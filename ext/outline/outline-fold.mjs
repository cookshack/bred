// Fold service for Outline mode. Headings are lines of one or more '*'
// followed by whitespace. A heading is foldable when lines follow it before
// the next heading at the same or a shallower level.

let headingRe

headingRe = /^(\*+)\s/

export
function outlineFoldService
(state, lineStart) {
  let doc, line, match

  doc = state.doc
  line = doc.lineAt(lineStart)
  match = line.text.match(headingRe)
  if (match) {
    let level, to, next

    level = match[1].length
    to = line.to
    next = line.number + 1
    while (next <= doc.lines) {
      let l, m

      l = doc.line(next)
      // the empty final line from a trailing newline is not content
      if ((l.length == 0) && (next == doc.lines))
        break
      m = l.text.match(headingRe)
      if (m && (m[1].length <= level))
        break
      to = l.to
      next++
    }
    if (to > line.to)
      return { from: line.to, to }
  }
  return null
}
