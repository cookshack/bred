import { equal } from 'node:assert/strict'
import { EditorState } from '../lib/@codemirror/state.js'
import * as WodeBep from '../js/wode-bep.mjs'
import * as WodePsn from '../js/wode-psn.mjs'

let tests

// a\nbb\nccc : line0 'a' 0-1, line1 'bb' 2-4, line2 'ccc' 5-8, doc length 8

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function viewFor
(doc, head) {
  let opts, state

  opts = { doc }
  if (head == undefined)
    opts = { doc }
  else
    opts = { doc, selection: { head, anchor: head } }
  state = EditorState.create(opts)
  return { ed: { state } }
}

let baseView, spaceView

tests = {}

baseView = viewFor('a\nbb\nccc')
spaceView = viewFor('a\n  x\nccc')

test('bepCol', 'start of doc',
     () => {
       equal(WodeBep.bepCol(baseView, 0), 0)
     })

test('bepCol', 'middle of line',
     () => {
       equal(WodeBep.bepCol(baseView, 4), 2)
     })

test('bepCol', 'start of line',
     () => {
       equal(WodeBep.bepCol(baseView, 5), 0)
     })

test('bepCol', 'end of doc',
     () => {
       equal(WodeBep.bepCol(baseView, 8), 3)
     })

test('bepRow', 'line 1',
     () => {
       equal(WodeBep.bepRow(baseView, 0), 0)
     })

test('bepRow', 'line 2',
     () => {
       equal(WodeBep.bepRow(baseView, 4), 1)
     })

test('bepRow', 'line 3',
     () => {
       equal(WodeBep.bepRow(baseView, 8), 2)
     })

test('bepToPos', 'row and col from bep',
     () => {
       let pos

       pos = WodeBep.bepToPos(baseView, 4)
       equal(pos.row, 1)
       equal(pos.col, 2)
       equal(pos.lineNumber, 2)
     })

test('vgetBep', 'reads selection head',
     () => {
       let v

       v = viewFor('a\nbb\nccc', 3)
       equal(WodeBep.vgetBep(v), 3)
     })

test('vgetBepEnd', 'is doc length',
     () => {
       equal(WodeBep.vgetBepEnd(baseView), 8)
     })

test('psn make', 'row',
     () => {
       equal(WodePsn.make(baseView, 3).row, 1)
     })

test('psn make', 'col',
     () => {
       equal(WodePsn.make(baseView, 3).col, 1)
     })

test('psn make', 'bep',
     () => {
       equal(WodePsn.make(baseView, 3).bep, 3)
     })

test('psn make', 'pos from bep',
     () => {
       let p

       p = WodePsn.make(baseView, 3)
       equal(p.pos.col, 1)
       equal(p.pos.lineNumber, 2)
     })

test('psn make', 'eol at line end',
     () => {
       equal(WodePsn.make(baseView, 4).eol, true)
     })

test('psn make', 'eol not at line end',
     () => {
       equal(WodePsn.make(baseView, 3).eol, false)
     })

test('psn make', 'text from bep to line end',
     () => {
       equal(WodePsn.make(baseView, 3).text, 'b')
     })

test('psn make', 'text empty at line end',
     () => {
       equal(WodePsn.make(baseView, 4).text, '')
     })

test('psn make', 'default bep from selection',
     () => {
       let v, p

       v = viewFor('a\nbb\nccc', 3)
       p = WodePsn.make(v)
       equal(p.bep, 3)
     })

test('charLeft', 'moves one',
     () => {
       let p

       p = WodePsn.make(baseView, 3)
       p.charLeft()
       equal(p.bep, 2)
     })

test('charLeft', 'clamps at start returns true',
     () => {
       let p, clamped

       p = WodePsn.make(baseView, 0)
       clamped = p.charLeft()
       equal(p.bep, 0)
       equal(clamped, true)
     })

test('charRight', 'moves one',
     () => {
       let p

       p = WodePsn.make(baseView, 0)
       p.charRight()
       equal(p.bep, 1)
     })

test('charRight', 'clamps at end returns true',
     () => {
       let p, clamped

       p = WodePsn.make(baseView, 8)
       clamped = p.charRight()
       equal(p.bep, 8)
       equal(clamped, true)
     })

test('lineStart', 'moves to line first char',
     () => {
       let p

       p = WodePsn.make(baseView, 3)
       p.lineStart()
       equal(p.bep, 2)
     })

test('lineEnd', 'moves to line last char',
     () => {
       let p

       p = WodePsn.make(baseView, 3)
       p.lineEnd()
       equal(p.bep, 4)
     })

test('lineNext', 'moves to next line',
     () => {
       let p, moved

       p = WodePsn.make(baseView, 3)
       moved = p.lineNext()
       equal(moved, 1)
       equal(p.bep, 5)
     })

test('lineNext', 'at doc end returns 0',
     () => {
       let p, moved

       p = WodePsn.make(baseView, 8)
       moved = p.lineNext()
       equal(moved, 0)
       equal(p.bep, 8)
     })

test('lineNext', 'near doc end clamps',
     () => {
       let p, moved

       p = WodePsn.make(baseView, 7)
       moved = p.lineNext()
       equal(moved, 0)
       equal(p.bep, 8)
     })

test('linePrev', 'moves to previous line',
     () => {
       let p, moved

       p = WodePsn.make(baseView, 3)
       moved = p.linePrev()
       equal(moved, 1)
       equal(p.bep, 1)
     })

test('linePrev', 'from line start goes to prior line start',
     () => {
       let p, moved

       p = WodePsn.make(baseView, 2)
       moved = p.linePrev()
       equal(moved, 1)
       equal(p.bep, 0)
     })

test('linePrev', 'at doc start returns 0',
     () => {
       let p, moved

       p = WodePsn.make(baseView, 0)
       moved = p.linePrev()
       equal(moved, 0)
       equal(p.bep, 0)
     })

test('lineRightOverSpace', 'skips leading spaces',
     () => {
       let p

       p = WodePsn.make(spaceView, 2)
       p.lineRightOverSpace()
       equal(p.bep, 4)
     })

test('lineRightOverSpace', 'no spaces leaves bep',
     () => {
       let p

       p = WodePsn.make(baseView, 2)
       p.lineRightOverSpace()
       equal(p.bep, 2)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
