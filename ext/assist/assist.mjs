import { append, div, divCl, img } from '../../dom.mjs'

import * as Buf from '../../buf.mjs'
import * as Cmd from '../../cmd.mjs'
import * as Css from '../../css.mjs'
import * as Ed from '../../ed.mjs'
import * as Icon from '../../icon.mjs'
import * as Loc from '../../loc.mjs'
import * as Mess from '../../mess.mjs'
import * as Mode from '../../mode.mjs'
import * as Pane from '../../pane.mjs'
import * as Panel from '../../panel.mjs'
import * as U from '../../util.mjs'
import * as Win from '../../win.mjs'
//import { d } from '../../mess.mjs'

let onCursor, icon

export
function make
(p, dir, name, cb) { // (view)
  Ed.make(p,
          { name: name,
            dir: dir },
          cb)
}

function divW
() {
  return divCl('assist-ww',
               [ divCl('assist-w',
                       [ divCl('assist-main',
                               [ divCl('assist-main-h'),
                                 divCl('assist-main-body retracted') ]) ]) ])
}

export
function init
() {
  function refresh
  (v, // assist
   view) { // target
    function uriPath
    (uri) {
      let home, path

      path = U.stripFilePrefix(uri)
      home = Loc.home()
      if (path.startsWith(home))
        path = ':' + path.slice(home.length)
      return path
    }

    view.getCallers(results => {
      let lang, off, tok, el, body

      body = v.ele.querySelector('.assist-main-body')
      Css.expand(body)

      lang = body.querySelector('.assist-lang')
      lang.innerText = view.buf.opt('core.lang')

      off = body.querySelector('.assist-offset')
      off.innerText = view.offset

      tok = body.querySelector('.assist-tok')
      tok.innerText = results?.node?.name

      el = body.querySelector('.assist-def')
      el.innerHTML = ''
      if (results?.def) {
        let def, line

        def = results.def
        line = parseInt(def.range.start.line) + 1
        append(el,
               [ div(def.name,
                     { 'data-run': 'open link',
                       'data-path': def.uri,
                       'data-line': line }),
                 div(uriPath(def.uri) + ' ' + line) ])
      }

      el = body.querySelector('.assist-callers')
      el.innerHTML = ''
      results?.callers?.forEach(clr => {
        let line

        line = parseInt(clr.from.range.start.line) + 1

        append(el, divCl('assist-caller',
                         [ div(clr.from.name,
                               { 'data-run': 'open link',
                                 'data-path': clr.from.uri,
                                 'data-line': line }),
                           div(uriPath(clr.from.uri) + ' ' + line) ]))
      })
    })
  }

  function update
  (view) {
    Buf.forEach(b => {
      if (b.mode.key == 'assist')
        b.views.forEach(v => refresh(v, view))
    })
  }

  function viewInit
  (view) {
    let p, body

    body = view.ele.querySelector('.assist-main-body')
    p = view.win.frame1.pane

    append(body,
           div('Lang'), divCl('assist-lang'),
           div('Offset'), divCl('assist-offset'),
           div('Token'), divCl('assist-tok'),
           divCl('assist-def-h', 'Def'),
           divCl('assist-def'),
           divCl('assist-callers-h', 'Callers'),
           divCl('assist-callers'))

    refresh(view, p.view)
  }

  function assist
  () {
    let found, p, tab

    tab = Win.current().frame1.tab || Mess.throw('Tab missing')
    tab.framesRight[1]?.retract()
    p = Pane.current(tab.frameRight)

    found = Buf.find(b => (b.mode.key == 'assist'))
    found = found || Buf.add('Assist', 'Assist', divW(), Pane.current().dir)
    p.setBuf(found)
  }

  onCursor = Ed.onCursor((be, view) => update(view))

  Mode.add('Assist', { viewInit: viewInit,
                       icon: { name: 'help' } })

  Cmd.add('assist', () => assist())

  Cmd.add('update', () => {
    let p

    p = Pane.current().view.win.frame1.pane

    update(p.view)
  })

  icon = div(img(Icon.path('help'), 'Assistant', 'filter-clr-text'),
             'mini-icon onfill mini-em',
             { 'data-run': 'assist' })
  Panel.start('mini-panel', icon)
}

export
function free
() {
  Mode.remove('Assist')
  onCursor.free()
  icon.remove()
}
