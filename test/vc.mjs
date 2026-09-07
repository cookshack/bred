import { equal } from 'node:assert/strict'
import * as Cmd from '../js/cmd.mjs'
import * as Ed from '../js/ed.mjs'
import * as Em from '../js/Em.mjs'
import * as Mode from '../js/mode.mjs'
import * as Vc from '../js/vc.mjs'

let savedDocument, savedElement, savedHTMLDocument, savedOpt, savedTron, tests, _shared

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function emReady
() {
  try {
    return Em.get('Global') ? 1 : 0
  }
  catch {
    return 0
  }
}

savedOpt = 0
_shared = globalThis.bred?._shared?.() || {}
_shared.opt = _shared.opt || { values: {},
                               types: {},
                               onSets: {},
                               onSetAlls: [],
                               onSetBufs: {},
                               onSetBufAlls: [] }
_shared.buf = _shared.buf || {}
_shared.buf.buffers = _shared.buf.buffers || []
_shared.buf.ring = _shared.buf.ring || []
savedOpt = _shared.opt
_shared.opt = { values: {},
                types: {},
                onSets: {},
                onSetAlls: [],
                onSetBufs: {},
                onSetBufAlls: [] }
globalThis.bred = { _shared: () => _shared }
savedDocument = globalThis.document
savedElement = globalThis.Element
savedHTMLDocument = globalThis.HTMLDocument
savedTron = globalThis.tron
globalThis.document = { dispatchEvent: () => {},
                        documentElement: { style: {} },
                        head: { appendChild: () => ({ innerHTML: '' }) },
                        createElement: () => ({ style: {}, innerHTML: '' }) }
globalThis.Element = class Element {}
globalThis.HTMLDocument = class HTMLDocument {}
globalThis.tron = { cmd: async () => ({ err: 0, ch: 0 }),
                    receive: (ch, cb2) => cb2({ err: 0, exists: 0 }),
                    acmd: async () => ({}) }

if (Cmd.hist == undefined)
  Cmd.init()
if (emReady() == 0)
  Em.init()

await new Promise((res, rej) => Ed.init('codemirror',
                                        err => err ? rej(err) : res()))
Vc.init()
await new Promise(r => setTimeout(r, 100))

_shared.opt = savedOpt
globalThis.document = savedDocument
globalThis.Element = savedElement
globalThis.HTMLDocument = savedHTMLDocument
globalThis.tron = savedTron

tests = {}

test('commands', 'stash commands registered',
     () => {
       equal(Cmd.get('stash open') ? 1 : 0, 1)
       equal(Cmd.get('stash apply') ? 1 : 0, 1)
       equal(Cmd.get('stash drop') ? 1 : 0, 1)
     })

test('commands', 'vc commands registered',
     () => {
       let names

       names = [ 'vc commit', 'vc hub', 'vc hub json', 'vc prs', 'vc prs json',
                 'vc log', 'vc log search', 'vc log one-line',
                 'vc log search one-line', 'vc equal', 'vc annotate',
                 'vc branch', 'vc main', 'vc pull', 'vc push', 'vc reset',
                 'vc show', 'vc review', 'vc stash', 'vc stash apply',
                 'vc stash drop', 'vc stash enumerate', 'vc stash pop',
                 'vc status' ]
       names.forEach(name => equal(Cmd.get(name) ? 1 : 0, 1, name))
     })

test('commands', 'mode commands registered',
     () => {
       equal(Cmd.getMo('edit', 'commit result') ? 1 : 0, 1)
       equal(Cmd.getMo('refresh', 'vc hub') ? 1 : 0, 1)
       equal(Cmd.getMo('branch', 'vc hub') ? 1 : 0, 1)
       equal(Cmd.getMo('equal', 'vc hub') ? 1 : 0, 1)
       equal(Cmd.getMo('show pr', 'vc prs') ? 1 : 0, 1)
       equal(Cmd.getMo('open pr', 'vc prs') ? 1 : 0, 1)
       equal(Cmd.getMo('one-line', 'vc log') ? 1 : 0, 1)
       equal(Cmd.getMo('next commit', 'vc log') ? 1 : 0, 1)
       equal(Cmd.getMo('show commit', 'vc log one-line') ? 1 : 0, 1)
       equal(Cmd.getMo('goto source', 'equal') ? 1 : 0, 1)
       equal(Cmd.getMo('apply hunk', 'equal') ? 1 : 0, 1)
       equal(Cmd.getMo('next hunk', 'equal') ? 1 : 0, 1)
       equal(Cmd.getMo('edit', 'vc annotate') ? 1 : 0, 1)
       equal(Cmd.getMo('branch add', 'branch') ? 1 : 0, 1)
       equal(Cmd.getMo('branch switch', 'branch') ? 1 : 0, 1)
     })

test('modes', 'modes registered',
     () => {
       let keys

       keys = [ 'stash', 'commit result', 'vc hub', 'vc prs', 'vc log',
                'vc log one-line', 'equal', 'vc annotate', 'branch' ]
       keys.forEach(key => equal(Mode.get(key) ? 1 : 0, 1, key))
     })

test('modes', 'parented on ed',
     () => {
       equal(Mode.get('stash').parentsForEm.join(','), 'ed')
       equal(Mode.get('vc hub').parentsForEm.join(','), 'ed')
       equal(Mode.get('vc prs').parentsForEm.join(','), 'ed')
       equal(Mode.get('vc log').parentsForEm.join(','), 'ed')
       equal(Mode.get('vc annotate').parentsForEm.join(','), 'ed')
       equal(Mode.get('branch').parentsForEm.join(','), 'ed')
     })

test('bindings', 'stash mode keys',
     () => {
       let stash

       stash = Mode.get('stash')
       equal(Em.seq('stash apply', { mode: stash }), 'a')
       equal(Em.seq('stash drop', { mode: stash }), 'd')
       equal(Em.seq('stash open', { mode: stash }), 'e')
       equal(Em.seq('vc stash enumerate', { mode: stash }), 'g')
     })

test('bindings', 'vc prefix keys',
     () => {
       equal(Em.seq('vc commit'), 'C-x v c')
       equal(Em.seq('vc hub'), 'C-x v h')
       equal(Em.seq('vc prs'), 'C-x v H')
       equal(Em.seq('vc equal'), 'C-x v =')
       equal(Em.seq('vc annotate'), 'C-x v g')
       equal(Em.seq('vc log'), 'C-x v L')
       equal(Em.seq('vc log one-line'), 'C-x v l')
       equal(Em.seq('vc status'), 'C-x v v')
       equal(Em.seq('vc stash'), 'C-x v w')
     })

test('bindings', 'log mode keys',
     () => {
       let log

       log = Mode.get('vc log')
       equal(Em.seq('refresh', { mode: log }), 'g')
       equal(Em.seq('one-line', { mode: log }), 'l')
       equal(Em.seq('next commit', { mode: log }), 'n')
       equal(Em.seq('previous commit', { mode: log }), 'p')
       equal(Em.seq('show', { mode: log }), 'e')
     })

test('bindings', 'hub prs equal commit result keys',
     () => {
       let hub, prs, eq, cr

       hub = Mode.get('vc hub')
       prs = Mode.get('vc prs')
       eq = Mode.get('equal')
       cr = Mode.get('commit result')
       equal(Em.seq('refresh', { mode: hub }), 'g')
       equal(Em.seq('mark read', { mode: hub }), 'r')
       equal(Em.seq('show pr', { mode: prs }), 'Enter')
       equal(Em.seq('open pr', { mode: prs }), 'w')
       equal(Em.seq('Goto Source', { mode: eq }), 'e')
       equal(Em.seq('Apply Hunk', { mode: eq }), 'a')
       equal(Em.seq('edit', { mode: cr }), 'e')
       equal(Em.seq('next error', { mode: cr }), 'n')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
