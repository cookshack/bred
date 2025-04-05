import { div } from '../../dom.mjs'

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

async function searchBufs
(dir, regex, needle, hist) {
  if (needle && needle.length) {
    let p, buf, name, lines

    hist.add(needle)

    name = 'Search Buffers: ' + needle

    buf = Buf.find(b => (b.name == name))
    if (buf)
      buf.clear()
    else {
      buf = Buf.add(name, 'Search Buffers', Ed.divW(0, 0, { hideMl: 1 }), dir)
      buf.addMode('view')
    }
    buf.opts.set('core.lint.enabled', 0)
    buf.opts.set('minimap.enabled', 0)
    buf.vars('Search Buffers').needle = needle
    buf.vars('Search Buffers').regex = regex
    if (regex)
      regex = new RegExp(needle, 'i')
    lines = []
    {
      let bufs

      bufs = []
      Buf.forEach(buf => buf.ed && bufs.push(buf))
      for (let buf of bufs) {
        let psn

        psn = buf.makePsn()
        do {
          let text

          text = await psn.line
          if (typeof text == 'string') {
            if (regex ? regex.test(text) : U.includes(text, needle, 1))
              lines.push({ text: text, from: psn.bep, row: psn.row, buf: buf })
          }
          else
            Mess.say('Error: line ' + (psn.row + 1) + ' missing from ' + buf.name)
        }
        while (await psn.lineNext())
      }
    }
    buf.vars('Search Buffers').lines = lines
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

export
function init
() {
  let moSr
  let hist

  function go
  (p, line) {
    if (line)
      p.setBuf(line.buf, {}, view => {
        view.bep = line.from
      })
  }

  function goto
  (line, other) {
    if (line) {
      let p

      if (other)
        Pane.nextOrSplit()
      p = Pane.current()

      go(p, line)
    }
  }

  function follow
  (other) {
    let p, line, lines

    if (other)
      Pane.nextOrSplit()
    p = Pane.current()

    lines = p.buf.vars('Search Buffers').lines
    if (lines)
      line = lines[Ed.bepRow(p.view, p.view.bep)]

    go(p, line)
  }

  function rerun
  () {
    let p, needle

    p = Pane.current()
    needle = p.buf.vars('Search Buffers').needle ?? Mess.throw('Missing needle')
    needle.length || Mess.throw('Empty needle')
    Mess.throw('FIX')
  }

  function prompt
  (regex) {
    let p

    p = Pane.current()
    Prompt.ask({ text: 'Search Buffers',
                 hist: hist },
               needle => searchBufs(p.dir, regex, needle, hist))
  }

  function search
  (u, regex) {
    prompt(regex)
  }

  let gutter

  class Marker extends CMView.GutterMarker {
    constructor
    (name, num) {
      super()
      this.name = name
      this.num = num
    }
    toDOM
    () {
      return div([ div(this.name), div(this.num) ])
    }
  }

  gutter = CMView.gutter({ class: 'search_buffers-lineNumbers',
                           domEventHandlers: {
                             mousedown(cmView, resultLine) {
                               let lines, line, view

                               view = cmView.bred?.view
                               if (view) {
                                 lines = view.buf.vars('Search Buffers').lines
                                 if (lines)
                                   line = lines[Ed.bepRow(view, resultLine.from)]
                                 if (line)
                                   goto(line)
                               }
                             }
                           },
                           lineMarker(cmView, resultLine) {
                             let lines, line, view

                             view = cmView.bred?.view
                             if (view) {
                               lines = view.buf.vars('Search Buffers').lines
                               if (lines)
                                 line = lines[Ed.bepRow(view, resultLine.from)]
                               if (line)
                                 return new Marker(line.buf.name, line.row + 1)
                             }
                             return null
                           } })

  hist = Hist.ensure('search lines') // shared w search-lines

  moSr = Mode.add('Search Buffers',
                  { viewInit: Ed.viewInit,
                    viewInitSpec: Ed.viewInitSpec,
                    viewCopy: Ed.viewCopy,
                    initFns: Ed.initModeFns,
                    brexts: [ { backend: 'cm',
                                make: () => gutter,
                                part: new CMState.Compartment } ],
                    parentsForEm: 'ed' })

  Cmd.add('rerun', () => rerun(), moSr)
  Cmd.add('select', () => follow(), moSr)
  Cmd.add('select in other pane', () => follow(1), moSr)

  Em.on('Enter', 'select', moSr)
  Em.on('g', 'rerun', moSr)
  Em.on('o', 'select in other pane', moSr)

  Cmd.add('search buffers', search)
  Cmd.add('match buffers', u => search(u, 1))
}

export
function free
() {
  Cmd.remove('search buffers')
  Cmd.remove('match buffers')
  Mode.remove('Search Buffers')
}
