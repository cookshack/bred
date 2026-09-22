import { equal } from 'node:assert/strict'
import { atEnd, makeStick } from '../ext/code/scroll.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

// a plain object with the metrics a scroller exposes
function fakeW
(scrollHeight, clientHeight, scrollTop) {
  let onScrolls

  onScrolls = []
  return { scrollHeight,
           clientHeight,
           scrollTop,
           addEventListener: (name, cb) => {
                               if (name == 'scroll')
                                 onScrolls.push(cb)
                             },
           fireScroll: () => onScrolls.forEach(cb => cb()) }
}

tests = {}

test('atEnd', 'true at the bottom',
     () => {
       equal(atEnd(fakeW(1000, 200, 800)), true)
     })

test('atEnd', 'true within the threshold',
     () => {
       equal(atEnd(fakeW(1000, 200, 795)), true)
     })

test('atEnd', 'false when scrolled up',
     () => {
       equal(atEnd(fakeW(1000, 200, 500)), false)
     })

test('stick', 'starts pinned',
     () => {
       let pinned

       pinned = makeStick(fakeW(1000, 200, 800))
       equal(pinned(), 1)
     })

test('stick', 'stays pinned while the response grows and we follow it',
     () => {
       let pinned, w

       w = fakeW(1000, 200, 800)
       pinned = makeStick(w)

       // growth, then our own scroll down to the new end
       w.scrollHeight = 1500
       w.scrollTop = 1300
       w.fireScroll()
       equal(pinned(), 1)

       // more growth, and a scroll down that is not quite at the end
       w.scrollHeight = 2000
       w.scrollTop = 1400
       w.fireScroll()
       equal(pinned(), 1)
     })

test('stick', 'content growth alone keeps it pinned',
     () => {
       let pinned, w

       w = fakeW(1000, 200, 800)
       pinned = makeStick(w)
       // grew, scrollTop unchanged: no scroll event
       w.scrollHeight = 1500
       equal(pinned(), 1)
     })

test('stick', 'unpins when the user scrolls up',
     () => {
       let pinned, w

       w = fakeW(1000, 200, 800)
       pinned = makeStick(w)
       w.scrollTop = 500
       w.fireScroll()
       equal(pinned(), 0)
     })

test('stick', 're-pins when the user scrolls back',
     () => {
       let pinned, w

       w = fakeW(1000, 200, 800)
       pinned = makeStick(w)
       w.scrollTop = 500
       w.fireScroll()
       w.scrollTop = 800
       w.fireScroll()
       equal(pinned(), 1)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
