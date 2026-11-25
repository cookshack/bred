#!/usr/bin/env node

// Record a live opencode v2 event stream to JSONL, one line per event:
//
//   { "ts": ..., "type": ..., "data": ... }
//
// The server's shared stream also carries other sessions' events, so the
// recorder keeps the ones for the session it creates plus the session-less
// events (server.connected and friends). It stops on that session's idle or
// the timeout, whichever comes first.
//
//   bin/oc-record.mjs --out /tmp/oc-events.jsonl
//   bin/oc-record.mjs --out rec.jsonl --url http://127.0.0.1:4096 \
//                     --prompt 'Say ok.' --timeout 60
//
// Auth comes from OPENCODE_PASSWORD, encoded the way js/main-code-server.mjs
// does it (Basic with the user "opencode"). The recorder writes only FILE.

import Fs from 'node:fs'
import Os from 'node:os'
import { pathToFileURL } from 'node:url'

import { OpenCode } from '../ext/code/lib/opencode/promise/index.js'

function authHeaders
() {
  let password

  password = process.env.OPENCODE_PASSWORD || ''
  if (password.length == 0)
    return undefined
  return { authorization: 'Basic ' + Buffer.from('opencode:' + password).toString('base64') }
}

function parseArgs
(argv) {
  let spec, i

  spec = { file: undefined,
           url: process.env.OPENCODE_URL || 'http://127.0.0.1:4096',
           prompt: 'Reply with the single word ok.',
           timeout: 120 }

  for (i = 0; i < argv.length; i++) {
    if (argv[ i ] == '--out')
      spec.file = argv[ i + 1 ]
    else if (argv[ i ] == '--url')
      spec.url = argv[ i + 1 ]
    else if (argv[ i ] == '--prompt')
      spec.prompt = argv[ i + 1 ]
    else if (argv[ i ] == '--timeout')
      spec.timeout = Number(argv[ i + 1 ]) || 120
    else
      return 0
    i += 1
  }

  return spec
}

// Keep the session's own events and the ones that carry no session. A busy
// shared server then does not fill the recording with someone else's turn.
function wanted
(ev, sessionID) {
  if (ev.data?.sessionID == undefined)
    return 1
  return ev.data.sessionID == sessionID ? 1 : 0
}

// session.idle is deprecated and current servers end a turn with
// session.execution.succeeded (or interrupted/failed). Those are the events
// translate() maps to a legacy idle status, so any of them is the stop.
function finished
(ev, sessionID) {
  if (ev.data?.sessionID == undefined)
    return 0
  if (ev.data.sessionID == sessionID)
    return [ 'session.idle',
             'session.execution.succeeded',
             'session.execution.interrupted',
             'session.execution.failed' ].includes(ev.type) ? 1 : 0
  return 0
}

async function record
(spec) {
  let client, session, controller, timer, count, timedOut

  client = OpenCode.make({ baseUrl: spec.url, headers: authHeaders() })

  try {
    await client.server.info()
  }
  catch (err) {
    console.error('no server at ' + spec.url + ': ' + err.message)
    return { code: 2, count: 0 }
  }

  session = await client.session.create({ location: { directory: Os.tmpdir() },
                                          title: 'oc-record' })
  controller = new AbortController()
  timer = setTimeout(() => {
                       timedOut = 1
                       controller.abort()
                     }, spec.timeout * 1000)
  count = 0
  timedOut = 0

  try {
    let iter

    // Subscribe before the prompt, so no event from the turn is missed.
    iter = client.event.subscribe({ signal: controller.signal })[Symbol.asyncIterator]()
    await client.session.prompt({ sessionID: session.id, text: spec.prompt })

    while (1) {
      let result

      result = await iter.next()
      if (result.done)
        break
      if (wanted(result.value, session.id) == 0)
        continue
      Fs.appendFileSync(spec.file,
                        JSON.stringify({ ts: Date.now(),
                                         type: result.value.type,
                                         data: result.value.data }) + '\n')
      count += 1
      if (finished(result.value, session.id) == 1)
        break
    }
  }
  catch (err) {
    if (err.name == 'AbortError')
      timedOut = 1
    else
      throw err
  }
  finally {
    clearTimeout(timer)
  }

  return { code: 0, count, timedOut }
}

export
async function cli
(argv) {
  let spec, res

  spec = parseArgs(argv)
  if ((spec == 0) || (spec.file == undefined)) {
    console.error('usage: bin/oc-record.mjs --out FILE [--url URL] [--prompt TEXT] [--timeout SEC]')
    return 2
  }

  try {
    res = await record(spec)
  }
  catch (err) {
    console.error('oc-record: ' + err.message)
    return 1
  }

  if (res.code == 0)
    console.log('wrote ' + res.count + ' events to ' + spec.file + (res.timedOut ? ' (timeout)' : ''))
  return res.code
}

if (process.argv[ 1 ] && (pathToFileURL(process.argv[ 1 ]).href == import.meta.url))
  process.exit(await cli(process.argv.slice(2)))
