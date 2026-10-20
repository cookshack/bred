import * as CMState from '../../lib/@codemirror/state.js'
import * as CMView from '../../lib/@codemirror/view.js'
import { syntaxTree } from '../../lib/@codemirror/language.js'
import { append, create } from '../../js/dom.mjs'

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

let hiddenMarks

hiddenMarks = [ 'EmphasisMark', 'StrikethroughMark', 'CodeMark', 'LinkMark', 'LinkTitle' ]

function linkAttrs
(href) {
  return { 'data-run': 'open link',
           'data-runaux': 'open externally',
           'data-path': href,
           'data-url': href }
}

function appendInlineChildren
(state, node, out, skip) {
  let pos

  pos = node.from
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.from > pos)
      out.push(state.doc.sliceString(pos, child.from))
    if (skip.includes(child.name) == 0)
      appendInline(state, child, out)
    pos = child.to
  }
  if (node.to > pos)
    out.push(state.doc.sliceString(pos, node.to))
}

function appendInline
(state, node, out) {
  let name

  name = node.name
  if (name == 'InlineCode') {
    let first, last

    first = node.firstChild
    last = node.lastChild
    out.push({ code: state.doc.sliceString(first?.name == 'CodeMark' ? first.to : node.from,
                                           last?.name == 'CodeMark' ? last.from : node.to) })
  }
  else if (name == 'Escape')
    out.push(state.doc.sliceString(node.from + 1, node.to))
  else if (name == 'HardBreak')
    out.push({ tag: 'br' })
  else if (name == 'URL') {
    let href

    href = state.doc.sliceString(node.from, node.to)
    if (href.startsWith('http://') || href.startsWith('https://'))
      out.push({ tag: 'span',
                 class: 'code-md-link',
                 attrs: linkAttrs(href),
                 children: [ href ] })
    else
      out.push(href)
  }
  else if ((name == 'Link') || (name == 'Autolink')) {
    let url, href, children

    url = node.getChild('URL')
    href = url ? state.doc.sliceString(url.from, url.to) : ''
    children = []
    appendInlineChildren(state, node, children, hiddenMarks.concat('URL'))
    out.push({ tag: 'span',
               class: 'code-md-link',
               attrs: linkAttrs(href),
               children })
  }
  else if (name == 'Image')
    appendInlineChildren(state, node, out, hiddenMarks.concat('URL'))
  else if ((name == 'Emphasis') || (name == 'StrongEmphasis') || (name == 'Strikethrough')) {
    let tag, children

    if (name == 'Emphasis')
      tag = 'em'
    else if (name == 'StrongEmphasis')
      tag = 'strong'
    else
      tag = 's'
    children = []
    appendInlineChildren(state, node, children, hiddenMarks)
    out.push({ tag, children })
  }
  else if (node.firstChild)
    appendInlineChildren(state, node, out, [])
  else
    out.push(state.doc.sliceString(node.from, node.to))
}

function appendBreakable
(parent, text) {
  let parts

  parts = text.split(/([/\\_-])/)
  for (let i = 0; i < parts.length; i++) {
    append(parent, parts[i])
    if (i % 2)
      append(parent, create('wbr', '', ''))
  }
}

function appendTokens
(parent, tokens) {
  for (let token of tokens)
    if (typeof token == 'string')
      appendBreakable(parent, token)
    else if (token.code == null) {
      let el

      el = create(token.tag, '', token.class)
      if (token.attrs)
        for (let name in token.attrs)
          el.setAttribute(name, token.attrs[name])
      append(parent, el)
      if (token.children)
        appendTokens(el, token.children)
    }
    else {
      let code

      code = create('code', '', 'code-md-inline')
      appendBreakable(code, token.code)
      append(parent, code)
    }
}

function cellTokens
(state, row) {
  let cells

  cells = []
  for (let child = row.firstChild; child; child = child.nextSibling)
    if (child.name == 'TableCell') {
      let tokens

      tokens = []
      appendInlineChildren(state, child, tokens, [])
      cells.push(tokens)
    }
  return cells
}

function alignOf
(cell) {
  let left, right

  left = cell.startsWith(':')
  right = cell.endsWith(':')
  if (left && right)
    return 'center'
  if (right)
    return 'right'
  return 'left'
}

function tableData
(state, node) {
  let delim, aligns, header, rows

  delim = node.getChild('TableDelimiter')
  aligns = delim ? rowCells(state.doc.sliceString(delim.from, delim.to)).map(alignOf) : []
  header = []
  rows = []
  for (let child = node.firstChild; child; child = child.nextSibling)
    if (child.name == 'TableHeader')
      header = cellTokens(state, child)
    else if (child.name == 'TableRow')
      rows.push(cellTokens(state, child))
  return { aligns, header, rows }
}

class TableWidget extends CMView.WidgetType {
  constructor
  (text, data) {
    super()
    this.text = text
    this.data = data
  }
  eq
  (other) {
    return this.text == other.text
  }
  get estimatedHeight
  () {
    let rows

    rows = this.data.rows.length + (this.data.header.length ? 1 : 0)
    return rows * 28
  }
  toDOM
  () {
    let wrap, table, thead, tbody

    wrap = create('div', '', 'code-md-table')
    table = create('table', '', '')
    thead = create('thead', '', '')
    tbody = create('tbody', '', '')
    if (this.data.header.length) {
      let tr

      tr = create('tr', '', '')
      for (let i = 0; i < this.data.header.length; i++) {
        let th

        th = create('th', '', '')
        th.style.textAlign = this.data.aligns[i] || 'left'
        appendTokens(th, this.data.header[i])
        append(tr, th)
      }
      append(thead, tr)
    }
    for (let row of this.data.rows) {
      let tr

      tr = create('tr', '', '')
      for (let i = 0; i < row.length; i++) {
        let td

        td = create('td', '', '')
        td.style.textAlign = this.data.aligns[i] || 'left'
        appendTokens(td, row[i])
        append(tr, td)
      }
      append(tbody, tr)
    }
    append(table, [ thead, tbody ])
    append(wrap, table)
    return wrap
  }
}

function tableDeco
(state) {
  let builder

  builder = new CMState.RangeSetBuilder()
  syntaxTree(state).iterate({ enter
                              (node) {
                                if (node.name == 'Table') {
                                  let from

                                  from = state.doc.lineAt(node.from).from
                                  // skip tables nested in quotes/lists
                                  if (state.doc.sliceString(from, node.from).trim() == '')
                                    builder.add(from, node.to,
                                                CMView.Decoration.replace({ block: true,
                                                                            widget: new TableWidget(state.doc.sliceString(node.from, node.to),
                                                                                                    tableData(state, node.node)) }))
                                  return false
                                }
                              } })
  return builder.finish()
}

export let extTables

extTables = CMState.StateField.define({ create: tableDeco,
                                        update
                                        (value, tr) {
                                          if (tr.docChanged)
                                            return tableDeco(tr.state)
                                          return value
                                        },
                                        provide: field => CMView.EditorView.decorations.from(field) })
