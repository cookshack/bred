import { equal } from 'node:assert/strict'
import * as Area from '../js/Area.mjs'
import * as DirCommon from '../js/dir-common.mjs'
import * as DirOps from '../js/dir-ops.mjs'
import * as Hist from '../js/hist.mjs'
import * as Win from '../js/win.mjs'
import { setupPanes, wait } from './pane-helpers.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

// a minimal dir-only buf, enough for dir-ops
function fakeDirBuf
(path) {
  let vars

  vars = {}
  return { mode: { key: 'dir' },
           path,
           views: [],
           vars: key => {
             vars[key] = vars[key] || {}
             return vars[key]
           } }
}

function pinBuf
(p, buf, dir) {
  Object.defineProperty(p, 'buf', { value: buf, configurable: 1 })
  Object.defineProperty(p, 'dir', { value: dir, configurable: 1 })
}

function promptBuf
() {
  return Area.getByName(Win.current(), 'bred-float')?.tab?.frame?.pane?.buf
}

function mark
(p, names) {
  let marked

  marked = DirCommon.getMarked(p.buf)
  names.forEach(name => marked.add(name, 'f'))
}

// make the cursor appear over the given entry
function selectEntry
(entry) {
  globalThis.document.elementFromPoint = () => ({ dataset: { path: entry, type: 'd' } })
}

// record tron calls; dirPaths are the paths that exist as dirs
function mockTron
(dirPaths) {
  let calls

  calls = []
  globalThis.tron = { cmd: async (name, args) => {
                        calls.push({ name, args })
                        return 'mock-' + name
                      },
                      receive: (ch, cb) => {
                                 let call

                                 call = calls.at(-1)
                                 if (call.name == 'file.stat')
                                   if (dirPaths.includes(call.args))
                                     cb({ err: 0, data: { mode: 0o040000 } })
                                   else
                                     cb({ err: { code: 'ENOENT', message: 'missing' } })
                                 else
                                   cb({ err: 0 })
                               },
                      acmd: async name => {
                              if (name == 'peer.get')
                                return { fresh: 1, text: '', version: 0 }
                              return {}
                            },
                      send: () => {},
                      on: () => () => {} }
  return calls
}

// submit the copy/rename prompt, defaulting to its placeholder
function submit
(name) {
  let buf

  buf = promptBuf()
  buf.vars('prompt').run(name == undefined ? buf.placeholder : name)
}

tests = {}

test('nextDir', 'uses the dir shown in the next pane',
     () => {
       equal(DirCommon.nextDir({ next: { buf: fakeDirBuf('/other/dir') } }),
             '/other/dir/')
     })

test('nextDir', 'keeps a trailing slash',
     () => {
       equal(DirCommon.nextDir({ next: { buf: fakeDirBuf('/other/dir/') } }),
             '/other/dir/')
     })

test('nextDir', 'missing when there is no next pane',
     () => {
       equal(DirCommon.nextDir({ next: 0 }), undefined)
     })

test('nextDir', 'missing when the next pane is a file',
     () => {
       equal(DirCommon.nextDir({ next: { buf: { mode: { key: 'ed' } } } }),
             undefined)
     })

test('baseName', 'dir path without a trailing slash',
     () => {
       equal(DirCommon.baseName('/a/mydir'), 'mydir')
     })

test('baseName', 'dir path with a trailing slash',
     () => {
       equal(DirCommon.baseName('/a/mydir/'), 'mydir')
     })

test('baseName', 'file path',
     () => {
       equal(DirCommon.baseName('/a/f.txt'), 'f.txt')
     })

test('copy', 'marked files offer the next pane dir',
     () => {
       let pA, pB, panes

       panes = setupPanes()
       pA = panes.pA
       pB = panes.pB

       pinBuf(pA, fakeDirBuf('/other/dir'), '/other/dir')
       pinBuf(pB, fakeDirBuf('/here'), '/here')
       mark(pB, [ 'a.txt', 'b.txt' ])

       DirOps.copy()

       equal(promptBuf()?.placeholder, '/other/dir/')
     })

test('rename', 'marked files offer the next pane dir',
     () => {
       let pA, pB, panes

       panes = setupPanes()
       pA = panes.pA
       pB = panes.pB

       pinBuf(pA, fakeDirBuf('/other/dir'), '/other/dir')
       pinBuf(pB, fakeDirBuf('/here'), '/here')
       mark(pB, [ 'a.txt', 'b.txt' ])

       DirOps.rename()

       equal(promptBuf()?.placeholder, '/other/dir/')
     })

test('copy', 'marked files fall back to destination history',
     () => {
       let hist, pA, pB, panes

       panes = setupPanes()
       pA = panes.pA
       pB = panes.pB

       pinBuf(pA, { mode: { key: 'ed' }, views: [] }, '/tmp')
       pinBuf(pB, fakeDirBuf('/here'), '/here')
       hist = Hist.make('dir-ops-test')
       hist.add('/last/dest/')
       pB.buf.vars('dir').hist = hist
       mark(pB, [ 'a.txt', 'b.txt' ])

       DirOps.copy()

       equal(promptBuf()?.placeholder, '/last/dest/')
     })

// set up an unmarked copy/rename of /here/mydir in the current pane
function setupOneDir
(dirPaths) {
  let calls, pA, pB, panes

  panes = setupPanes()
  pA = panes.pA
  pB = panes.pB

  pinBuf(pA, fakeDirBuf('/other/dir'), '/other/dir')
  pinBuf(pB, fakeDirBuf('/here'), '/here')
  pB.buf.vars('dir').hist = Hist.make('pane-dir-ops')
  selectEntry('/here/mydir/')
  calls = mockTron(dirPaths)
  return { calls, pA, pB }
}

test('copy', 'unmarked dir copies into the next pane dir',
     async () => {
       let calls, op

       op = setupOneDir([ '/other/dir/' ])
       calls = op.calls

       DirOps.copy()
       equal(promptBuf()?.placeholder, '/other/dir/')

       submit()
       await wait(30)

       equal(calls.some(c => (c.name == 'file.cp')
                             && (c.args[0] == '/here/mydir/')
                             && (c.args[1] == '/other/dir/mydir')), true)
     })

test('copy', 'unmarked dir takes a full path as the new name',
     async () => {
       let calls, op

       op = setupOneDir([])
       calls = op.calls

       DirOps.copy()
       submit('/other/newname')
       await wait(30)

       equal(calls.some(c => (c.name == 'file.cp')
                             && (c.args[0] == '/here/mydir/')
                             && (c.args[1] == '/other/newname')), true)
     })

test('copy', 'unmarked dir refuses an existing dir target',
     async () => {
       let calls, op

       op = setupOneDir([ '/other/dir/', '/other/dir/mydir' ])
       calls = op.calls

       DirOps.copy()
       submit()
       await wait(30)

       equal(calls.some(c => c.name == 'file.cp'), false)
     })

test('rename', 'unmarked dir moves into the next pane dir',
     async () => {
       let calls, mv, op

       op = setupOneDir([ '/other/dir/' ])
       calls = op.calls

       DirOps.rename()
       submit()
       await wait(30)

       mv = calls.find(c => c.name == 'file.mv')
       equal(mv?.args[0], '/here/mydir/')
       equal(mv?.args[1], '/other/dir/mydir')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
