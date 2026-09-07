import { equal } from 'node:assert/strict'
import * as WodeMode from '../js/wode-mode.mjs'

let tests

globalThis.document = { dispatchEvent: () => {},
                        documentElement: { style: {} } }
globalThis.Element = class Element {}
globalThis.HTMLDocument = class HTMLDocument {}

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

tests = {}

test('modeFromLang', 'plaintext maps to text',
     () => {
       equal(WodeMode.modeFromLang('plaintext'), 'text')
     })

test('modeFromLang', 'other ids pass through',
     () => {
       equal(WodeMode.modeFromLang('javascript'), 'javascript')
     })

test('modeLang', 'returns id',
     () => {
       equal(WodeMode.modeLang('c'), 'c')
     })

test('modeFor', 'no path gives Ed',
     () => {
       equal(WodeMode.modeFor(0), 'Ed')
     })

test('makeExtsMode', 'no wextsMode gives empty',
     () => {
       let v

       v = { wode: {} }
       equal(WodeMode.makeExtsMode(v).length, 0)
     })

test('makeExtsMode', 'maps make of wexts',
     () => {
       let v

       v = { wode: { wextsMode: [ { make: () => 'a' }, { make: () => 'b' }, {} ] } }
       equal(WodeMode.makeExtsMode(v).join(','), 'a,b')
     })

test('makeExtsMinors', 'empty minors gives empty',
     () => {
       let v

       v = { buf: { minors: [] } }
       equal(WodeMode.makeExtsMinors(v).length, 0)
     })

test('makeExtsMinors', 'builds from minor wexts',
     () => {
       let v

       v = { buf: { minors: [ { wexts: [ { make: () => 'x' } ] },
                             { wexts: [ { make: () => 'y' }, {} ] } ] } }
       equal(WodeMode.makeExtsMinors(v).join(','), 'x,y')
     })

test('seize', 'reconfigures mode exts',
     () => {
       let dispatchRec, v

       dispatchRec = 0
       v = { wode: { wextsMode: [],
                     comp: { extsMode: { reconfigure: exts => ({ exts }) } } },
             buf: { mode: { wexts: [ { make: () => 'ext' } ] } },
             ed: { dispatch: tr => dispatchRec = tr } }
       WodeMode.seize({ views: [ v ] }, { key: 'mode' })
       equal(v.wode.wextsMode, v.buf.mode.wexts)
       equal(dispatchRec.effects.exts.join(','), 'ext')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
