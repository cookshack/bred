// Scroller end-tracking for code buffers.

export
function atEnd
(w) {
  return Math.abs((w.scrollHeight - Math.ceil(w.scrollTop)) - w.clientHeight) < 10
}

// Index of the message to jump to when going up from scrollTop: the last one
// strictly above the viewport. -1 means there is none, so scroll to the top.
export
function prevMsgIndex
(tops, scrollTop) {
  for (let i = tops.length - 1; i >= 0; i--)
    if (tops[i] < scrollTop - 1)
      return i
  return -1
}

// Index of the message to jump to when going down from scrollTop: the first one
// at least a pixel below the viewport plus pad (the offset we leave above a
// jumped-to message, so a repeat click keeps stepping instead of re-selecting
// the same one; the pixel absorbs sub-pixel scroll snapping).
// -1 means there is none, or that the one we found can't be aligned with pad
// above it (it's too close to the end), so scroll to the end instead.
export
function nextMsgIndex
(tops, scrollTop, pad, max) {
  for (let i = 0; i < tops.length; i++)
    if (tops[i] > scrollTop + pad + 1)
      return tops[i] - pad >= max ? -1 : i
  return -1
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
