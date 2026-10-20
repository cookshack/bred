import { equal } from 'node:assert/strict'
import * as Platform from '../js/main-platform.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

tests = {}

test('ozonePlatform', 'forces x11 on wayland with XWayland available',
     () => {
       equal(Platform.ozonePlatform({ XDG_SESSION_TYPE: 'wayland', DISPLAY: ':0' }), 'x11')
     })

test('ozonePlatform', 'honors native wayland opt-out',
     () => {
       equal(Platform.ozonePlatform({ XDG_SESSION_TYPE: 'wayland',
                                      DISPLAY: ':0',
                                      BRED_NATIVE_WAYLAND: '1' }), 0)
     })

test('ozonePlatform', 'leaves X11 sessions alone',
     () => {
       equal(Platform.ozonePlatform({ XDG_SESSION_TYPE: 'x11', DISPLAY: ':0' }), 0)
     })

test('ozonePlatform', 'requires a display to force x11',
     () => {
       equal(Platform.ozonePlatform({ XDG_SESSION_TYPE: 'wayland' }), 0)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
