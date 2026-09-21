import * as CMView from '../../lib/@codemirror/view.js'
import { syntaxTree } from '../../lib/@codemirror/language.js'

// Mark nodes whose punctuation is hidden in rendered markdown (eg the ** of
// bold). The syntax tree and highlighting stay, only the marks disappear.
// Code also gets a fill background so it stands out from prose.
let decorationCode, decorationCodeStart, decorationHidden, decorationInline, hiddenNodes

decorationCode = CMView.Decoration.line({ class: 'code-md-code' })
decorationCodeStart = CMView.Decoration.line({ class: 'code-md-code code-md-code-start' })
decorationHidden = CMView.Decoration.replace({})
decorationInline = CMView.Decoration.mark({ class: 'code-md-inline' })
hiddenNodes = [ 'EmphasisMark', 'CodeMark', 'HeaderMark', 'StrikethroughMark' ]

// middle click opens a link (via auxclick); don't let it paste the primary
// selection into whatever editable buf currently has focus
function blockPaste
(event) {
  if (event.button == 1) {
    event.preventDefault()
    return 1
  }
  return 0
}

function makeMarks
(view) {
  let plugin

  function build
  (v) {
    let len, ranges

    function enter
    (node) {
      if (hiddenNodes.includes(node.name)) {
        let end

        // also hide the space after a heading mark
        end = node.name == 'HeaderMark' ? Math.min(node.to + 1, len) : node.to
        ranges.push(decorationHidden.range(node.from, end))
      }
      else if (node.name == 'InlineCode') {
        let first, last

        first = node.node.firstChild
        last = node.node.lastChild
        if (first?.name == 'CodeMark' && last?.name == 'CodeMark') {
          let from, to

          from = node.from + (first.to - first.from)
          to = node.to - (last.to - last.from)
          if (to > from)
            ranges.push(decorationInline.range(from, to))
        }
      }
      else if (node.name == 'Link' || node.name == 'Autolink') {
        let url

        url = node.node.getChild('URL')
        if (url) {
          let href, link

          href = v.state.doc.sliceString(url.from, url.to)
          link = CMView.Decoration.mark({ class: 'code-md-link',
                                          attributes: { 'data-run': 'open link',
                                                        'data-runaux': 'open externally',
                                                        'data-path': href,
                                                        'data-url': href } })
          ranges.push(link.range(node.from, node.to))
        }
      }
      else if ((node.name == 'FencedCode') || (node.name == 'CodeBlock')) {
        let pos, start

        pos = node.from
        start = node.name == 'FencedCode' ? 1 : 0
        for (; pos <= node.to;) {
          let line

          line = v.state.doc.lineAt(pos)
          ranges.push((start ? decorationCodeStart : decorationCode).range(line.from))
          start = 0
          pos = line.to + 1
        }
      }
    }

    ranges = []
    len = v.state.doc.length
    for (let { from, to } of v.visibleRanges)
      syntaxTree(v.state).iterate({ from, to, enter })
    return CMView.Decoration.set(ranges, true)
  }

  function update
  (u) {
    if (u.docChanged || u.viewportChanged)
      plugin.decorations = build(u.view)
  }

  plugin = { decorations: build(view), update }
  return plugin
}

export let hideMarks

hideMarks = CMView.ViewPlugin.define(makeMarks,
                                     { decorations: v => v.decorations,
                                       eventHandlers: { mousedown: blockPaste } })
