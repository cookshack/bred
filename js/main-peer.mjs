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

  updates = [] // could get huge
  buf = { id,
          chs: new Set(),
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
function onGet
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
function onPull
(e, ch, onArgs) {
  const [ id, version, pullCh ] = onArgs

  d('============== PEER ' + id + ' PULLED (main sending) ' + pullCh)
  setTimeout(() => {
    let buf

    buf = get(id)
    if (version < buf.version)
      e.sender.send(pullCh,
                    { updates: changes(buf.updates.slice(version)) })
    buf.chs.add(pullCh)
  })
  e.sender.send(ch, {}) // just ret here
}

export
function onPush
(e, onArgs) {
  const [ id, version, updates ] = onArgs
  let received, buf, applied

  buf = get(id)
  received = updates.map(u => ({ clientID: u.clientID,
                                 changes: CMState.ChangeSet.fromJSON(u.changes) }))
  d('============= PEER ' + id + ' PUSHED (main receiving) ' + received.length)
  d('    version: ' + version)
  d('    buf.version: ' + buf.version)
  if (0) {
    d('    updates: ')
    updates.forEach(u => {
      d('clientID: ' + u.clientID)
      d('changes:')
      d(JSON.stringify(u.changes))
    })
    d('==')
  }
  if (received.length == 0)
    return {}
  applied = []
  if (version == buf.version) {
    // both at same version, new updates received.
  }
  else
    try {
      received = CMCollab.rebaseUpdates(received, buf.updates.slice(version))
    }
    catch (err) {
      d('ERR in rebaseUpdates: ' + err.message)
      d('== ERR updates: ')
      updates.forEach(u => {
        d('clientID: ' + u.clientID)
        d('changes:')
        d(JSON.stringify(u.changes))
      })
      d('== ERR received: ')
      received.forEach(r => {
        d('clientID: ' + r.clientID)
        d('changes:')
        d(JSON.stringify(r.changes))
        d('--')
      })
      d('==')
      throw err
    }
  try {
    received.forEach(update => {
      //d(JSON.stringify(update, null, 2))
      buf.updates.push(update)
      buf.text = update.changes.apply(buf.text)
      applied.push(update)
    })
  }
  catch (err) {
    d('ERR ' + err.message)
  }
  if (applied.length && buf.chs.size) {
    let push

    d('    WILL SEND')
    push = changes(applied)
    // must send to everyone, including peer that pushed.
    buf.chs.forEach(pullCh => {
      d('    SEND TO ' + pullCh)
      e.sender.send(pullCh, { updates: push })
    })
  }
  return {}
}

export
function onPsnLine
(e, onArgs) {
  const [ id, bep ] = onArgs
  let buf, text

  buf = get(id)
  d('PEER ' + id + ' PSN.LINE')

  text = buf.text.lineAt(bep)?.text
  return { version: buf.version,
           fresh: buf.fresh,
           text }
}

export
function onPsnLineNext
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
