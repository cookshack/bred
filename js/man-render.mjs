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
  let el

  if (span.style == 'bold')
    el = globalThis.document.createElement('b')
  else if (span.style == 'italic')
    el = globalThis.document.createElement('i')
  else if (span.style == 'mono')
    el = globalThis.document.createElement('code')
  else if (span.style == 'small')
    el = globalThis.document.createElement('small')
  else
    el = globalThis.document.createElement('span')
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
  block.items.forEach(item => {
                        let li

                        li = globalThis.document.createElement('li')
                        blocksInto(li, item.blocks, toc)
                        append(el, li)
                      })
  return el
}

function tableNode
(block) {
  let el, body

  el = globalThis.document.createElement('table')
  el.className = 'man-table' + (block.options.box ? ' man-box' : '') +
                 (block.options.allbox ? ' man-allbox' : '')
  body = globalThis.document.createElement('tbody')
  el.appendChild(body)
  block.rows.forEach(row => {
                       let tr

                       tr = globalThis.document.createElement('tr')
                       row.cells.forEach((cell, i) => {
                                           let col, td

                                           col = block.cols[i] || {}
                                           td = globalThis.document.createElement('td')
                                           if (cell.colspan > 1)
                                             td.setAttribute('colspan', String(cell.colspan))
                                           td.className = 'man-' + (col.align || 'left') +
                                                           (col.bold ? ' man-bold' : '') +
                                                           (col.italic ? ' man-italic' : '')
                                           append(td, spanNodes(cell.spans))
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
  if (toc.length > 1) {
    let tocEl

    tocEl = divCl('man-toc')
    toc.forEach(entry => {
                  let a

                  a = globalThis.document.createElement('a')
                  a.setAttribute('href', '#' + entry.id)
                  append(a, entry.text)
                  append(tocEl, a)
                })
    el.insertBefore(tocEl, el.firstChild)
  }
  return { el, toc }
}
