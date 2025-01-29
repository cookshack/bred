// node or browser

export
function arrRm1
(arr, pred) { // (cb)
  let i

  i = arr.findIndex(pred)
  if (i < 0)
    return
  arr.splice(i, 1)
}

export
function stripFilePrefix
(path) {
  let file

  file = 'file://'
  if (path?.startsWith(file))
    return path.slice(file.length)
  return path
}

export
function stripAnsi
(str) {
  //str.replace(/[\x00-\x1F\x7F]/g, '') // remove control chars
  return str?.replace(/\x1B\[[0-?9;]*[mK]/g, '') // remove ansi sequences
}

export
function bool
(x) {
  if (x)
    return true
  return false
}

export
function defined
(arg) {
  if (arg === undefined)
    return 0
  if (arg === null)
    return 0
  return 1
}

// pass any args to this fn to prevent warnings about them
export
function use
() {
}
