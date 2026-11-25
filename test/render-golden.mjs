import { equal } from 'node:assert/strict'
import Fs from 'node:fs'
import Path from 'node:path'
import Url from 'node:url'

import * as ManParse from '../js/man-parse.mjs'
import * as ManRender from '../js/man-render.mjs'
import { setupDom } from './dom-help.mjs'

// A golden is the structural tree of a rendered fixture: tag, class, colspan
// and text, indented. Not a screenshot — a block or class regression is what we
// want to catch, and a pixel diff cannot tell a moved heading from a rounding
// error. `UPDATE_GOLDENS=1 npx mocha test/render-golden.mjs` regenerates them.
//
// Adding a case is adding a `<name>.man` beside its `<name>.golden`.

let fixtures

fixtures = Path.join(Path.dirname(Url.fileURLToPath(import.meta.url)), 'fixtures', 'render')

function text
(value) {
  return String(value).replace(/\s+/g, ' ').trim()
}

function walk
(el, depth, out) {
  let tag, cls, span, i

  tag = el.tagName.toLowerCase()
  cls = String(el.className || '').trim()
  span = el.getAttribute('colspan')
  out.push('  '.repeat(depth) + tag +
           (cls ? '.' + cls.split(/\s+/).join('.') : '') +
           (span ? ' colspan=' + span : ''))

  i = 0
  while (i < el.childNodes.length) {
    let node

    node = el.childNodes[ i ]
    if (node.nodeType == 1)
      walk(node, depth + 1, out)
    else if (node.nodeType == 3) {
      let value

      value = text(node.nodeValue)
      if (value.length)
        out.push('  '.repeat(depth + 1) + '"' + value + '"')
    }
    i += 1
  }
}

function tree
(el) {
  let out

  out = []
  walk(el, 0, out)
  return out.join('\n') + '\n'
}

function rendered
(name) {
  let source, res

  source = Fs.readFileSync(Path.join(fixtures, name + '.man'), 'utf8')
  res = ManParse.parse(source)
  if (res.ok == 0)
    return 0

  return tree(ManRender.render(res.doc).el)
}

function firstDiff
(want, got) {
  let a, b, i

  a = want.split('\n')
  b = got.split('\n')
  i = 0

  while ((i < a.length) && (i < b.length)) {
    if ((a[ i ] == b[ i ]) == 0)
      return 'line ' + (i + 1) + ': want ' + JSON.stringify(a[ i ]) + ' got ' + JSON.stringify(b[ i ])
    i += 1
  }

  if ((a.length == b.length) == 0)
    return 'length: want ' + a.length + ' got ' + b.length

  return 0
}

function check
(name) {
  let got, want, file

  got = rendered(name)
  if (got == 0)
    return name + ' does not parse'
  file = Path.join(fixtures, name + '.golden')

  if (process.env.UPDATE_GOLDENS) {
    Fs.writeFileSync(file, got)
    return 0
  }

  want = Fs.readFileSync(file, 'utf8')
  return got == want ? 0 : firstDiff(want, got)
}

function names
() {
  return Fs.readdirSync(fixtures).filter(f => f.endsWith('.man'))
    .map(f => f.slice(0, -4)).sort()
}

function makeCheck
(name) {
  return checker.bind(0, name)
}

function checker
(name) {
  let diff

  diff = check(name)
  equal(diff, 0, diff || '')
}

// The point of a golden is that a change it was not told about fails it. This
// is the planted class change: the same tree with one class renamed.
function planted
() {
  let got, changed, diff

  got = rendered('blocks')
  changed = got.replace('man-bold', 'man-BOLD')

  equal((changed == got) == 0, true)
  diff = firstDiff(got, changed)
  equal(String(diff).includes('man-BOLD'), true, diff || '')
}

function addCase
(name) {
  globalThis.it(name, makeCheck(name))
}

function suite
() {
  globalThis.beforeEach(setupDom)
  names().forEach(addCase)
  globalThis.it('one renamed class is a failure', planted)
}

globalThis.describe('render-golden', suite)
