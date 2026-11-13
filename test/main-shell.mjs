import { equal } from 'node:assert/strict'
import * as Pty from 'node-pty'
import * as ShellRun from '../js/main-shell-run.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function fakeIpc
() {
  let listeners

  listeners = []
  return { listeners,
           on: (ch, cb) => listeners.push({ ch, cb }),
           removeListener: (ch, cb) => {
                             let i

                             i = listeners.findIndex(l => (l.ch == ch) && (l.cb == cb))
                             if (i >= 0)
                               listeners.splice(i, 1)
                           } }
}

function start
(sc, args, spec, opts) { // opts: { appPath, shell }
  let e, events, ipc

  events = []
  ipc = fakeIpc()
  e = { sender: { send: (ch, data) => events.push({ ch, data }) } }
  ShellRun.run({ pty: Pty,
                 ipcMain: ipc,
                 appPath: opts?.appPath ?? '/tmp/bred' },
               e, 'testCh', '/tmp', sc, args || [], spec || {},
               { shell: opts?.shell ?? '/bin/sh' })
  return { e, events, ipc }
}

function waitFor
(cb, ms) {
  return new Promise((res, rej) => {
                       let i

                       function tick
                       () {
                         if (cb())
                           res()
                         else if (++i > (ms || 3000) / 10)
                           rej(new Error('waitFor: timeout'))
                         else
                           setTimeout(tick, 10)
                       }

                       i = 0
                       tick()
                     })
}

function stdout
(run) {
  return run.events.filter(ev => ev.data.stdout).map(ev => ev.data.stdout).join('')
}

function closed
(run) {
  return run.events.some(ev => ev.data.close)
}

tests = {}

test('run', 'echo then close, close last',
     async () => {
       let run

       run = start('/bin/sh', [ '-c', 'echo hi' ])
       await waitFor(() => closed(run))
       equal(stdout(run).includes('hi'), true)
       equal(run.events.at(-1).data.close, 1)
       equal(run.events.at(-1).data.code, 0)
     })

test('run', 'large output is not truncated',
     async () => {
       let out, run

       run = start('/bin/sh', [ '-c', 'seq 1 200000' ])
       await waitFor(() => closed(run), 10000)
       out = stdout(run)
       equal(out.includes('199999'), true)
       equal(run.events.at(-1).data.close, 1)
     })

test('run', 'no trailing newline, stderr merged into pty',
     async () => {
       let run

       run = start('/bin/sh', [ '-c', 'printf x; printf err 1>&2' ])
       await waitFor(() => closed(run))
       equal(stdout(run), 'xerr')
     })

test('run', 'input is written to the process',
     async () => {
       let l, run

       run = start('/bin/cat', [])
       equal(run.ipc.listeners.length, 1)
       l = run.ipc.listeners[0].cb

       l(run.e, { input: 'hello\n' })
       await waitFor(() => stdout(run).includes('hello'))

       l(run.e, { exit: 1 })
       await waitFor(() => closed(run))
     })

test('run', 'input from another sender is ignored',
     async () => {
       let l, run

       run = start('/bin/cat', [])
       l = run.ipc.listeners[0].cb

       l({ sender: {} }, { input: 'nope\n' })
       l(run.e, { input: 'yep\n' })
       await waitFor(() => stdout(run).includes('yep'))
       equal(stdout(run).includes('nope'), false)

       l(run.e, { exit: 1 })
       await waitFor(() => closed(run))
     })

test('run', 'exit input interrupts the process',
     async () => {
       let l, run

       run = start('/bin/sleep', [ '30' ])
       l = run.ipc.listeners[0].cb

       l(run.e, { exit: 1 })
       await waitFor(() => closed(run), 3000)
       equal(run.events.at(-1).data.close, 1)
     })

test('run', 'listener is removed when the process exits',
     async () => {
       let run

       run = start('/bin/sh', [ '-c', 'echo hi' ])
       equal(run.ipc.listeners.length, 1)
       await waitFor(() => closed(run))
       equal(run.ipc.listeners.length, 0)
     })

test('run', 'background child does not block close',
     async () => {
       let run

       run = start('/bin/sh', [ '-c', 'sleep 2 & echo hi' ])
       await waitFor(() => closed(run), 1500)
       equal(stdout(run).includes('hi'), true)
     })

// A single run gets its command from bash's -c, not typed in, so nothing at
// the end of the command line can swallow the exit.
function startInShell
(sc) {
  return start(sc, [], { runInShell: 1 },
               { shell: '/bin/bash', appPath: process.cwd() })
}

test('runInShell', 'a comment-only command closes instead of hanging',
     async () => {
       let run

       run = startInShell('# anything')
       await waitFor(() => closed(run))
       equal(run.events.at(-1).data.code, 0)
     })

test('runInShell', 'a trailing comment does not swallow the exit',
     async () => {
       let run

       run = startInShell('echo hi # note')
       await waitFor(() => closed(run))
       equal(stdout(run).includes('hi'), true)
       equal(run.events.at(-1).data.code, 0)
     })

test('runInShell', 'the close code is the command status',
     async () => {
       let run

       run = startInShell('false')
       await waitFor(() => closed(run))
       equal(run.events.at(-1).data.code, 1)
     })

test('runInShell', 'unterminated input closes with a syntax error',
     async () => {
       let run

       run = startInShell('echo "abc')
       await waitFor(() => closed(run))
       equal(run.events.at(-1).data.code, 2)
     })

function mochaIt
(cb) {
  return function
         () {
           this.timeout(10000)
           return cb()
         }
}

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     mochaIt(t.cb)))))
