import { d } from './main-log.mjs'

import * as CMState from '@codemirror/state'

let bufs, onBufUpdate

export
function setBufUpdateHook
(fn) {
  onBufUpdate = fn
}

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
          get updates
          () {
            return updates
          },
          get version
          () {
            return updates.length
          } }
  bufs[id] = buf
  return buf
}

export
function onGet
(e, onArgs) {
  let [ id ] = onArgs
  let buf

  buf = get(id)
  d('PEER ' + id + ' GET v' + buf.version)
  return { version: buf.version,
           fresh: buf.fresh,
           text: buf.text.toString() }
}

function changes
(updates) {
  return updates.map(u => ({ clientID: u.clientID,
                             changes: u.changes.toJSON() }))
}

// Apply a batch without committing anything until every change fits.  A
// failure leaves the text and the history exactly as they were, so a bad
// batch can never leave them out of step.
function applyUpdates
(buf, updates) {
  let text, i

  text = buf.text
  for (i = 0; i < updates.length; i++) {
    let change

    change = updates[i].changes
    if (change.length == text.length)
      text = change.apply(text)
    else {
      d('PEER ' + buf.id + ' ERR change length ' + change.length + ', doc length ' + text.length)
      return 0
    }
  }
  updates.forEach(update => buf.updates.push(update))
  buf.text = text
  return updates
}

export
function onPull
(e, ch, onArgs) {
  let [ id, version, pullCh ] = onArgs

  d('PEER ' + id + ' PULL from v' + version)
  setTimeout(() => {
               let buf

               buf = get(id)
               if (version < buf.version)
                 e.sender.send(pullCh,
                               { version,
                                 updates: changes(buf.updates.slice(version)) })
               buf.chs.add(pullCh)
             })
  e.sender.send(ch, {}) // just ret here
}

export
function onUnpull
(e, onArgs) {
  let [ id, ch ] = onArgs
  let buf

  buf = bufs[id]
  if (buf)
    buf.chs.delete(ch)
  return {}
}

export
function onPush
(e, onArgs) {
  let [ id, version, updates ] = onArgs
  let buf, received, base

  buf = get(id)
  try {
    received = updates.map(u => ({ clientID: u.clientID,
                                   changes: CMState.ChangeSet.fromJSON(u.changes) }))
  }
  catch (err) {
    d('PEER ' + id + ' ERR bad changes: ' + err.message)
    return { version: buf.version,
             resync: 1 }
  }
  // The version a peer sends is one more than its last confirmed version,
  // so it is the version just before the first update in the batch.  The
  // batch is only usable when that is exactly where we are.
  base = version - 1
  d('PEER ' + id + ' PUSH v' + version + ' n' + received.length + ' have ' + buf.version)
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
    return { version: buf.version }
  if (base == buf.version) {
    let applied

    applied = applyUpdates(buf, received)
    if (applied) {
      if (buf.chs.size) {
        let push

        push = { version: base,
                 updates: changes(applied) }
        // must send to everyone, including the peer that pushed.
        buf.chs.forEach(pullCh => e.sender.send(pullCh, push))
      }
      if (onBufUpdate)
        onBufUpdate(id, buf.text.toString())
      return { version: base,
               updates: changes(applied) }
    }
  }
  // The peer is not at our version.  Never guess by rebasing: ask it to
  // pull what it is missing and push again.
  d('PEER ' + id + ' RESYNC v' + version + ' n' + received.length + ' have ' + buf.version)
  return { version: buf.version,
           resync: 1 }
}

export
function onPsnLine
(e, onArgs) {
  let [ id, bep ] = onArgs
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
  let [ id, bep ] = onArgs
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
