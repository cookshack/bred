import { equal } from 'node:assert/strict'
import * as Cmd from '../js/cmd.mjs'
import * as Ed from '../js/ed.mjs'
import * as Em from '../js/Em.mjs'
import * as Mode from '../js/mode.mjs'

let savedDocument, savedElement, savedHTMLDocument, savedOpt, savedTron, tests, _shared

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
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

test('mode', 'Ed mode registered',
     () => {
       let mo

       mo = Mode.get('ed')
       equal(mo ? 1 : 0, 1)
       equal(mo.hidePoint, 1)
     })

test('commands', 'editing commands',
     () => {
       let names

       names = [ 'activate mark', 'delete previous char', 'delete next char',
                 'delete next word', 'delete previous word',
                 'delete to next word boundary', 'delete to previous word boundary',
                 'trim', 'comment region', 'count region', 'sort buffer lines',
                 'sort lines', 'capitalize word', 'lowercase word',
                 'uppercase word', 'new line and indent', 'new line',
                 'insert /', 'forward', 'backward', 'cut line',
                 'group forward', 'group backward', 'syntax forward',
                 'syntax backward', 'word forward', 'word backward',
                 'page forward', 'page backward',
                 'page forward or self insert', 'page backward or self insert',
                 'previous line', 'next line', 'previous boundary',
                 'next boundary', 'line start', 'line end', 'buffer start',
                 'buffer end', 'scroll up', 'scroll down', 'mark set',
                 'mark exchange', 'open line', 'cancel', 'recenter', 'undo',
                 'redo', 'self insert', 'quoted insert',
                 'self insert and indent', 'indent buffer', 'suggest',
                 'next suggestion', 'previous suggestion', 'indent region',
                 'indent line', 'indent rigidly', 'insert two spaces',
                 'save', 'save as', 'transpose chars', 'transpose words',
                 'toggle overwrite', 'top level start', 'top level end',
                 'top of pane', 'bottom of pane', 'select all',
                 'open lint panel', 'first diagnostic',
                 'flush trailing whitespace', 'yank', 'yank roll', 'paste',
                 'paste roll', 'cut', 'copy', 'revert buffer', 'goto line' ]
       names.forEach(name => equal(Cmd.getMo(name, 'ed') ? 1 : 0, 1, name))
     })

test('bindings', 'cursor movement keys',
     () => {
       let mo

       mo = Mode.get('ed')
       equal(Em.seq('forward', { mode: mo }), 'C-f')
       equal(Em.seq('backward', { mode: mo }), 'C-b')
       equal(Em.seq('next line', { mode: mo }), 'C-n')
       equal(Em.seq('previous line', { mode: mo }), 'C-p')
       equal(Em.seq('line start', { mode: mo }), 'C-a')
       equal(Em.seq('line end', { mode: mo }), 'C-e')
       equal(Em.seq('buffer start', { mode: mo }), 'Home')
       equal(Em.seq('buffer end', { mode: mo }), 'End')
     })

test('bindings', 'control keys',
     () => {
       let mo

       mo = Mode.get('ed')
       equal(Em.seq('new line', { mode: mo }), 'C-j')
       equal(Em.seq('cut line', { mode: mo }), 'C-k')
       equal(Em.seq('quoted insert', { mode: mo }), 'C-q')
       equal(Em.seq('undo', { mode: mo }), 'C-z')
       equal(Em.seq('paste', { mode: mo }), 'C-y')
       equal(Em.seq('mark set', { mode: mo }), 'C-')
       equal(Em.seq('cancel', { mode: mo }), 'Escape')
       equal(Em.seq('delete next char', { mode: mo }), 'Delete')
     })

test('bindings', 'extended keys',
     () => {
       let mo

       mo = Mode.get('ed')
       equal(Em.seq('save', { mode: mo }), 'C-x C-s')
       equal(Em.seq('save as', { mode: mo }), 'C-x C-w')
       equal(Em.seq('mark exchange', { mode: mo }), 'C-x C-x')
       equal(Em.seq('open line', { mode: mo }), 'C-x o')
       equal(Em.seq('page forward', { mode: mo }), 'C-x ]')
       equal(Em.seq('comment region', { mode: mo }), 'C-c ;')
       equal(Em.seq('lowercase word', { mode: mo }), 'A-l')
       equal(Em.seq('uppercase word', { mode: mo }), 'A-u')
       equal(Em.seq('trim', { mode: mo }), 'A-z')
       equal(Em.seq('count region', { mode: mo }), 'A-=')
       equal(Em.seq('top of pane', { mode: mo }), 'A-,')
       equal(Em.seq('bottom of pane', { mode: mo }), 'A-.')
       equal(Em.seq('goto line', { mode: mo }), 'A-g l')
       equal(Em.seq('revert buffer', { mode: mo }), 'C-c A-r')
       equal(Em.seq('syntax forward', { mode: mo }), 'C-A-f')
       equal(Em.seq('top level start', { mode: mo }), 'C-A-a')
       equal(Em.seq('top level end', { mode: mo }), 'C-A-e')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
