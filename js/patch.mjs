import { diffChars } from '../lib/diff.js'

function computeRefine
(patch) {
  let lines, results, i

  lines = patch.split('\n')
  results = []

  i = 0
  while (i < lines.length) {
    let c

    c = lines[i]
    if (c.length == 0) {
      i++
      continue
    }

    // Only process inside hunks (after @@ headers)
    if (c[0] == '@' && c[1] == '@') {
      i++

      while (i < lines.length) {
        let cur

        cur = lines[i]
        if (cur.length == 0 || (cur[0] == '@' && cur[1] == '@'))
          break

        if (cur[0] == '+') {
          i++
          continue
        }

        if (cur[0] == '-') {
          let oldLines, newLines

          // Collect consecutive - lines
          oldLines = [ { text: cur.slice(1), lineNum: i + 1 } ]
          i++
          while (i < lines.length) {
            let n

            n = lines[i]
            if (n.length && n[0] == '-') {
              oldLines.push({ text: n.slice(1), lineNum: i + 1 })
              i++
            }
            else
              break
          }

          // Collect matching + lines
          newLines = []
          while (i < lines.length) {
            let n

            n = lines[i]
            if (n.length && n[0] == '+') {
              newLines.push({ text: n.slice(1), lineNum: i + 1 })
              i++
            }
            else
              break
          }

          {
            let maxPairs, p

            // Pair old/new lines and diff them
            maxPairs = Math.min(oldLines.length, newLines.length)
            for (p = 0; p < maxPairs; p++) {
              let changes, oldPos, newPos, j

              changes = diffChars(oldLines[p].text, newLines[p].text)
              oldPos = 1 // skip '-'
              newPos = 1 // skip '+'

              for (j = 0; j < changes.length; j++) {
                let ch

                ch = changes[j]
                if (ch.removed) {
                  let from, to

                  from = oldPos
                  to = oldPos + ch.value.length
                  results.push({ line: oldLines[p].lineNum, from, to, type: '-' })
                  oldPos = to
                }
                else if (ch.added) {
                  let from, to

                  from = newPos
                  to = newPos + ch.value.length
                  results.push({ line: newLines[p].lineNum, from, to, type: '+' })
                  newPos = to
                }
                else {
                  oldPos += ch.value.length
                  newPos += ch.value.length
                }
              }
            }
            // Unpaired lines (extra - or +) get no refine
          }
          continue
        }

        i++
      }
    }
    else
      i++
  }

  return results
}

export
function refine
(patch, cb) {
  cb(computeRefine(patch))
}
