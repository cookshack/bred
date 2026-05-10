globalThis.restartForError.onclick = () => globalThis.tron.cmd('restart')

globalThis.document.addEventListener('keydown', e => {
  if (e.key == 'r' && globalThis.restartForError?.offsetParent)
    globalThis.tron.cmd('restart')
})
