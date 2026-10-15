import * as U from '../../js/util.mjs'
import * as Tron from '../../js/tron.mjs'
import { d } from '../../js/mess.mjs'

import * as Comm from './comm.mjs'
import * as Pacer from './pacer.mjs'
import * as Ui from './ui.mjs'
import * as Util from './util.mjs'

import VopenCode from './lib/opencode/version.json' with { type: 'json' }

function legacy
(type, properties) {
  return { type, properties: properties || {} }
}

function parseJson
(s) {
  try {
    return JSON.parse(s)
  }
  catch {
    return {}
  }
}

function textOf
(content) {
  let i, out

  out = []
  content = content || []
  for (i = 0; i < content.length; i++)
    if (content[i].type == 'text')
      out.push(content[i].text)
  return out.join('\n')
}

// v2 forms replace v1 questions: map each field to a question the UI understands.
function fieldQuestions
(form) {
  return (form.fields || []).map(f => ({ key: f.key, header: f.title, question: f.description, custom: f.custom, multiple: f.type == 'multiselect', options: (f.options || []).map(o => ({ value: o.value, label: o.label, description: o.description })) }))
}

// Translate a v2 event into the legacy events the code handlers consume.
export
function translate
(buf, ev) {
  let data, state, out

  function toolPart
  (status, input, extra) {
    let st

    st = Object.assign({ status, input: input || state.toolInputs?.[data.id] || {}, output: '', metadata: {} }, extra)
    return { id: data.id, type: 'tool', tool: data.name || state.toolNames?.[data.id], callID: data.id, messageID: data.assistantMessageID, sessionID: data.sessionID, state: st }
  }

  data = ev.data || {}
  state = buf.vars('code')
  out = []

  switch (ev.type) {
  case 'server.connected':
    out.push(legacy('server.connected'))
    break
  case 'session.idle':
    out.push(legacy('session.idle', { sessionID: data.sessionID }))
    break
  case 'session.status':
    out.push(legacy('session.status', { sessionID: data.sessionID, status: data.status }))
    break
  case 'session.execution.started':
    out.push(legacy('session.status', { sessionID: data.sessionID, status: { type: 'busy' } }))
    break
  case 'session.execution.succeeded':
  case 'session.execution.interrupted':
    out.push(legacy('session.status', { sessionID: data.sessionID, status: { type: 'idle' } }))
    break
  case 'session.execution.failed':
    out.push(legacy('session.error', { sessionID: data.sessionID, error: data.error }))
    out.push(legacy('session.status', { sessionID: data.sessionID, status: { type: 'idle' } }))
    break
  case 'session.step.failed':
    out.push(legacy('session.error', { sessionID: data.sessionID, error: data.error }))
    break
  case 'session.renamed':
    out.push(legacy('session.updated', { info: { id: data.sessionID, title: data.title } }))
    break
  case 'session.usage.updated':
    out.push(legacy('message.updated', { info: { sessionID: data.sessionID, tokens: data.tokens, cost: data.cost } }))
    break
  case 'session.model.selected':
    out.push(legacy('message.updated', { info: { sessionID: data.sessionID, model: data.model } }))
    break
  case 'permission.asked':
    out.push(legacy('permission.asked', { id: data.id, sessionID: data.sessionID, permission: data.action, type: data.action, resources: data.resources, save: data.save, metadata: data.metadata, callID: data.metadata?.callID, tool: { callID: data.metadata?.callID } }))
    break
  case 'form.created':
    out.push(legacy('question.asked', { id: data.form.id, sessionID: data.form.sessionID, questions: fieldQuestions(data.form), tool: { callID: data.form.metadata?.callID } }))
    break
  case 'session.step.started':
    state.textID = 0
    state.thinkID = 0
    out.push(legacy('message.part.updated', { part: { type: 'step-start', sessionID: data.sessionID } }))
    break
  case 'session.step.ended':
    out.push(legacy('message.part.updated', { part: { type: 'step-finish', sessionID: data.sessionID } }))
    break
  case 'session.text.started':
    state.textID = data.assistantMessageID + ':text:' + data.ordinal
    out.push(legacy('message.part.updated', { part: { id: state.textID, type: 'text', text: '', messageID: data.assistantMessageID, sessionID: data.sessionID } }))
    break
  case 'session.text.delta':
    out.push(legacy('message.part.delta', { sessionID: data.sessionID, partID: state.textID, field: 'text', delta: data.delta }))
    break
  case 'session.reasoning.started':
    state.thinkID = data.assistantMessageID + ':reason:' + data.ordinal
    break
  case 'session.reasoning.delta':
    out.push(legacy('message.part.updated', { part: { id: state.thinkID, type: 'reasoning', messageID: data.assistantMessageID, sessionID: data.sessionID }, delta: data.delta }))
    break
  case 'session.tool.input.started':
    state.toolNames = state.toolNames || {}
    state.toolNames[data.id] = data.name
    out.push(legacy('message.part.updated', { part: toolPart('pending', {}) }))
    break
  case 'session.tool.input.ended':
    state.toolInputs = state.toolInputs || {}
    state.toolInputs[data.id] = parseJson(data.text)
    out.push(legacy('message.part.updated', { part: toolPart('pending', state.toolInputs[data.id]) }))
    break
  case 'session.tool.called':
    state.toolInputs = state.toolInputs || {}
    state.toolInputs[data.id] = data.input
    out.push(legacy('message.part.updated', { part: toolPart('running', data.input) }))
    break
  case 'session.tool.progress':
    out.push(legacy('message.part.updated', { part: toolPart('running', 0, { metadata: data.metadata }) }))
    break
  case 'session.tool.success':
    out.push(legacy('message.part.updated', { part: toolPart('completed', 0, { output: textOf(data.content), metadata: data.metadata }) }))
    break
  case 'session.tool.failed':
    out.push(legacy('message.part.updated', { part: toolPart('error', 0, { output: textOf(data.content), error: data.error }) }))
    break
  default:
    break
  }
  return out
}

function handle
(buf, events, ev) {
  let legacies

  if (ev.location?.directory && (Util.sameDir(ev.location.directory, buf.dir) == 0))
    d('CO skip, for dir ' + ev.location.directory)

  legacies = translate(buf, ev)
  legacies.forEach(le => {
                     let h

                     h = events[le.type]
                     if (h?.onArrive)
                       h.onArrive(buf, le)
                     else if (h == null)
                       // unknown event type (the handler map has entries with no
                       // onArrive, eg sync, that we intentionally ignore)
                       d('🌱 TODO handle ' + le.type)
                   })
}

export
function startSub
(buf, events) {
  let state

  async function runStream
  (client) {
    let due, iter

    try {
      iter = client.event.subscribe()[Symbol.asyncIterator]()
    }
    catch (err) {
      if (err.name == 'AbortError') return
      d('CO subscribe error: ' + err.message)
      state.client = 0
      setTimeout(() => tryReconnect(), 1000)
      return
    }

    state._resolveStreamReady?.()
    state._resolveStreamReady = 0

    Ui.updateStatus(buf, '🔁 CONNECTED', '', '', VopenCode.version)

    due = Pacer.makePacer(16)

    while (state.streamActive) {
      let timeoutMs, timeoutPromise

      timeoutMs = 35000
      timeoutPromise = new Promise((_, reject) => {
                                     setTimeout(() => reject(new Error('heartbeat-timeout')), timeoutMs)
                                   })

      try {
        let result

        result = await Promise.race([ iter.next(), timeoutPromise ])

        state.lastEventTime = Date.now()
        if (result.done) {
          state.client = 0
          tryReconnect()
          return
        }

        handle(buf, events, result.value)
        // yield only every frame, so a backlog drains fast but the ui breathes
        if (due(Date.now()))
          await U.cede()
      }
      catch (err) {
        if (err.message == 'heartbeat-timeout') {
          d('CO heartbeat timeout, reconnecting')
          state.client = 0
          tryReconnect()
          return
        }
        if (err.name == 'AbortError') return
        d('CO stream error: ' + err.message)
        state.client = 0
        tryReconnect()
        return
      }
    }
  }

  async function tryReconnect
  () {
    if (state.streamActive == 0) return
    if (state.spawnedBufferID) {
      await Tron.acmd('code.close', [ state.spawnedBufferID ])
      state.spawnedBufferID = 0
    }
    state.streamReady = new Promise(resolve => state._resolveStreamReady = resolve)
    state.client = 0
    state.lastEventTime = Date.now()
    Ui.updateStatus(buf, '🔁 RECONNECTING', '', '')
    Comm.ensureClient(buf).then(runStream).catch(() => {
                                                   d('CO reconnect spawn failed')
                                                   setTimeout(tryReconnect, 1000)
                                                 })
  }

  state = buf.vars('code')
  if (state.streamActive) return
  state.streamActive = 1
  state.lastEventTime = Date.now()
  state.streamReady = new Promise(resolve => state._resolveStreamReady = resolve)
  Ui.updateStatus(buf, '🔁 CONNECTING', '', '')

  Comm.ensureClient(buf).then(runStream).catch(() => {
                                                 d('CO spawn failed, retrying')
                                                 setTimeout(() => startSub(buf), 1000)
                                               })
}
