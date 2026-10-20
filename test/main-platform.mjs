import { equal } from 'node:assert/strict'
import * as Platform from '../js/main-platform.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

tests = {}

test('ozonePlatform', 'forces x11 when opted in on wayland',
     () => {
       equal(Platform.ozonePlatform({ BRED_XWAYLAND: '1',
                                      XDG_SESSION_TYPE: 'wayland',
                                      DISPLAY: ':0' }), 'x11')
     })

test('ozonePlatform', 'stays on native wayland by default',
     () => {
       equal(Platform.ozonePlatform({ XDG_SESSION_TYPE: 'wayland', DISPLAY: ':0' }), 0)
     })

test('ozonePlatform', 'leaves X11 sessions alone',
     () => {
       equal(Platform.ozonePlatform({ BRED_XWAYLAND: '1',
                                      XDG_SESSION_TYPE: 'x11',
                                      DISPLAY: ':0' }), 0)
     })

test('ozonePlatform', 'requires a display to force x11',
     () => {
       equal(Platform.ozonePlatform({ BRED_XWAYLAND: '1', XDG_SESSION_TYPE: 'wayland' }), 0)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
