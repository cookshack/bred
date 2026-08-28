import * as CMState from '../../lib/@codemirror/state.js'
import * as CMView from '../../lib/@codemirror/view.js'
import * as CMLang from '../../lib/@codemirror/language.js'

let ctx, measureFont, measureCache

function fontChanged
(font) {
  if (font == measureFont)
    return 0
  measureFont = font
  measureCache = new Map()
  if (ctx)
    ctx.font = font
  return 1
}

function measure
(text) {
  if (ctx == null) {
    ctx = globalThis.document.createElement('canvas').getContext('2d')
    ctx.font = measureFont
  }
  if (measureCache.has(text))
    return measureCache.get(text)
  {
    let w

    w = ctx.measureText(text).width
    measureCache.set(text, w)
    return w
  }
}

class PadWidget extends CMView.WidgetType {
  constructor
  (spaces) {
    super()
    this.spaces = spaces
  }

  eq
  (other) {
    return (other instanceof PadWidget) && (other.spaces == this.spaces)
  }

  toDOM
  () {
    let el

    el = globalThis.document.createElement('span')
    el.className = 'cm-table-pad'
    el.textContent = '\u00a0'.repeat(this.spaces)
    return el
  }
}

function delimCells
(line, off) {
  let cells, i

  cells = []
  i = line[0] == '|' ? 1 : 0
  while (i < line.length) {
    let pipe

    pipe = line.indexOf('|', i)
    if (pipe < 0)
      break
    cells.push({ from: off + i, to: off + pipe, pipe: off + pipe })
    i = pipe + 1
  }
  return cells
}

function rowsFor
(table, view) {
  let rows

  rows = []
  CMLang.syntaxTree(view.state).iterate({ from: table.from,
                                          to: table.to,
                                          enter: n => {
                                            if ((n.name == 'TableHeader') || (n.name == 'TableRow')) {
                                              let cells

                                              cells = (n.node.getChildren('TableCell') || []).map(c => {
                                                                                              let line, pipe

                                                                                              line = view.state.doc.lineAt(c.to)
                                                                                              pipe = view.state.doc.sliceString(c.to, line.to).indexOf('|')
                                                                                              if (pipe < 0)
                                                                                                pipe = 0
                                                                                              return { from: c.from, to: c.to, pipe: c.to + pipe }
                                                                                            })
                                              rows.push({ delim: 0, cells })
                                            }
                                            else if ((n.name == 'TableDelimiter') && (n.to - n.from > 1))
                                              rows.push({ delim: 1, cells: delimCells(view.state.doc.sliceString(n.from, n.to), n.from) })
                                          } })
  if (rows.length < 2)
    return []
  return rows
}

function cellWidth
(cell, view) {
  return measure(view.state.doc.sliceString(cell.from, cell.to).trim())
}

function addTable
(builder, table, view) {
  let rows, cols, width, spaceW

  rows = rowsFor(table, view)
  if (rows.length == 0)
    return

  cols = rows[0].cells.length
  width = Array(cols)
  for (let row of rows) {
    if (cols == 0 || row.cells.length < cols || cols < row.cells.length)
      continue
    for (let i = 0; i < row.cells.length; i++) {
      let w

      w = cellWidth(row.cells[i], view)
      if (width[i] == null || w > width[i])
        width[i] = w
    }
  }

  spaceW = measure(' ')
  for (let row of rows)
    if (row.cells.length == cols)
      for (let i = 0; i < row.cells.length; i++) {
        let cell, w, raw, pad

        cell = row.cells[i]
        w = cellWidth(cell, view)
        if (row.delim) {
          let trailingLen, lead

          raw = view.state.doc.sliceString(cell.from, cell.to)
          lead = raw.length - raw.trimStart().length
          if (lead == 0)
            builder.add(cell.from, cell.from, new PadWidget(1))
          trailingLen = raw.length - raw.trimEnd().length
          raw = measure(view.state.doc.sliceString(cell.to - trailingLen, cell.to))
          pad = Math.ceil((width[i] + spaceW - w - raw) / spaceW)
        }
        else {
          raw = measure(view.state.doc.sliceString(cell.to, cell.pipe))
          pad = Math.ceil((width[i] + spaceW - w - raw) / spaceW)
        }
        if (pad > 0)
          builder.add(cell.pipe, cell.pipe, new PadWidget(pad))
      }
}

export
function tableDecorations
(view) {
  let builder

  fontChanged(globalThis.getComputedStyle(view.contentDOM).font)
  builder = new CMState.RangeSetBuilder()
  for (let { from, to } of view.visibleRanges)
    CMLang.syntaxTree(view.state).iterate({ from,
                                            to,
                                            enter: n => {
                                              if (n.name == 'Table')
                                                addTable(builder, n, view)
                                            } })
  return builder.finish()
}

export
function markdownTablePad
() {
  return CMView.ViewPlugin.fromClass(class {
    constructor
    (view) {
      this.decorations = tableDecorations(view)
    }

    update
    (update) {
      if (update.docChanged || update.viewportChanged)
        this.decorations = tableDecorations(update.view)
    }
  },
                                     { decorations: v => v.decorations })
}
