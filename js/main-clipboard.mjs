export
async function writeClipboard
(clipboard, text, selection) {
  if (selection && clipboard.selection)
    return clipboard.selection.writeText(text)
  return clipboard.writeText(text)
}

export
async function readClipboard
(clipboard) {
  return clipboard.readText()
}
