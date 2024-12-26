// node or browser

export
function stripFilePrefix
(path) {
  let file

  file = 'file://'
  if (path.startsWith(file))
    return path.slice(file.length)
  return path
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
