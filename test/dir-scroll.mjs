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
       let fake, surf

       surf = fakeSurf(100)
       fake = fakeView({ surf, current: visibleEl(surf, { top: 50, bottom: 70 }) })
       Dir.redraw(fake.view)
       equal(surf.scrollTop, 100, 'must not jump back to the cursor')
       equal(fake.point.puts.length, 1)
       equal(fake.point.puts[0].skipScroll, 1, 'must put without scrolling')
       equal(fake.scroll.renderCount, 1, 'renders for the new position')
       equal(fake.scroll.count, 3, 'updates the item count')
     })

test('redraw', 'keeps scroll when the cursor line scrolled offscreen',
     () => {
       let current, dirName, fake, row, surf

       surf = fakeSurf(100)
       current = visibleEl(surf, { top: -40, bottom: -20 })
       dirName = { classList: { contains: n => n == 'dir-name' ? 1 : 0 },
                   closest: () => surf }
       row = { firstElementChild: dirName, nextElementSibling: 0 }
       dirName.parentNode = row
       fake = fakeView({ surf, current, over: dirName })
       Dir.redraw(fake.view)
       equal(surf.scrollTop, 100, 'must not jump back')
       equal(fake.point.puts.length, 1)
       equal(fake.point.puts[0].el, dirName, 'cursor follows the line under the point')
       equal(fake.point.puts[0].skipScroll, 1, 'must put without scrolling')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
