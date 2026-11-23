export
function post
(key, data) {
  let doc, e

  // A deferred callback can outlive its window (shutdown, or a test that
  // swapped the DOM globals). There is nobody listening then, so drop it
  // instead of throwing out of a timer.
  doc = globalThis.document
  if (doc?.dispatchEvent == undefined || globalThis.CustomEvent == undefined)
    return

  e = new CustomEvent(key, { bubbles: false,
                             detail: data })
  doc.dispatchEvent(e)
}

export
function on
(key, cb) {
  globalThis.document.addEventListener(key, cb)
}
