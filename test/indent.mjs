import { equal } from 'node:assert/strict'
import { EditorState } from '../lib/@codemirror/state.js'
import { indentRange, indentNodeProp, delimitedIndent, syntaxTree, ensureSyntaxTree } from '../lib/@codemirror/language.js'
import { javascriptLanguage } from '../lib/@codemirror/lang-javascript.js'
import { makeJsIndents } from '../js/wode-lang-js.mjs'

let tests, customIndent, customProps, lang

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

// EditorState.create parses with a 20ms wall clock budget and keeps whatever
// prefix it managed to parse. Under load that can be the empty tree, and
// indentRange then leaves every line past the tree untouched, so the test
// reads a half-indented document. Finish the parse and publish it into the
// state, as forceParsing does for a view, before asking for indentation.
function settle
(state) {
  let after

  after = state
  for (;;) {
    let before

    before = syntaxTree(after).length
    if (before == after.doc.length)
      return after
    ensureSyntaxTree(after, after.doc.length, 10000)
    after = after.update({}).state
    if (syntaxTree(after).length <= before)
      // no progress, give up so the caller reports it
      return after
  }
}

function autoIndent
(code) {
  let state, changes

  state = settle(EditorState.create({ doc: code,
                                      extensions: [ lang ] }))
  equal(syntaxTree(state).length, state.doc.length,
        'the parse covers the whole document')
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

// The state's initial parse only covers the first 3000 characters, so the tail
// of a longer document used to be read while the tree below it was missing and
// came back unindented. The state created under load can be cut short the same
// way, which is what made 'object methods same indent' fail.
pass('object methods same indent past the parse viewport',
     'y = { f() {\n// this\n},\n' +
     'f() {\n// that\n},\n'.repeat(200) +
     'h() {\n// that\n} }',
     'y = { f() {\n        // this\n      },\n' +
     '      f() {\n        // that\n      },\n'.repeat(200) +
     '      h() {\n        // that\n      } }')

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

pass('function expression body',
     `
let x = function() {
// inside
}`,
     `
let x = function() {
          // inside
        }`)

pass('function expression closing brace',
     `
let x = function() {
          // inside
}`,
     `
let x = function() {
          // inside
        }`)

pass('arrow expression body',
     `
let x = () => {
// inside
}`,
     `
let x = () => {
          // inside
        }`)

pass('arrow expression closing brace',
     `
let x = () => {
          // inside
}`,
     `
let x = () => {
          // inside
        }`)

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
