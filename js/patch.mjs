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
    let start, lineStart, lineText, from, count

    start = match.index // before the ESC[41m
    lineStart = text.lastIndexOf('\n', start) + 1
    from = start - lineStart

    // Subtract the space taken by the 'ESC[0m's in the string
    lineText = text.substring(lineStart, start)
    count = (lineText.match(/\x1b\[0m/g) || []).length
    from -= (count * 4)

    // Subtract the space taken by the 'ESC[4Xm's in the string
    count = (lineText.match(/\x1b\[4[12]m/g) || []).length
    from -= (count * 5)

    matches.push({ line: text.substring(0, start).split('\n').length,
                   from,
                   to: from + match[1].length,
                   type })
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
