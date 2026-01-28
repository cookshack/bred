// node or browser

let $home, shrug

export { shrug }

shrug = '¯\\_(ツ)_/¯'

export
function cede
(ms) {
  ms = ms || 0
  return new Promise(resolve => setTimeout(resolve, ms))
}

export
function compressedExt
(path) {
  let exts

  exts = [ '.gz' ]

  return exts.find(e => path.toLowerCase().endsWith(e))
}

export
function stripCompressedExt
(path) {
  let ext

  ext = compressedExt(path)
  if (ext)
    return path.slice(0, -ext.length)
  return path
}

export
function homeSet
(h) {
  h = h || '/'
  h = h.trim()
  if (h.endsWith('/'))
    $home = h
  else
    $home = h + '/'
}

// guaranteed to have trailing slash
export
function home
() {
  return $home || '/'
}

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

export
function urlAt
(l, pos) {
  if (l.length == 0)
    return 0
  if (l[pos] == ' ')
    return 0
  while (pos > 0) {
    if (l[pos] == ' ') {
      pos++
      break
    }
    pos--
  }
  l = l.slice(pos)
  l = stripAnsi(l)

  if (l.startsWith('~/'))
    l = 'file://' + home() + l.slice(2)
  else if (l.startsWith('/'))
    l = 'file://' + l
  try {
    return new URL(l.split(' ')[0])
  }
  catch {
  }
  return 0
}

export
function includes
(text, needle, foldCase) {
  if (foldCase)
    return text.normalize('NFD').toLowerCase().includes(needle.normalize('NFD').toLowerCase())
  return text.includes(needle)
}

// pass any args to this fn to prevent warnings about them
export
function use
() {
}
