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
