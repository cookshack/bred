export
function post
(key, data) {
  let e

  e = new CustomEvent(key, { bubbles: false,
                             detail: data })
  globalThis.document.dispatchEvent(e)
}

export
function on
(key, cb) {
  globalThis.document.addEventListener(key, cb)
}
