import { equal } from 'node:assert/strict'

import * as CMState from '../lib/@codemirror/state.js'
import { showMinimap } from '../ext/minimap/lib/@replit/codemirror-minimap.js'
import { make } from '../ext/minimap/minimap.mjs'

let tests

tests = {}

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

let opts

opts = { 'minimap.enabled': 1,
         'minimap.text.type': 'blocks',
         'minimap.maxLines': 100,
         'minimap.maxBytes': 1000 }

// The facet is null when there is no minimap, per the lib.
function facet
(doc) {
  let buf, state

  buf = { opt: name => opts[name] }
  state = CMState.EditorState.create({ doc, extensions: [ make({ buf }) ] })
  return state.facet(showMinimap)
}

test('minimap', 'a normal doc gets a minimap',
     () => equal(facet('x\n'.repeat(50)) == null, false))

test('minimap', 'a doc past the line cap gets no minimap',
     () => equal(facet('x\n'.repeat(200)) == null, true))

test('minimap', 'a doc past the byte cap gets no minimap',
     () => equal(facet('x'.repeat(2000)) == null, true))

test('minimap', 'disabled means no minimap',
     () => {
       let buf

       buf = { opt: name => name == 'minimap.enabled' ? 0 : opts[name] }
       equal(CMState.EditorState.create({ doc: 'x\n',
                                          extensions: [ make({ buf }) ] }).facet(showMinimap) == null,
             true)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
