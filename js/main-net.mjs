// Watch the host's network identity and tell the renderer when it changes.
// The renderer only learns about the change; deciding whether a running turn
// should be cancelled belongs to the code extension.

import Os from 'node:os'

import { d } from './main-log.mjs'

let last, started

// A stable summary of the machine's network identity. IPv4 is preferred
// because temporary IPv6 addresses can rotate without the network changing.
// IPv6 is used when the machine has no routable IPv4.
export
function fingerprint
(interfaces) {
  let i, names, v4, v6

  interfaces = interfaces || Os.networkInterfaces()
  v4 = []
  v6 = []
  names = Object.keys(interfaces || {})
  for (i = 0; i < names.length; i++) {
    let infos, j, name

    name = names[i]
    infos = interfaces[name] || []
    for (j = 0; j < infos.length; j++) {
      let info

      info = infos[j]
      if (info.internal)
        continue
      if ((info.family == 'IPv4') || (info.family == 4))
        v4.push(name + ':' + info.address)
      else if ((info.family == 'IPv6') || (info.family == 6))
        v6.push(name + ':' + info.address)
    }
  }
  if (v4.length == 0)
    v4 = v6
  v4.sort()
  return v4
}

export
function same
(a, b) {
  if ((a?.length || 0) == (b?.length || 0))
    return (a || []).every((x, i) => x == b[i]) ? 1 : 0
  return 0
}

export
function update
(previous, interfaces, send) {
  let next

  next = fingerprint(interfaces)
  if (same(previous, next))
    return previous
  d('NET change ' + (next.length ? next.join(',') : 'offline'))
  send({ fingerprint: next, hasNetwork: next.length ? 1 : 0 })
  return next
}

function tick
(send) {
  last = update(last, Os.networkInterfaces(), send)
}

export
function start
(send) {
  let timer

  if (started)
    return
  started = 1
  last = fingerprint()
  timer = setInterval(() => tick(send), 2000)
  timer.unref?.()
}
