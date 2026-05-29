import { diffChars } from '../lib/diff.js'

function mapToLine
(lines, offset) {
  let pos

  pos = 0
  for (let i = 0; i < lines.length; i++) {
    let len

    len = lines[i].text.length
    if (offset < pos + len)
      return { lineNum: lines[i].lineNum, lineOff: offset - pos }
    pos += len + 1
  }
  return { lineNum: lines[lines.length - 1].lineNum, lineOff: lines[lines.length - 1].text.length }
}

function diffBlock
(results, oldLines, newLines) {
  let oldJoined, newJoined, changes, oldCur, newCur, j

  oldJoined = oldLines.map(l => l.text).join('\n')
  newJoined = newLines.map(l => l.text).join('\n')
  changes = diffChars(oldJoined, newJoined)
  oldCur = 0
  newCur = 0

  for (j = 0; j < changes.length; j++) {
    let ch, segments, s

    ch = changes[j]
    segments = ch.value.split('\n')
    for (s = 0; s < segments.length; s++) {
      let seg, segLen

      seg = segments[s]
      segLen = seg.length

      if (ch.removed) {
        if (segLen) {
          let mapped

          mapped = mapToLine(oldLines, oldCur)
          results.push({ line: mapped.lineNum,
                         from: mapped.lineOff + 1,
                         to: mapped.lineOff + 1 + segLen,
                         type: '-' })
        }
        oldCur += segLen + (s < segments.length - 1 ? 1 : 0)
      }
      else if (ch.added) {
        if (segLen) {
          let mapped

          mapped = mapToLine(newLines, newCur)
          results.push({ line: mapped.lineNum,
                         from: mapped.lineOff + 1,
                         to: mapped.lineOff + 1 + segLen,
                         type: '+' })
        }
        newCur += segLen + (s < segments.length - 1 ? 1 : 0)
      }
      else {
        oldCur += segLen + (s < segments.length - 1 ? 1 : 0)
        newCur += segLen + (s < segments.length - 1 ? 1 : 0)
      }
    }
  }
}

export
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

          if (oldLines.length && newLines.length && oldLines.length == newLines.length)
            diffBlock(results, oldLines, newLines)
          // Unpaired lines (extra - or +) get no refine
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
