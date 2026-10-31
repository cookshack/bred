import { equal } from 'node:assert/strict'

let tests, _shared

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

globalThis.document = { dispatchEvent: () => {},
                        documentElement: { style: {} },
                        createElement: () => ({ style: {} }) }
globalThis.Element = class Element {}
globalThis.HTMLDocument = class HTMLDocument {}
_shared = globalThis.bred?._shared?.() || {}
_shared.opt = _shared.opt || { values: {},
                               types: {},
                               onSets: {},
                               onSetAlls: [],
                               onSetBufs: {},
                               onSetBufAlls: [] }
globalThis.bred = { _shared: () => _shared }

let Dir

Dir = await import('../js/dir.mjs')

tests = {}

function fakeSurf
(scrollTop) {
  return { scrollTop,
           getBoundingClientRect: () => ({ top: 0, bottom: 200 }) }
}

function visibleEl
(surf, rect) {
  return { classList: { contains: () => 0 },
           closest: () => surf,
           getBoundingClientRect: () => rect }
}

// The fake point jumps the scroll unless skipScroll is 1, mimicking what
// point.sync did on every scroll-driven dir redraw.
function fakeView
(opts) {
  let dirVars, point, scroll, view

  dirVars = { lines: [ 1, 2, 3 ], current: opts.current }
  scroll = { renderCount: 0,
             count: 0,
             render
             () {
               this.renderCount++
             },
             updateItemCount
             (n) {
               this.count = n
             } }
  point = { puts: [],
            over
            (el) {
              return el ? 0 : opts.over
            },
            put
            (el, skipScroll) {
              this.puts.push({ el, skipScroll })
              if (skipScroll == 1)
                return
              opts.surf.scrollTop = 0
            } }
  view = { buf: { vars: () => dirVars },
           vars: () => ({ scroll }),
           ele: { querySelector: () => ({}),
                  querySelectorAll: () => [] },
           point }

  return { view, point, scroll }
}

test('redraw', 'keeps scroll when the cursor line is still visible',
     () => {
       let cur, fake, surf

       surf = fakeSurf(100)
       cur = visibleEl(surf, { top: 50, bottom: 70 })
       cur.dataset = { path: '/tmp/a' }
       fake = fakeView({ surf, current: cur })
       fake.view.ele.querySelector = sel => sel == '.dir-h' ? {} : cur
       Dir.redraw(fake.view)
       equal(surf.scrollTop, 100, 'must not jump back to the cursor')
       equal(fake.point.puts.length, 1)
       equal(fake.point.puts[0].el, cur, 'keeps the cursor on its line')
       equal(fake.point.puts[0].skipScroll, 1, 'must put without scrolling')
       equal(fake.scroll.renderCount, 1, 'renders for the new position')
       equal(fake.scroll.count, 3, 'updates the item count')
     })

test('redraw', 'keeps scroll when the cursor line scrolled offscreen',
     () => {
       let current, dirName, fake, off, row, surf

       surf = fakeSurf(100)
       current = visibleEl(surf, { top: -40, bottom: -20 })
       current.dataset = { path: '/tmp/off' }
       off = visibleEl(surf, { top: -40, bottom: -20 })
       off.dataset = { path: '/tmp/off' }
       dirName = { classList: { contains: n => n == 'dir-name' ? 1 : 0 },
                   closest: () => surf }
       row = { firstElementChild: dirName, nextElementSibling: 0 }
       dirName.parentNode = row
       fake = fakeView({ surf, current, over: dirName })
       fake.view.ele.querySelector = sel => sel == '.dir-h' ? {} : off
       Dir.redraw(fake.view)
       equal(surf.scrollTop, 100, 'must not jump back')
       equal(fake.point.puts.length, 1)
       equal(fake.point.puts[0].el, dirName, 'cursor follows the line under the point')
       equal(fake.point.puts[0].skipScroll, 1, 'must put without scrolling')
     })

test('lastVisibleLine', 'includes a last row clipped by subpixel rounding',
     () => {
       let puts, rows, surf, view

       surf = fakeSurf(0)
       rows = [ visibleEl(surf, { top: 175, bottom: 199 }),
                visibleEl(surf, { top: 199, bottom: 200.4 }) ]
       puts = []
       view = { ele: { querySelectorAll: () => rows },
                buf: { vars: () => ({}) },
                point: { put: (el, skipScroll) => puts.push({ el, skipScroll }) } }

       Dir.lastVisibleLine(view)
       equal(puts.length, 1)
       equal(puts[0].el, rows[1], 'last row counts even when a fraction outside')
     })

test('lastVisibleLine', 'skips a row that is clearly clipped',
     () => {
       let puts, rows, surf, view

       surf = fakeSurf(0)
       rows = [ visibleEl(surf, { top: 175, bottom: 199 }),
                visibleEl(surf, { top: 199, bottom: 205 }) ]
       puts = []
       view = { ele: { querySelectorAll: () => rows },
                buf: { vars: () => ({}) },
                point: { put: (el, skipScroll) => puts.push({ el, skipScroll }) } }

       Dir.lastVisibleLine(view)
       equal(puts.length, 1)
       equal(puts[0].el, rows[0], 'must not pick a row below the listing')
     })

test('selectFile', 'moves point to the matching file',
     () => {
       let dirName, dirVars, view

       dirName = { dataset: { name: 'b.txt' } }
       dirVars = {}
       view = { ele: { querySelectorAll: () => [ { dataset: { name: 'a.txt' } }, dirName ] },
                buf: { vars: () => dirVars },
                point: { puts: [],
                         put
                         (el) {
                           this.puts.push(el)
                         } } }

       equal(Dir.selectFile(view, 'b.txt'), 1)
       equal(view.point.puts.length, 1)
       equal(view.point.puts[0], dirName)
       equal(dirVars.current, dirName)
     })

test('selectFile', 'missing file leaves point alone',
     () => {
       let dirVars, view

       dirVars = {}
       view = { ele: { querySelectorAll: () => [ { dataset: { name: 'a.txt' } } ] },
                buf: { vars: () => dirVars },
                point: { puts: [],
                         put
                         (el) {
                           this.puts.push(el)
                         } } }

       equal(Dir.selectFile(view, 'b.txt'), 0)
       equal(view.point.puts.length, 0)
       equal(dirVars.current, undefined)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
