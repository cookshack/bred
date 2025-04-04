import { d } from './main-log.mjs'

import * as CMState from '@codemirror/state'
import * as CMCollab from '@codemirror/collab'

let bufs

export
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
(e, onArgs) {
  const [ id ] = onArgs
  let buf

  buf = get(id)
  d('PEER ' + id + ' GET')
  return { version: buf.version,
           fresh: buf.fresh,
           text: buf.text.toString() }
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
(e, onArgs) {
  const [ id, version, updates ] = onArgs
  let received, buf

  buf = get(id)
  received = updates.map(u => ({ clientID: u.clientID,
                                 changes: CMState.ChangeSet.fromJSON(u.changes) }))
  d('PEER ' + id + ' PUSHED ' + received.length)
  d('    version: ' + version)
  d('    buf.version: ' + buf.version)
  if (version == buf.version)
    return {}

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
  return {}
}

export
function onPeerPsnLine
(e, onArgs) {
  const [ id, bep ] = onArgs
  let buf, text

  buf = get(id)
  d('PEER ' + id + ' PSN.LINE')

  text = buf.text.lineAt(bep)?.text
  return { version: buf.version,
           fresh: buf.fresh,
           text: text }
}

export
function onPeerPsnLineNext
(e, onArgs) {
  const [ id, bep ] = onArgs
  let buf, line

  buf = get(id)
  d('PEER ' + id + ' PSN.LINENEXT ' + bep)

  line = buf.text.lineAt(bep)
  if (line)
    if ((line.number + 1) <= buf.text.lines) {
      let next

      next = buf.text.line(line.number + 1)
      if (next)
        return { version: buf.version,
                 fresh: buf.fresh,
                 row: line.number,
                 bep: next.from,
                 more: 1 }
    }
  return { version: buf.version,
           fresh: buf.fresh }
}

bufs = []
