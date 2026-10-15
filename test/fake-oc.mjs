// Fake @opencode/client for tests. Records calls, returns canned responses, and
// streams scripted events, mirroring the v2 promise client (OpenCode.make).
//
// Usage:
//   let fake = Fake.make({ responses: { 'session.create': { id: 'ses1' } } })
//   fake.push(Fake.event('session.idle', { sessionID: 'ses1' }, '/tmp'))

export
function make
(spec) {
  let calls, responses, queue, waiters, closed, client, sessionGroup

  function record
  (name, input) {
    calls.push({ name, input })
  }

  function respond
  (name, input) {
    let r

    record(name, input)
    r = responses[name]
    if (typeof r == 'function')
      return Promise.resolve(r(input, calls))
    if (r instanceof Error)
      return Promise.reject(r)
    return Promise.resolve(r == undefined ? {} : r)
  }

  function notify
  () {
    let ws

    ws = waiters
    waiters = []
    ws.forEach(w => w())
  }

  function push
  (ev) {
    queue.push(ev)
    notify()
  }

  function end
  () {
    closed = 1
    notify()
  }

  async function* subscribe
  () {
    let i

    i = 0
    while (1) {
      if (i < queue.length) {
        yield queue[i]
        i++
        continue
      }
      if (closed)
        return
      await new Promise(w => waiters.push(w))
    }
  }

  spec = spec || {}
  calls = []
  responses = spec.responses || {}
  queue = []
  waiters = []
  closed = 0

  sessionGroup = {}
  sessionGroup.create = input => respond('session.create', input)
  sessionGroup.list = input => respond('session.list', input)
  sessionGroup.get = input => respond('session.get', input)
  sessionGroup.remove = input => respond('session.remove', input)
  sessionGroup.update = input => respond('session.update', input)
  sessionGroup.prompt = input => respond('session.prompt', input)
  sessionGroup.command = input => respond('session.command', input)
  sessionGroup.interrupt = input => respond('session.interrupt', input)
  sessionGroup.message = { get: input => respond('session.message.get', input) }

  client = {}
  client._calls = calls
  client._queue = queue
  client.push = push
  client.end = end
  client.server = { info: () => respond('server.info') }
  client.session = sessionGroup
  client.message = { list: input => respond('message.list', input) }
  client.provider = { list: input => respond('provider.list', input) }
  client.permission = { reply: input => respond('permission.reply', input) }
  client.event = { subscribe }

  return client
}

// Build a v2 event envelope. `directory` sets location.directory.
export
function event
(type, data, directory) {
  return { id: 'evt_' + Math.random().toString(36).slice(2),
           created: Date.now(),
           type,
           location: directory ? { directory } : undefined,
           data: data || {} }
}
