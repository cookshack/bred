import Fs from 'node:fs'
import * as CMState from '@codemirror/state'
import * as U from './util.mjs'

export
function onLines
(e, ch, onArgs) {
  let files

  files = onArgs

  files.forEach(file => {
    let state, text, content

    state = CMState.EditorState.create()
    try {
      content = Fs.readFileSync(U.stripFilePrefix(file.from.uri),
                                { encoding: 'utf8' })
      text = state.toText(content || '')
    }
    catch (err) {
      file.err = { message: err.message }
    }
    if (text)
      file.fromRanges.forEach(range => {
        range.line = text.line(range.start.line + 1)
      })
  })

  e.sender.send(ch, files)
}
