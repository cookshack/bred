import { equal } from 'node:assert/strict'
import * as Area from '../js/Area.mjs'
import * as DirCommon from '../js/dir-common.mjs'
import * as DirOps from '../js/dir-ops.mjs'
import * as Hist from '../js/hist.mjs'
import * as Win from '../js/win.mjs'
import { setupPanes } from './pane-helpers.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

// a minimal dir-only buf, enough for dir-ops
function fakeDirBuf
(path) {
  let vars

  vars = {}
  return { mode: { key: 'dir' },
           path,
           views: [],
           vars: key => {
             vars[key] = vars[key] || {}
             return vars[key]
           } }
}

function pinBuf
(p, buf, dir) {
  Object.defineProperty(p, 'buf', { value: buf, configurable: 1 })
  Object.defineProperty(p, 'dir', { value: dir, configurable: 1 })
}

function promptBuf
() {
  return Area.getByName(Win.current(), 'bred-float')?.tab?.frame?.pane?.buf
}

function mark
(p, names) {
  let marked

  marked = DirCommon.getMarked(p.buf)
  names.forEach(name => marked.add(name, 'f'))
}

tests = {}

test('nextDir', 'uses the dir shown in the next pane',
     () => {
       equal(DirCommon.nextDir({ next: { buf: fakeDirBuf('/other/dir') } }),
             '/other/dir/')
     })

test('nextDir', 'keeps a trailing slash',
     () => {
       equal(DirCommon.nextDir({ next: { buf: fakeDirBuf('/other/dir/') } }),
             '/other/dir/')
     })

test('nextDir', 'missing when there is no next pane',
     () => {
       equal(DirCommon.nextDir({ next: 0 }), undefined)
     })

test('nextDir', 'missing when the next pane is a file',
     () => {
       equal(DirCommon.nextDir({ next: { buf: { mode: { key: 'ed' } } } }),
             undefined)
     })

test('copy', 'marked files offer the next pane dir',
     () => {
       let pA, pB, panes

       panes = setupPanes()
       pA = panes.pA
       pB = panes.pB

       pinBuf(pA, fakeDirBuf('/other/dir'), '/other/dir')
       pinBuf(pB, fakeDirBuf('/here'), '/here')
       mark(pB, [ 'a.txt', 'b.txt' ])

       DirOps.copy()

       equal(promptBuf()?.placeholder, '/other/dir/')
     })

test('rename', 'marked files offer the next pane dir',
     () => {
       let pA, pB, panes

       panes = setupPanes()
       pA = panes.pA
       pB = panes.pB

       pinBuf(pA, fakeDirBuf('/other/dir'), '/other/dir')
       pinBuf(pB, fakeDirBuf('/here'), '/here')
       mark(pB, [ 'a.txt', 'b.txt' ])

       DirOps.rename()

       equal(promptBuf()?.placeholder, '/other/dir/')
     })

test('copy', 'marked files fall back to destination history',
     () => {
       let hist, pA, pB, panes

       panes = setupPanes()
       pA = panes.pA
       pB = panes.pB

       pinBuf(pA, { mode: { key: 'ed' }, views: [] }, '/tmp')
       pinBuf(pB, fakeDirBuf('/here'), '/here')
       hist = Hist.make('dir-ops-test')
       hist.add('/last/dest/')
       pB.buf.vars('dir').hist = hist
       mark(pB, [ 'a.txt', 'b.txt' ])

       DirOps.copy()

       equal(promptBuf()?.placeholder, '/last/dest/')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
