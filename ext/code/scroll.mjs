// Scroller end-tracking for code buffers.

export
function atEnd
(w) {
  return Math.abs((w.scrollHeight - Math.ceil(w.scrollTop)) - w.clientHeight) < 10
}

// Returns a fn telling whether w should stay pinned to the end. Starts pinned;
// scrolling up unpins, being at the end re-pins. Our own scrolls to the end and
// content growth both keep it pinned.
export
function makeStick
(w) {
  let last, value

  function onScroll
  () {
    let top

    top = w.scrollTop
    if (atEnd(w))
      value = 1
    else if (top < last)
      value = 0
    last = top
  }

  function pinned
  () {
    return value
  }

  last = w.scrollTop
  value = 1
  w.addEventListener('scroll', onScroll)
  return pinned
}
