import { equal } from 'node:assert/strict'
import * as VcCommon from '../js/vc-common.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

tests = {}

test('stateClr', 'modified uses syntax3',
     () => {
       equal(VcCommon.stateClr('M'), '--clr-syntax3')
     })

test('stateClr', 'added uses syntax0',
     () => {
       equal(VcCommon.stateClr('A'), '--clr-syntax0')
     })

test('stateClr', 'renamed uses emph',
     () => {
       equal(VcCommon.stateClr('R'), '--clr-emph')
     })

test('stateClr', 'partially staged uses syntax4',
     () => {
       equal(VcCommon.stateClr('P'), '--clr-syntax4')
     })

test('stateClr', 'deleted uses text',
     () => {
       equal(VcCommon.stateClr('D'), '--clr-text')
     })

test('stateClr', 'untracked uses syntax1',
     () => {
       equal(VcCommon.stateClr('O'), '--clr-syntax1')
     })

test('stateClr', 'conflict uses nb2',
     () => {
       equal(VcCommon.stateClr('C'), '--clr-nb2')
     })

test('stateClr', 'unknown state falls back to text',
     () => {
       equal(VcCommon.stateClr('X'), '--clr-text')
       equal(VcCommon.stateClr(''), '--clr-text')
       equal(VcCommon.stateClr(0), '--clr-text')
     })

test('formatDate', 'empty string returns empty',
     () => {
       equal(VcCommon.formatDate(''), '')
     })

test('formatDate', 'missing date returns empty',
     () => {
       equal(VcCommon.formatDate(0), '')
     })

test('formatDate', 'today returns time padded to 20',
     () => {
       let got

       got = VcCommon.formatDate(new Date().toISOString())
       equal(got.length, 20)
       equal(/^\d{2}h\d{2} +$/.test(got), true)
     })

test('formatDate', 'other day returns date text',
     () => {
       let d, got, wd

       d = new Date(Date.now() - (3 * 24 * 60 * 60 * 1000))
       wd = [ 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ][d.getDay()]
       got = VcCommon.formatDate(d.toISOString())
       equal(got.startsWith(wd + ' '), true)
       equal(/^\S+ \d{4}-\d{2}-\d{2} \d{2}h\d{2}$/.test(got), true)
     })

test('shortReason', 'review_requested becomes review',
     () => {
       equal(VcCommon.shortReason('review_requested'), 'review')
     })

test('shortReason', 'subscribed becomes sub',
     () => {
       equal(VcCommon.shortReason('subscribed'), 'sub')
     })

test('shortReason', 'other reasons pass through',
     () => {
       equal(VcCommon.shortReason('comment'), 'comment')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
