import { equal, ok } from 'node:assert/strict'

// makeCmDiag is not exported, but we can reach it via _internals
import * as Lint from '../ext/core/lint.mjs'

let tests, makeCmDiag

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

tests = {}

globalThis.document = { dispatchEvent: () => {} }
globalThis.Element = class Element {}
globalThis.HTMLDocument = class HTMLDocument {}

// we need makeCmDiag — expose via internals for testing
// (handler is in the diff but not exported; we need to reach it)
makeCmDiag = Lint._internals?.makeCmDiag

// --- mock helpers ---

function makeDoc
(lines) {
  let lineObjs, offset

  lineObjs = []
  offset = 0
  for (let i = 0; i < lines.length; i++) {
    lineObjs.push({ from: offset,
                    number: i + 1 })
    offset += lines[i].length + 1
  }
  return { lines: lines.length,
           line
           (n) {
             return lineObjs[n - 1]
           } }
}

function makeView
(doc) {
  return { ed: { state: { doc } } }
}

// --- makeCmDiag tests ---

if (makeCmDiag) {
  test('makeCmDiag', 'inline error on first line',
       () => {
         let doc, view, diag, result

         doc = makeDoc([ 'int x = "hello";' ])
         view = makeView(doc)
         diag = { range: { start: { line: 0, character: 4 },
                           end: { line: 0, character: 5 } },
                  severity: 1,
                  message: 'type mismatch',
                  source: 'clangd' }
         result = makeCmDiag(view, diag)
         ok(result == null ? 0 : 1)
         equal(result.from, 4)
         equal(result.to, 5)
         equal(result.severity, 'error')
         equal(result.message, 'type mismatch')
         equal(result.source, 'clangd')
       })

  test('makeCmDiag', 'warning on second line',
       () => {
         let doc, view, diag, result

         doc = makeDoc([ '#include <stdio.h>', 'int main() { return; }' ])
         view = makeView(doc)
         diag = { range: { start: { line: 1, character: 11 },
                           end: { line: 1, character: 18 } },
                  severity: 2,
                  message: 'unused parameter',
                  source: 'clangd' }
         result = makeCmDiag(view, diag)
         ok(result == null ? 0 : 1)
         equal(result.from, 30) // line.from=19 (18 chars + 1 newline) + char 11
         equal(result.to, 37) // line.from=19 + char 18
         equal(result.severity, 'warning')
       })

  test('makeCmDiag', 'multiline diagnostic',
       () => {
         let doc, view, diag, result

         doc = makeDoc([ 'int x;', '{', '  return x;', '}' ])
         view = makeView(doc)
         diag = { range: { start: { line: 0, character: 5 },
                           end: { line: 2, character: 10 } },
                  severity: 1,
                  message: 'spans multiple lines',
                  source: 'clangd' }
         result = makeCmDiag(view, diag)
         ok(result == null ? 0 : 1)
         // line 0: from=0, +5 = 5
         equal(result.from, 5)
         // line 2: from = (7+1)+(2+1) = 8 + 3 = 11? Wait let me compute
         // line 1 offset: "int x;\n" = 6+1 = 7, so line 2 starts at 7
         // line 2 offset: "{\n" = 1+1 = 2, so line 3 starts at 7+2 = 9
         // line 3 (index 2): from=9, +10 = 19
         equal(result.to, 9 + 10)
         equal(result.severity, 'error')
       })

  test('makeCmDiag', 'severity 3 → info',
       () => {
         let doc, view, diag, result

         doc = makeDoc([ 'int x;' ])
         view = makeView(doc)
         diag = { range: { start: { line: 0, character: 0 },
                           end: { line: 0, character: 1 } },
                  severity: 3,
                  message: 'note',
                  source: 'clangd' }
         result = makeCmDiag(view, diag)
         equal(result.severity, 'info')
       })

  test('makeCmDiag', 'severity 4 → hint',
       () => {
         let doc, view, diag, result

         doc = makeDoc([ 'int x;' ])
         view = makeView(doc)
         diag = { range: { start: { line: 0, character: 0 },
                           end: { line: 0, character: 1 } },
                  severity: 4,
                  message: 'suggestion',
                  source: 'clangd' }
         result = makeCmDiag(view, diag)
         equal(result.severity, 'hint')
       })

  test('makeCmDiag', 'unknown severity → error',
       () => {
         let doc, view, diag, result

         doc = makeDoc([ 'int x;' ])
         view = makeView(doc)
         diag = { range: { start: { line: 0, character: 0 },
                           end: { line: 0, character: 1 } },
                  severity: 99,
                  message: 'unknown',
                  source: 'clangd' }
         result = makeCmDiag(view, diag)
         equal(result.severity, 'error')
       })

  test('makeCmDiag', 'fromLine past end of doc → null',
       () => {
         let doc, view, diag, result

         doc = makeDoc([ 'int x;' ]) // 1 line, index 0
         view = makeView(doc)
         diag = { range: { start: { line: 5, character: 0 },
                           end: { line: 5, character: 1 } },
                  severity: 1,
                  message: 'out of range',
                  source: 'clangd' }
         result = makeCmDiag(view, diag)
         equal(result, null)
       })

  test('makeCmDiag', 'toLine past end of doc → clamped',
       () => {
         let doc, view, diag, result

         doc = makeDoc([ 'line one', 'line two' ]) // 2 lines, indices 0,1
         view = makeView(doc)
         diag = { range: { start: { line: 0, character: 0 },
                           end: { line: 99, character: 4 } },
                  severity: 1,
                  message: 'clamped end',
                  source: 'clangd' }
         result = makeCmDiag(view, diag)
         ok(result == null ? 0 : 1)
         // doc.lines=2, toLine clamped to 1 (doc.lines-1)
         // line(1).from=0, +0 = 0
         equal(result.from, 0)
         // line(2).from = len("line one\n") = 9, +4 = 13
         equal(result.to, 9 + 4)
       })

  test('makeCmDiag', 'toLine exactly at doc end (not clamped)',
       () => {
         let doc, view, diag, result

         doc = makeDoc([ 'line one' ]) // 1 line, doc.lines = 1
         view = makeView(doc)
         diag = { range: { start: { line: 0, character: 0 },
                           end: { line: 0, character: 4 } },
                  severity: 1,
                  message: 'on last line',
                  source: 'clangd' }
         result = makeCmDiag(view, diag)
         ok(result == null ? 0 : 1)
         equal(result.from, 0)
         equal(result.to, 4)
       })

  test('makeCmDiag', 'missing source field',
       () => {
         let doc, view, diag, result

         doc = makeDoc([ 'int x;' ])
         view = makeView(doc)
         diag = { range: { start: { line: 0, character: 0 },
                           end: { line: 0, character: 1 } },
                  severity: 1,
                  message: 'no source' }
         result = makeCmDiag(view, diag)
         equal(result.source, undefined)
         equal(result.message, 'no source')
       })

  test('makeCmDiag', 'different severities map correctly',
       () => {
         let doc, view, sevs

         doc = makeDoc([ 'a' ])
         view = makeView(doc)
         sevs = { 1: 'error', 2: 'warning', 3: 'info', 4: 'hint' }
         for (let [ sev, expected ] of Object.entries(sevs)) {
           let diag, result

           diag = { range: { start: { line: 0, character: 0 },
                             end: { line: 0, character: 1 } },
                    severity: parseInt(sev),
                    message: sev,
                    source: 'test' }
           result = makeCmDiag(view, diag)
           equal(result.severity, expected)
         }
       })
}

// --- dispatch ---

function skip
() {
}

globalThis.describe = globalThis.describe || skip
globalThis.it = globalThis.it || skip
Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name + ' ',
                                                                                                     t.cb))))
