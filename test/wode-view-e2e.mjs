import { equal } from 'node:assert/strict'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import * as Cmd from '../js/cmd.mjs'
import * as Ed from '../js/ed.mjs'
import * as Em from '../js/Em.mjs'
import Mk from '../js/mk.mjs'
import * as Mode from '../js/mode.mjs'
import * as Wode from '../js/wode.mjs'
import * as WodeView from '../js/wode-view.mjs'
import { setupDom } from './dom-help.mjs'

let domWin, fileGetArgs, filePath, readyView, savedDocument, savedElement, savedHTMLDocument, savedOpt
let savedTron, tests, tmp, view, _shared

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

function setup
() {
  let buf, edW, edWW, ele

  tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'bred-e2e-'))
  filePath = Path.join(tmp, 'a.txt')
  Fs.writeFileSync(filePath, 'v1')
  fileGetArgs = 0
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

  globalThis.tron = { acmd: async name => {
                                if (name == 'peer.get')
                                  return { version: 0, fresh: 1, text: '' }
                                return {}
                              },
                      cmd: async (name, args) => {
                             if (name == 'file.get') {
                               fileGetArgs = args
                               return 'file-get-ch'
                             }
                             return { err: 0, ch: 0 }
                           },
                      receive: (ch, cb2) => {
                        if (ch == 'file-get-ch')
                          cb2({ err: 0, data: Fs.readFileSync(filePath, 'utf8'), stat: Fs.statSync(filePath), realpath: filePath })
                        else
                          cb2({ err: 0 })
                      },
                      on: () => () => {} }

  ele = globalThis.document.createElement('div')
  edWW = globalThis.document.createElement('div')
  edW = globalThis.document.createElement('div')
  edW.className = 'edW'
  edWW.appendChild(edW)
  ele.appendChild(edWW)

  buf = { id: 'b1',
          file: filePath,
          path: filePath,
          dir: Path.dirname(filePath),
          mode: Mode.get('text'),
          views: [],
          co: 0,
          opts: { set: () => {} },
          vars: () => ({ fillParent: 1 }),
          minors: [],
          addToRecents: () => {},
          onRemove: () => {},
          modified: 0,
          modifiedOnDisk: 0,
          stat: 0,
          icon: '' }
  view = { vid: 1,
           ready: 1,
           marks: [],
           ele,
           onChanges: Mk.array,
           onFocuss: Mk.array,
           onRemove: () => {},
           buf }
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

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
