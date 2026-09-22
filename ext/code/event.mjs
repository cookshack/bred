import * as U from '../../js/util.mjs'
import * as Tron from '../../js/tron.mjs'
import { d } from '../../js/mess.mjs'

import * as Comm from './comm.mjs'
import * as Pacer from './pacer.mjs'
import * as Ui from './ui.mjs'
import * as Util from './util.mjs'

import VopenCode from './lib/opencode/version.json' with { type: 'json' }

function handle
(buf, events, globalEvent) {
  let h, event

  event = globalEvent.payload

  if (globalEvent.directory)
    if (Util.sameDir(globalEvent.directory, buf.dir)) {
      // ours
    }
    else
      d('CO skip, for dir ' + globalEvent.directory)

  h = events[event.type]
  if (h?.onArrive)
    h.onArrive(buf, event)
  else if (h == null)
    // unknown event type (the handler map has entries with no onArrive, eg
    // server.heartbeat/sync, that we intentionally ignore)
    d('🌱 TODO handle ' + event.type)
}

export
function startSub
(buf, events) {
  let state

  async function runStream
  (client) {
    let due, iter

    try {
      let evs

      evs = await client.global.event()
      iter = evs.stream[Symbol.asyncIterator]()
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
