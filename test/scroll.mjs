import { equal } from 'node:assert/strict'
import * as Opt from '../js/opt.mjs'
import * as Scroll from '../js/scroll.mjs'

let computedCalls, els, rafCbs, styleMap, surfListeners, tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name,
                      cb: () => {
                        resetScroll()
                        cb()
                      } })
}

function resetScroll
() {
  let _shared

  computedCalls = 0
  els = []
  rafCbs = []
  styleMap = new Map()
  surfListeners = {}

  _shared = { opt: { values: {},
                     types: {},
                     onSets: {},
                     onSetAlls: [],
                     onSetBufs: {},
                     onSetBufAlls: [] } }
  globalThis.bred = { _shared: () => _shared }
  globalThis.tron = { cmd: async () => ({ err: 0, ch: 0 }),
                      receive: (ch, cb2) => cb2({ err: 0 }),
                      acmd: async () => ({}) }
  Scroll.init()

  globalThis.requestAnimationFrame = cb => rafCbs.push(cb)
  globalThis.DocumentFragment = class {
    constructor
    () {
      this.children = []
    }

    append
    (...kids) {
      kids.forEach(k => {
                     if (k.parent)
                       k.parent.firstChild = null
                     this.children.push(k)
                   })
    }
  }
  globalThis.document = { dispatchEvent: () => {},
                          documentElement: { style: {} },
                          createElement: () => {
                            let el

                            el = { style: {},
                                   dataset: {},
                                   className: '',
                                   innerHTML: '',
                                   firstChild: null,
                                   append: () => {} }
                            els.push(el)
                            return el
                          } }
  globalThis.getComputedStyle = el => {
                                  computedCalls += 1
                                  if (el == globalThis.document.documentElement)
                                    return { fontSize: '16px' }
                                  return { getPropertyValue: name => styleMap.get(el)?.[name] ?? '1' }
                                }
}

function makeSurf
(height) {
  let surf

  surf = { scrollTop: 0,
           getBoundingClientRect: () => ({ height }),
           addEventListener: (name, cb) => surfListeners[name] = cb,
           removeEventListener: name => delete surfListeners[name],
           innerHTML: '',
           append: frag => surf._frag = frag,
           querySelector: sel => {
             let m

             m = sel.match(/data-index="(\d+)"/)
             return m ? { dataIndex: Number(m[1]) } : null
           } }
  return surf
}

tests = {}

test('visibleCount', 'clamps to itemCount',
     () => {
       let sc, surf

       surf = makeSurf(50)
       sc = Scroll.make(surf, { itemCount: 2 })
       equal(sc.visibleCount, 2)
       sc = Scroll.make(surf, { itemCount: 10 })
       equal(sc.visibleCount, 4)
     })

test('visibleCount', 'uses line height from style',
     () => {
       let sc, surf

       surf = makeSurf(48)
       styleMap.set(surf, { '--line-height': '1.5' })
       sc = Scroll.make(surf, { itemCount: 5 })
       equal(sc.visibleCount, 2)
     })

test('render', 'pads top and bottom',
     () => {
       let sc, surf

       surf = makeSurf(50)
       surf.scrollTop = 32
       sc = Scroll.make(surf, { itemCount: 10, renderItem: el => el.firstChild = { parent: el } })
       sc.render()
       equal(surf._frag.children[0].style.height, '32px')
       equal(surf._frag.children.at(-1).style.height, '0px')
       equal(surf._frag.children.length, 10)
     })

test('render', 'items get index and id',
     () => {
       let sc, surf

       surf = makeSurf(50)
       sc = Scroll.make(surf, { itemCount: 10, idForItem: i => 'id-' + i, renderItem: el => el.firstChild = { parent: el } })
       sc.render()
       equal(els[1].dataset.index, 0)
       equal(els[1].dataset.id, 'id-0')
       equal(els[9].dataset.index, 8)
       equal(els[9].dataset.id, 'id-8')
       equal(surf._frag.children.slice(1, -1).length, 9)
     })

test('render', 'renderItem called per item',
     () => {
       let called, sc, surf

       function fill
       (el, i) {
         el.firstChild = { parent: el }
         called.push(i)
       }

       surf = makeSurf(50)
       called = []
       sc = Scroll.make(surf, { itemCount: 10, renderItem: fill })
       sc.render()
       equal(called.length, 9)
     })

test('toIndex', 'scrolls and returns element',
     () => {
       let sc, surf

       surf = makeSurf(50)
       sc = Scroll.make(surf, { itemCount: 10 })
       sc.toIndex(3)
       equal(surf.scrollTop, 48)
       equal(sc.toIndex(3).dataIndex, 3)
     })

test('scrollTo', 'sets scrollTop',
     () => {
       let sc, surf

       surf = makeSurf(50)
       sc = Scroll.make(surf, { itemCount: 5 })
       sc.scrollTo(2)
       equal(surf.scrollTop, 32)
     })

test('scrollBy', 'moves by delta',
     () => {
       let sc, surf

       surf = makeSurf(50)
       sc = Scroll.make(surf, { itemCount: 5 })
       surf.scrollTop = 16
       sc.scrollBy(-1)
       equal(surf.scrollTop, 0)
     })

test('updateItemCount', 'changes visible count',
     () => {
       let sc, surf

       surf = makeSurf(50)
       sc = Scroll.make(surf, { itemCount: 2 })
       sc.updateItemCount(10)
       equal(sc.visibleCount, 4)
     })

test('refresh', 'resets scrollTop and renders',
     () => {
       let sc, surf

       surf = makeSurf(50)
       sc = Scroll.make(surf, { itemCount: 5 })
       surf.scrollTop = 64
       sc.refresh()
       equal(surf.scrollTop, 0)
       equal(surf._frag ? 1 : 0, 1)
     })

test('onScroll', 'throttled by rAF',
     () => {
       let got, sc, surf

       surf = makeSurf(50)
       sc = Scroll.make(surf, { itemCount: 5 })
       got = 0
       sc.onScroll = () => got += 1
       surfListeners.scroll()
       surfListeners.scroll()
       equal(rafCbs.length, 1)
       rafCbs[0]()
       equal(got, 1)
       surfListeners.scroll()
       equal(rafCbs.length, 2)
     })

test('make', 'line height cached per surf',
     () => {
       let sc, surf

       surf = makeSurf(40)
       sc = Scroll.make(surf, { itemCount: 5 })
       sc.render()
       equal(computedCalls, 2)
       computedCalls = 0
       sc.render()
       equal(computedCalls, 0)
     })

test('make', 'destroy evicts line height cache',
     () => {
       let sc, surf

       surf = makeSurf(40)
       sc = Scroll.make(surf, { itemCount: 5 })
       sc.render()
       equal(computedCalls, 2)
       surfListeners['scroll-mjs.destroy']()
       computedCalls = 0
       sc.render()
       equal(computedCalls, 2)
     })

test('init', 'fontSize change clears cache',
     () => {
       let sc, surf

       surf = makeSurf(40)
       sc = Scroll.make(surf, { itemCount: 5 })
       sc.render()
       equal(computedCalls, 2)
       Opt.set('core.fontSize', 18)
       computedCalls = 0
       sc.render()
       equal(computedCalls, 2)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
