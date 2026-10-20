import { equal } from 'node:assert/strict'
import { atEnd, makeStick, nextMsgIndex, prevMsgIndex } from '../ext/code/scroll.mjs'

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

test('msg nav', 'prev at the top scrolls to the top',
     () => {
       equal(prevMsgIndex([ 100, 500, 900 ], 0), -1)
     })

test('msg nav', 'prev from the buffer end goes to the last message',
     () => {
       equal(prevMsgIndex([ 100, 500, 900 ], 5000), 2)
     })

test('msg nav', 'repeated prev steps through every message',
     () => {
       equal(prevMsgIndex([ 100, 500, 900 ], 900 - 7), 1)
       equal(prevMsgIndex([ 100, 500, 900 ], 500 - 7), 0)
       equal(prevMsgIndex([ 100, 500, 900 ], 100 - 7), -1)
     })

test('msg nav', 'next from the top goes to the first message',
     () => {
       equal(nextMsgIndex([ 100, 500, 900 ], 0, 7, 1000), 0)
     })

test('msg nav', 'next from the buffer end scrolls to the end',
     () => {
       equal(nextMsgIndex([ 100, 500, 900 ], 900 - 7, 7, 1000), -1)
     })

test('msg nav', 'repeated next steps through every message',
     () => {
       equal(nextMsgIndex([ 100, 500, 900 ], 100 - 7, 7, 1000), 1)
       equal(nextMsgIndex([ 100, 500, 900 ], 500 - 7, 7, 1000), 2)
       equal(nextMsgIndex([ 100, 500, 900 ], 900 - 7, 7, 1000), -1)
     })

test('msg nav', 'next to a message that cannot be aligned scrolls to the end',
     () => {
       // 900 - 7 is past the end (890), so jumping there would leave us short
       equal(nextMsgIndex([ 100, 500, 900 ], 500 - 7, 7, 890), -1)
     })

test('msg nav', 'next after a sub-pixel landing steps past that message',
     () => {
       // scrollTop can snap half a pixel short of the message top (hidpi), so
       // the message we landed on sits pad + 0.5 below the top, not pad
       equal(nextMsgIndex([ 100.5, 500.5, 900.5 ], 900.5 - 7 - 0.5, 7, 2000), -1)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
