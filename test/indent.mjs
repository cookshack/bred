import { equal } from 'node:assert/strict'
import { EditorState } from '../lib/@codemirror/state.js'
import { indentRange, indentNodeProp, delimitedIndent } from '../lib/@codemirror/language.js'
import { javascriptLanguage } from '../lib/@codemirror/lang-javascript.js'

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

customIndent = {
  'FunctionDeclaration ParamList': ctx => ctx.baseIndent,
  'Property ParamList': ctx => {
    let block

    block = ctx.node.parent?.getChild('Block')
    if (block) {
      let blockText

      blockText = ctx.state.doc.slice(block.from, block.to)
      if (/^\s*}/.test(blockText))
        return ctx.column(ctx.node.parent.from)
    }
    return ctx.column(ctx.node.parent.from) + ctx.unit
  },

  Block: ctx => {
    let parent

    parent = ctx.node.parent?.name

    // Property Block: use Property's column + unit (no alignment)
    if (parent == 'Property') {
      if (/^\s*}/.test(ctx.textAfter))
        return ctx.column(ctx.node.parent.from)
      return ctx.column(ctx.node.parent.from) + ctx.unit
    }

    // FunctionDeclaration Block: check if brace on same line as params
    if (parent == 'FunctionDeclaration') {
      let line, text, bracePos

      line = ctx.state.doc.lineAt(ctx.node.from)
      text = line.text
      bracePos = text.indexOf('{')
      if (bracePos > 0)
        return delimitedIndent({ closing: '}', align: false })(ctx)
    }

    // Other blocks: use delimitedIndent with align: true
    return delimitedIndent({ closing: '}', align: true })(ctx)
  }
}

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

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
