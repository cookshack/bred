// Draw the block model from man-parse.mjs.
//
// The renderer is deliberately dumb: it maps blocks to elements and links to
// anchors carrying data-topic, so the viewer can follow man: references and
// in-page anchors without knowing the model.

import { append, divCl } from './dom.mjs'

let headingCount

headingCount = 0

function styleNode
(span) {
  let el, cls

  // Inline runs are spans with classes, never <b>/<i>/<code>: the theme styles
  // by class, and these sit inside <p> and headings where a div is invalid.
  cls = ''
  if (span.style == 'bold')
    cls = 'man-bold'
  else if (span.style == 'italic')
    cls = 'man-italic'
  else if (span.style == 'mono')
    cls = 'man-mono'
  else if (span.style == 'small')
    cls = 'man-small'
  el = globalThis.document.createElement('span')
  if (cls)
    el.className = cls
  // mdoc says what the run is (a flag, a path, a variable); man's .B does not.
  if (span.role)
    el.classList.add('man-r-' + span.role)
  append(el, span.text || '')
  return el
}

function spanNode
(span) {
  let el

  if (span.br)
    return globalThis.document.createElement('br')
  el = styleNode(span)
  if (span.href) {
    let a

    a = globalThis.document.createElement('a')
    a.setAttribute('href', span.href)
    if (span.href.startsWith('man:'))
      a.dataset.topic = span.href.slice(4)
    // A link with no text would be invisible: show its target instead, and
    // for man references show the topic rather than the man: prefix.
    if ((span.text || '').length)
      append(a, el)
    else if (span.href.startsWith('man:'))
      append(a, span.href.slice(4))
    else
      append(a, span.href)
    el = a
  }
  return el
}

function spanNodes
(spans) {
  return (spans || []).map(spanNode)
}

function blocksInto
(el, blocks, toc) {
  (blocks || []).forEach(block => {
                           append(el, blockNode(block, toc))
                         })
}

function headingNode
(block, toc) {
  let el, text

  text = ''
  block.spans.forEach(span => {
                        text += span.text || ''
                      })
  headingCount++
  el = globalThis.document.createElement((block.level == 1) ? 'h2' : 'h3')
  el.id = 'man-h-' + headingCount
  el.className = (block.level == 1) ? 'man-h1' : 'man-h2'
  append(el, spanNodes(block.spans))
  if (toc && (block.level == 1))
    toc.push({ id: el.id, text })
  return el
}

function tagNode
(block, toc) {
  let el, tag, body

  el = divCl('man-tag')
  tag = divCl('man-tag-t')
  append(tag, spanNodes(block.tag))
  body = divCl('man-tag-b')
  blocksInto(body, block.blocks, toc)
  append(el, [ tag, body ])
  return el
}

function listNode
(block, toc) {
  let tagged, el

  tagged = (block.listType == 'tag') || (block.listType == 'hang') ||
           (block.listType == 'diag') || (block.listType == 'ohang') ||
           (block.listType == 'inset')
  if (tagged) {
    el = globalThis.document.createElement('dl')
    el.className = 'man-list man-dl'
    block.items.forEach(item => {
                          let dt, dd

                          dt = globalThis.document.createElement('dt')
                          append(dt, spanNodes(item.tag))
                          dd = globalThis.document.createElement('dd')
                          blocksInto(dd, item.blocks, toc)
                          append(el, [ dt, dd ])
                        })
    return el
  }
  el = globalThis.document.createElement((block.listType == 'enum') ? 'ol' : 'ul')
  el.className = 'man-list man-ul'
  // groff prints a hyphen for both -dash and -hyphen; the stylesheet draws it
  // in place of the disc.
  if ((block.listType == 'dash') || (block.listType == 'hyphen'))
    el.className += ' man-dash'
  block.items.forEach(item => {
                        let li

                        li = globalThis.document.createElement('li')
                        blocksInto(li, item.blocks, toc)
                        append(el, li)
                      })
  return el
}

// The cell of the row above that covers column `col`, walking colspans.
function tableAbove
(above, col) {
  let i

  for (i = 0; i < above.length; i++)
    if ((above[i].at <= col) && (col < above[i].at + above[i].span))
      return above[i].desc
  return undefined
}

// Lay the rows out as HTML cells. A vertical span is one cell in HTML, but the
// model marks the continuation on the lower row (a `^` column or a `\^` field
// sets cont), so each continuation is paired with the cell above it in the same
// column: that cell grows a rowspan and the lower row emits nothing for the
// column. groff anchors a `d` span at its bottom, so the text of such a span is
// written on the continuation and moves up into the spanning cell.
function tablePlans
(block) {
  let plans, above

  plans = []
  above = []
  block.rows.forEach(row => {
                       let cols, plan, seen, at

                       // A header row can be laid out on its own (`c c` over
                       // `l l`), so a row is styled by its own descriptors and
                       // falls back to the block's when it carries none.
                       cols = row.cols || block.cols || []
                       plan = []
                       seen = []
                       // tableFit() gives a cell one column and folds an `s`
                       // column into the cell on its left, so a cell is styled
                       // by the columns it covers, starting at its own. Walking
                       // by index would style every cell after a colspan with
                       // the wrong column.
                       at = 0
                       row.cells.forEach(cell => {
                                           let span, col

                                           span = (cell.colspan > 1) ? cell.colspan : 1
                                           col = cols[at] || {}
                                           if (cell.cont) {
                                             let root

                                             root = tableAbove(above, at)
                                             // A short row can leave a
                                             // continuation with no cell above
                                             // it; groff draws nothing for it.
                                             if (root) {
                                               root.rowspan++
                                               if (((root.spans || root.cell.spans || []).length == 0) &&
                                                   (cell.spans || []).length) {
                                                 root.spans = cell.spans
                                                 root.bottom = col.bottom
                                               }
                                               seen.push({ at, span, desc: root })
                                             }
                                           }
                                           else {
                                             let desc

                                             desc = { cell, col, span, rowspan: 1 }
                                             plan.push(desc)
                                             seen.push({ at, span, desc })
                                           }
                                           at += span
                                         })
                       plans.push(plan)
                       above = seen
                     })
  return plans
}

function tableNode
(block) {
  let el, body

  el = globalThis.document.createElement('table')
  el.className = 'man-table' + (block.options.box ? ' man-box' : '') +
                 (block.options.allbox ? ' man-allbox' : '')
  body = globalThis.document.createElement('tbody')
  el.appendChild(body)
  tablePlans(block).forEach(plan => {
                              let tr

                              tr = globalThis.document.createElement('tr')
                              plan.forEach(desc => {
                                             let col, td

                                             col = desc.col
                                             td = globalThis.document.createElement('td')
                                             if (desc.span > 1)
                                               td.setAttribute('colspan', String(desc.span))
                                             if (desc.rowspan > 1)
                                               td.setAttribute('rowspan',
                                                               String(desc.rowspan))
                                             td.className = 'man-' + (col.align || 'left') +
                                                                  (col.bold ? ' man-bold' : '') +
                                                                  (col.italic ? ' man-italic' : '') +
                                                                  (col.bottom ? ' man-bottom' : '')
                                             append(td, spanNodes(desc.spans || desc.cell.spans))
                                             tr.appendChild(td)
                                           })
                              body.appendChild(tr)
                            })
  return el
}

function blockNode
(block, toc) {
  switch (block.kind) {
  case 'heading':
    return headingNode(block, toc)
  case 'para': {
    let el

    el = globalThis.document.createElement('p')
    if (block.synopsis)
      el.className = 'man-synopsis'
    append(el, spanNodes(block.spans))
    return el
  }
  case 'tag':
    return tagNode(block, toc)
  case 'group':
    return insetNode(block, toc)
  case 'pre': {
    let el

    el = globalThis.document.createElement('pre')
    el.className = 'man-pre' + (block.mono ? ' man-mono' : '')
    append(el, spanNodes(block.spans))
    return el
  }
  case 'list':
    return listNode(block, toc)
  case 'table':
    return tableNode(block)
  case 'space':
    return divCl('man-space')
  default:
    return divCl('man-unknown')
  }
}

function insetNode
(block, toc) {
  let el

  el = divCl('man-inset')
  blocksInto(el, block.blocks, toc)
  return el
}

export
function render
(doc) {
  let el, toc

  headingCount = 0
  toc = []
  el = divCl('man-doc')
  blocksInto(el, doc.blocks, toc)
  // The viewer lists the toc in the Assist sidebar; the page itself starts
  // with its first heading.
  return { el, toc }
}
