import { equal } from 'node:assert/strict'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import * as Cmd from '../js/cmd.mjs'
import * as Ed from '../js/ed.mjs'
import * as Em from '../js/Em.mjs'
import Mk from '../js/mk.mjs'
import * as MainPeer from '../js/main-peer.mjs'
import * as Mode from '../js/mode.mjs'
import * as Opt from '../js/opt.mjs'
import * as Wode from '../js/wode.mjs'
import * as WodePeer from '../js/wode-peer.mjs'
import * as WodeView from '../js/wode-view.mjs'
import * as CMState from '../lib/@codemirror/state.js'
import * as CMView from '../lib/@codemirror/view.js'
import { setupDom } from './dom-help.mjs'

let buf, bufSeq, domWin, extraViews, fileGetArgs, fileGetErr, filePath, optsSet, readyView
let savedDocument, savedElement, savedHTMLDocument, savedOpt, savedTron, tests, tmp, view, watchCbs, _shared

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name,
                      cb: async () => {
                        setup()
                        try {
                          await cb()
                        }
                        finally {
                          view.ed?.destroy()
                          extraViews.forEach(v => v.ed?.destroy())
                          domWin?.happyDOM?.cancelAsync()
                          Fs.rmSync(tmp, { recursive: true, force: true })
                        }
                      } })
}

function emReady
() {
  try {
    return Em.get('Global') ? 1 : 0
  }
  catch {
    return 0
  }
}

function fakeE
() {
  return { sender: { send: () => {} } }
}

function makeEle
() {
  let edW, edWW, ele

  ele = globalThis.document.createElement('div')
  edWW = globalThis.document.createElement('div')
  edW = globalThis.document.createElement('div')
  edW.className = 'edW'
  edWW.appendChild(edW)
  ele.appendChild(edWW)
  return ele
}

function makeView
(vbuf) {
  let v

  v = { vid: 1,
        ready: 1,
        marks: [],
        ele: makeEle(),
        onChanges: Mk.array,
        onFocuss: Mk.array,
        onRemove: () => {},
        buf: vbuf }
  return v
}

function fireWatch
(data) {
  watchCbs.forEach((cb, ch) => {
                     if (typeof ch == 'string')
                       return
                     cb(data)
                   })
}

function fireChannel
(ch, data) {
  let cb

  cb = watchCbs.get(ch)
  if (cb)
    cb(data)
}

async function waitPeer
(id, text) {
  for (let i = 0; i < 100; i++) {
    if (MainPeer.onGet(fakeE(), [ id ]).text == text)
      return
    await new Promise(r => setTimeout(r, 20))
  }
  throw new Error('peer text did not reach ' + text)
}

async function waitDoc
(v, text) {
  for (let i = 0; i < 100; i++) {
    if (v.ed?.state.doc.toString() == text)
      return
    await new Promise(r => setTimeout(r, 20))
  }
  throw new Error('doc did not reach ' + text)
}

function setup
() {

  bufSeq = (bufSeq || 0) + 1
  tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'bred-e2e-'))
  filePath = Path.join(tmp, 'a.txt')
  Fs.writeFileSync(filePath, 'v1')
  fileGetArgs = 0
  fileGetErr = 0
  watchCbs = new Map()
  extraViews = []
  optsSet = []
  _shared.cut = { ring: [], buf: { views: [] } }
  globalThis.bred = { _shared: () => _shared }
  domWin = setupDom()

  globalThis.bredWin = { currentArea: { tabs: [ { el: { classList: { contains: () => 1 } },
                                                  elBar: { classList: { contains: () => 1 } },
                                                  frames: [ { el: { classList: { contains: () => 1 } },
                                                              panes: [ { w: { classList: { contains: () => 1 } },
                                                                         view: 0 } ] } ] } ] } }

  globalThis.document.dispatchEvent = (orig => ev => {
    try {
      orig(ev)
    }
    catch {
    }
  })(globalThis.document.dispatchEvent.bind(globalThis.document))

  globalThis.tron = { acmd: async (name, args) => {
                                if (name == 'peer.get')
                                  return MainPeer.onGet(fakeE(), args)
                                if (name == 'peer.push')
                                  return MainPeer.onPush({ sender: { send: (ch, data) => fireChannel(ch, data) } },
                                                         args)
                                return {}
                              },
                      cmd: async (name, args) => {
                             if (name == 'file.get') {
                               fileGetArgs = args
                               return 'file-get-ch'
                             }
                             if (name == 'file.watch')
                               return { err: 0, ch: 'watch-ch' }
                             if (name == 'peer.pull')
                               MainPeer.onPull({ sender: { send: (ch, data) => fireChannel(ch, data) } },
                                               'ch',
                                               args)
                             return { err: 0, ch: 0 }
                           },
                      receive: (ch, cb2) => {
                        if (ch == 'file-get-ch')
                          if (fileGetErr)
                            cb2({ err: { message: 'boom' } })
                          else
                            cb2({ err: 0, data: Fs.readFileSync(filePath, 'utf8'), stat: Fs.statSync(filePath), realpath: filePath })
                        else
                          cb2({ err: 0 })
                      },
                      on: (ch, cb) => {
                        watchCbs.set(ch, cb)
                        return () => watchCbs.delete(ch)
                      } }

  buf = { id: 'b' + bufSeq,
          file: filePath,
          path: filePath,
          dir: Path.dirname(filePath),
          mode: Mode.get('text'),
          views: [],
          co: 0,
          opts: { set: (name, v) => optsSet.push([ name, v ]) },
          opt: () => 0,
          placeholder: 0,
          vars: () => ({ fillParent: 1 }),
          minors: [],
          addToRecents: () => {},
          onRemove: () => {},
          modified: 0,
          modifiedOnDisk: 0,
          stat: 0,
          icon: '' }
  view = makeView(buf)
  globalThis.bredWin.currentArea.tabs[0].frames[0].panes[0].view = view
  readyView = 0
}

async function openDoc
(text) {
  Fs.writeFileSync(filePath, text)
  await open()
}

function goto
(head) {
  view.ed.dispatch({ selection: { head, anchor: head } })
}

async function open
() {
  readyView = 0
  await WodeView.init(view, {}, v => readyView = v)
  await new Promise(r => setTimeout(r, 50))
}

async function revert
() {
  readyView = 0
  await WodeView.revertV(view, {}, v => readyView = v)
  await new Promise(r => setTimeout(r, 50))
}

async function openSeeded
() {
  MainPeer.get(buf.id)
  MainPeer.onPush(fakeE(), [ buf.id, 0, [ { clientID: 'seed',
                                            changes: CMState.ChangeSet.of({ from: 0, to: 0, insert: 'v1' }, 0).toJSON() } ] ])
  MainPeer.get(buf.id)
  readyView = 0
  await WodeView.init(view, {}, v => readyView = v)
  await new Promise(r => setTimeout(r, 50))
}

savedOpt = 0
_shared = globalThis.bred?._shared?.() || {}
_shared.opt = _shared.opt || { values: {},
                               types: {},
                               onSets: {},
                               onSetAlls: [],
                               onSetBufs: {},
                               onSetBufAlls: [] }
_shared.buf = _shared.buf || {}
_shared.buf.buffers = _shared.buf.buffers || []
_shared.buf.ring = _shared.buf.ring || []
_shared.cut = _shared.cut || { ring: [], buf: { views: [] } }
savedOpt = _shared.opt
_shared.opt = { values: {},
                types: {},
                onSets: {},
                onSetAlls: [],
                onSetBufs: {},
                onSetBufAlls: [] }
globalThis.bred = { _shared: () => _shared }
savedDocument = globalThis.document
savedElement = globalThis.Element
savedHTMLDocument = globalThis.HTMLDocument
savedTron = globalThis.tron
globalThis.document = { dispatchEvent: () => {},
                        documentElement: { style: {} },
                        head: { appendChild: () => ({ innerHTML: '' }) },
                        createElement: () => ({ style: {}, innerHTML: '' }) }
globalThis.Element = class Element {}
globalThis.HTMLDocument = class HTMLDocument {}
globalThis.tron = { cmd: async () => ({ err: 0, ch: 0 }),
                    receive: (ch, cb2) => cb2({ err: 0, exists: 0 }),
                    acmd: async () => ({}) }

if (Cmd.hist == undefined)
  Cmd.init()
if (emReady() == 0)
  Em.init()

await new Promise((res, rej) => Ed.init('codemirror',
                                        err => err ? rej(err) : res()))
await new Promise(r => setTimeout(r, 100))

_shared.opt = savedOpt
globalThis.document = savedDocument
globalThis.Element = savedElement
globalThis.HTMLDocument = savedHTMLDocument
globalThis.tron = savedTron

tests = {}

test('open', 'loads file content into view',
     async () => {
       await open()
       equal(view.ed.state.doc.toString(), 'v1')
       equal(readyView, view)
     })

test('revert', 'reloads file after disk change',
     async () => {
       await open()
       Fs.writeFileSync(filePath, 'v2')
       await revert()
       equal(view.ed.state.doc.toString(), 'v2')
     })

test('revert', 'unchanged file keeps content',
     async () => {
       await open()
       await revert()
       equal(view.ed.state.doc.toString(), 'v1')
     })

test('revert', 'calls file.get with path',
     async () => {
       await open()
       fileGetArgs = 0
       await revert()
       equal(fileGetArgs.join(','), filePath)
     })

test('revert', 're-enables the view element',
     async () => {
       await open()
       await revert()
       equal(view.ele.getAttribute('inert'), null)
     })

test('revert', 'file.get error keeps previous content',
     async () => {
       await open()
       fileGetErr = 1
       await revert()
       equal(view.ed.state.doc.toString(), 'v1')
       equal(view.ele.getAttribute('inert'), null)
       equal(readyView, view)
     })

test('open', 'file.get error is ready not dead',
     async () => {
       fileGetErr = 1
       await open()
       equal(view.ed.state.doc.toString(), '')
       equal(view.ready, 1)
       equal(readyView, view)
     })

test('movement', 'vforward moves right by chars',
     async () => {
       await openDoc('ab\ncd\nef')
       goto(0)
       Wode.vforward(view, 1)
       equal(view.ed.state.selection.main.head, 1)
       Wode.vforward(view, 3)
       equal(view.ed.state.selection.main.head, 4)
     })

test('movement', 'forward uses current view',
     async () => {
       await openDoc('ab\ncd\nef')
       goto(0)
       Wode.forward(2)
       equal(view.ed.state.selection.main.head, 2)
     })

test('movement', 'backward moves left',
     async () => {
       await openDoc('ab\ncd\nef')
       goto(4)
       Wode.backward(1)
       equal(view.ed.state.selection.main.head, 3)
     })

test('movement', 'groupForward and groupBackward',
     async () => {
       await openDoc('ab\ncd\nef')
       goto(0)
       Wode.groupForward(1)
       equal(view.ed.state.selection.main.head, 2)
       goto(4)
       Wode.groupBackward(1)
       equal(view.ed.state.selection.main.head, 3)
     })

test('movement', 'lineStart and lineEnd',
     async () => {
       await openDoc('ab\ncd\nef')
       goto(4)
       Wode.lineStart(view)
       equal(view.ed.state.selection.main.head, 3)
       goto(0)
       Wode.lineEnd(view)
       equal(view.ed.state.selection.main.head, 2)
     })

test('movement', 'nextBoundary and prevBoundary',
     async () => {
       await openDoc('ab\ncd\nef')
       goto(0)
       Wode.nextBoundary(view, 1)
       equal(view.ed.state.selection.main.head, 2)
       goto(5)
       Wode.prevBoundary(view, 1)
       equal(view.ed.state.selection.main.head, 3)
     })

test('movement', 'selectAll selects the doc',
     async () => {
       await openDoc('ab\ncd\nef')
       Wode.selectAll()
       equal(view.ed.state.selection.main.from, 0)
       equal(view.ed.state.selection.main.to, 8)
     })

test('sync', 'peer holds file content after open',
     async () => {
       await open()
       await waitPeer(buf.id, 'v1')
     })

test('sync', 'peer receives edit',
     async () => {
       await open()
       view.ed.dispatch({ changes: { from: 2, insert: 'X' } })
       await waitPeer(buf.id, 'v1X')
     })

test('copy', 'new view gets content',
     async () => {
       let to

       await open()
       to = makeView(buf)
       extraViews.push(to)
       await new Promise((res, rej) => {
                           WodeView.copy(to, view, 1, res)
                           setTimeout(() => rej(new Error('copy timeout')), 3000)
                         })
       equal(to.ed.state.doc.toString(), 'v1')
     })

test('watch', 'file change sets modifiedOnDisk',
     async () => {
       await open()
       equal(buf.modifiedOnDisk, 0)
       fireWatch({ err: 0, type: 'change', stat: { mtimeMs: 999 } })
       await new Promise(r => setTimeout(r, 30))
       equal(buf.modifiedOnDisk, 1)
     })

test('modified', 'edit marks buffer modified',
     async () => {
       await open()
       view.ed.dispatch({ changes: { from: 2, insert: 'X' } })
       equal(buf.modified, 1)
     })

test('modified', 'edit during revert not marked',
     async () => {
       await open()
       view.ready = 0
       buf.reverting = 1
       view.ed.dispatch({ changes: { from: 2, insert: 'X' } })
       equal(buf.modified, 0)
       equal(view.ready, 1)
     })

test('reopen', 'preserves content and readies view',
     async () => {
       await open()
       await new Promise((res, rej) => {
                           WodeView.reopen(view, 1, res)
                           setTimeout(() => rej(new Error('reopen timeout')), 3000)
                         })
       equal(view.ed.state.doc.toString(), 'v1')
       equal(view.ready, 1)
     })

test('peer plugin', 'pushes on edit, pulls updates, destroys',
     async () => {
       let chOff, parent, pullCb, pushes, state, v

       pushes = []
       globalThis.tron = { acmd: async (name, args) => {
                                     if (name == 'peer.push') {
                                       pushes.push(args)
                                       return {}
                                     }
                                     return {}
                                   },
                           cmd: async () => ({ err: 0, ch: 0 }),
                           receive: (ch, cb2) => cb2({ err: 0 }),
                           on: (ch, cb) => {
                             pullCb = cb
                             return () => chOff = 1
                           } }
       parent = globalThis.document.createElement('div')
       globalThis.document.body.appendChild(parent)
       state = CMState.EditorState.create({ doc: 'a',
                                            extensions: WodePeer.make('pid1', 0) })
       v = new CMView.EditorView({ state, parent })
       v.dispatch({ changes: { from: 1, insert: 'b' } })
       await new Promise(r => setTimeout(r, 30))
       equal(pushes.length > 0, true)
       pullCb({ err: 0, updates: [] })
       await new Promise(r => setTimeout(r, 30))
       equal(v.state.doc.toString(), 'ab')
       v.destroy()
       equal(chOff, 1)
     })

test('editing', 'selfInsert types char',
     async () => {
       await openDoc('v1')
       goto(0)
       Wode.selfInsert(1, { e: { key: 'x' } })
       equal(view.ed.state.doc.toString(), 'xv1')
     })

test('editing', 'trim removes trailing whitespace',
     async () => {
       await openDoc('a b  ')
       goto(5)
       Wode.trim()
       equal(view.ed.state.doc.toString(), 'a b')
     })

test('editing', 'transposeChars swaps chars',
     async () => {
       await openDoc('ab')
       goto(1)
       Wode.transposeChars()
       equal(view.ed.state.doc.toString(), 'ba')
     })

test('editing', 'cutLine cuts to end of line',
     async () => {
       await openDoc('ab\ncd')
       goto(0)
       Wode.cutLine()
       equal(view.ed.state.doc.toString(), '\ncd')
     })

test('editing', 'delNextWordBound deletes next word',
     async () => {
       await openDoc('a b')
       goto(0)
       Wode.delNextWordBound(1)
       equal(view.ed.state.doc.toString(), ' b')
     })

test('editing', 'capitalizeWord from word end',
     async () => {
       await openDoc('hello world')
       goto(7)
       Wode.capitalizeWord()
       equal(view.ed.state.doc.toString(), 'hello wOrld')
     })

test('editing', 'openLine splits line',
     async () => {
       await openDoc('ab\ncd')
       goto(1)
       Wode.openLine()
       equal(view.ed.state.doc.toString(), 'a\nb\ncd')
     })

test('editing', 'insertSlash inserts slash',
     async () => {
       await openDoc('ab')
       goto(0)
       Wode.insertSlash(1)
       equal(view.ed.state.doc.toString(), '/ab')
     })

test('editing', 'suggest does not change doc',
     async () => {
       await openDoc('ab')
       Wode.suggest()
       equal(view.ed.state.doc.toString(), 'ab')
     })

test('editing', 'indentLine on plain text',
     async () => {
       await openDoc('  hello')
       goto(0)
       Wode.indentLine()
       equal(view.ed.state.doc.toString(), 'hello')
       equal(view.ed.state.selection.main.head, 0)
     })

test('editing', 'sortLines sorts lines',
     async () => {
       await openDoc('b\na\n')
       Wode.sortLines()
       equal(view.ed.state.doc.toString(), 'a\nb\n')
     })

test('editing', 'yank inserts from cut ring',
     async () => {
       await openDoc('ab')
       globalThis.bred._shared().cut.ring.push('x')
       goto(0)
       Wode.yank()
       equal(view.ed.state.doc.toString(), 'xab')
     })

test('editing', 'commentRegion no comment syntax leaves doc',
     async () => {
       await openDoc('ab')
       Wode.commentRegion(1)
       equal(view.ed.state.doc.toString(), 'ab')
     })

test('editing', 'undo and redo',
     async () => {
       await openDoc('ab')
       goto(1)
       view.ed.dispatch({ changes: { from: 1, insert: 'x' } })
       equal(view.ed.state.doc.toString(), 'axb')
       Wode.undo()
       equal(view.ed.state.doc.toString(), 'ab')
       Wode.redo()
       equal(view.ed.state.doc.toString(), 'axb')
     })

test('ed', 'escapeForRe escapes regex chars',
     () => {
       equal(Ed.escapeForRe('a.b*'), 'a\\.b\\*')
     })

test('ed', 'charForInsert plain key',
     () => {
       equal(Ed.charForInsert({ e: { key: 'x' } }), 'x')
     })

test('ed', 'charForInsert control key',
     () => {
       equal(Ed.charForInsert({ e: { key: 'a', ctrlKey: 1 } }), String.fromCharCode(1))
     })

test('ed', 'charForInsert tab and enter',
     () => {
       equal(Ed.charForInsert({ e: { key: 'Tab' } }), String.fromCharCode(9))
       equal(Ed.charForInsert({ e: { key: 'Enter' } }), String.fromCharCode(10))
     })

test('ed', 'supportsExt matches registered ext',
     () => {
       equal(Ed.supportsExt('css'), 1)
       equal(Ed.supportsExt('zzz'), 0)
     })

test('ed', 'findLang finds language',
     () => {
       equal(Ed.findLang('css') ? 1 : 0, 1)
     })

test('ed', 'mtypeFromExt maps extension',
     () => {
       equal(Ed.mtypeFromExt('css') ? 1 : 0, 1)
     })

test('ed', 'enable and enableBuf set opts',
     () => {
       Ed.enable(1, 'core.test.enable')
       equal(Opt.get('core.test.enable'), 1)
       Ed.enableBuf(1, 'core.test.buf')
       equal(optsSet.some(o => o[0] == 'core.test.buf' && o[1] == 1), true)
     })

test('collab', 'second view shows existing content',
     async () => {
       let vB

       await open()
       vB = makeView(buf)
       extraViews.push(vB)
       await new Promise((res, rej) => {
                           WodeView.init(vB, {}, res)
                           setTimeout(() => rej(new Error('init timeout')), 3000)
                         })
       equal(vB.ed.state.doc.toString(), 'v1')
     })

test('collab', 'second view receives edit from first',
     async () => {
       let vB

       await openSeeded()
       vB = makeView(buf)
       extraViews.push(vB)
       await new Promise((res, rej) => {
                           WodeView.init(vB, {}, res)
                           setTimeout(() => rej(new Error('init timeout')), 3000)
                         })
       view.ed.dispatch({ changes: { from: 2, insert: 'X' } })
       await waitDoc(vB, 'v1X')
     })

test('collab', 'edits from second view reach first',
     async () => {
       let vB

       await openSeeded()
       vB = makeView(buf)
       extraViews.push(vB)
       await new Promise((res, rej) => {
                           WodeView.init(vB, {}, res)
                           setTimeout(() => rej(new Error('init timeout')), 3000)
                         })
       vB.ed.dispatch({ changes: { from: 0, insert: 'Z' } })
       await waitDoc(view, 'Zv1')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
