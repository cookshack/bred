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

test('display', 'detects native wayland',
     () => {
       equal(Platform.display({ XDG_SESSION_TYPE: 'wayland',
                                WAYLAND_DISPLAY: 'wayland-0' }, 0),
             'Wayland (session: wayland, ozone: auto)')
     })

test('display', 'detects xwayland',
     () => {
       equal(Platform.display({ XDG_SESSION_TYPE: 'wayland' }, 'x11'),
             'XWayland (session: wayland, ozone: x11)')
     })

test('display', 'detects x11',
     () => {
       equal(Platform.display({ XDG_SESSION_TYPE: 'x11', DISPLAY: ':0' }, 0),
             'X11 (session: x11, ozone: auto)')
     })

test('display', 'falls back to WAYLAND_DISPLAY',
     () => {
       equal(Platform.display({ WAYLAND_DISPLAY: 'wayland-0' }, 0),
             'Wayland (session: wayland, ozone: auto)')
     })

test('display', 'trusts an explicit wayland backend over the session',
     () => {
       equal(Platform.display({ XDG_SESSION_TYPE: 'x11' }, 'wayland'),
             'Wayland (session: x11, ozone: wayland)')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
