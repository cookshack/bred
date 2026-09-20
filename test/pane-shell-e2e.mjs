import { equal } from 'node:assert/strict'
import * as Css from '../js/css.mjs'
import * as Pty from 'node-pty'
import * as Shell from '../js/shell.mjs'
import * as ShellRun from '../js/shell-run.mjs'
import { setupPanes, waitFor } from './pane-helpers.mjs'

let bridges, tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function run
(sc, spec) {
  spec = { end: 1, ...spec }
  return new Promise(res => Shell.shell1(sc, spec, buf => res(buf)))
}

function text
(buf) {
  return buf.views[0].ed.state.doc.toString()
}

function busy
(buf) {
  let el

  el = buf.views[0].ele.querySelector('.shell-exit-w')
  return Css.has(el, 'shell-busy') ? 1 : 0
}

// wire the renderer tron API to the real main-side run() in-process
function bridge
() {
  let chans, ipc, sender

  chans = {}
  bridges.push(chans)
  sender = { send: (ch, data) => {
                      setImmediate(() => {
                                     if (chans[ch])
                                       chans[ch](data)
                                   })
                    } }
  ipc = { cbs: {},
          on: (ch, cb) => {
                ipc.cbs[ch] = cb
              },
          removeListener: ch => {
                            delete ipc.cbs[ch]
                          } }

  globalThis.tron = { cmd: async (name, args) => {
                        if (name == 'shell.run') {
                          let ch

                          ch = args[0]
                          ShellRun.run({ pty: Pty, ipcMain: ipc, appPath: process.cwd() },
                                       { sender },
                                       ch, args[1], args[2], args[3], args[4], { shell: '/bin/bash' })
                          return ch
                        }
                        return { err: 0, ch: 0 }
                      },
                      receive: (ch, cb) => cb({ err: 0 }),
                      acmd: async name => {
                              if (name == 'peer.get')
                                return { fresh: 1, text: '', version: 0 }
                              return {}
                            },
                      send: (ch, data) => {
                              // renderer to main
                              if (ipc.cbs[ch])
                                ipc.cbs[ch]({ sender }, data)
                            },
                      on: (ch, cb) => {
                            chans[ch] = cb
                            return () => {
                                     delete chans[ch]
                                   }
                          } }

  return { chans, ipc }
}

bridges = []
tests = {}

// late events from a still-exiting process must not reach a later test
globalThis.afterEach(() => {
                       bridges.forEach(chans => {
                                         Object.keys(chans).forEach(ch => delete chans[ch])
                                       })
                     })

test('e2e', 'echo close clears busy',
     async () => {
       let buf

       setupPanes()
       bridge()
       buf = await run('echo hi')

       await waitFor(() => busy(buf) == 0, 3000)
       equal(text(buf).includes('hi'), true)
       equal(buf.vars('shell').code, 0)
     })

test('e2e', 'large output is complete',
     async () => {
       let buf

       setupPanes()
       bridge()
       buf = await run('seq 1 100000')

       await waitFor(() => busy(buf) == 0, 10000)
       equal(text(buf).includes('99999'), true)
     })

test('e2e', 'concurrent runs keep output separate',
     async () => {
       let b1, b2, panes

       panes = setupPanes()
       bridge()
       panes.pB.focus()
       b1 = await run('echo one')
       panes.pA.focus()
       b2 = await run('echo two')

       await waitFor(() => (busy(b1) == 0) && (busy(b2) == 0), 3000)
       equal(text(b1).includes('one'), true)
       equal(text(b2).includes('two'), true)
       equal(text(b1).includes('two'), false)
       equal(text(b2).includes('one'), false)
     })

test('e2e', 'repeated reruns always close',
     async () => {
       let i, state

       setupPanes()
       state = bridge()
       for (i = 0; i < 8; i++) {
         let buf, ch

         buf = await run('echo same')
         ch = buf.vars('Shell').ch
         await waitFor(() => busy(buf) == 0, 3000)
         equal(buf.vars('shell').code, 0)
         equal(state.chans[ch], undefined)
       }
     })

test('e2e', 'removing a running buf sends exit to the current channel',
     async () => {
       let buf, ch, exits, orig, state

       setupPanes()
       state = bridge()
       buf = await run('sleep 30')
       ch = buf.vars('Shell').ch
       exits = 0
       orig = state.ipc.cbs[ch]
       state.ipc.cbs[ch] = (ev, data) => {
                             if (data.exit)
                               exits++
                             return orig(ev, data)
                           }

       buf.remove()

       await waitFor(() => exits == 1, 2000)
       equal(exits, 1)
     })

function mochaIt
(cb) {
  return function
         () {
           this.timeout(15000)
           return cb()
         }
}

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     mochaIt(t.cb)))))
