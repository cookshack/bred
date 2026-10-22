import { equal } from 'node:assert/strict'
import * as Scrollbar from '../js/scrollbar.mjs'
import { setupDom } from './dom-help.mjs'

let globalKeys, saved, tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

// setupDom swaps in happy-dom; save and restore the globals so other test
// files keep the ones they installed at load time
globalKeys = 'document window navigator Element HTMLElement HTMLDocument Node NodeFilter Text DocumentFragment Comment Event CustomEvent DOMRect getComputedStyle requestAnimationFrame cancelAnimationFrame ResizeObserver MutationObserver IntersectionObserver getSelection FileReader Blob URL'.split(' ')

function saveGlobals
() {
  saved = {}
  globalKeys.forEach(k => saved[k] = globalThis[k])
}

function restoreGlobal
(k) {
  try {
    globalThis[k] = saved[k]
  }
  catch {
  }
}

function restoreGlobals
() {
  globalKeys.forEach(restoreGlobal)
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

test('make', 'drops a bar copied in with cloned content',
     () => {
       let dom

       saveGlobals()
       try {
         let bar, host, scroller, stale

         dom = setupDom()
         host = dom.document.createElement('div')
         scroller = dom.document.createElement('div')
         host.append(scroller)

         // what cloneNode copies into a new view
         stale = dom.document.createElement('div')
         stale.className = 'bred-scrollbar'
         host.append(stale)

         bar = Scrollbar.make(scroller, {})
         equal(host.querySelectorAll('.bred-scrollbar').length, 1, 'host owns one bar')
         equal(host.firstElementChild == scroller, true, 'keeps the scroller')
         bar.destroy()
       }
       finally {
         dom?.happyDOM?.cancelAsync()
         restoreGlobals()
       }
     })

test('make', 'leaves bars of nested content alone',
     () => {
       let dom

       saveGlobals()
       try {
         let bar, host, nested, scroller

         dom = setupDom()
         host = dom.document.createElement('div')
         scroller = dom.document.createElement('div')
         host.append(scroller)

         nested = dom.document.createElement('div')
         nested.innerHTML = '<div class="bred-scrollbar"></div>'
         scroller.append(nested)

         bar = Scrollbar.make(scroller, {})
         equal(nested.querySelectorAll('.bred-scrollbar').length, 1, 'nested bar untouched')
         bar.destroy()
       }
       finally {
         dom?.happyDOM?.cancelAsync()
         restoreGlobals()
       }
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
