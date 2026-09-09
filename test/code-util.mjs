import { equal } from 'node:assert/strict'
import * as CodeUtil from '../ext/code/util.mjs'
import * as Opt from '../js/opt.mjs'

let tests, _shared

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function bufFor
(vars, dir) {
  let v

  v = vars || { code: {} }
  return { dir: dir || '/a/b',
           vars: name => v[name] || (v[name] = {}),
           opts: { get: name => v['opts']?.[name] } }
}

globalThis.document = { dispatchEvent: () => {},
                        documentElement: { style: {} } }
globalThis.Element = class Element {}
globalThis.HTMLDocument = class HTMLDocument {}
_shared = globalThis.bred?._shared?.() || {}
_shared.opt = { values: {},
                types: {},
                onSets: {},
                onSetAlls: [],
                onSetBufs: {},
                onSetBufAlls: [] }
globalThis.bred = { _shared: () => _shared }
globalThis.tron = { cmd: async () => ({ err: 0, ch: 0 }),
                    receive: (ch, cb2) => cb2({ err: 0 }),
                    acmd: async () => ({}) }

tests = {}

test('iconAgent', 'returns bolt',
     () => {
       equal(CodeUtil.iconAgent(), '⚡')
     })

test('iconRightArrow', 'returns arrow',
     () => {
       equal(CodeUtil.iconRightArrow(), '➔')
     })

test('modelName', 'with variant',
     () => {
       equal(CodeUtil.modelName('deep', 'v1'), 'deep:v1')
     })

test('modelName', 'no variant',
     () => {
       equal(CodeUtil.modelName('deep', ''), 'deep')
       equal(CodeUtil.modelName('deep', 0), 'deep')
     })

test('fmtCost', 'zero is empty',
     () => {
       equal(CodeUtil.fmtCost(0), '')
     })

test('fmtCost', 'positive formats to 4 places',
     () => {
       equal(CodeUtil.fmtCost(0.5), '$0.5000')
       equal(CodeUtil.fmtCost(1.23456), '$1.2346')
     })

test('makeRelative', 'under dir is relative',
     () => {
       let buf

       buf = bufFor(0, '/a/b')
       equal(CodeUtil.makeRelative(buf, '/a/b/c.txt'), '/c.txt')
     })

test('makeRelative', 'outside dir unchanged',
     () => {
       let buf

       buf = bufFor(0, '/a/b')
       equal(CodeUtil.makeRelative(buf, '/x/y.txt'), '/x/y.txt')
     })

test('sameDir', 'trailing slash ignored',
     () => {
       equal(CodeUtil.sameDir('/a/b/', '/a/b'), true)
       equal(CodeUtil.sameDir('/a/b', '/a/b/'), true)
     })

test('sameDir', 'different dirs',
     () => {
       equal(CodeUtil.sameDir('/a/b', '/a/c'), false)
     })

test('sameDir', 'root only matches root',
     () => {
       equal(CodeUtil.sameDir('/', '/'), true)
       equal(CodeUtil.sameDir('/', '/a'), false)
     })

test('isSubagentId', 'in map',
     () => {
       let buf

       buf = bufFor({ code: { subagentIds: new Map([ [ 'sub1', 1 ] ]) } })
       equal(CodeUtil.isSubagentId(buf, 'sub1'), true)
       equal(CodeUtil.isSubagentId(buf, 'other'), false)
     })

test('isSessionMatch', 'session id or subagent',
     () => {
       let buf

       buf = bufFor({ code: { sessionID: 'ses1',
                              subagentIds: new Map([ [ 'sub1', 1 ] ]) } })
       equal(CodeUtil.isSessionMatch(buf, 'ses1'), true)
       equal(CodeUtil.isSessionMatch(buf, 'sub1'), true)
       equal(CodeUtil.isSessionMatch(buf, 'other'), false)
     })

test('getProvider', 'default',
     () => {
       equal(CodeUtil.getProvider(0), 'opencode-go')
     })

test('getProvider', 'opt overridden by buf',
     () => {
       let buf

       Opt.set('code.provider.agent', 'opt-provider')
       buf = bufFor({ code: { provider: 'buf-provider' } })
       equal(CodeUtil.getProvider(buf), 'buf-provider')
       equal(CodeUtil.getProvider(0), 'opt-provider')
       delete _shared.opt.values['code.provider.agent']
     })

test('getModel', 'default',
     () => {
       equal(CodeUtil.getModel(0), 'deepseek-v4-pro')
     })

test('getVariant', 'default empty',
     () => {
       equal(CodeUtil.getVariant(0), '')
     })

test('getAgent', 'buf opts then opt',
     () => {
       let buf

       Opt.set('code.agent', 'agent-opt')
       buf = bufFor({ opts: { 'code.agent': 'agent-buf' } })
       equal(CodeUtil.getAgent(buf), 'agent-buf')
       equal(CodeUtil.getAgent(0), 'agent-opt')
       delete _shared.opt.values['code.agent']
     })

test('ensureThinkChunks', 'creates and caches',
     () => {
       let buf, a, b

       buf = bufFor()
       a = CodeUtil.ensureThinkChunks(buf)
       equal(typeof a, 'object')
       b = CodeUtil.ensureThinkChunks(buf)
       equal(a, b)
     })

test('ensureTextChunks', 'creates and caches',
     () => {
       let buf, a, b

       buf = bufFor()
       a = CodeUtil.ensureTextChunks(buf)
       equal(typeof a, 'object')
       b = CodeUtil.ensureTextChunks(buf)
       equal(a, b)
     })

test('sumTokens', 'sums all categories',
     () => {
       let tokens

       tokens = { input: 1, output: 2, reasoning: 3, cache: { read: 4, write: 5 } }
       equal(CodeUtil.sumTokens(tokens), 15)
     })

test('sumTokens', 'missing categories are zero',
     () => {
       equal(CodeUtil.sumTokens({ input: 1 }), 1)
       equal(CodeUtil.sumTokens({}), 0)
     })

test('fmtSessionStart', 'formats date and time',
     () => {
       equal(CodeUtil.fmtSessionStart(new Date(2026, 0, 5, 9, 30).getTime()), '2026-01-05 09h30')
     })

test('calculateTokenPercentage', 'tokens and percent',
     () => {
       let buf

       buf = bufFor({ code: { lastTokens: 50, modelContextLimit: 100 } })
       equal(CodeUtil.calculateTokenPercentage(buf), 'T:50 50%')
     })

test('calculateTokenPercentage', 'no limit just tokens',
     () => {
       let buf

       buf = bufFor({ code: { lastTokens: 50 } })
       equal(CodeUtil.calculateTokenPercentage(buf), 'T:50')
     })

test('calculateTokenPercentage', 'no tokens empty',
     () => {
       let buf

       buf = bufFor()
       equal(CodeUtil.calculateTokenPercentage(buf), '')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
