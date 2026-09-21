import { equal } from 'node:assert/strict'
import * as Area from '../js/Area.mjs'
import * as Cmd from '../js/cmd.mjs'
import * as DirCommon from '../js/dir-common.mjs'
import * as DirOps from '../js/dir-ops.mjs'
import * as Hist from '../js/hist.mjs'
import * as Loc from '../js/loc.mjs'
import * as Prompt from '../js/prompt.mjs'
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
(p, names, type) {
  let marked

  marked = DirCommon.getMarked(p.buf)
  names.forEach(name => marked.add(name, type || 'f'))
}

// make the cursor appear over the given entry
function selectEntry
(entry, name) {
  globalThis.document.elementFromPoint = () => ({ dataset: { path: entry, name, type: 'd' } })
}

// record tron calls; opts.dirs exist as dirs, opts.nonEmpty fail non-recursive rm
function mockTron
(opts) {
  let calls

  calls = []
  globalThis.tron = { cmd: async (name, args) => {
                        let ch

                        ch = 'mock-' + calls.length
                        calls.push({ ch, name, args })
                        return ch
                      },
                      receive: (ch, cb) => {
                                 let call

                                 call = calls.find(c => c.ch == ch)
                                 if (call.name == 'file.stat')
                                   if (opts.dirs?.includes(call.args))
                                     cb({ err: 0, data: { mode: 0o040000 } })
                                   else
                                     cb({ err: { code: 'ENOENT', message: 'missing' } })
                                 else if (call.name == 'dir.rm') {
                                   let spec

                                   spec = call.args[1]
                                   if (opts.nonEmpty?.includes(call.args[0])
                                       && (spec?.recurse == undefined))
                                     cb({ err: { code: 'ENOTEMPTY', message: 'Directory not empty' } })
                                   else
                                     cb({ err: 0 })
                                 }
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

// bred.mjs registers this; tests don't load it
Cmd.add('close demand', () => Prompt.close())

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

test('expandTilde', 'expands ~ and ~/ only',
     () => {
       let saved

       saved = Loc.home()
       try {
         Loc.homeSet('/home/matt')
         equal(DirCommon.expandTilde('~'), '/home/matt/')
         equal(DirCommon.expandTilde('~/'), '/home/matt/')
         equal(DirCommon.expandTilde('~/x'), '/home/matt/x')
       }
       finally {
         Loc.homeSet(saved)
       }
       equal(DirCommon.expandTilde('~user'), '~user')
       equal(DirCommon.expandTilde('a/b'), 'a/b')
     })

test('abs', 'expands a leading tilde',
     () => {
       let saved

       saved = Loc.home()
       try {
         Loc.homeSet('/home/matt')
         equal(DirCommon.abs('~/', '/here'), '/home/matt/')
         equal(DirCommon.abs('~/x', '/here'), '/home/matt/x')
       }
       finally {
         Loc.homeSet(saved)
       }
       equal(DirCommon.abs('x', '/here'), '/here/x')
       equal(DirCommon.abs('/abs', '/here'), '/abs')
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

test('link', 'prompt records the entered name in the dir history',
     async () => {
       let calls, hist, pA, pB, panes

       panes = setupPanes()
       pA = panes.pA
       pB = panes.pB

       pinBuf(pA, fakeDirBuf('/other/dir'), '/other/dir')
       pinBuf(pB, fakeDirBuf('/here'), '/here')
       hist = Hist.make('pane-dir-ops')
       pB.buf.vars('dir').hist = hist
       selectEntry('/here/mydir/')
       calls = mockTron({})

       DirOps.link()
       submit('mylink')
       await wait(30)

       equal(hist.nth(0), 'mylink')
       equal(calls.some(c => (c.name == 'file.ln')
                             && (c.args[0] == '/here/mydir/')
                             && (c.args[1] == 'mylink')), true)
     })

test('link', 'expands a tilde destination',
     async () => {
       let calls, hist, pA, pB, panes, saved

       saved = Loc.home()
       panes = setupPanes()
       pA = panes.pA
       pB = panes.pB

       pinBuf(pA, fakeDirBuf('/other/dir'), '/other/dir')
       pinBuf(pB, fakeDirBuf('/here'), '/here')
       hist = Hist.make('pane-dir-ops')
       pB.buf.vars('dir').hist = hist
       selectEntry('/here/mydir/')
       calls = mockTron({})

       try {
         Loc.homeSet('/home/matt')
         DirOps.link()
         submit('~/')
         await wait(30)

         equal(hist.nth(0), '~/', 'history keeps the raw input')
         equal(calls.some(c => (c.name == 'file.ln')
                               && (c.args[0] == '/here/mydir/')
                               && (c.args[1] == '/home/matt/')), true)
       }
       finally {
         Loc.homeSet(saved)
       }
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
  calls = mockTron({ dirs: dirPaths })
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

// set up marked entries in the current pane; opts = { files, dirs, nonEmpty }
function setupMarked
(opts) {
  let calls, pA, pB, panes

  panes = setupPanes()
  pA = panes.pA
  pB = panes.pB

  pinBuf(pA, fakeDirBuf('/other/dir'), '/other/dir')
  pinBuf(pB, fakeDirBuf('/here'), '/here')
  pB.buf.vars('dir').hist = Hist.make('pane-dir-ops')
  mark(pB, opts.files || [])
  mark(pB, opts.dirs || [], 'd')
  calls = mockTron({ nonEmpty: opts.nonEmpty })
  return { calls, pB }
}

test('chmod', 'targets the entry under point, not the topmost',
     async () => {
       let calls, decoy, doc, op

       op = setupOneDir([])
       calls = op.calls

       // a top row that a querySelector-based lookup would wrongly pick
       doc = op.pB.view.ele.ownerDocument
       decoy = doc.createElement('div')
       decoy.className = 'dir-name'
       decoy.setAttribute('data-path', '/here/aaa')
       decoy.setAttribute('data-name', 'aaa')
       op.pB.view.ele.appendChild(decoy)
       selectEntry('/here/mydir/', 'mydir')

       DirOps.chmod()
       submit('755')
       await wait(30)

       equal(calls.some(c => (c.name == 'file.chmod')
                             && (c.args[0] == '755')
                             && (c.args[1] == '/here/mydir')), true)
       equal(calls.some(c => (c.name == 'file.chmod')
                             && (c.args[1] == '/here/aaa')), false)
     })

test('chmod', 'marked entries each get chmodded',
     async () => {
       let calls, op

       op = setupMarked({ files: [ 'a.txt', 'b.txt' ] })
       calls = op.calls

       DirOps.chmod()
       submit('644')
       await wait(30)

       equal(calls.some(c => (c.name == 'file.chmod') && (c.args[1] == '/here/a.txt')), true)
       equal(calls.some(c => (c.name == 'file.chmod') && (c.args[1] == '/here/b.txt')), true)
     })

function recursed
(calls) {
  return calls.filter(c => (c.name == 'dir.rm') && (c.args[1]?.recurse == 1))
}

test('delete', 'marked non-empty dirs ask to recurse',
     async () => {
       let calls, op

       op = setupMarked({ dirs: [ 'd1', 'd2' ],
                          nonEmpty: [ '/here/d1', '/here/d2' ] })
       calls = op.calls

       DirOps.del()
       Cmd.run('yes')
       await wait(30)

       equal(recursed(calls).length, 0)

       Cmd.run('yes')
       await wait(30)

       equal(recursed(calls).length, 2)
       equal(DirCommon.getMarked(op.pB.buf).length, 0)
     })

test('delete', 'only non-empty dirs get recursed',
     async () => {
       let calls, op

       op = setupMarked({ files: [ 'f.txt' ],
                          dirs: [ 'd1', 'd2' ],
                          nonEmpty: [ '/here/d2' ] })
       calls = op.calls

       DirOps.del()
       Cmd.run('yes')
       await wait(30)

       Cmd.run('yes')
       await wait(30)

       equal(calls.some(c => (c.name == 'file.rm') && (c.args[0] == '/here/f.txt')), true)
       equal(recursed(calls).length, 1)
       equal(recursed(calls)[0].args[0], '/here/d2')
       equal(DirCommon.getMarked(op.pB.buf).length, 0)
     })

test('delete', 'declining recursion keeps non-empty dirs marked',
     async () => {
       let calls, op

       op = setupMarked({ dirs: [ 'd1', 'd2' ],
                          nonEmpty: [ '/here/d2' ] })
       calls = op.calls

       DirOps.del()
       Cmd.run('yes')
       await wait(30)

       Cmd.run('no')
       await wait(30)

       equal(recursed(calls).length, 0)
       equal(DirCommon.getMarked(op.pB.buf).has('d2')?.name, 'd2')
       equal(DirCommon.getMarked(op.pB.buf).has('d1'), undefined)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
