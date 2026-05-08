import * as U from '../../js/util.mjs'
import * as Tron from '../../js/tron.mjs'
import { d } from '../../js/mess.mjs'

import * as Comm from './comm.mjs'
import * as Ui from './ui.mjs'
import * as Util from './util.mjs'

import VopenCode from './lib/opencode/version.json' with { type: 'json' }

function handle
(buf, events, event) {
  let h, evSessionID, subagent

  d('CO ' + event.type)
  d({ event })

  h = events[event.type]
  if (h) {
    if (h.onArrive)
      h.onArrive(buf, event)
    return
  }

  evSessionID = event.properties.sessionID
    || event.properties.part?.sessionID
    || event.properties.info?.id
  subagent = Util.isSubagentId(buf, evSessionID)
  d('🌱 TODO handle ' + event.type + (subagent ? ' (subagent)' : ''))
}

export
function startSub
(buf, events) {
  let state

  async function runStream
  (client) {
    let iter

    try {
      let evs

      evs = await client.event.subscribe()
      iter = evs.stream[Symbol.asyncIterator]()
    }
    catch (err) {
      if (err.name == 'AbortError') return
      d('CO subscribe error: ' + err.message)
      state.client = 0
      setTimeout(() => tryReconnect(), 1000)
      return
    }

    Ui.updateStatus(buf, '🔁 CONNECTED', '', '', VopenCode.version)

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

        // give event loop a chance, in case flurry of events is freezing ui
        await U.cede()
        handle(buf, events, result.value)
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
  Ui.updateStatus(buf, '🔁 CONNECTING', '', '')

  Comm.ensureClient(buf).then(runStream).catch(() => {
    d('CO spawn failed, retrying')
    setTimeout(() => startSub(buf), 1000)
  })
}
