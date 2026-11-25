import { equal } from 'node:assert/strict'
import Fs from 'node:fs'

import * as Conf from '../bin/oc-conformance.mjs'
import * as Ev from '../ext/code/event.mjs'

let tests, fixture, live

tests = {}
fixture = Conf.readEvents(Fs.readFileSync(new URL('./fixtures/oc-events/minimal.jsonl',
                                                  import.meta.url),
                                          'utf8'))
live = Conf.readEvents(Fs.readFileSync(new URL('./fixtures/oc-events/live.jsonl',
                                               import.meta.url),
                                       'utf8'))

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

// The real translate() over one buffer's state, so text.delta finds the part
// id text.started set and the tool events keep their name.
function translator
() {
  let buf, state

  state = {}
  buf = { vars: () => state }
  return ev => Ev.translate(buf, ev)
}

function boom
() {
  throw new Error('boom')
}

test('measure', 'the minimal fixture translates every input',
     () => {
       let record

       record = Conf.classify(fixture, translator())
       equal(record.total, 11)
       equal(record.translated, 11)
       equal(record.dropped, 0)
       equal(record.malformed, 0)
       equal(record.types[ 'session.execution.started' ].translated, 1)
       equal(record.types[ 'session.step.started' ].translated, 1)
       equal(record.types[ 'session.text.started' ].translated, 1)
       equal(record.types[ 'session.text.delta' ].translated, 1)
       equal(record.types[ 'session.tool.called' ].translated, 1)
       equal(record.types[ 'session.tool.success' ].translated, 1)
       equal(record.types[ 'session.idle' ].translated, 1)
       equal(record.types[ 'session.text.ended' ].translated, 1)
       equal(record.types[ 'session.reasoning.ended' ].translated, 1)
       equal(record.types[ 'session.retry.scheduled' ].translated, 1)
     })

test('measure', 'the fixture covers every event the measure must see',
     () => {
       let wanted

       wanted = [ 'session.execution.started',
                  'session.step.started',
                  'session.text.started',
                  'session.text.delta',
                  'session.text.ended',
                  'session.reasoning.ended',
                  'session.tool.called',
                  'session.tool.success',
                  'session.idle',
                  'session.retry.scheduled' ]
       wanted.forEach(name => equal(fixture.some(ev => ev.type == name), true, name))
     })

test('measure', 'a sanitized live recording classifies from the recorder shape',
     () => {
       let record

       record = Conf.classify(live, translator())
       equal(record.total, 9)
       equal(record.translated, 8)
       equal(record.dropped, 1)
       equal(record.malformed, 0)
       equal(record.types[ 'session.step.streamed' ].dropped, 1)
     })

test('measure', 'a legacy event without properties is malformed',
     () => {
       let record

       record = Conf.classify(fixture, () => [ { type: 'message.part.updated' } ])
       equal(record.malformed, 11)
       equal(record.translated, 0)
     })

test('measure', 'a translator that throws or returns a non-array is malformed',
     () => {
       let bad

       bad = Conf.classify(fixture, () => 'not an array')
       equal(bad.malformed, 11)
       bad = Conf.classify(fixture, boom)
       equal(bad.malformed, 11)
     })

test('measure', 'format prints the totals and a line per input type',
     () => {
       let lines

       lines = Conf.format(Conf.classify(fixture, translator())).split('\n')
       equal(lines[ 0 ], 'total 11  translated 11  dropped 0  malformed 0')
       equal(lines.some(line => line.startsWith('session.tool.success  total 1')), true)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
