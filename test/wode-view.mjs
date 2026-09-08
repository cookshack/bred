import { equal } from 'node:assert/strict'
import { EditorState } from '../lib/@codemirror/state.js'
import * as CMState from '../lib/@codemirror/state.js'
import * as Cmd from '../js/cmd.mjs'
import * as Ed from '../js/ed.mjs'
import * as Em from '../js/Em.mjs'
import * as Mode from '../js/mode.mjs'
import * as WodeView from '../js/wode-view.mjs'

let ed, fileGetArgs, filePath, readyView, savedDocument
let savedElement, savedHTMLDocument, savedOpt, savedTron, tests, _shared, view

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name,
                      cb: () => {
                        setup()
                        return cb()
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
  let buf, decorC, fileContent

  fileContent = 'the file content'
  filePath = '/tmp/wode-view-test.txt'
  fileGetArgs = 0
  decorC = new CMState.Compartment()
  ed = { state: EditorState.create({ doc: '' }),
         dispatch: tr => ed.state = ed.state.update(tr).state,
         focus: () => {} }
  buf = { id: 'b1',
          file: filePath,
          path: filePath,
          dir: '/tmp',
          mode: Mode.get('text'),
          views: [],
          co: 0,
          opts: { set: () => {} },
          addToRecents: () => {},
          onRemove: () => {},
          modifiedOnDisk: 0,
          stat: 0,
          icon: '' }
  view = { ready: 1,
           marks: [],
           ele: { removeAttribute: () => {},
                  classList: { remove: () => {}, add: () => {} } },
           wode: { decorMode: decorC },
           onChanges: [],
           onRemove: () => {},
           onFocuss: [],
           buf,
           ed }
  readyView = 0
  globalThis.bredWin = { currentArea: { tabs: [ { el: { classList: { contains: () => 1 } },
                                                  elBar: { classList: { contains: () => 1 } },
                                                  frames: [ { el: { classList: { contains: () => 1 } },
                                                              panes: [ { w: { classList: { contains: () => 1 } },
                                                                         view: 0 } ] } ] } ] } }
  globalThis.document = { dispatchEvent: () => {},
                          documentElement: { style: {} },
                          head: { appendChild: () => ({ innerHTML: '' }) },
                          createElement: () => ({ style: {}, innerHTML: '' }) }
  globalThis.Element = class Element {}
  globalThis.HTMLElement = class HTMLElement {}
  globalThis.HTMLDocument = class HTMLDocument {}
  globalThis.tron = { cmd: async (name, args) => {
                                if (name == 'file.get') {
                                  fileGetArgs = args
                                  return 'file-get-ch'
                                }
                                return { err: 0, ch: 0 }
                              },
                      receive: (ch, cb2) => {
                        if (ch == 'file-get-ch')
                          cb2({ err: 0, data: fileContent, stat: { mtimeMs: 1 }, realpath: filePath })
                        else
                          cb2({ err: 0 })
                      },
                      acmd: async () => ({}),
                      on: () => () => {} }
}

async function load
(text, spec) {
  WodeView.loadContent(view, ed, text, spec, 0, v => readyView = v)
  await new Promise(r => setTimeout(r, 30))
  return readyView
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

test('revert', 'reloads file content',
     async () => {
       let rv

       rv = await load('stale', { revert: 1 })
       equal(ed.state.doc.toString(), 'the file content')
       equal(rv, view)
     })

test('revert', 'ignores peer text',
     async () => {
       await load('stale peer text', { revert: 1 })
       equal(ed.state.doc.toString(), 'the file content')
     })

test('revert', 'calls file.get with path',
     async () => {
       await load(0, { revert: 1 })
       equal(fileGetArgs.join(','), filePath)
     })

test('fresh', 'open reads file content',
     async () => {
       await load(0, {})
       equal(ed.state.doc.toString(), 'the file content')
     })

test('reopen', 'uses peer text without file.get',
     async () => {
       ed = { state: EditorState.create({ doc: 'peer text' }),
              dispatch: tr => ed.state = ed.state.update(tr).state,
              focus: () => {} }
       view.ed = ed
       await load('peer text', {})
       equal(ed.state.doc.toString(), 'peer text')
       equal(fileGetArgs, 0)
     })

test('empty', 'no file gives empty doc',
     async () => {
       let rv

       view.buf.file = 0
       rv = await load(0, {})
       equal(ed.state.doc.toString(), '')
       equal(rv, view)
       equal(view.ready, 1)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
