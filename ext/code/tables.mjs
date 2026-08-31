function splitCells
(line) {
  let cells, cur, i

  cells = []
  cur = ''
  i = 0
  while (i < line.length) {
    let c

    c = line[i]
    if ((c == '\\') && (line[i + 1] == '|')) {
      cur += '|'
      i += 2
    }
    else if (c == '|') {
      cells.push(cur.trim())
      cur = ''
      i++
    }
    else {
      cur += c
      i++
    }
  }
  cells.push(cur.trim())
  return cells
}

function rowCells
(line) {
  let s

  s = line.trim()
  if (s.startsWith('|'))
    s = s.slice(1)
  if (s.endsWith('|'))
    if (s.endsWith('\\|') == 0)
      s = s.slice(0, -1)
  return splitCells(s)
}

function isDelimiter
(line) {
  let cells

  if (line.indexOf('-') < 0)
    return 0
  cells = rowCells(line)
  if (cells.length == 0)
    return 0
  return cells.every(c => /^:?-+:?$/.test(c))
}

function looksLikeRow
(line) {
  return line.trimStart().startsWith('|')
}

export
function padTableText
(text) {
  let lines, out, i

  lines = text.split('\n')
  out = []
  i = 0
  while (i < lines.length)
    if ((i + 1 < lines.length) && (isDelimiter(lines[i]) == 0) && looksLikeRow(lines[i]) && isDelimiter(lines[i + 1])) {
      let rows, j, numCols, width

      rows = [ lines[i], lines[i + 1] ]
      j = i + 2
      while ((j < lines.length) && looksLikeRow(lines[j])) {
        rows.push(lines[j])
        j++
      }
      numCols = rowCells(lines[i]).length
      width = Array(numCols).fill(0)
      for (let row of rows)
        if (isDelimiter(row) == 0) {
          let cells

          cells = rowCells(row)
          if (cells.length == numCols)
            for (let c = 0; c < numCols; c++)
              if (cells[c].length > width[c])
                width[c] = cells[c].length
        }
      for (let row of rows) {
        let lead

        lead = row.match(/^\s*/)[0]
        if (isDelimiter(row)) {
          let parts

          parts = rowCells(row).map((c, ci) => '-'.repeat(Math.max(width[ci] || 0, 1)))
          out.push(lead + '| ' + parts.join(' | ') + ' |')
        }
        else {
          let cells

          cells = rowCells(row)
          if (cells.length == numCols)
            out.push(lead + '| ' + cells.map((c, ci) => c.padEnd(width[ci])).join(' | ') + ' |')
          else
            out.push(row)
        }
      }
      i = j
    }
    else {
      out.push(lines[i])
      i++
    }
  return out.join('\n')
}
