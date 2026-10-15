import { equal } from 'node:assert/strict'
import * as Ev from '../ext/code/event.mjs'
import * as Fake from './fake-oc.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function makeBuf
() {
  let state

  state = {}
  return { vars: () => state, views: [], state }
}

function until
(cb, ms) {
  let start

  start = Date.now()
  return new Promise((resolve, reject) => {
                       function poll
                       () {
                         if (cb())
                           return resolve()
                         if ((Date.now() - start) > (ms || 1000))
                           return reject(new Error('until timeout'))
                         setTimeout(poll, 5)
                       }
                       poll()
                     })
}

tests = {}

test('translate', 'execution lifecycle maps to status',
     () => {
       let buf, done, started

       buf = makeBuf()
       started = Ev.translate(buf, Fake.event('session.execution.started', { sessionID: 's1' }))
       equal(started[0].type, 'session.status')
       equal(started[0].properties.status.type, 'busy')
       done = Ev.translate(buf, Fake.event('session.execution.succeeded', { sessionID: 's1' }))
       equal(done[0].properties.status.type, 'idle')
     })

test('translate', 'session.idle and status map through',
     () => {
       let buf, leg

       buf = makeBuf()
       leg = Ev.translate(buf, Fake.event('session.idle', { sessionID: 's1' }))
       equal(leg.length, 1)
       equal(leg[0].type, 'session.idle')
       equal(leg[0].properties.sessionID, 's1')
       leg = Ev.translate(buf, Fake.event('session.status', { sessionID: 's1', status: { type: 'busy' } }))
       equal(leg[0].type, 'session.status')
       equal(leg[0].properties.status.type, 'busy')
     })

test('translate', 'permission.asked carries the action as permission',
     () => {
       let buf, leg

       buf = makeBuf()
       leg = Ev.translate(buf, Fake.event('permission.asked', { id: 'per1', sessionID: 's1', action: 'edit', resources: [ 'a.txt' ] }))
       equal(leg[0].type, 'permission.asked')
       equal(leg[0].properties.id, 'per1')
       equal(leg[0].properties.permission, 'edit')
     })

test('translate', 'form.created maps fields to questions',
     () => {
       let buf, leg

       buf = makeBuf()
       leg = Ev.translate(buf, Fake.event('form.created', { form: { id: 'f1', sessionID: 's1', title: 'Pick', fields: [ { key: 'k', title: 'Color', type: 'string', options: [ { value: 'r', label: 'Red' } ] } ] } }))
       equal(leg[0].type, 'question.asked')
       equal(leg[0].properties.id, 'f1')
       equal(leg[0].properties.questions[0].header, 'Color')
       equal(leg[0].properties.questions[0].options[0].label, 'Red')
     })

test('translate', 'text started then delta',
     () => {
       let buf, leg, started

       buf = makeBuf()
       started = Ev.translate(buf, Fake.event('session.text.started', { sessionID: 's1', assistantMessageID: 'm1', ordinal: 0 }))
       equal(started[0].properties.part.type, 'text')
       leg = Ev.translate(buf, Fake.event('session.text.delta', { sessionID: 's1', assistantMessageID: 'm1', ordinal: 0, delta: 'hi' }))
       equal(leg[0].type, 'message.part.delta')
       equal(leg[0].properties.delta, 'hi')
       equal(leg[0].properties.field, 'text')
     })

test('translate', 'reasoning delta carries the text field',
     () => {
       let buf, leg

       buf = makeBuf()
       Ev.translate(buf, Fake.event('session.reasoning.started', { sessionID: 's1', assistantMessageID: 'm1', ordinal: 0 }))
       leg = Ev.translate(buf, Fake.event('session.reasoning.delta', { sessionID: 's1', assistantMessageID: 'm1', ordinal: 0, delta: 'think' }))
       equal(leg[0].properties.part.type, 'reasoning')
       equal(leg[0].properties.delta, 'think')
     })

test('translate', 'tool lifecycle maps to states',
     () => {
       let buf, called, started, success

       buf = makeBuf()
       started = Ev.translate(buf, Fake.event('session.tool.input.started', { sessionID: 's1', assistantMessageID: 'm1', id: 't1', name: 'read' }))
       equal(started[0].properties.part.state.status, 'pending')
       called = Ev.translate(buf, Fake.event('session.tool.called', { sessionID: 's1', assistantMessageID: 'm1', id: 't1', input: { filePath: '/tmp/a' } }))
       equal(called[0].properties.part.state.status, 'running')
       equal(called[0].properties.part.state.input.filePath, '/tmp/a')
       success = Ev.translate(buf, Fake.event('session.tool.success', { sessionID: 's1', assistantMessageID: 'm1', id: 't1', content: [ { type: 'text', text: 'done' } ] }))
       equal(success[0].properties.part.state.status, 'completed')
       equal(success[0].properties.part.state.output, 'done')
     })

test('pipeline', 'startSub dispatches translated events',
     async () => {
       let buf, events, fake, got, state

       fake = Fake.make()
       state = { client: fake }
       got = []
       buf = { vars: () => state, views: [] }
       events = { 'session.idle': { onArrive: (b, ev) => got.push(ev) },
                  'message.part.updated': { onArrive: (b, ev) => got.push(ev) } }
       Ev.startSub(buf, events)
       fake.push(Fake.event('session.idle', { sessionID: 's1' }))
       fake.push(Fake.event('session.step.started', { sessionID: 's1' }))
       await until(() => got.length >= 2)
       state.streamActive = 0
       fake.end()
       equal(got[0].type, 'session.idle')
       equal(got[0].properties.sessionID, 's1')
       equal(got[1].properties.part.type, 'step-start')
     })

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
