import * as CMState from '@codemirror/state'
//import * as CMCollab from '@codemirror/collab'

let bufs

function get
(id) {
  let buf, updates

  buf = bufs[id]
  if (buf)
    return buf

  buf = { id: id,
          pending: [],
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
                      text: buf.tex.toString() })
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
  })
  e.sender.send(ch, {})
}

bufs = []
