import * as WodeCommon from './wode-common.mjs'
import { d } from './mess.mjs'

import * as CMState from '../lib/@codemirror/state.js'
import * as CMView from '../lib/@codemirror/view.js'

export
function markFromDec
(dec) {
  let m

  if (dec.ref)
    return { ref: dec.ref }

  m = {}

  if (dec.rules)
    m.class = dec.rules.map(c => 'bred-rule-' + c).join(' ')
  if (dec.attr)
    m.attributes = dec.attr

  if (dec.line)
    return { line: CMView.Decoration.line(m) }
  return { mark: CMView.Decoration.mark(m) }
}

export
function makeDecor
(spec) {
  return markFromDec(spec)
}

export
function makeDecorator
(spec) {
  let marks

  function decorate
  (edview) {
    let builder

    builder = new CMState.RangeSetBuilder()

    for (let { from, to } of edview.visibleRanges)
      for (let pos = from; pos <= to;) {
        let line, match

        line = edview.state.doc.lineAt(pos)
        match = line.text.match(spec.regex)
        if (match)
          for (let i = 1; i < match.indices.length; i++) {
            let index, from, to, mark

            index = match.indices[i]
            from = line.from + index[0]
            to = line.from + index[1]
            //d('adding ' + from + ' ' + to)
            mark = marks[i - 1]
            if (mark?.ref) {
              let markR, view

              view = edview.state.facet(WodeCommon.bredView())
              if (view) {
                markR = mark.ref(view, match, line)
                if (markR?.mark)
                  builder.add(from, to, markR.mark)
                else if (markR?.line)
                  builder.add(line.from, line.from, markR.line)
                else
                  d('decorate: ref missing mark')
              }
              else
                d('decorate: missing view')
            }
            else if (mark?.mark)
              builder.add(from, to, mark.mark)
            else if (mark?.line)
              builder.add(line.from, line.from, mark.line)
            else
              d('decorate: missing mark')
          }
        pos = line.to + 1
      }

    return builder.finish()
  }

  class Pv {
    constructor(ed) {
      this.decorations = decorate(ed)
    }

    update(update) {
      if (update.docChanged || update.viewportChanged)
        this.decorations = decorate(update.view)
    }
  }

  marks = spec.decor.map(markFromDec)

  return CMView.ViewPlugin.fromClass(Pv, { decorations: v => v.decorations })
}

export
function decorate
(view, mode) {
  if (mode?.decorators) {
    let decorators

    decorators = []
    mode.decorators.forEach(dec => {
      d(dec)
      decorators.push(makeDecorator(dec))
    })

    view.ed.dispatch({ effects: view.wode.decorMode.reconfigure(decorators) })
  }
}
