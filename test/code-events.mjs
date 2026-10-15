import { equal } from 'node:assert/strict'
import * as Fake from './fake-oc.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

tests = {}

test('fake', 'records calls and returns canned responses',
     async () => {
       let fake, res

       fake = Fake.make({ responses: { 'session.create': { id: 'ses1' } } })
       res = await fake.session.create({ location: { directory: '/tmp' } })
       equal(res.id, 'ses1')
       equal(fake._calls.length, 1)
       equal(fake._calls[0].name, 'session.create')
       equal(fake._calls[0].input.location.directory, '/tmp')
     })

test('fake', 'streams pushed events with data and location',
     async () => {
       let fake, got, iter

       fake = Fake.make()
       iter = fake.event.subscribe()[Symbol.asyncIterator]()
       fake.push(Fake.event('session.idle', { sessionID: 's1' }, '/tmp'))
       got = await iter.next()
       equal(got.value.type, 'session.idle')
       equal(got.value.data.sessionID, 's1')
       equal(got.value.location.directory, '/tmp')
     })

test('fake', 'replays events pushed before subscribe',
     async () => {
       let fake, got, iter

       fake = Fake.make()
       fake.push(Fake.event('server.connected', {}, '/tmp'))
       iter = fake.event.subscribe()[Symbol.asyncIterator]()
       got = await iter.next()
       equal(got.value.type, 'server.connected')
     })

test('fake', 'rejects when the response is an Error',
     async () => {
       let fake, err

       fake = Fake.make({ responses: { 'session.prompt': new Error('nope') } })
       err = 0
       try {
         await fake.session.prompt({ sessionID: 's1' })
       }
       catch (e) {
         err = e
       }
       equal(err?.message, 'nope')
     })

test('fake', 'stops the stream after end',
     async () => {
       let done, fake, iter

       fake = Fake.make()
       iter = fake.event.subscribe()[Symbol.asyncIterator]()
       fake.end()
       done = await iter.next()
       equal(done.done, true)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
