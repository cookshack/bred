import * as CMView from '../../lib/@codemirror/view.js'
import { syntaxTree } from '../../lib/@codemirror/language.js'

// Mark nodes whose punctuation is hidden in rendered markdown (eg the ** of
// bold). The syntax tree and highlighting stay, only the marks disappear.
let decorationHidden, hiddenNodes

hiddenNodes = [ 'EmphasisMark', 'CodeMark', 'HeaderMark' ]
decorationHidden = CMView.Decoration.replace({})

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
    }

    ranges = []
    len = v.state.doc.length
    for (let { from, to } of v.visibleRanges)
      syntaxTree(v.state).iterate({ from, to, enter })
    return CMView.Decoration.set(ranges)
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

hideMarks = CMView.ViewPlugin.define(makeMarks, { decorations: v => v.decorations })
