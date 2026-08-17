import { equal } from 'node:assert/strict'
import * as Buf from '../js/Buf.mjs'
import * as BufCommon from '../js/buf-common.mjs'
import * as Cmd from '../js/cmd.mjs'
import Mk from '../js/mk.mjs'
import * as Mode from '../js/mode.mjs'

let tests, _shared

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

globalThis.document = { dispatchEvent: () => {},
                        documentElement: { style: {} } }
globalThis.Element = class Element {}
globalThis.HTMLDocument = class HTMLDocument {}
_shared = globalThis.bred?._shared?.() || {}
_shared.opt = _shared.opt || { values: {}, types: {}, onSets: {}, onSetAlls: [], onSetBufs: {}, onSetBufAlls: [] }
_shared.buf = _shared.buf || {}
_shared.buf.buffers = Mk.array
_shared.buf.ring = Mk.array
_shared.buf.id = _shared.buf.id || 1
_shared.win = _shared.win || { wins: [] }
globalThis.bred = { _shared: () => _shared }

Cmd.init()
BufCommon.init()
Mode.getOrAdd('m-minor-x')
Mode.getOrAdd('m-toggle-x')
Mode.getOrAdd('mbep').bepEnd = () => 7
Mode.getOrAdd('mline').line = () => 9
Mode.getOrAdd('mtext')
Mode.getOrAdd('mphs').setPlaceholder = (v, val) => val

tests = {}

test('make', 'defaults',
     () => {
       let b

       b = Buf.make({ name: 'm-defaults', dir: '/tmp/x/' })
       equal(b.name, 'm-defaults')
       equal(b.mode.key, 'div')
       equal(b.minors.length, 0)
       equal(b.fileType, 'file')
       equal(b.single, undefined)
       equal(b.co, undefined)
     })

test('make', 'increments id',
     () => {
       let a, b

       a = Buf.make({ name: 'm-id1', dir: '/tmp/x/' })
       b = Buf.make({ name: 'm-id2', dir: '/tmp/x/' })
       equal(b.id, a.id + 1)
     })

test('add', 'pushes buffer and ring',
     () => {
       let b

       b = Buf.add('m-addname', 'div', 'content', '/tmp/d/')
       equal(Buf.find(x => x == b), b)
       equal(Buf.getRing()[0], b)
     })

test('name', 'dedups with angle suffix',
     () => {
       let a, c

       a = Buf.add('dup-name', 'div', 0, '/tmp/x/')
       Buf.add('dup-name', 'div', 0, '/tmp/x/')
       c = Buf.add('dup-name', 'div', 0, '/tmp/x/')
       equal(a.name, 'dup-name')
       equal(c.name, 'dup-name<2>')
     })

test('find', 'missing returns undefined',
     () => {
       equal(Buf.find(x => x.name == 'no-such-name'), undefined)
     })

test('map', 'maps over buffers',
     () => {
       let names

       names = Buf.map(x => x.name)
       equal(names.includes('m-addname'), true)
     })

test('filter', 'filters buffers',
     () => {
       let got

       got = Buf.filter(x => x.name == 'm-addname')
       equal(got.length, 1)
     })

test('forEach', 'visits buffers',
     () => {
       let n

       n = 0
       Buf.forEach(() => n++)
       equal(n > 0, true)
     })

test('addMode', 'adds and dedups minor',
     () => {
       let b

       b = Buf.add('m-mode', 'div', 0, '/tmp/x/')
       b.addMode('m-minor-x')
       equal(b.minors.length, 1)
       b.addMode('m-minor-x')
       equal(b.minors.length, 1)
       b.rmMode('m-minor-x')
       equal(b.minors.length, 0)
     })

test('toggleMode', 'adds then removes',
     () => {
       let b

       b = Buf.add('m-toggle', 'div', 0, '/tmp/x/')
       equal(b.toggleMode('m-toggle-x'), 1)
       equal(b.minors.length, 1)
       equal(b.toggleMode('m-toggle-x'), 0)
       equal(b.minors.length, 0)
     })

test('setMode', 'switches mode',
     () => {
       let b

       b = Buf.add('m-setmode', 'div', 0, '/tmp/x/')
       b.mode = 'm-minor-x'
       equal(b.mode.key, 'm-minor-x')
     })

test('vars', 'stores per mode lowercase',
     () => {
       let b, v1, v2

       b = Buf.make({ name: 'm-vars', dir: '/tmp/x/' })
       v1 = b.vars('MyMode')
       v2 = b.vars('mymode')
       equal(v1, v2)
       v1.x = 7
       equal(b.vars('mymode').x, 7)
       equal(b.vars().mymode.x, 7)
     })

test('opt', 'falls back to global',
     () => {
       let b

       b = Buf.make({ name: 'm-opt', dir: '/tmp/x/' })
       equal(b.opt('no-such-opt'), undefined)
     })

test('opt', 'buf opt takes precedence',
     () => {
       let b

       b = Buf.make({ name: 'm-opt2', dir: '/tmp/x/' })
       b.opts.set('m.bufopt', 42)
       equal(b.opt('m.bufopt'), 42)
     })

test('file', 'set and get',
     () => {
       let b

       b = Buf.make({ name: 'm-file', dir: '/tmp/a/' })
       b.file = 'x.txt'
       equal(b.file, 'x.txt')
       equal(b.path, '/tmp/a/x.txt')
     })

test('dir', 'set ensures slash',
     () => {
       let b

       b = Buf.make({ name: 'm-dir', dir: '/tmp/x/' })
       b.dir = '/tmp/b'
       equal(b.dir, '/tmp/b/')
     })

test('dir', 'dir fileType joins file',
     () => {
       let b

       b = Buf.make({ name: 'm-dir2', dir: '/tmp/c/' })
       b.fileType = 'dir'
       b.file = 'sub'
       equal(b.dir, '/tmp/c/sub/')
     })

test('clear', 'sets content 0',
     () => {
       let b

       b = Buf.make({ name: 'm-clear', dir: '/tmp/x/' })
       b.clear()
       equal(b.co, 0)
     })

test('clearLine', 'missing mode falls back',
     () => {
       let b

       b = Buf.make({ name: 'm-cl', dir: '/tmp/x/' })
       b.clearLine()
       equal(b.co, 0)
     })

test('save', 'missing mode falls back',
     () => {
       let b, r

       b = Buf.make({ name: 'm-save', dir: '/tmp/x/' })
       r = b.save()
       equal(r, 0)
     })

test('bepEnd', 'missing returns 0',
     () => {
       let b

       b = Buf.make({ name: 'm-bepend', dir: '/tmp/x/' })
       equal(b.bepEnd, 0)
     })

test('line', 'missing returns 0',
     () => {
       let b

       b = Buf.make({ name: 'm-line', dir: '/tmp/x/' })
       equal(b.line(2), 0)
     })

test('text', 'no view tosses',
     () => {
       let b, caught

       b = Buf.make({ name: 'm-text', dir: '/tmp/x/' })
       caught = 0
       try {
         b.text()
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('on', 'missing mode says',
     () => {
       let b

       b = Buf.make({ name: 'm-on', dir: '/tmp/x/' })
       b.on('event', () => {})
       equal(b.co, undefined)
     })

test('off', 'missing mode says',
     () => {
       let b

       b = Buf.make({ name: 'm-off', dir: '/tmp/x/' })
       b.off('event', () => {})
       equal(b.co, undefined)
     })

test('insert', 'missing mode tosses',
     () => {
       let b, caught

       b = Buf.make({ name: 'm-insert', dir: '/tmp/x/' })
       caught = 0
       try {
         b.insert('x', 0)
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('append', 'missing mode tosses',
     () => {
       let b, caught

       b = Buf.make({ name: 'm-append', dir: '/tmp/x/' })
       caught = 0
       try {
         b.append('x')
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('syntaxTreeStr', 'missing returns 0',
     () => {
       let b

       b = Buf.make({ name: 'm-syn', dir: '/tmp/x/' })
       equal(b.syntaxTreeStr, 0)
     })

test('anyView', 'finds ready view',
     () => {
       let b, v

       b = Buf.make({ name: 'm-anyview', dir: '/tmp/x/' })
       v = { ready: 1, ele: {} }
       b.views.push({ ready: 0 })
       b.views.push(v)
       equal(b.anyView(), v)
       equal(b.anyView(1), v)
     })

test('makePsn', 'starts at zero',
     () => {
       let b, p

       b = Buf.make({ name: 'm-psn', dir: '/tmp/x/' })
       p = b.makePsn()
       equal(p.bep, 0)
       equal(p.row, 0)
     })

test('makePsn', 'line fetches from main',
     async () => {
       let b, prev, t

       b = Buf.make({ name: 'm-psnline', dir: '/tmp/x/' })
       prev = globalThis.tron
       globalThis.tron = { acmd: async () => ({ text: 'the line' }) }
       t = await b.makePsn().line
       globalThis.tron = prev
       equal(t, 'the line')
     })

test('makePsn', 'lineNext updates position',
     async () => {
       let b, p, prev, more

       b = Buf.make({ name: 'm-psnnext', dir: '/tmp/x/' })
       p = b.makePsn()
       prev = globalThis.tron
       globalThis.tron = { acmd: async () => ({ bep: 5, row: 2, more: 1 }) }
       more = await p.lineNext()
       globalThis.tron = prev
       equal(more, 1)
       equal(p.bep, 5)
       equal(p.row, 2)
     })

test('onRemove', 'runs cbs and clears on remove',
     () => {
       let b, n

       b = Buf.add('m-rm', 'div', 0, '/tmp/x/')
       n = 0
       b.onRemove(() => n++)
       b.remove()
       equal(n, 1)
       equal(Buf.find(x => x == b), undefined)
     })

test('onRemove', 'cb errors caught',
     () => {
       let b

       b = Buf.add('m-rme', 'div', 0, '/tmp/x/')
       b.onRemove(() => {
                    throw new Error('remove boom')
                  })
       b.remove()
       equal(Buf.find(x => x == b), undefined)
     })

test('addMode', 'accepts mode object',
     () => {
       let b, mo

       b = Buf.add('m-modobj', 'div', 0, '/tmp/x/')
       mo = Mode.get('m-minor-x')
       b.addMode(mo)
       equal(b.minors.length, 1)
     })

test('toggleMode', 'missing mode returns 0',
     () => {
       let b

       b = Buf.add('m-tm', 'div', 0, '/tmp/x/')
       equal(b.toggleMode('no-such-mode'), 0)
     })

test('bepEnd', 'mode bepEnd no view returns 0',
     () => {
       let b

       b = Buf.make({ name: 'm-bep1', dir: '/tmp/x/', modeKey: 'mbep' })
       equal(b.bepEnd, 0)
     })

test('bepEnd', 'mode bepEnd with view',
     () => {
       let b

       b = Buf.make({ name: 'm-bep2', dir: '/tmp/x/', modeKey: 'mbep' })
       b.views.push({ ready: 1, ele: {} })
       equal(b.bepEnd, 7)
     })

test('line', 'mode line no view returns 0',
     () => {
       let b

       b = Buf.make({ name: 'm-line1', dir: '/tmp/x/', modeKey: 'mline' })
       equal(b.line(1), 0)
     })

test('text', 'view but no mode text tosses',
     () => {
       let b, caught

       b = Buf.make({ name: 'm-tex2', dir: '/tmp/x/', modeKey: 'mtext' })
       b.views.push({ ele: {} })
       caught = 0
       try {
         b.text()
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('setPlaceholder', 'mode setPlaceholder runs',
     () => {
       let b

       b = Buf.make({ name: 'm-phs', dir: '/tmp/x/', modeKey: 'mphs' })
       b.views.push({})
       b.placeholder = 'z'
       equal(b.placeholder, 'z')
     })

test('bury', 'moves buffer to ring end',
     () => {
       let b, ring

       b = Buf.add('m-bury2', 'div', 0, '/tmp/x/')
       b.bury()
       ring = Buf.getRing()
       equal(ring[ring.length - 1], b)
     })

test('reconf', 'runs div extensions',
     () => {
       let b

       b = Buf.make({ name: 'm-reconf', dir: '/tmp/x/' })
       b.reconf()
       equal(b.co, undefined)
     })

test('anyView', 'no ready view returns 0',
     () => {
       let b

       b = Buf.make({ name: 'm-any2', dir: '/tmp/x/' })
       b.views.push({ ready: 0, ele: {} })
       equal(b.anyView(), 0)
       equal(b.anyView(1), b.views[0])
     })

test('ml', 'set no match leaves alone',
     () => {
       let b, v

       b = Buf.make({ name: 'm-ml', dir: '/tmp/x/' })
       v = { ele: { querySelector: () => 0 } }
       b.views.push(v)
       b.ml.set('x', 0)
       equal(b.co, undefined)
     })

test('register', 'reconf hooks into ext',
     () => {
       let before

       before = BufCommon.divExts.length
       Buf.register({ reconf: () => {}, reconfOpts: [ 'm.rg' ] })
       equal(BufCommon.divExts.length, before + 1)
     })

test('register', 'no reconf pushes ext',
     () => {
       let before

       before = BufCommon.divExts.length
       Buf.register({})
       equal(BufCommon.divExts.length, before + 1)
     })

test('print', 'no crash with empty views',
     () => {
       Buf.print()
     })

test('placeholder', 'from spec',
     () => {
       let b

       b = Buf.make({ name: 'm-ph', dir: '/tmp/x/', placeholder: 'hi' })
       equal(b.placeholder, 'hi')
     })

test('setPlaceholder', 'missing mode tosses',
     () => {
       let b, caught

       b = Buf.make({ name: 'm-ph2', dir: '/tmp/x/' })
       caught = 0
       try {
         b.placeholder = 'x'
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('modifiedOnDisk', 'set and clear without views',
     () => {
       let b

       b = Buf.make({ name: 'm-mod', dir: '/tmp/x/' })
       b.modifiedOnDisk = 1
       equal(b.modifiedOnDisk, 1)
       b.modifiedOnDisk = 0
       equal(b.modifiedOnDisk, 0)
     })

test('icon', 'set and get',
     () => {
       let b

       b = Buf.make({ name: 'm-icon', dir: '/tmp/x/' })
       b.icon = 'python'
       equal(b.icon, 'python')
     })

test('ed', 'set and get',
     () => {
       let b

       b = Buf.make({ name: 'm-ed', dir: '/tmp/x/' })
       equal(b.ed, undefined)
       b.ed = 1
       equal(b.ed, 1)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
