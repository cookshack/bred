// Watch the host's network identity and tell the renderer when it changes.
// The renderer only learns about the change; deciding whether a running turn
// should be cancelled belongs to the code extension.

import * as Net from './net.mjs'
import Os from 'node:os'

import { d } from './main-log.mjs'

let last, started

export
function fingerprint
() {
  return Net.fingerprint(Os.networkInterfaces())
}

export
function update
(previous, interfaces, send) {
  let next

  next = Net.fingerprint(interfaces)
  if (Net.same(previous, next))
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
