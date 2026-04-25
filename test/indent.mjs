import { equal } from 'node:assert/strict'
import { EditorState } from '../lib/@codemirror/state.js'
import { indentRange, indentNodeProp, delimitedIndent } from '../lib/@codemirror/language.js'
import { javascriptLanguage } from '../lib/@codemirror/lang-javascript.js'
import { makeJsIndents } from '../js/wode-lang-js.mjs'

let tests, customIndent, customProps, lang

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function autoIndent
(code) {
  let state, changes

  state = EditorState.create({ doc: code,
                               extensions: [ lang ] })
  changes = indentRange(state, 0, state.doc.length)
  return changes.apply(state.doc).toString()
}

function pass
(name, input, expected) {
  test('indent', name,
       () => equal(autoIndent(input),
                   expected))
}

tests = {}

customIndent = makeJsIndents({ delimitedIndent, flatIndent: delimitedIndent })
customProps = indentNodeProp.add(customIndent)
lang = javascriptLanguage.configure({ props: [ customProps ] })

pass('object methods same indent',
     `
y = { f() {
// this
},
g() {
// that
},
h() {
// that
} }`,
     `
y = { f() {
        // this
      },
      g() {
        // that
      },
      h() {
        // that
      } }`)

pass('object methods same indent 2',
     `
y = { f() {
// this
},
g() {
// that
} }`,
     `
y = { f() {
        // this
      },
      g() {
        // that
      } }`)

pass('struct',
     `
a = { a1: 1,
a2: 2 }`,
     `
a = { a1: 1,
      a2: 2 }`)

pass('struct return',
     `
return { a1: 1,
a2: 2 }`,
     `
return { a1: 1,
         a2: 2 }`)

pass('if',
     `
if (x) {
console.log('a')
}
`,
     `
if (x) {
  console.log('a')
}
`)

pass('while',
     `
while (x) {
// do
}`,
     `
while (x) {
  // do
}`)

pass('block',
     `
{
// inside
}`,
     `
{
  // inside
}`)

pass('fn',
     `
function f() {
  // inside
}`,
     `
function f() {
  // inside
}`)

pass('fn',
     `
function g
() {
// inside
}`,
     `
function g
() {
  // inside
}`)

pass('struct fn param list',
     `
y = { f
() {
// this
},
g
() {
// that
} }`,
     `
y = { f
      () {
        // this
      },
      g
      () {
        // that
      } }`)

pass('struct fn param list when string name',
     `
y = { 'Program:xxx'
() {
// this
},
'Program:exit'
() {
// that
} }`,
     `
y = { 'Program:xxx'
      () {
        // this
      },
      'Program:exit'
      () {
        // that
      } }`)

pass('return with fn param list when string name',
     `
return { 'Program:xxx'
() {
// this
},
'Program:exit'
() {
// that
} }`,
     `
return { 'Program:xxx'
         () {
           // this
         },
         'Program:exit'
         () {
           // that
         } }`)

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
