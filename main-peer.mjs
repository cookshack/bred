import { d } from './main-log.mjs'

import * as CMState from '@codemirror/state'
import * as CMCollab from '@codemirror/collab'

let bufs

function get
(id) {
  let buf, updates

  buf = bufs[id]
  if (buf) {
    buf.fresh = 0
    return buf
  }

  updates = []
  buf = { id: id,
          chs: [],
          fresh: 1,
          text: CMState.Text.of([ '' ]),
          //
          get updates() {
            return updates
          },
          get version() {
            return updates.length
          } }
  bufs[id] = buf
  return buf
}

export
function onPeerGet
(e, ch, onArgs) {
  const [ id ] = onArgs
  let buf

  buf = get(id)
  d('PEER ' + id + ' GET')
  e.sender.send(ch, { version: buf.version,
                      fresh: buf.fresh,
                      text: buf.text.toString() })
}

function changes
(updates) {
  return updates.map(u => ({ clientID: u.clientID,
                             changes: u.changes.toJSON() }))
}

export
function onPeerPull
(e, ch, onArgs) {
  const [ id, version, pullCh ] = onArgs

  d('PEER ' + id + ' PULLED ' + pullCh)
  setTimeout(() => {
    let buf

    buf = get(id)
    if (version < buf.version)
      e.sender.send(pullCh,
                    { updates: changes(buf.updates.slice(version)) })
    buf.chs.push(pullCh)
  })
  e.sender.send(ch, {})
}

export
function onPeerPush
(e, ch, onArgs) {
  const [ id, version, updates ] = onArgs
  let received, buf

  buf = get(id)
  received = updates.map(u => ({ clientID: u.clientID,
                                 changes: CMState.ChangeSet.fromJSON(u.changes) }))
  d('PEER ' + id + ' PUSHED ' + received.length)
  d('    version: ' + version)
  d('    buf.version: ' + buf.version)
  if (version != buf.version)
    received = CMCollab.rebaseUpdates(received, buf.updates.slice(version))
  try {
    received.forEach(update => {
      buf.updates.push(update)
      buf.text = update.changes.apply(buf.text)
    })
  }
  catch (err) {
    d('ERR ' + err.message)
  }
  if (received.length && buf.chs.length) {
    let push

    d('    WILL SEND')
    push = changes(received)
    buf.chs.forEach(pullCh => {
      d('    SEND TO ' + pullCh)
      e.sender.send(pullCh, { updates: push })
    })
  }
  e.sender.send(ch, {})
}

bufs = []
