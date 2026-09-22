// Yields to the event loop only every ms, so a backlog of streamed events
// drains in a few ticks while the ui still gets frames.

export
function makePacer
(ms) {
  let last

  function due
  (now) {
    if ((now - last) >= ms) {
      last = now
      return 1
    }
    return 0
  }

  last = 0
  return due
}
