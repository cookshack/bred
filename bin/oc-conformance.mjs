#!/usr/bin/env node

// A measure for ext/code's v2 -> legacy event translation: run recorded v2
// events through the real translate() and count, per input type, whether it
// became one or more legacy events, was dropped, or came out malformed. The
// per-type rows are the first queue items for the area: a dropped type is an
// event the code UI never sees.
//
//   bin/oc-conformance.mjs test/fixtures/oc-events/minimal.jsonl
//   bin/oc-conformance.mjs recording.jsonl --json
//
// The recorder that writes those files is bin/oc-record.mjs. The JSONL may
// hold full v2 envelopes or the recorder's { ts, type, data } lines, because
// translate() only reads type, data, created and location.

import Fs from 'node:fs'
import { pathToFileURL } from 'node:url'

import * as Ev from '../ext/code/event.mjs'

// One legacy event is consumable when it has a type and a properties object.
// Anything else is a shape the handlers cannot use.
export
function valid
(le) {
  if (le == null)
    return 0
  if (le.properties == null)
    return 0
  if ((typeof le.type == 'string') && (le.type.length > 0) && (typeof le.properties == 'object'))
    return 1
  return 0
}

export
function empty
() {
  return { total: 0, translated: 0, dropped: 0, malformed: 0, types: {} }
}

// classify(events, translate) walks the inputs in order. The translator is a
// stateful closure over one buffer's code state, so the text part ids and the
// tool names it remembers across events are the real ones.
export
function classify
(events, translate) {
  let record, i

  record = empty()

  for (i = 0; i < events.length; i++) {
    let ev, name, row, status

    ev = events[ i ]
    if (ev == null)
      name = '(no type)'
    else if (typeof ev.type == 'string')
      name = ev.type
    else
      name = '(no type)'
    row = record.types[ name ]
    if (row == undefined) {
      row = { total: 0, translated: 0, dropped: 0, malformed: 0 }
      record.types[ name ] = row
    }
    record.total += 1
    row.total += 1
    try {
      let out

      out = translate(ev)
      if (Array.isArray(out) == 0)
        status = 'malformed'
      else if (out.length == 0)
        status = 'dropped'
      else
        status = 'translated'
      if (status == 'translated')
        for (let j = 0; j < out.length; j++)
          if (valid(out[ j ]) == 0)
            status = 'malformed'
    }
    catch {
      status = 'malformed'
    }
    record[ status ] += 1
    row[ status ] += 1
  }

  return record
}

export
function merge
(into, from) {
  Object.keys(from.types).forEach(name => {
                                    let row

                                    row = into.types[ name ]
                                    if (row == undefined) {
                                      row = { total: 0, translated: 0, dropped: 0, malformed: 0 }
                                      into.types[ name ] = row
                                    }
                                    row.total += from.types[ name ].total
                                    row.translated += from.types[ name ].translated
                                    row.dropped += from.types[ name ].dropped
                                    row.malformed += from.types[ name ].malformed
                                  })
  into.total += from.total
  into.translated += from.translated
  into.dropped += from.dropped
  into.malformed += from.malformed
  return into
}

export
function format
(record) {
  let lines

  lines = [ 'total ' + record.total +
            '  translated ' + record.translated +
            '  dropped ' + record.dropped +
            '  malformed ' + record.malformed ]
  Object.keys(record.types).sort().forEach(name => {
                                             let row

                                             row = record.types[ name ]
                                             lines.push(name +
                                                       '  total ' + row.total +
                                                       '  translated ' + row.translated +
                                                       '  dropped ' + row.dropped +
                                                       '  malformed ' + row.malformed)
                                           })
  return lines.join('\n')
}

export
function readEvents
(text) {
  let lines, out, i

  lines = text.split('\n')
  out = []
  for (i = 0; i < lines.length; i++)
    if (lines[ i ].trim().length > 0)
      try {
        out.push(JSON.parse(lines[ i ]))
      }
      catch (err) {
        throw new Error('line ' + (i + 1) + ': ' + err.message)
      }
  return out
}

// The CLI's translator: one buffer state per recording, so the fixture's
// text.delta finds the part id that its text.started set.
export
function makeTranslator
() {
  let buf, state

  state = {}
  buf = { vars: () => state }
  return ev => Ev.translate(buf, ev)
}

function usage
() {
  console.error('usage: bin/oc-conformance.mjs FILE... [--json]')
  return 2
}

export
function cli
(argv) {
  let files, json, record, i

  json = argv.includes('--json')
  files = argv.filter(a => a.startsWith('--') == 0)
  if (files.length == 0)
    return usage()

  record = empty()
  try {
    for (i = 0; i < files.length; i++)
      merge(record, classify(readEvents(Fs.readFileSync(files[ i ], 'utf8')), makeTranslator()))
  }
  catch (err) {
    console.error('oc-conformance: ' + err.message)
    return 2
  }

  if (json)
    console.log(JSON.stringify(record, null, 2))
  else
    console.log(format(record))
  return record.malformed > 0 ? 1 : 0
}

if (process.argv[ 1 ] && (pathToFileURL(process.argv[ 1 ]).href == import.meta.url))
  process.exit(await cli(process.argv.slice(2)))
