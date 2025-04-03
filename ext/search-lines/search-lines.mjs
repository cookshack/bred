import * as Buf from '../../buf.mjs'
import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Em from '../../em.mjs'
import * as Hist from '../../hist.mjs'
import * as Mess from '../../mess.mjs'
import * as Mode from '../../mode.mjs'
import * as Pane from '../../pane.mjs'
import * as Prompt from '../../prompt.mjs'
import * as U from '../../util.mjs'
//import { d } from '../../mess.mjs'

import * as CMState from '../../lib/@codemirror/state.js'
import * as CMView from '../../lib/@codemirror/view.js'

export
function init
() {
  let moSr
  let hist

  function follow
  (other) {
    let p, line, lines

    if (other)
      Pane.nextOrSplit()
    p = Pane.current()

    lines = p.buf.vars('Search Lines').lines
    if (lines)
      line = lines[Ed.bepRow(p.view, p.view.bep)]

    if (line)
      p.setBuf(line.buf, {}, view => {
        view.bep = line.from
      })
  }

  function rerun
  () {
    let p, needle

    p = Pane.current()
    needle = p.buf.vars('Search Lines').needle ?? Mess.throw('Missing needle')
    needle.length || Mess.throw('Empty needle')
    Mess.throw('FIX')
  }

  function searchLines
  (dir, target, view, regex, needle) {
    if (needle && needle.length) {
      let p, buf, name, lines

      name = 'SL: ' + needle

      buf = Buf.find(b => (b.mode.name == name))
      if (buf)
        buf.clear()
      else {
        buf = Buf.add(name, 'Search Lines', Ed.divW(0, 0, { hideMl: 1 }), dir)
        buf.addMode('view')
      }
      buf.opts.set('core.lint.enabled', 0)
      buf.opts.set('minimap.enabled', 0)
      buf.vars('Search Lines').needle = needle
      buf.vars('Search Lines').regex = regex
      if (regex)
        regex = new RegExp(needle, 'i')
      {
        let psn

        // have to do this before the view closes
        // really need to persist the views somehow

        lines = []
        psn = Ed.Backend.makePsn(view, Ed.Backend.makeBep(view, 0, 0))
        do {
          let text

          text = Ed.Backend.lineAtBep(view, psn.bep)
          if (regex ? regex.test(text) : U.includes(text, needle, 1))
            lines.push({ text: text, from: psn.bep, row: Ed.bepRow(view, psn.bep), buf: view.buf })
        }
        while (psn.lineNext())
        buf.vars('Search Lines').lines = lines
      }
      p = Pane.current()
      p.setBuf(buf, {}, view => {
        view.insert(lines.map(line => line.text).join('\n'))
        if (lines.length)
          view.insert('\n')
        view.bufStart()
      })
    }
    else if (typeof needle === 'string')
      Mess.say('Empty')
    else
      Mess.say('Error')
  }

  function prompt
  (regex) {
    let p

    p = Pane.current()
    Prompt.ask({ text: 'Search lines',
                 hist: hist },
               needle => searchLines(p.dir, p.buf, p.view, regex, needle))
  }

  function search
  (u, regex) {
    prompt(regex)
  }

  let gutter

  class NumberMarker extends CMView.GutterMarker {
    constructor
    (number) {
      super()
      this.number = number
    }
    toDOM
    () {
      return globalThis.document.createTextNode(this.number)
    }
  }

  gutter = CMView.gutter({ class: 'search_lines-lineNumbers',
                           lineMarker(cmView, resultLine) {
                             let lines, line, view

                             view = cmView.bred?.view
                             if (view) {
                               lines = view.buf.vars('Search Lines').lines
                               if (lines)
                                 line = lines[Ed.bepRow(view, resultLine.from)]
                               if (line)
                                 return new NumberMarker(line.row + 1)
                             }
                             return null
                           } })

  hist = Hist.ensure('search lines')

  moSr = Mode.add('Search Lines',
                  { viewInit: Ed.viewInit,
                    viewInitSpec: Ed.viewInitSpec,
                    viewCopy: Ed.viewCopy,
                    initFns: Ed.initModeFns,
                    exts: [ { backend: 'cm',
                              make: () => gutter,
                              part: new CMState.Compartment } ],
                    parentsForEm: 'ed' })

  Cmd.add('rerun', () => rerun(), moSr)
  Cmd.add('select', () => follow(), moSr)
  Cmd.add('select in other pane', () => follow(1), moSr)

  Em.on('Enter', 'select', moSr)
  Em.on('g', 'rerun', moSr)
  Em.on('o', 'select in other pane', moSr)

  Cmd.add('search lines', search)
  Cmd.add('match lines', u => search(u, 1))
}

export
function free
() {
  Cmd.remove('search lines')
  Cmd.remove('match lines')
  Mode.remove('Search Lines')
}
