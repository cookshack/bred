import * as Loc from './loc.mjs'
import * as Pane from './pane.mjs'
import * as Shell from './shell.mjs'
import { d } from './mess.mjs'

function findEscapeSequences
(text, type) {
  let matches, regex, match, num

  num = 41
  if (type == '+')
    num = 42
  else
    type = '-'

  regex = new RegExp('\\x1B\\[' + num + 'm([^\\x1b]+)\\x1B\\[0m', 'gs')
  matches = []

  while (match = regex.exec(text)) {
    let start, lineStart, from

    start = match.index
    lineStart = text.lastIndexOf('\n', start)
    from = lineStart == -1 ? start : start - lineStart - 1

    matches.push({ line: text.substring(0, start).split('\n').length,
                   from: from,
                   to: from + match[1].length,
                   type: type })
  }

  return matches
}

export
async function refine
(patch, cb) {
  Shell.runToString(Pane.current().dir,
                    Loc.appDir().join('bin/highlight-patch'),
                    [ patch ],
                    0,
                    text => {
                      let all

                      d({ text })
                      all = [ ...findEscapeSequences(text, '-'),
                              ...findEscapeSequences(text, '+') ]
                      d({ all })
                      cb(all)
                    })
}
