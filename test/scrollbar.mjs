import { equal } from 'node:assert/strict'
import * as Scrollbar from '../js/scrollbar.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

tests = {}

test('thumbFor', 'hidden when content fits',
     () => {
       let info

       info = Scrollbar.thumbFor(0, 150, 200, 100)
       equal(info.hidden, 1)
       equal(info.height, 100)
       equal(info.top, 0)
     })

test('thumbFor', 'thumbs proportional to content',
     () => {
       let info

       info = Scrollbar.thumbFor(0, 1000, 200, 100)
       equal(info.hidden, 0)
       equal(info.height, 20)
       equal(info.top, 0)
     })

test('thumbFor', 'thumb reaches bottom of track',
     () => {
       let info

       info = Scrollbar.thumbFor(800, 1000, 200, 100)
       equal(info.top, 80)
     })

test('thumbFor', 'thumb has a minimum size',
     () => {
       let info

       info = Scrollbar.thumbFor(0, 10000, 100, 100)
       equal(info.height, 18)
     })

test('scrollForThumb', 'inverts thumbFor',
     () => {
       let info, top

       info = Scrollbar.thumbFor(400, 1000, 200, 100)
       top = Scrollbar.scrollForThumb(info.top, 100, info.height, 1000, 200)
       equal(top, 400)
     })

test('scrollForThumb', 'top maps to top',
     () => {
       equal(Scrollbar.scrollForThumb(0, 100, 20, 1000, 200), 0)
     })

test('scrollForThumb', 'bottom maps to bottom',
     () => {
       equal(Scrollbar.scrollForThumb(80, 100, 20, 1000, 200), 800)
     })

test('scrollForThumb', 'zero when thumb fills track',
     () => {
       equal(Scrollbar.scrollForThumb(10, 100, 100, 1000, 200), 0)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
