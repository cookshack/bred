import { equal, throws } from 'node:assert/strict'
import * as Opt from '../js/opt.mjs'
import * as VcGithub from '../js/vc-github.mjs'

let tests, _shared

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name,
                      cb: () => {
                        globalThis.tron = { cmd: async () => ({ err: 0, ch: 0 }),
                                            receive: (ch, cb2) => cb2({ err: 0 }),
                                            acmd: async () => ({}) }
                        Opt.set('core.vc.github.token', 'test-token')
                        cb()
                      } })
}

function response
(status, data, opts) { // { text, headers }
  return { ok: (status >= 200) && (status < 300),
           status,
           headers: { get: name => opts?.headers?.[name] },
           json: async () => data,
           text: async () => opts?.text ?? data }
}

function stubFetch
(rs) { // array of responses or Error
  let i

  i = 0
  globalThis.fetch = async () => {
                       let r

                       r = rs[i]
                       i += 1
                       if (r instanceof Error)
                         throw r
                       return r
                     }
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

tests = {}

test('getToken', 'returns set token',
     () => {
       equal(VcGithub.getToken(), 'test-token')
     })

test('getToken', 'empty token tosses',
     () => {
       Opt.set('core.vc.github.token', '')
       throws(() => VcGithub.getToken())
       Opt.set('core.vc.github.token', 'test-token')
     })

test('fetchArg', 'default headers',
     () => {
       let fa

       fa = VcGithub.fetchArg('GET')
       equal(fa.method, 'GET')
       equal(fa.mode, 'cors')
       equal(fa.cache, 'no-store')
       equal(fa.headers.Authorization, 'Bearer test-token')
       equal(fa.headers.Accept, 'application/vnd.github+json')
       equal(fa.headers['X-GitHub-Api-Version'], '2026-03-10')
     })

test('fetchArg', 'accept override',
     () => {
       let fa

       fa = VcGithub.fetchArg('GET', { accept: 'application/vnd.github.diff' })
       equal(fa.headers.Accept, 'application/vnd.github.diff')
     })

test('fetchArg', 'lastModified adds header',
     () => {
       let fa

       fa = VcGithub.fetchArg('GET', { lastModified: 'lm' })
       equal(fa.headers['If-Modified-Since'], 'lm')
     })

test('del', 'ok calls cb',
     async () => {
       let called

       stubFetch([ response(204, 0) ])
       called = 0
       await VcGithub.del('http://x', () => called = 1)
       equal(called, 1)
     })

test('del', 'http error calls cb with err',
     async () => {
       let err

       stubFetch([ response(500, 0) ])
       err = 0
       await VcGithub.del('http://x', e => err = e)
       equal(err instanceof Error, true)
       equal(err.message, 'HTTP 500')
     })

test('del', 'network error calls cb with err',
     async () => {
       let err

       stubFetch([ new Error('net') ])
       err = 0
       await VcGithub.del('http://x', e => err = e)
       equal(err.message, 'net')
     })

test('patch', 'ok calls cb',
     async () => {
       let called

       stubFetch([ response(200, 0) ])
       called = 0
       await VcGithub.patch('http://x', () => called = 1)
       equal(called, 1)
     })

test('patch', 'http error calls cb with err',
     async () => {
       let err

       stubFetch([ response(404, 0) ])
       err = 0
       await VcGithub.patch('http://x', e => err = e)
       equal(err.message, 'HTTP 404')
     })

test('get', 'json success',
     async () => {
       let got

       stubFetch([ response(200, { a: 1 }, { headers: { 'Last-Modified': 'lm' } }) ])
       got = 0
       await VcGithub.get('http://x',
                          0,
                          (err, status, data, headers) => got = { err, status, data, headers })
       equal(got.err, 0)
       equal(got.status, 200)
       equal(got.data.a, 1)
       equal(got.headers.get('Last-Modified'), 'lm')
     })

test('get', 'diff accept returns text',
     async () => {
       let got

       stubFetch([ response(200, 'diff-text', { text: 'the-diff' }) ])
       got = 0
       await VcGithub.get('http://x',
                          { accept: 'application/vnd.github.diff' },
                          (err, status, data) => got = { err, status, data })
       equal(got.err, 0)
       equal(got.data, 'the-diff')
     })

test('get', 'http error reports status',
     async () => {
       let got

       stubFetch([ response(404, 0) ])
       got = 0
       await VcGithub.get('http://x',
                          0,
                          (err, status, data) => got = { err, status, data })
       equal(got.err.message, 'HTTP 404')
       equal(got.status, 404)
     })

test('get', 'network error reports',
     async () => {
       let got

       stubFetch([ new Error('down') ])
       got = 0
       await VcGithub.get('http://x', 0, err => got = { err })
       equal(got.err.message, 'down')
     })

test('getPr', 'basic caches pr and reviews',
     async () => {
       let got

       stubFetch([ response(200, { merged: 1,
                                   head: { ref: 'feat' },
                                   state: 'open',
                                   review_decision: 'APPROVED' },
                            { headers: { 'Last-Modified': 'lm1' } }),
                   response(200, [ { body: 'nice',
                                     user: { login: 'al' },
                                     state: 'APPROVED',
                                     submitted_at: 't1' } ],
                            { headers: { 'Last-Modified': 'lm2' } }) ])
       got = await new Promise(res => VcGithub.getPr(1, 'o/r', 7, res))
       equal(got.state, 'Merged')
       equal(got.branch, 'feat')
       equal(got.prNum, 7)
       equal(got.lastModified, 'lm1')
       equal(got.reviews.length, 1)
       equal(got.reviews[0].user, 'al')
       equal(got.reviews[0].body, 'nice')
       equal(got.reviews[0].state, 'APPROVED')
       equal(got.reviewsLastModified, 'lm2')
     })

test('getPr', 'full fetch maps commits and comments',
     async () => {
       let got

       stubFetch([ response(200, { state: 'open',
                                   head: { ref: 'x' } },
                            { headers: { 'Last-Modified': 'lm1' } }),
                   response(200, [], { headers: { 'Last-Modified': 'lm2' } }),
                   response(200, [ { sha: 'abc123',
                                     commit: { message: 'first line\nsecond',
                                               author: { name: 'me' } } } ],
                            { headers: { 'Last-Modified': 'lm3' } }),
                   response(200, [ { body: 'cmt',
                                     user: { login: 'you' },
                                     created_at: 'c1' } ],
                            { headers: { 'Last-Modified': 'lm4' } }) ])
       got = await new Promise(res => VcGithub.getPr(0, 'o/r', 3, res))
       equal(got.state, 'Open')
       equal(got.commits.length, 1)
       equal(got.commits[0].sha, 'abc123')
       equal(got.commits[0].message, 'first line')
       equal(got.commits[0].author, 'me')
       equal(got.commitsLastModified, 'lm3')
       equal(got.comments.length, 1)
       equal(got.comments[0].body, 'cmt')
       equal(got.comments[0].user, 'you')
       equal(got.comments[0].created, 'c1')
       equal(got.commentsLastModified, 'lm4')
     })

test('getPr', 'review decision states',
     async () => {
       let got

       stubFetch([ response(200, { review_decision: 'APPROVED',
                                   head: { ref: 'a' } },
                            { headers: { 'Last-Modified': 'lm1' } }),
                   response(200, [], { headers: { 'Last-Modified': 'lm2' } }) ])
       got = await new Promise(res => VcGithub.getPr(1, 'o/r', 1, res))
       equal(got.state, 'Approved')

       stubFetch([ response(200, { review_decision: 'PENDING',
                                   head: { ref: 'b' } },
                            { headers: { 'Last-Modified': 'lm3' } }),
                   response(200, [], { headers: { 'Last-Modified': 'lm4' } }) ])
       got = await new Promise(res => VcGithub.getPr(1, 'o/r', 2, res))
       equal(got.state, 'Pending')

       stubFetch([ response(200, { review_decision: 'CHANGES_REQUESTED',
                                   head: { ref: 'c' } },
                            { headers: { 'Last-Modified': 'lm5' } }),
                   response(200, [], { headers: { 'Last-Modified': 'lm6' } }) ])
       got = await new Promise(res => VcGithub.getPr(1, 'o/r', 3, res))
       equal(got.state, 'Request for changes')

       stubFetch([ response(200, { draft: 1,
                                   head: { ref: 'd' } },
                            { headers: { 'Last-Modified': 'lm7' } }),
                   response(200, [], { headers: { 'Last-Modified': 'lm8' } }) ])
       got = await new Promise(res => VcGithub.getPr(1, 'o/r', 4, res))
       equal(got.state, 'Draft')
     })

test('getPr', '304 uses cached when basic',
     async () => {
       let got

       stubFetch([ response(200, { state: 'open',
                                   head: { ref: 'b' } },
                            { headers: { 'Last-Modified': 'lm1' } }),
                   response(200, [], { headers: { 'Last-Modified': 'lm2' } }) ])
       await new Promise(res => VcGithub.getPr(1, 'o/r', 1, res))
       stubFetch([ response(304, 0) ])
       got = await new Promise(res => VcGithub.getPr(1, 'o/r', 1, res))
       equal(got.prNum, 1)
       equal(got.state, 'Open')
     })

test('getPr', '304 with cache miss gives no result',
     async () => {
       let got

       stubFetch([ response(304, 0) ])
       got = await new Promise(res => VcGithub.getPr(1, 'o/r', 99, res))
       equal(got, undefined)
     })

test('getPr', 'no data gives no result',
     async () => {
       let got

       stubFetch([ response(200, 0) ])
       got = await new Promise(res => VcGithub.getPr(1, 'o/r', 1, res))
       equal(got, undefined)
     })

test('getPr', '304 without commits refetches full',
     async () => {
       let got

       stubFetch([ response(200, { state: 'open',
                                   head: { ref: 'b' } },
                            { headers: { 'Last-Modified': 'lm1' } }),
                   response(200, [], { headers: { 'Last-Modified': 'lm2' } }) ])
       await new Promise(res => VcGithub.getPr(1, 'o/r', 2, res))
       stubFetch([ response(304, 0),
                   response(200, { state: 'open',
                                   head: { ref: 'b' } },
                            { headers: { 'Last-Modified': 'lm1' } }),
                   response(200, [], { headers: { 'Last-Modified': 'lm2' } }),
                   response(200, [ { sha: 's1',
                                     commit: { message: 'm1',
                                               author: { name: 'n' } } } ],
                            { headers: { 'Last-Modified': 'lm3' } }),
                   response(200, [], { headers: { 'Last-Modified': 'lm4' } }) ])
       got = await new Promise(res => VcGithub.getPr(0, 'o/r', 2, res))
       equal(got.commits.length, 1)
       equal(got.commits[0].sha, 's1')
     })

test('getPr', 'new pr with same branch invalidates old cache',
     async () => {
       let got

       stubFetch([ response(200, { state: 'open',
                                   head: { ref: 'shared' } },
                            { headers: { 'Last-Modified': 'l1' } }),
                   response(200, [], { headers: { 'Last-Modified': 'l2' } }) ])
       await new Promise(res => VcGithub.getPr(1, 'o/r', 5, res))
       stubFetch([ response(200, { state: 'open',
                                   head: { ref: 'shared' } },
                            { headers: { 'Last-Modified': 'l3' } }),
                   response(200, [], { headers: { 'Last-Modified': 'l4' } }) ])
       await new Promise(res => VcGithub.getPr(1, 'o/r', 6, res))
       got = VcGithub.findPrNumByBranch('o/r', 'shared')
       equal(got, 6)
     })

test('findPrNumByBranch', 'no match returns 0',
     () => {
       equal(VcGithub.findPrNumByBranch('other/repo', 'shared'), 0)
     })

test('clearCachedPrs', 'empties the cache',
     async () => {
       let got

       stubFetch([ response(200, { state: 'open',
                                   head: { ref: 'b' } },
                            { headers: { 'Last-Modified': 'l1' } }),
                   response(200, [], { headers: { 'Last-Modified': 'l2' } }) ])
       await new Promise(res => VcGithub.getPr(1, 'o/r', 8, res))
       VcGithub.clearCachedPrs()
       got = VcGithub.findPrNumByBranch('o/r', 'b')
       equal(got, 0)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
