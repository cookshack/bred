import { append, divCl, divId, divIdCl, img } from './dom.mjs'

import * as Area from './area.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Cut from './cut.mjs'
import * as Em from './em.mjs'
import * as Ext from './ext.mjs'
import * as Icon from './icon.mjs'
import * as Menu from './menu.mjs'
import * as Pane from './pane.mjs'
import * as Tab from './tab.mjs'
import * as Shell from './shell.mjs'
import { d } from './mess.mjs'

function context0
(buf, name, cmd, spec) {
  let key

  cmd = cmd || name.toLowerCase()
  spec = spec || {}
  spec.enable = Object.hasOwn(spec, 'enable') ? spec.enable : 1

  if (Cmd.get(cmd, buf))
    key = Em.seq(cmd, buf) || ''
  else
    spec.enable = 0

  return divCl('bred-context-item onfill' + (spec.enable ? '' : ' disabled'),
               [ name, divCl('bred-context-kb', key) ],
               { 'data-run': cmd })
}

function contextLine
() {
  return divCl('bred-context-line')
}

function appendContextMode
(context, p) {
  p.buf.mode.context?.forEach(item =>
    append(context.el,
           context0(p.buf, item.name || item.cmd, item.cmd)))
  if (p.buf.mode.context)
    append(context.el,
           contextLine())
}

function hasSel
(win, p) {
  if (p.view.ed)
    return p.view.region?.chars > 0
  return win.selection?.toString().length > 0
}

function makeContext
(win) {
  let context

  function appendRun
  (p) {
    if (p && p.view.ed)
      append(context.el,
             context0(p.buf, 'Run This Line In Shell', 'run this line'),
             contextLine())
  }

  function appendSpell
  (p) {
    if (p)
      append(context.el,
             context0(p.buf, 'Spell Check Word', 'spell check word at click'),
             contextLine())
  }

  function appendStep
  (p) {
    append(context.el,
           context0(p?.buf, 'Inspect Element'),
           context0(p?.buf, 'Dom', 'Dom And Css Right'))
  }

  function addCopy
  (p) {
    let copy, cut, paste

    if (p.view.ed)
      paste = Cut.nth(0)
    if (hasSel(win, p)) {
      copy = 1
      if (p.view.ed)
        cut = 1
    }

    append(context.el,
           context0(p.buf, 'Cut', 0, { enable: cut }),
           context0(p.buf, 'Copy', 0, { enable: copy }),
           context0(p.buf, 'Paste', 0, { enable: paste }),
           contextLine())
  }

  context = { el: divCl('bred-context'),
              close() {
                Css.remove(context.el, 'bred-open')
              },
              open(we) {
                let target, p

                context.el.innerHTML = ''

                target = win.document.elementFromPoint(we.e.clientX, we.e.clientY)
                p = Pane.holding(target) // FIX uses current win
                if (p && (p.buf?.fileType == 'file'))
                  Shell.runToString(p.dir, 'git', [ 'ls-files', '--error-unmatch', p.buf.path ], false, (str, code) => {
                    if (code == 0)
                      append(context.el,
                             context0(p.buf, 'Annotate', 'Vc Annotate'),
                             contextLine())
                    if (Ext.get('hex'))
                      append(context.el,
                             context0(p.buf, 'Hex'),
                             contextLine())
                    p && appendContextMode(context, p)
                    p && addCopy(p)
                    appendSpell(p)
                    appendRun(p)
                    appendStep(p)
                    Css.add(context.el, 'bred-open')
                  })
                else {
                  p && appendContextMode(context, p)
                  p && addCopy(p)
                  appendSpell(p)
                  appendRun(p)
                  appendStep(p)
                  Css.add(context.el, 'bred-open')
                }
              } }

  return context
}

function id
() {
  let ident

  ident = shared().win.id
  shared().win.id = ident + 1
  return ident
}

export
function add
(window, spec) { // { devtools, initCss }
  let win, ident
  let areas, context, main, menu
  let diag, echo, el, outer, frameToggleL, frameToggleR, hover, mini, tip

  function addArea
  (area) {
    areas.push(area)
    append(el, area.el)
  }

  function frame1
  () {
    return areas.find(a => Css.has(a.el, 'bred-main'))?.tab?.frame1
  }

  ident = id()

  areas = []
  diag = divCl('bred-diag')
  echo = divIdCl('echo', 'mini-echo mini-em', [], { 'data-run': 'messages' })
  el = divCl('bred-areas')

  frameToggleL = divCl('mini-frame mini-icon onfill mini-frame-open mini-frame-left',
                       img('img/open.svg', 'Open', 'filter-clr-text'),
                       { 'data-run': 'toggle frame left' })

  frameToggleR = divCl('mini-frame mini-icon onfill mini-frame-open',
                       img('img/open.svg', 'Open', 'filter-clr-text'),
                       { 'data-run': 'toggle frame right' })

  hover = divCl('bred-hover')

  mini = divIdCl('mini', 'top',
                 [ divIdCl('mini-panel-l', 'mini-panel', frameToggleL),
                   echo,
                   divIdCl('mini-execute', 'mini-execute mini-em', [], { 'data-run': 'execute' }),
                   divIdCl('mini-panel',
                           'mini-panel',
                           [ divCl('mini-icon onfill',
                                   img('img/split.svg', 'Split', 'filter-clr-text'),
                                   { 'data-run': 'easy split' }),
                             divCl('mini-icon onfill',
                                   img(Icon.path('welcome'), 'Welcome', 'filter-clr-text'),
                                   { 'data-run': 'welcome' }),
                             frameToggleR ]) ])
  outer = divId('outer')
  tip = divCl('bred-tip')

  win = { id: ident,
          //
          get areas() {
            return areas
          },
          get body() {
            return window.document.body
          },
          get context() {
            return context
          },
          get diag() {
            return diag
          },
          get document() {
            return window.document
          },
          get echo() {
            return echo
          },
          get el() {
            return el
          },
          get frameToggleL() {
            return frameToggleL
          },
          get frameToggleR() {
            return frameToggleR
          },
          get hover() {
            return hover
          },
          get main() {
            return main
          },
          get menu() {
            return menu
          },
          get mini() {
            return mini
          },
          get outer() {
            return outer
          },
          get parent() {
            return spec?.parent
          },
          get frame1() {
            return frame1()
          },
          get selection() {
            return window.getSelection()
          },
          get tip() {
            return tip
          },
          get window() {
            return window
          },
          //
          add: addArea }

  context = makeContext(win)
  menu = Menu.make(spec?.devtools, win)

  append(win.body, win.outer)
  shared().win.wins.push(win)
  window.bredWin = win

  {
    let area

    d('setting up win')

    // top
    area = Area.add(win, 'bred-top')

    append(area.el,
           [ win.menu.el,
             win.mini ])
    area.show()

    // hover
    d('adding hover')
    area = Area.add(win, 'bred-hoverW')
    Css.hide(hover)
    append(area.el, hover)
    area.show()

    // diagnosis
    d('adding diag')
    area = Area.add(win, 'bred-diag-w')
    Css.hide(diag)
    append(diag, divCl('bred-diag-icon',
                       img(Icon.path('diagnostic'), 'Diagnostic', 'filter-clr-text')))
    append(diag, divCl('bred-diag-text-w',
                       [ divCl('bred-diag-text'),
                         divCl('bred-diag-source') ]))
    append(area.el, diag)
    area.show()

    // tooltip
    d('adding tooltip')
    area = Area.add(win, 'bred-tip-w')
    Css.hide(tip)
    append(tip, divCl('bred-tip-icon',
                      img(Icon.path('diagnostic'), 'Tip', 'filter-clr-text')))
    append(tip, divCl('bred-tip-text-w',
                      [ divCl('bred-tip-text'),
                        divCl('bred-tip-source') ]))
    append(area.el, tip)
    area.show()

    // main
    d('adding main area')
    main = Area.add(win, 'bred-main')
    main.show()
    d('adding main tab')
    Tab.add(main)

    d('appending to outer')
    append(outer,
           context.el,
           el)
  }

  return win
}

export
function current
() {
  return globalThis.bredWin
}

export
function forEach
(cb) {
  return shared().win.wins.forEach(cb)
}

export
function root
() {
  return globalThis.opener ? 0 : 1
}

export
function shared
() {
  return globalThis.bred._shared()
}

export
function init
() {
  if (root())
    shared().win = { wins: [],
                     id: 1 }
}
