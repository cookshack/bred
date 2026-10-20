import { equal } from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import * as WindowState from '../js/main-window-state.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function fakeWin
(bounds) {
  let win

  win = new EventEmitter()
  win.bounds = { ...bounds }
  win.maximized = 0
  win.shown = 0
  win.getBounds = () => ({ ...win.bounds })
  win.getNormalBounds = () => ({ ...win.bounds })
  win.setBounds = b => {
                    win.bounds = { ...b }
                  }
  win.isMaximized = () => win.maximized
  win.show = () => {
               win.shown++
             }
  win.maximize = () => {
                   win.maximized = 1
                 }
  return win
}

function fakeStore
() {
  let data

  data = {}
  return { data,
           get: key => data[key],
           set: (key, value) => {
             data[key] = value
           } }
}

tests = {}

test('saveWindowState', 'stores normal bounds and maximized state',
     () => {
       let win, store

       win = fakeWin({ x: 10, y: 20, width: 800, height: 600 })
       store = fakeStore()
       win.maximized = 1
       WindowState.saveWindowState(win, store)

       equal(store.data.bounds.x, 10)
       equal(store.data.bounds.width, 800)
       equal(store.data.maximized, 1)
     })

test('makeWindowState', 'restores bounds after show and ignores startup events',
     async () => {
       let win, store, state

       win = fakeWin({ x: 0, y: 0, width: 800, height: 600 })
       store = fakeStore()
       state = WindowState.makeWindowState(win, store,
                                           { bounds: { x: 10, y: 20, width: 800, height: 600 },
                                             maximized: 0,
                                             delay: 0 })

       win.emit('move')
       equal(store.data.bounds, undefined)

       state.restore()
       equal(win.shown, 1)
       equal(win.bounds.x, 10)
       equal(win.bounds.y, 20)

       win.bounds = { x: 5, y: 5, width: 800, height: 600 }
       win.emit('move')
       equal(store.data.bounds, undefined)

       await new Promise(r => setTimeout(r, 5))
       win.bounds = { x: 30, y: 40, width: 800, height: 600 }
       win.emit('move')
       equal(store.data.bounds.x, 30)
       equal(store.data.bounds.y, 40)
     })

test('makeWindowState', 'maximizes instead of setting bounds',
     () => {
       let win, store, state

       win = fakeWin({ x: 0, y: 0, width: 800, height: 600 })
       store = fakeStore()
       state = WindowState.makeWindowState(win, store,
                                           { bounds: { x: 10, y: 20, width: 800, height: 600 },
                                             maximized: 1,
                                             delay: 0 })

       state.restore()

       equal(win.shown, 1)
       equal(win.maximized, 1)
       equal(win.bounds.x, 0)
     })

test('makeWindowState', 'saveNow writes current bounds',
     () => {
       let win, store, state

       win = fakeWin({ x: 0, y: 0, width: 800, height: 600 })
       store = fakeStore()
       state = WindowState.makeWindowState(win, store, { delay: 0 })
       win.bounds = { x: 50, y: 60, width: 900, height: 700 }

       state.saveNow()

       equal(store.data.bounds.x, 50)
       equal(store.data.bounds.height, 700)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
