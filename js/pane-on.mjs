export
let onSetBufs

export
function onSetBuf
(cb) { // (view)
  function free
  () {
    onSetBufs.delete(cb)
  }

  onSetBufs.add(cb)

  return { free }
}

onSetBufs = new Set()
