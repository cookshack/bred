import { equal } from 'node:assert/strict'
import { EditorState } from '../lib/@codemirror/state.js'
import { indentRange, getIndentation, indentNodeProp } from '../lib/@codemirror/language.js'
import { javascriptLanguage } from '../lib/@codemirror/lang-javascript.js'

let tests

function test(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name: name, cb: cb })
}

tests = {}

let customIndent = {
  Block: ctx => {
    if (ctx.node.parent?.name === 'Property') {
      if (/^\s*}/.test(ctx.textAfter)) {
        return ctx.column(ctx.node.parent.from)
      }
      return ctx.column(ctx.node.parent.from) + ctx.unit
    }
    // For other blocks, use default delimited indent
    if (/^\s*}/.test(ctx.textAfter)) {
      return ctx.baseIndent
    }
    return ctx.baseIndent + ctx.unit
  }
}

let customProps = indentNodeProp.add(customIndent)
let lang = javascriptLanguage.configure({ props: [customProps] })

function autoIndent(code) {
  let state = EditorState.create({
    doc: code,
    extensions: [lang]
  })
  let changes = indentRange(state, 0, state.doc.length)
  return changes.apply(state.doc).toString()
}

function pass(name, input, expected) {
  test('indent', name,
       () => equal(autoIndent(input),
                   expected))
}

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

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
