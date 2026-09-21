import { equal } from 'node:assert/strict'
import * as Cmd from '../js/cmd.mjs'
import * as Css from '../js/css.mjs'
import * as Ed from '../js/ed.mjs'
import * as Em from '../js/Em.mjs'
import * as Loc from '../js/loc.mjs'
import * as Area from '../js/Area.mjs'
import * as Tab from '../js/tab.mjs'
import * as Pane from '../js/Pane.mjs'
import * as Buf from '../js/Buf.mjs'
import * as BufCommon from '../js/buf-common.mjs'
import * as Prompt from '../js/prompt.mjs'
import * as Shell from '../js/shell.mjs'
import * as View from '../js/view.mjs'
import Mk from '../js/mk.mjs'
import { setupDom } from './dom-help.mjs'

let inited, _shared

function emReady
() {
  try {
    return Em.get('Global') ? 1 : 0
  }
  catch {
    return 0
  }
}

export
function wait
(ms) {
  return new Promise(r => setTimeout(r, ms))
}

export
async function waitFor
(cb, ms) {
  let start, timeout

  timeout = ms ?? 1000
  start = Date.now()
  while ((Date.now() - start) < timeout) {
    if (cb())
      return
    await wait(10)
  }
  throw new Error('waitFor: timeout')
}

export
function setBuf
(p, b) {
  return new Promise(res => p.setBuf(b, {}, v => res(v)))
}

// install focus spies on the given views, returns a fn giving the last focused view
export
function spyFocus
(views) {
  let focusedView

  focusedView = 0
  views.forEach(v => {
                  let orig

                  orig = v.ed.focus.bind(v.ed)
                  v.ed.focus = () => {
                                 focusedView = v
                                 orig()
                               }
                })
  return () => focusedView
}

export
function fileBuf
(name) {
  return Buf.add(name, 'ed', Ed.divW('/tmp', name), '/tmp', { file: name })
}

export
function sameView
(a, b, msg) {
  // compare identity as a bool, else a failing assert inspects huge view graphs
  equal(a == b, true, msg)
}

export
function pointOf
(v) {
  return v?.ed?.state.selection.main.head
}

// all views of a pane that have an editor, including nested ones
export
function viewsFor
(p) {
  let v

  v = p.view
  if (v)
    return [ v, ...(v.nestedViews || []) ].filter(v2 => v2.ed)
  return []
}

// focus another pane and come back, returning the focused view and point state
export
function focusRoundTrip
(from, to) {
  let before, focused, views

  before = pointOf(View.current(to))
  views = [ ...viewsFor(from), ...viewsFor(to) ]
  focused = spyFocus(views)
  from.focus()
  to.focus()
  return { focused: focused(),
           before,
           after: pointOf(View.current(to)) }
}

export
function checkPaneInvariants
(frame) {
  let currentCount, seen

  currentCount = 0
  seen = []
  frame.panes.forEach(p => {
                        if (Css.has(p.w, 'current'))
                          currentCount++
                        if (p.view) {
                          equal(p.buf.views.includes(p.view), true, 'view must be registered on its buf')
                          equal(seen.includes(p.view), false, 'view must be in only one pane')
                          seen.push(p.view)
                          equal(View.current(p) == p.view || (p.view.nestedViews || []).includes(View.current(p)),
                                true,
                                'View.current must belong to the pane')
                        }
                      })
  equal(currentCount, 1, 'exactly one current pane')
}

export
function setupPanes
() {
  let area, boot, domWin, frame, pA, pB, shellChans, win

  _shared.buf = { buffers: Mk.array, ring: Mk.array, id: 1 }
  _shared.cut = { ring: [], buf: { views: [] } }
  _shared.win = { wins: [], id: 1 }
  globalThis.bred = { _shared: () => _shared }

  domWin = setupDom()
  domWin.HTMLCanvasElement.prototype.getContext = () => ({ measureText: () => ({ width: 8 }) })

  win = { areas: [],
          currentArea: 0,
          document: domWin.document,
          get selection
          () {
            return domWin.getSelection()
          },
          add
          (a) {
            this.areas.push(a)
          } }
  globalThis.bredWin = win

  shellChans = {}
  globalThis.tron = { cmd: async (name, args) => {
                             if (name == 'file.get')
                               return 'file-get-ch'
                             if (name == 'shell.run')
                               return args[0]
                             return { err: 0, ch: 0 }
                           },
                      receive: (ch, cb) => {
                                 if (ch == 'file-get-ch')
                                   cb({ err: 0,
                                        data: 'the file content\n',
                                        stat: { mtimeMs: 1 },
                                        realpath: '/tmp/a.txt' })
                                 else
                                   cb({ err: 0 })
                               },
                      acmd: async name => {
                              if (name == 'peer.get')
                                return { fresh: 1, text: '', version: 0 }
                              return {}
                            },
                      on: (ch, cb) => {
                            if (String(ch).startsWith('shellCh'))
                              shellChans[ch] = cb
                            return () => delete shellChans[ch]
                          },
                      send: () => {} }

  if (inited == 0) {
    Prompt.init()
    Shell.init()
    inited = 1
  }

  boot = Buf.add('boot', 'div', domWin.document.createElement('div'), '/tmp')
  area = Area.add(win, 'bred-main')
  area.show()
  frame = Tab.add(area, { singleFrame: 1, buf: boot }).frame1
  pA = Pane.current()
  Pane.nextOrSplit()
  pB = Pane.current()

  return { frame, pA, pB, shellChans }
}

let savedDocument, savedElement, savedHTMLDocument, savedOpt, savedTron

savedOpt = 0
inited = 0
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
                    receive: (ch, cb) => cb({ err: 0, exists: 0 }),
                    acmd: async () => ({}) }

if (Cmd.hist == undefined)
  Cmd.init()
if (emReady() == 0)
  Em.init()

await new Promise((res, rej) => Ed.init('codemirror',
                                        err => err ? rej(err) : res()))
await wait(100)

Loc.iwdSet('/tmp')
BufCommon.init()

_shared.opt = savedOpt
globalThis.document = savedDocument
globalThis.Element = savedElement
globalThis.HTMLDocument = savedHTMLDocument
globalThis.tron = savedTron
