import { diffChars } from '../lib/diff.js'

// How far back a window looks for the hunk header it sits in.
let hunkStartMax

hunkStartMax = 20000

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

function blockTexts
(oldLines, newLines) {
  return { old: oldLines.map(l => l.text).join('\n'),
           new: newLines.map(l => l.text).join('\n') }
}

function blockKey
(texts) {
  return texts.old + '\u0000' + texts.new
}

function diffBlock
(results, oldLines, newLines, texts, timeout) {
  let changes, oldCur, newCur, j

  texts = texts || blockTexts(oldLines, newLines)
  if (timeout)
    changes = diffChars(texts.old, texts.new, { timeout })
  else
    changes = diffChars(texts.old, texts.new)
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

// Index of the hunk header enclosing (or nearest before) a line, so a window
// doesn't have to scan the whole patch. 1-based line numbers. A hunk bigger
// than hunkStartMax gets no refine (it is only a highlight, so that is fine).
function hunkStart
(lines, first) {
  let cap, i, start

  cap = Math.max(0, first - 1 - hunkStartMax)
  start = cap
  for (i = Math.min(first - 2, lines.length - 1); i >= cap; i--) {
    let c

    c = lines[i]
    if ((c[0] == '@' && c[1] == '@') || c.startsWith('diff ')) {
      start = i
      break
    }
  }
  return start
}

// Call onBlock({ oldLines, newLines, first, last }) for every changed block
// between the 1-based line numbers first and last (inclusive). onBlock returns
// 0 to stop scanning. Blocks are never split, so a block that starts before
// first is passed whole.
function scanBlocks
(lines, first, last, start, onBlock) {
  let i

  i = start
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

        if ((cur[0] == ' ') || (cur[0] == '+') || (cur[0] == '-')) {
          if (cur[0] == '+') {
            i++
            continue
          }

          if (cur[0] == '-') {
            let oldLines, newLines, blockFirst, blockLast

            // Collect consecutive - lines
            oldLines = [ { text: cur.slice(1), lineNum: i + 1 } ]
            blockFirst = i + 1
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
            blockLast = i

            // Blocks are in line order, so once one starts past the window no
            // later one can be visible.
            if (blockFirst > last)
              return
            // Unpaired lines (extra - or +) get no refine.
            if (oldLines.length && newLines.length)
              if ((blockLast >= first) && (blockFirst <= last))
                if (onBlock({ oldLines,
                              newLines,
                              first: blockFirst,
                              last: blockLast }) == 0)
                  return
            continue
          }

          // Context line.
          i++
          continue
        }

        // A hunk body only holds context, added and removed lines, so anything
        // else (eg a following file header) ends the hunk.
        break
      }
      continue
    }

    i++
  }
}

function cacheAdd
(cache, key, refines) {
  if (cache.size >= 4000)
    cache.delete(cache.keys().next().value)
  cache.set(key, refines)
}

export
function computeRefine
(patch) {
  let lines, results

  lines = patch.split('\n')
  results = []

  scanBlocks(lines, 1, lines.length, 0, block => {
                                          diffBlock(results, block.oldLines, block.newLines)
                                        })

  return results
}

// Refine only the blocks between the 1-based line numbers first and last.
// Results are cached by block text, so streaming a patch and scrolling over
// it don't re-diff blocks that were already seen. spec: { budget, timeout } in
// ms; a budget of 0 diffs nothing that isn't already cached.
export
function refineBlocks
(patch, first, last, cache, spec) {
  let lines, results, start, budget, timeout, t0

  spec = spec || {}
  budget = spec.budget ?? 40
  timeout = spec.timeout ?? 50
  lines = patch.split('\n')
  results = []
  start = hunkStart(lines, first)
  t0 = Date.now()

  scanBlocks(lines, first, last, start, block => {
                                          let texts, key, refines

                                          texts = blockTexts(block.oldLines, block.newLines)
                                          key = blockKey(texts)
                                          refines = cache.get(key)
                                          if (refines == undefined) {
                                            let t1

                                            if ((budget == 0) || (Date.now() - t0 > budget))
                                              return 0
                                            refines = []
                                            t1 = Date.now()
                                            diffBlock(refines, block.oldLines, block.newLines, texts, timeout)
                                            // A timed out diff is truncated, so leave it for a later pass.
                                            if ((Date.now() - t1) < timeout)
                                              cacheAdd(cache, key, refines)
                                          }
                                          refines.forEach(r => results.push(r))
                                        })

  return results
}

export
function refine
(patch, cb) {
  cb(computeRefine(patch))
}
