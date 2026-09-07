import { equal } from 'node:assert/strict'
import { EditorState } from '../lib/@codemirror/state.js'
import * as Wode from '../js/wode.mjs'
import * as WodeRange from '../js/wode-range.mjs'

let tests

globalThis.document = { dispatchEvent: () => {},
                        documentElement: { style: {} } }
globalThis.Element = class Element {}
globalThis.HTMLElement = class HTMLElement {}
globalThis.HTMLDocument = class HTMLDocument {}

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function edFor
(doc, head) {
  let ed

  ed = { state: EditorState.create({ doc,
                                     selection: { head, anchor: head } }),
         dispatch: tr => ed.state = ed.state.update(tr).state,
         scrollDOM: { getBoundingClientRect: () => ({ top: 0,
                                                      bottom: 0,
                                                      left: 0,
                                                      right: 0,
                                                      x: 0,
                                                      y: 0,
                                                      width: 0,
                                                      height: 0 }),
                      clientWidth: 0,
                      clientHeight: 0 },
         domAtPos: () => ({ node: null }) }
  return ed
}

function viewFor
(doc, head, anchor) {
  let ed, view

  ed = edFor(doc, head)
  if (anchor == undefined)
    anchor = head
  ed.state = EditorState.create({ doc,
                                  selection: { head, anchor } })
  view = { ed,
           markActive: 0,
           ele: {},
           marks: [] }
  return view
}

tests = {}

test('bep math', 'vlineStart gives line start',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       equal(Wode.vlineStart(v, 0), 0)
       equal(Wode.vlineStart(v, 3), 2)
       equal(Wode.vlineStart(v, 7), 5)
     })

test('bep math', 'vlineStart clamps negative',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       equal(Wode.vlineStart(v, -1), 0)
     })

test('bep math', 'lineAtBep gives line text',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       equal(Wode.lineAtBep(v, 0), 'a')
       equal(Wode.lineAtBep(v, 2), 'bb')
       equal(Wode.lineAtBep(v, 8), 'ccc')
     })

test('bep math', 'lineAt gives line text from pos',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       equal(Wode.lineAt(v, { row: 1, column: 0 }), 'bb')
     })

test('bep math', 'makeBep converts row col',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       equal(Wode.makeBep(v, 0, 0), 0)
       equal(Wode.makeBep(v, 1, 1), 3)
       equal(Wode.makeBep(v, 2, 0), 5)
     })

test('bep math', 'posRow',
     () => {
       equal(Wode.posRow({ lineNumber: 5 }), 4)
       equal(Wode.posRow({ row: 5 }), 5)
       equal(Wode.posRow(0), 0)
     })

test('bep math', 'posCol',
     () => {
       equal(Wode.posCol({ column: 3 }), 2)
       equal(Wode.posCol({ col: 3 }), 3)
       equal(Wode.posCol(0), 0)
     })

test('bep math', 'bep comparisons',
     () => {
       equal(Wode.bepGt(2, 1), true)
       equal(Wode.bepGt(1, 2), false)
       equal(Wode.bepGtEq(2, 2), true)
       equal(Wode.bepLt(1, 2), true)
       equal(Wode.bepLt(2, 1), false)
       equal(Wode.bepLtEq(2, 2), true)
     })

test('bep math', 'rowLen',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       equal(Wode.rowLen(v, 0), 1)
       equal(Wode.rowLen(v, 1), 2)
       equal(Wode.rowLen(v, 2), 3)
     })

test('bep math', 'vbepIncr increments',
     () => {
       equal(Wode.vbepIncr(viewFor('a', 0), 3), 4)
     })

test('bep math', 'vbepEq',
     () => {
       equal(Wode.vbepEq(3, 3), true)
       equal(Wode.vbepEq(3, 4), false)
     })

test('bep math', 'posToBep converts pos',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       equal(Wode.posToBep(v, { row: 1, column: 1 }), 3)
     })

test('bep math', 'bepToOff and offToBep are identity',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       equal(Wode.bepToOff(v, 5), 5)
       equal(Wode.offToBep(v, 5), 5)
     })

test('bep math', 'vendBep and vlen',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       equal(Wode.vendBep(v), 8)
       equal(Wode.vlen(v), 3)
     })

test('bep math', 'vforLines visits each line',
     () => {
       let got, v

       v = viewFor('a\nbb\nccc', 0)
       got = []
       Wode.vforLines(v, line => got.push(line.text))
       equal(got.join(','), 'a,bb,ccc')
     })

test('selection', 'vgetPos returns pos',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 2)
       equal(Wode.vgetPos(v).row, 1)
       equal(Wode.vgetPos(v).column, 0)
     })

test('selection', 'vsetPos moves point',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       Wode.vsetPos(v, { row: 2, column: 0 }, 0)
       equal(v.ed.state.selection.main.head, 5)
     })

test('selection', 'vsetBepSpec reveal 0 moves point',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       Wode.vsetBepSpec(v, 5, { reveal: 0 })
       equal(v.ed.state.selection.main.head, 5)
     })

test('selection', 'vsetBepSpec reveal 2 moves point',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       Wode.vsetBepSpec(v, 5, { reveal: 2 })
       equal(v.ed.state.selection.main.head, 5)
     })

test('selection', 'vsetBepSpec keeps selection with mark',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 2, 0)
       v.markActive = 1
       Wode.vsetBepSpec(v, 5, { keepSelection: 1, goalCol: 4 })
       equal(v.ed.state.selection.main.anchor, 0)
       equal(v.ed.state.selection.main.head, 5)
       equal(v.ed.state.selection.main.goalColumn, 4)
     })

test('selection', 'vsetBep moves point',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       Wode.vsetBep(v, 5)
       equal(v.ed.state.selection.main.head, 5)
     })

test('selection', 'vgotoLine moves to line start',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       Wode.vgotoLine(v, 2)
       equal(v.ed.state.selection.main.head, 2)
     })

test('selection', 'vgotoLine clamps high and low',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       Wode.vgotoLine(v, 99)
       equal(v.ed.state.selection.main.head, 5)
       Wode.vgotoLine(v, 0)
       equal(v.ed.state.selection.main.head, 0)
     })

test('selection', 'clearSelection collapses to head',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 5, 2)
       v.markActive = 1
       Wode.clearSelection(v)
       equal(v.ed.state.selection.main.anchor, 5)
       equal(v.ed.state.selection.main.head, 5)
       equal(v.markActive, 0)
     })

test('selection', 'vbufEnd moves to doc end',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       Wode.vbufEnd(v)
       equal(v.ed.state.selection.main.head, 8)
     })

test('selection', 'vbufStart moves to doc start',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 5)
       Wode.vbufStart(v)
       equal(v.ed.state.selection.main.head, 0)
     })

test('editing', 'vinsert1 inserts at point',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 2)
       Wode.vinsert1(v, 1, 'xy')
       equal(v.ed.state.doc.toString(), 'a\nxybb\nccc')
     })

test('editing', 'vinsertAll inserts',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       Wode.vinsertAll(v, 1, 'Q')
       equal(v.ed.state.doc.toString(), 'Qa\nbb\nccc')
     })

test('editing', 'vinsertAt inserts at bep',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       Wode.vinsertAt(v, 0, 1, 'X')
       equal(v.ed.state.doc.toString(), 'Xa\nbb\nccc')
     })

test('editing', 'vinsertAt repeats for non setBep',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       Wode.vinsertAt(v, 0, 2, 'x')
       equal(v.ed.state.doc.toString(), 'xxa\nbb\nccc')
     })

test('editing', 'vinsertAt setBep replaces range',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       Wode.vinsertAt(v, 2, 1, 'Z', 1, 4)
       equal(v.ed.state.doc.toString(), 'a\nZ\nccc')
     })

test('editing', 'vreplaceAt replaces range',
     () => {
       let v, r

       v = viewFor('a\nbb\nccc', 0)
       r = WodeRange.make(v, 0, 1)
       Wode.vreplaceAt(v, r, 'YY')
       equal(v.ed.state.doc.toString(), 'YY\nbb\nccc')
     })

test('search', 'find returns range and selects',
     () => {
       let r, st, v

       v = viewFor('a\nbb\nccc', 0)
       st = { view: v, from: 'bb' }
       r = Wode.find(st)
       equal(r.from, 2)
       equal(r.to, 4)
       equal(v.ed.state.selection.main.anchor, 2)
       equal(v.ed.state.selection.main.head, 4)
     })

test('search', 'find no match returns 0',
     () => {
       let r, st, v

       v = viewFor('a\nbb\nccc', 0)
       st = { view: v, from: 'zz' }
       r = Wode.find(st)
       equal(r, 0)
     })

test('search', 'replace all returns 1 and changes doc',
     () => {
       let r, st, v

       v = viewFor('a\nbb\nccc', 0)
       st = { view: v, from: 'bb', to: 'XY' }
       r = Wode.replace(st, 1)
       equal(r, 1)
       equal(v.ed.state.doc.toString(), 'a\nXY\nccc')
     })

test('search', 'replace single calls search',
     () => {
       let r, searched, st, v

       v = viewFor('a\nbb\nccc', 0)
       st = { view: v, from: 'bb', to: 'XY' }
       searched = 0
       r = Wode.replace(st, 0, () => searched = 1)
       equal(r, 1)
       equal(searched, 1)
       equal(v.ed.state.doc.toString(), 'a\nXY\nccc')
     })

test('search', 'replace no match returns 0',
     () => {
       let r, st, v

       v = viewFor('a\nbb\nccc', 0)
       st = { view: v, from: 'zz', to: 'XY' }
       r = Wode.replace(st, 1)
       equal(r, 0)
     })

test('region', 'vregion getters',
     () => {
       let reg, v

       v = viewFor('a\nbb\nccc', 3, 0)
       reg = Wode.vregion(v)
       equal(reg.from, 0)
       equal(reg.to, 3)
       equal(reg.chars, 3)
       equal(reg.end.bep, 3)
     })

test('misc', 'addMarkAt pushes mark',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 0)
       Wode.addMarkAt(v, 5)
       equal(v.marks.join(','), '5')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
