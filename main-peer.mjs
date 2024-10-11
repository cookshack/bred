import * as CMState from '@codemirror/state'
import * as CMCollab from '@codemirror/collab'

let bufs

function get
(id) {
  let buf, updates

  buf = bufs[id]
  if (buf)
    return buf

  updates = []
  buf = { id: id,
          chs: [],
          text: CMState.Text.of([ 'xx' ]),
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
  e.sender.send(ch, { version: buf.version,
                      text: buf.text.toString() })
}

export
function onPeerPull
(e, ch, onArgs) {
  const [ id, pullCh, version ] = onArgs

  setTimeout(() => {
    let buf

    buf = get(id)
    if (version < buf.version)
      e.sender.send(pullCh,
                    { updates: JSON.stringify(buf.updates.slice(version)) })
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
  if (version != buf.version)
    received = CMCollab.rebaseUpdates(received, buf.updates.slice(version))
  received.forEach(update => {
    buf.updates.push(update)
    buf.text = update.changes.apply(buf.text)
  })
  if (received.length && buf.chs.length) {
    let push

    push = received.map(u => ({ clientID: u.clientID,
                                changes: u.changes.toJSON() }))
    buf.chs.forEach(pullCh => e.sender.send(pullCh, push))
  }
  e.sender.send(ch, {})
}

bufs = []
