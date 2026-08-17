import { equal } from 'node:assert/strict'
import * as Cmd from '../js/cmd.mjs'
import * as Em from '../js/Em.mjs'
import * as EmMake from '../js/em.mjs'
import * as EvParser from '../lib/ev-parser.mjs'
import * as Mode from '../js/mode.mjs'

let tests, _shared

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function press
(key, code, ctrl, alt) {
  return { e: { key,
                code,
                ctrlKey: ctrl,
                altKey: alt,
                preventDefault: () => {} },
           mouse: 0 }
}

function mpress
(name) {
  return { e: { key: '',
                code: '',
                ctrlKey: 0,
                altKey: 0,
                preventDefault: () => {} },
           mouse: 1,
           name }
}

function lookTo
(wes) {
  let found

  Em.look(wes,
          undefined,
          undefined,
          (map, to) => {
            found = { map, to }
          })
  return found
}

globalThis.document = { dispatchEvent: () => {},
                        documentElement: { style: {} } }
globalThis.Element = class Element {}
globalThis.HTMLDocument = class HTMLDocument {}
_shared = globalThis.bred?._shared?.() || {}
_shared.opt = _shared.opt || { values: {}, types: {} }
globalThis.bred = { _shared: () => _shared }

Em.init()
Cmd.init()
Em.on('g', 'goto line')
Em.on('C-x C-f', 'open file')
Em.on('C-c A-g', 'two prefixes')

tests = {}

test('EvParser', 'single key',
     () => {
       equal(EvParser.parse('g').join(','), 'g')
     })

test('EvParser', 'two keys',
     () => {
       equal(EvParser.parse('C-x C-f').join(','), 'C-x,C-f')
     })

test('EvParser', 'alt prefix',
     () => {
       equal(EvParser.parse('A-g').join(','), 'A-g')
     })

test('EvParser', 'ctrl alt prefix',
     () => {
       equal(EvParser.parse('C-A-g').join(','), 'C-A-g')
     })

test('EvParser', 'empty string',
     () => {
       equal(EvParser.parse('').join(','), '')
     })

test('EvParser', 'space char key',
     () => {
       equal(EvParser.parse('C- ').join(','), 'C- ')
     })

test('EvParser', 'dash key',
     () => {
       equal(EvParser.parse('C--').join(','), 'C--')
     })

test('EvParser', 'three keys',
     () => {
       equal(EvParser.parse('C-c C-a C-t').join(','), 'C-c,C-a,C-t')
     })

test('EvParser', 'plain keys with space',
     () => {
       equal(EvParser.parse('a b').join(','), 'a,b')
     })

test('Em.get', 'after init has root Global',
     () => {
       equal(Em.get('Global').key, 'Global:')
     })

test('Em.add', 'returns em with name key',
     () => {
       equal(Em.add('Foo').key, 'Foo:')
     })

test('Em.add', 'spec on key',
     () => {
       equal(Em.add('Bar', 'C-x').key, 'Bar: C-x')
     })

test('Em.add', 'caches same name',
     () => {
       equal(Em.add('Baz') == Em.add('Baz'), true)
     })

test('Em.add', 'distinct names differ',
     () => {
       equal(Em.add('Qux') == Em.add('Quux'), false)
     })

test('Em.seq', 'single key',
     () => {
       equal(Em.seq('goto line'), 'g')
     })

test('Em.seq', 'two key sequence',
     () => {
       equal(Em.seq('open file'), 'C-x C-f')
     })

test('Em.seq', 'ctrl alt sequence',
     () => {
       equal(Em.seq('two prefixes'), 'C-c A-g')
     })

test('Em.seq', 'missing command returns 0',
     () => {
       equal(Em.seq('no such command'), 0)
     })

test('Em.look', 'single key to command',
     () => {
       let found

       found = lookTo([ press('g', 'KeyG', 0, 0) ])
       equal(found.map.key, 'Global:')
       equal(found.to, 'goto line')
     })

test('Em.look', 'two key sequence to command',
     () => {
       let found

       found = lookTo([ press('x', 'KeyX', 1, 0),
                        press('f', 'KeyF', 1, 0) ])
       equal(found.to, 'open file')
     })

test('Em.look', 'partial sequence gives map',
     () => {
       let found

       found = lookTo([ press('x', 'KeyX', 1, 0) ])
       equal(found.to.ons ? 1 : 0, 1)
     })

test('Em.look', 'unbound key gives no command',
     () => {
       let found

       found = lookTo([ press('z', 'KeyZ', 0, 0) ])
       equal(found.to, undefined)
       equal(found.map, undefined)
     })

test('Em.look', 'explicit active list',
     () => {
       let found

       Em.look([ press('g', 'KeyG', 0, 0) ],
               [ Em.get('Global') ],
               undefined,
               (map, to) => {
                 found = to
               })
       equal(found, 'goto line')
     })

test('Em.on', 'mode object targets mode em',
     () => {
       let mo

       mo = Mode.add('emtest-mo', {})
       Em.on('q', 'mode quack', mo)
       equal(Em.seq('mode quack', { mode: mo }), 'q')
       equal(Em.seq('mode quack'), 0)
       Mode.remove('emtest-mo')
     })

test('Em.on', 'mode name string binds',
     () => {
       let mo

       mo = Mode.add('emtest-mn', {})
       Em.on('j', 'mode jun', 'emtest-mn')
       equal(Em.seq('mode jun', { mode: mo }), 'j')
       Mode.remove('emtest-mn')
     })

test('Em.on', 'em object is first map',
     () => {
       let em, found

       em = EmMake.make('Direct')
       Em.on('w', 'direct woot', em)
       Em.look([ press('w', 'KeyW', 0, 0) ],
               [ em ],
               undefined,
               (map, to) => {
                 found = to
               })
       equal(found, 'direct woot')
     })

test('Em.on', 'missing mode tosses',
     () => {
       let caught

       caught = 0
       try {
         Em.on('r', 'x', 'emtest-no-such')
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('Em.on', 'key ended too early tosses',
     () => {
       let caught

       caught = 0
       try {
         Em.on('C-', 'x')
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('Em.on', 'three key sequence',
     () => {
       Em.on('C-c C-a C-t', 'triple t')
       equal(Em.seq('triple t'), 'C-c C-a C-t')
     })

test('Em.on', 'ctrl alt single event',
     () => {
       Em.on('C-A-x', 'ctrl alt x')
       equal(Em.seq('ctrl alt x'), 'C-A-x')
     })

test('Em.on', 'empty sequence tosses',
     () => {
       let caught

       caught = 0
       try {
         Em.on('', 'empty thing')
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('Em.seq', 'mode falls back to root',
     () => {
       let mo

       mo = Mode.add('emtest-fb', {})
       equal(Em.seq('open file', { mode: mo }), 'C-x C-f')
     })

test('Em.cancel', 'resets input buffer',
     () => {
       Em.on('C-c C-a C-t', 'triple t')
       Em.cancel()
       equal(Em.seq('triple t'), 'C-c C-a C-t')
     })

test('Em.mainGetActive', 'no buf root only',
     () => {
       let a

       a = Em.mainGetActive()
       equal(a.length, 1)
       equal(a[0].key, 'Global:')
     })

test('Em.mainGetActive', 'mode and minors reverse',
     () => {
       let a, m1, m2, mo

       mo = Mode.add('emtest-ma', {})
       m1 = Mode.add('emtest-ma1', { minor: 1 })
       m2 = Mode.add('emtest-ma2', { minor: 1 })
       a = Em.mainGetActive({ mode: mo, minors: [ m1, m2 ] })
       equal(a[0], m2.em)
       equal(a[1], m1.em)
       equal(a[2], mo.em)
       equal(a[3].key, 'Global:')
     })

test('Em.mainGetActive', 'parents after mode',
     () => {
       let a, mo, pm

       pm = Mode.add('emtest-pm', {})
       mo = Mode.add('emtest-mp', { parentsForEm: [ 'emtest-pm' ] })
       a = Em.mainGetActive({ mode: mo })
       equal(a[0], mo.em)
       equal(a[1], pm.em)
       equal(a[2].key, 'Global:')
     })

test('Em.mainGetActive', 'missing parent warns',
     () => {
       let a, mo

       mo = Mode.add('emtest-mw', { parentsForEm: [ 'emtest-nop' ] })
       a = Em.mainGetActive({ mode: mo })
       equal(a[0], mo.em)
       equal(a[1].key, 'Global:')
     })

test('Em.replace', 'custom getActive used by look',
     () => {
       let em, found

       em = EmMake.make('Custom')
       em.on('v', 'custom vee')
       Em.replace(() => [ em ])
       Em.look([ press('v', 'KeyV', 0, 0) ],
               undefined,
               undefined,
               (map, to) => {
                 found = to
               })
       Em.replace(0)
       equal(found, 'custom vee')
     })

test('Em.replace', 'restore mainGetActive',
     () => {
       let found

       Em.look([ press('g', 'KeyG', 0, 0) ],
               undefined,
               undefined,
               (map, to) => {
                 found = to
               })
       equal(found, 'goto line')
     })

test('Em.seq', 'parent mode command',
     () => {
       let mo, pm

       pm = Mode.add('emtest-sp', {})
       Em.on('p', 'parent bind', pm)
       mo = Mode.add('emtest-sm', { parentsForEm: [ 'emtest-sp' ] })
       equal(Em.seq('parent bind', { mode: mo }), 'p')
     })

test('em make', 'name on key',
     () => {
       equal(EmMake.make('Num').key, 'Num:')
     })

test('em make', 'name spec on key',
     () => {
       equal(EmMake.make('Num', 'C-y').key, 'Num: C-y')
     })

test('em make', 'name spec kept',
     () => {
       let em

       em = EmMake.make('Num', 'C-y')
       equal(em.name, 'Num')
       equal(em.spec, 'C-y')
     })

test('em make', 'on stores binding',
     () => {
       let em

       em = EmMake.make('Num')
       em.on('f', 'find')
       equal(em.ons['f'].to, 'find')
     })

test('em make', 'look resolves binding',
     () => {
       let em, found

       em = EmMake.make('Num')
       em.on('f', 'find')
       em.look([ press('f', 'KeyF', 0, 0) ],
               to => {
                 found = to
               })
       equal(found, 'find')
     })

test('em make', 'look unbound resolves nothing',
     () => {
       let em, found

       em = EmMake.make('Num')
       em.on('f', 'find')
       em.look([ press('g', 'KeyG', 0, 0) ],
               to => {
                 found = to
               })
       equal(found, undefined)
     })

test('em make', 'otherwise unset is undefined',
     () => {
       let em

       em = EmMake.make('Num')
       equal(em.otherwise, undefined)
     })

test('em make', 'otherwise set and cleared',
     () => {
       let em

       em = EmMake.make('Num')
       em.otherwise = 'fb'
       equal(em.otherwise, 'fb')
       em.otherwise = 0
       equal(em.otherwise, undefined)
     })

test('em make', 'otherwise is fallback',
     () => {
       let em, found

       em = EmMake.make('Num')
       em.on('f', 'find')
       em.otherwise = 'fallback'
       em.look([ press('z', 'KeyZ', 0, 0) ],
               to => {
                 found = to
               })
       equal(found, 'fallback')
     })

test('em make', 'control key goes through submap',
     () => {
       let em, sub, found

       em = EmMake.make('Num')
       sub = EmMake.make('Sub')
       em.on('Control', sub)
       sub.on('g', 'sub goto')
       em.look([ press('g', 'KeyG', 1, 0) ],
               to => {
                 found = to
               })
       equal(found, 'sub goto')
     })

test('em make', 'mouse binding',
     () => {
       let em, found

       em = EmMake.make('Num')
       em.on('Left', 'mouse left')
       em.look([ mpress('Left') ],
               to => {
                 found = to
               })
       equal(found, 'mouse left')
     })

test('em make', 'command before end of sequence warns',
     () => {
       let em, found

       em = EmMake.make('Num')
       em.on('a', 'first cmd')
       em.look([ press('a', 'KeyA', 0, 0),
                 press('b', 'KeyB', 0, 0) ],
               to => {
                 found = to
               })
       equal(found, undefined)
     })

test('em make', 'ctrl bound to command warns',
     () => {
       let em, found

       em = EmMake.make('Num')
       em.on('Control', 'ctrl cmd')
       em.look([ press('a', 'KeyA', 1, 0) ],
               to => {
                 found = to
               })
       equal(found, undefined)
     })

test('em make', 'ctrl unbound returns nothing',
     () => {
       let em, found

       em = EmMake.make('Num')
       em.look([ press('a', 'KeyA', 1, 0) ],
               to => {
                 found = to
               })
       equal(found, undefined)
     })

test('em make', 'alt as map goes through submap',
     () => {
       let em, found, sub

       em = EmMake.make('Num')
       sub = EmMake.make('Sub')
       em.on('Alt', sub)
       sub.on('g', 'sub alt goto')
       em.look([ press('g', 'KeyG', 0, 1) ],
               to => {
                 found = to
               })
       equal(found, 'sub alt goto')
     })

test('em make', 'alt bound to command warns',
     () => {
       let em, found

       em = EmMake.make('Num')
       em.on('Alt', 'alt cmd')
       em.look([ press('a', 'KeyA', 0, 1) ],
               to => {
                 found = to
               })
       equal(found, undefined)
     })

test('em make', 'alt unbound returns nothing',
     () => {
       let em, found

       em = EmMake.make('Num')
       em.look([ press('a', 'KeyA', 0, 1) ],
               to => {
                 found = to
               })
       equal(found, undefined)
     })

test('em make', 'binding with no to logs and returns nothing',
     () => {
       let em, found

       em = EmMake.make('Num')
       em.on('x', 0)
       em.look([ press('x', 'KeyX', 0, 0) ],
               to => {
                 found = to
               })
       equal(found, undefined)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
