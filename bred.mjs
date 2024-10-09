import { append, button, div, divCl, divIdCl, span, img } from './dom.mjs'

import * as About from './about.mjs'
import * as Area from './area.mjs'
import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Cut from './cut.mjs'
import * as Css from './css.mjs'
import * as Dir from './dir.mjs'
import * as Dom from './dom.mjs'
import * as Exec from './exec.mjs'
import * as Ed from './ed.mjs'
import elements from './elements.mjs'
import * as Em from './em.mjs'
import * as Ext from './ext.mjs'
import * as Frame from './frame.mjs'
import * as Hist from './hist.mjs'
import * as Loc from './loc.mjs'
import * as Lsp from './lsp.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Opt from './opt.mjs'
import * as OptUi from './opt-ui.mjs'
import * as Pane from './pane.mjs'
import * as Place from './place.mjs'
import * as Prompt from './prompt.mjs'
import * as Recent from './recent.mjs'
import * as Shell from './shell.mjs'
import * as Switch from './switch.mjs'
import * as Tab from './tab.mjs'
import * as Tron from './tron.mjs'
import * as Vc from './vc.mjs'
import * as ViewMode from './view-mode.mjs'
import * as Win from './win.mjs'
import { importCss } from './json.mjs'
import { d } from './mess.mjs'

//import * as Linters from "./lib/ace-linters/ace-linters.js"

let $version, mouse, context, menu, recents
let devtoolsToggle, area

export
function version
() {
  return $version
}

function focus
(we) {
  let target, p

  target = globalThis.document.elementFromPoint(we.e.clientX, we.e.clientY)
  p = Pane.holding(target)
  if (p)
    p.focus()
}

function click
(u, we) {
  context.close()
  menu.close()
  focus(we)
}

function clickAux
(u, we) {
  context.close()
  menu.close()
  focus(we)
}

function initPackages
(backend, cb) { // (err)
  // order is important
  d('init packages')
  // Opt already happened
  Hist.init()
  Area.init()
  Cmd.init()
  Em.init()
  Win.init()
  Buf.init()
  Frame.init()
  Pane.init()
  Lsp.init()
  Ed.init(backend, err => {
    if (err)
      cb(err)

    ViewMode.init()
    Dir.init()
    Cut.init()
    Exec.init()
    Shell.init()
    Vc.init()
    About.init(),
    Prompt.init()
    Switch.init()
    Tab.init()
    Ext.init()
    Place.init()
    OptUi.init()

    globalThis.bred = { ...globalThis.bred,
                        Cmd,
                        Dom,
                        Ed,
                        Em,
                        Ext,
                        Hist,
                        Loc,
                        Opt,
                        Pane,
                        Place,
                        Mess,
                        Mode,
                        Cut,
                        Dir,
                        Exec,
                        Shell }

    cb()
  })
}

function initDoc
(devtools) {
  let places, win

  function menu0
  (name, co) {
    let lower

    lower = name.toLowerCase()
    return divCl('bred-menu-item onfill',
                 [ name,
                   divIdCl('bred-menu1-' + lower, 'bred-menu1', co) ],
                 { 'data-run': 'open menu item', 'data-menu': 'bred-menu1-' + lower })
  }

  function item
  (name, cmd, attr) {
    cmd = cmd || name.toLowerCase()
    return divCl('bred-menu1-item onfill',
                 [ div(name), divCl('bred-menu-kb') ],
                 { 'data-run': cmd,
                   'data-after': 'close menu',
                   ...(attr || {}) })
  }

  function line
  () {
    return divCl('bred-menu1-line')
  }

  function context0
  (name, cmd) {
    cmd = cmd || name.toLowerCase()
    return divCl('bred-context-item onfill', name, { 'data-run': cmd })
  }

  function contextLine
  () {
    return divCl('bred-context-line')
  }

  function appendContextMode
  (context, p) {
    p.buf.mode.context?.forEach(item =>
      append(context.el,
             context0(item.name || item.cmd, item.cmd)))
    if (p.buf.mode.context)
      append(context.el,
             contextLine())
  }

  places = { el: menu0('Places'),
             //
             update() {
               let menu1, map

               d(places.el)
               menu1 = places.el.firstElementChild
               menu1.innerHTML = ''
               map = Place.map(p => item(p.name, 'open link', { 'data-path': p.path }))
               append(menu1,
                      [ item('Home', 'goto home'),
                        item('Bred', 'goto bred'),
                        item('Scratch', 'goto scratch'),
                        line(),
                        item('/', 'root'),
                        item('/tmp', 'open link', { 'data-path': '/tmp/' }),
                        map.length && line(),
                        map ])
             } }

  context = { el: divCl('bred-context'),
              close() {
                Css.remove(context.el, 'bred-open')
              },
              open(we) {
                let target, p

                context.el.innerHTML = ''

                target = globalThis.document.elementFromPoint(we.e.clientX, we.e.clientY)
                p = Pane.holding(target)
                if (p && (p.buf?.fileType == 'file'))
                  Shell.runToString(p.dir, 'git', [ 'ls-files', '--error-unmatch', p.buf.path ], false, (str, code) => {
                    if (code == 0)
                      append(context.el,
                             context0('Annotate', 'Vc Annotate'),
                             contextLine())
                    p && appendContextMode(context, p)
                    append(context.el,
                           context0('Inspect Element'))
                    Css.add(context.el, 'bred-open')
                  })
                else {
                  p && appendContextMode(context, p)
                  append(context.el,
                         context0('Inspect Element'))
                  Css.add(context.el, 'bred-open')
                }
              } }

  {
    function fill
    (el) {
      let buf

      buf = Pane.current().buf
      el.querySelectorAll('.bred-menu1-item').forEach(el => {
        if (Cmd.get(el.dataset.run, buf)) {
          Css.enable(el)
          //el.children[1].innerText = Cmd.get(el.dataset.run, buf).seq() || ""
          el.children[1].innerText = Em.seq(el.dataset.run, buf) || ''
        }
        else
          Css.disable(el)
      })
    }

    function clear
    () {
      for (let i = 0; i < menu.ele.children.length; i++)
        Css.remove(menu.ele.children[i], 'bred-open')
    }

    function close
    () {
      Css.remove(menu.ele, 'bred-open')
      clear()
      for (let i = 0; i < menu.ele.children.length; i++)
        menu.ele.children[i].onmouseover = null
    }

    function open
    () {
      Css.add(menu.ele, 'bred-open')
      clear()
      for (let i = 0; i < menu.ele.children.length; i++)
        menu.ele.children[i].onmouseover = () => {
          if (Css.has(menu.ele.children[i], 'bred-open'))
            return
          clear()
          Css.add(menu.ele.children[i], 'bred-open')
        }
    }

    devtoolsToggle = divCl('bred-devtools onfill' + (devtools.open ? ' bred-open' : ''),
                           img('img/open2.svg', 'Toggle Devtools', 'filter-clr-text'),
                           { 'data-run': 'toggle devtools' })

    Tron.on('devtools', (err, d) => {
      if (d.open)
        Css.add(devtoolsToggle, 'bred-open')
      else
        Css.remove(devtoolsToggle, 'bred-open')
      Css.enable(devtoolsToggle)
    })

    menu = { ele: divCl('bred-menu',
                        [ menu0('File',
                                [ item('New Window'),
                                  line(),
                                  item('Open File'),
                                  item('Open Recent'),
                                  line(),
                                  item('Save'),
                                  item('Save As...'),
                                  line(),
                                  item('Extensions'),
                                  item('Options'),
                                  line(),
                                  item('Restart', 'restart'),
                                  item('Quit') ]),
                          menu0('Edit',
                                [ item('Undo'),
                                  item('Redo'),
                                  line(),
                                  item('Cut'),
                                  item('Copy'),
                                  item('Paste'),
                                  line(),
                                  item('Select All'),
                                  item('Clipboard', 'cuts'),
                                  line(),
                                  item('Find'),
                                  item('Find and Replace') ]),
                          menu0('Buffer',
                                [ item('Close', 'close buffer'),
                                  item('Switch', 'switch to buffer'),
                                  item('List', 'buffers'),
                                  line() ]),
                          menu0('Pane',
                                [ item('Split', 'split'),
                                  item('Maximize', 'pane max'),
                                  item('Close', 'pane close') ]),
                          places.el,
                          menu0('Help',
                                [ item('Welcome', 'welcome'),
                                  item('View Log', 'messages'),
                                  item('Describe Current Buffer', 'describe buffer'),
                                  line(),
                                  item('Language Samples', 'samples'),
                                  item('Toggle Devtools', 'toggle devtools'),
                                  item('Open Test Buffer', 'test buffer'),
                                  line(),
                                  item('About Bred', 'about') ]),
                          divCl('menu-panel',
                                [ divCl('bred-add-tab onfill',
                                        img('img/plus.svg', 'Add Tab', 'filter-clr-text'),
                                        { 'data-run': 'add tab' }),
                                  divCl('bred-restart onfill',
                                        img('img/restart.svg', 'Restart', 'filter-clr-text'),
                                        { 'data-run': 'restart' }),
                                  devtoolsToggle ]) ]),
             close: close,
             fill: fill,
             open: open,
             places: places }

    globalThis.bred.menu = menu
    menu.places.update()
  }

  Mess.say('Building...')

  win = Win.add(globalThis)

  {
    area = Area.add(win, 'bred-top')
    elements.mini = divIdCl('mini', 'top',
                            [ divIdCl('mini-panel-l', 'mini-panel', win.frameToggleL),
                              win.echo,
                              divIdCl('mini-execute', 'mini-execute mini-em', [], { 'data-run': 'execute' }),
                              divIdCl('mini-panel',
                                      'mini-panel',
                                      [ divCl('mini-icon onfill',
                                              img('img/split.svg', 'Split', 'filter-clr-text'),
                                              { 'data-run': 'easy split' }),
                                        divCl('mini-icon onfill',
                                              img(Ed.iconPath('welcome'), 'Welcome', 'filter-clr-text'),
                                              { 'data-run': 'welcome' }),
                                        win.frameToggleR ]) ])

    append(area.el,
           [ menu.ele,
             elements.mini ])
    area.show()

    area = Area.add(win, 'bred-hoverW')
    elements.hover = divCl('bred-hover')
    Css.hide(elements.hover)
    append(area.el, elements.hover)
    area.show()

    area = Area.add(win, 'bred-diag-w')
    elements.diag = divCl('bred-diag')
    Css.hide(elements.diag)
    append(elements.diag, divCl('bred-diag-icon',
                                img(Ed.iconPath('diagnostic'), 'Diagnostic', 'filter-clr-text')))
    append(elements.diag, divCl('bred-diag-text-w',
                                [ divCl('bred-diag-text'),
                                  divCl('bred-diag-source') ]))
    append(area.el, elements.diag)
    area.show()

    area = Area.add(win, 'bred-tip-w')
    elements.tip = divCl('bred-tip')
    Css.hide(elements.tip)
    append(elements.tip, divCl('bred-tip-icon',
                               img(Ed.iconPath('diagnostic'), 'Tip', 'filter-clr-text')))
    append(elements.tip, divCl('bred-tip-text-w',
                               [ divCl('bred-tip-text'),
                                 divCl('bred-tip-source') ]))
    append(area.el, elements.tip)
    area.show()

    area = Area.add(win, 'bred-main')
    area.show()

    Tab.add(area)

    append(win.outer,
           context.el,
           win.el)

    globalThis.restartForError.remove()
  }
}

function initMouse
() {
  let x, y, hover

  mouse = { get x() {
    return x
  },
            get y() {
              return y
            } }

  globalThis.document.addEventListener('mousemove', xy)
  globalThis.document.addEventListener('mouseenter', xy)

  function xy(e) {
    x = e.pageX
    y = e.pageY
    if (e.target?.dataset?.run) {
      if (e.target?.dataset?.run == 'open link')
        elements.hover.innerText = Cmd.canon(e.target.dataset.run) + ': ' + e.target.dataset.path
      else if (e.target?.dataset?.run == 'open externally')
        elements.hover.innerText = Cmd.canon(e.target.dataset.run) + ': ' + e.target.dataset.url
      else
        elements.hover.innerText = Cmd.canon(e.target?.dataset?.run)
      if (hover)
        return
      Css.show(elements.hover)
      hover = 1
    }
    else if (hover) {
      Css.hide(elements.hover)
      hover = 0
    }
  }
}

function initCmds
() {
  let quitEm, lastContext

  Cmd.add('click', click)
  Cmd.add('click aux', clickAux)

  Cmd.add('universal argument', () => Cmd.setUniversal())

  Cmd.add('toggle devtools', () => {
    Css.disable(devtoolsToggle)
    Tron.cmd1('devtools.toggle', [], err => {
      if (err) {
        Css.enable(devtoolsToggle)
        Mess.toss(err)
      }
    })
  })

  Cmd.add('switch to tab', (u, we) => {
    d('s')
    if (we.e.target.dataset.id) {
      let tab

      d(we.e.target.dataset.id)
      tab = Tab.get(area, we.e.target.dataset.id)
      if (tab)
        tab.show()
      else
        Mess.toss('tab missing')
    }
  })

  Cmd.add('add tab', () => {
    let tab, buf, p

    p = Pane.current()
    buf = p.buf
    tab = Tab.add(area)
    Css.expand(area.tabbar)
    p = tab.pane()
    p.buf = buf
  })

  Cmd.add('close tab', (u, we) => {
    let id, tab

    id = we.e?.dataset?.tabid
    if (id)
      tab = Tab.get(area, id) || Mess('Tab missing')
    else
      tab = Tab.current(area)
    if (tab.close())
      Css.retract(area.tabbar)
  })

  function switchToTab
  (i) {
    let t

    t = Tab.getByIndex(area, i)
    if (t)
      t.show()
  }

  Cmd.add('switch to tab 1', () => switchToTab(0))
  Cmd.add('switch to tab 2', () => switchToTab(1))
  Cmd.add('switch to tab 3', () => switchToTab(2))
  Cmd.add('switch to tab 4', () => switchToTab(3))
  Cmd.add('switch to tab 5', () => switchToTab(4))
  Cmd.add('switch to tab 6', () => switchToTab(5))
  Cmd.add('switch to tab 7', () => switchToTab(6))
  Cmd.add('switch to tab 8', () => switchToTab(7))
  Cmd.add('switch to tab 9', () => switchToTab(8))

  Cmd.add('select', () => {
    let p, el

    p = Pane.current()
    el = p.view?.point?.over()
    if (el && el.dataset.run)
      Cmd.run(el.dataset.run, p.buf, 0, { e: { target: el } })
  })

  Cmd.add('toggle frame right', () => {
    let win, tab

    tab = Tab.current(area)
    win = tab.area.win
    if (Css.toggle(tab.frameRight.el, 'retracted')) {
      Tab.forEach(area, tab => {
        tab.frame1.focus()
        Css.retract(tab.frameRight.el)
      })
      tab.frame1.focus()
      Css.remove(win.frameToggleR, 'mini-frame-open')
    }
    else {
      Tab.forEach(area, tab => {
        Css.expand(tab.frameRight.el)
      })
      Css.add(win.frameToggleR, 'mini-frame-open')
    }
  })

  Cmd.add('toggle frame left', () => {
    let win, tab

    tab = Tab.current(area)
    win = tab.area.win
    if (Css.toggle(tab.frameLeft.el, 'retracted')) {
      Tab.forEach(area, tab => {
        tab.frame1.focus()
        Css.retract(tab.frameLeft.el)
      })
      tab.frame1.focus()
      Css.remove(win.frameToggleL, 'mini-frame-open')
    }
    else {
      Tab.forEach(area, tab => {
        Css.expand(tab.frameLeft.el)
      })
      Css.add(win.frameToggleL, 'mini-frame-open')
    }
  })

  Cmd.add('close menu', () => {
    menu.close()
  })

  Cmd.add('open menu item', (u, we) => {
    if (we.e.target.dataset.menu) {
      let el

      el = globalThis.document.querySelector('#' + we.e.target.dataset.menu)
      if (el) {
        let parent

        menu.fill(el)
        parent = el.parentNode
        if (Css.has(parent, 'bred-open')) {
          menu.close()
          Css.remove(parent, 'bred-open')
        }
        else {
          menu.open()
          Css.add(parent, 'bred-open')
        }
      }
      else
        Mess.warn('menu missing el')
    }
    else
      Mess.warn('missing data-menu')
  })

  Cmd.add('context menu', (u, we) => {
    we.e.preventDefault()
    context.open(we)
    lastContext = { x: we.e.x, y: we.e.y }
    context.el.style.left = we.e.x + 'px'
    context.el.style.top = we.e.y + 'px'
  })

  Cmd.add('inspect element', (u, we) => {
    let x, y

    if (we?.e) {
      x = lastContext.x
      y = lastContext.y
    }
    else {
      x = mouse.x
      y = mouse.y
    }
    Tron.cmd('devtools.inspect', [ x, y ], (err) => {
      if (err) {
        Mess.yell('inspect element: ' + err.message)
        return
      }
    })
  })

  function defAt
  (l, col) { // 1 indexed
    let end

    d(l)
    d(col)
    if (l.length == 0)
      return 0
    if (col == 0)
      return 0
    col--
    // mv back over word chars to get start
    while (1)
      if (/[_a-zA-Z0-9]/.test(l[col])) {
        if (col == 0)
          break
        col--
      }
      else {
        col++
        break
      }

    l = l.slice(col)
    d(col)
    d(l)
    col = 0
    end = l.length
    // mv forward over word chars to get end
    while (1)
      if (/[_a-zA-Z0-9]/.test(l[col])) {
        col++
        if (col == end)
          break
      }
      else
        break

    return l.slice(0, col)
  }

  Cmd.add('goto definition', () => {
    let p, l, pos, def, ctag

    p = Pane.current()
    l = p.line()
    pos = p.pos()
    def = defAt(l, pos.col)
    ctag = Ed.getCTag(def)
    if (ctag) {
      d(ctag)
      d('def: ' + def)
      d('opening: ' + ctag.loc.path)
      Pane.open(ctag.loc, 1, (view) => {
        let ret

        d('going to line: ' + ctag.regex)
        ctag.regex || Mess.toss('Ctag missing regex')
        ret = Ed.vfind(view,
                       ctag.regex,
                       0,
                       { skipCurrent: 0,
                         backwards: 0,
                         wrap: 0,
                         caseSensitive: 0,
                         wholeWord: 0,
                         regExp: 1 })
        ret || Mess.yell('Failed search for ' + ctag.regex)
      })
    }
    else
      Mess.yell('Missing: ' + def)
  })

  Cmd.add('goto bred', () => Pane.open(Loc.appDir().path))
  Cmd.add('goto home', () => Pane.open(Loc.home()))
  Cmd.add('goto scratch', () => {
    let p, buf

    p = Pane.current()

    buf = Buf.find(b => b.name == 'Scratch.js')
    if (buf) {
      p.buf = buf
      return
    }

    Ed.make(p, 'Scratch.js', p.dir)
  })

  Cmd.add('samples', () => Pane.open(Loc.appDir().join('samples')))

  Cmd.add('evaluate expression', () => {
    d('ee')
  })

  Cmd.add('open externally', (u, we) => {
    if (we.e.target.dataset.url)
      Tron.cmd('shell.open', [ we.e.target.dataset.url ], (err) => {
        if (err) {
          Mess.yell('shell.open: ' + err.message)
          return
        }
      })
    else
      Mess.say('Target missing URL')
  })

  Cmd.add('open link', (u, we) => {
    if (we.e.target.dataset.path) {
      let ext, mtype, ed

      ed = 1
      if (we.e.target.dataset.path.includes('.')) {
        ext = we.e.target.dataset.path.slice(we.e.target.dataset.path.indexOf('.') + 1)
        mtype = Ed.mtypeFromExt(ext)
        if (mtype)
          ed = Ed.supports(mtype)
      }
      if (ed)
        Pane.open(we.e.target.dataset.path, we.e.target.dataset.line)
      else
        Shell.run(0, Pane.current().dir, 'xdg-open', 0, 0, [ we.e.target.dataset.path ], 0)
    }
    else
      Mess.say('Target missing path')
  })

  Cmd.add('say', () => Mess.say('Test of Mess.say'))
  Cmd.add('warn', () => Mess.warn('Test of Mess.warn'))
  Cmd.add('yell', () => Mess.yell('Test of Mess.yell'))

  Cmd.add('cancel', () => {
    menu.close()
    Pane.cancel()
  })

  Cmd.add('recenter', () => Pane.recenter())

  Cmd.add('backward character', () => Pane.current().view.backwardChar())
  Cmd.add('forward character', () => Pane.current().view.forwardChar())
  Cmd.add('line end', () => Pane.current().view.lineEnd())
  Cmd.add('line start', () => Pane.current().view.lineStart())
  Cmd.add('buffer end', () => Pane.current().view.bufEnd())
  Cmd.add('buffer start', () => Pane.current().view.bufStart())
  Cmd.add('next line', () => Pane.current().view.lineNext())
  Cmd.add('previous line', () => Pane.current().view.linePrev())

  Cmd.add('parent', () => {
    let dir, p

    p = Pane.current()
    dir = p.dir
    if (dir)
      dir = Loc.make(dir)
    else {
      Mess.say('Missing dir, going home')
      dir = Loc.make(Loc.home())
    }

    if (dir.path)
      Dir.add(Pane.current(), dir.path, p.buf.file)
    else
      Mess.yell('parent: Missing dir')
  })

  function urlAt
  (l, pos) {
    if (l.length == 0)
      return 0
    if (l[pos] == ' ')
      return 0
    while (pos > 0) {
      if (l[pos] == ' ') {
        pos++
        break
      }
      pos--
    }
    l = l.slice(pos)
    if (l.startsWith('http://') || l.startsWith('https://'))
      return l.split(' ')[0]
    return 0
  }

  Cmd.add('view url at point', () => {
    let p, l, pos, url

    p = Pane.current()
    l = p.line()
    pos = p.pos()
    pos = pos.col
    url = urlAt(l, pos)
    if (url)
      Tron.cmd('shell.open', [ url ], (err) => err && Mess.yell('shell.open: ' + err.message))
    else
      Mess.say('Point must be over an URL')
  })

  Cmd.add('scroll up', () => {
    let ele

    ele = Pane.current().ele.parentNode
    ele.scrollTo({ top: ele.scrollTop - ele.clientHeight * 0.9,
                   left: 0,
                   behavior: 'auto' })
  })

  Cmd.add('scroll down', () => {
    let ele

    ele = Pane.current().ele.parentNode
    ele.scrollTo({ top: ele.scrollTop + ele.clientHeight * 0.9,
                   left: 0,
                   behavior: 'auto' })
  })

  function incrFont
  (incr) { // in px
    let px

    incr = incr || 1

    px = parseFloat(globalThis.getComputedStyle(globalThis.document.documentElement).fontSize)
    //d('px: ' + px)
    globalThis.document.documentElement.style.fontSize = (px + incr) + 'px'
    //d('new size: ' + parseFloat(globalThis.getComputedStyle(globalThis.document.documentElement).fontSize))
    Opt.set('core.fontSize', (px + incr))
  }

  Cmd.add('zoom in', () => incrFont())
  Cmd.add('zoom out', () => incrFont(-1))

  Cmd.add('easy split', () => {
    if (Pane.length() < 2) {
      Pane.split()
      return
    }
    Pane.max()
    return
  })

  Cmd.add('pane next or split', () => {
    Pane.nextOrSplit()
  })

  Cmd.add('split', () => {
    Pane.split()
  })

  Cmd.add('pane close', () => {
    let win, f

    win = area.win
    f = Frame.current(Tab.current(area))
    if (f.panes.length <= 1) {
      if (f == f.tab.frameLeft) {
        Tab.forEach(area, tab => Css.retract(tab.frameLeft.el))
        Css.remove(win.frameToggleL, 'mini-frame-open')
        f.tab.frame1.focus()
        return
      }
      if (f == f.tab.frameRight) {
        Tab.forEach(area, tab => Css.retract(tab.frameRight.el))
        Css.remove(win.frameToggleR, 'mini-frame-open')
        f.tab.frame1.focus()
        return
      }
      Mess.yell('Only pane')
      return
    }
    Pane.current().close()
  })

  Cmd.add('pane max', () => {
    let win, f, tab

    win = area.win
    tab = Tab.current(area)
    f = Frame.current(tab)
    if (f.panes.length <= 1) {
      if (Css.has(tab.frameLeft.el, 'retracted')
          && Css.has(tab.frameRight.el, 'retracted')) {
        Css.disable(devtoolsToggle)
        Tron.cmd1('devtools.close', [], err => {
          if (err) {
            Css.enable(devtoolsToggle)
            Mess.yell(err.message)
          }
        })
        return
      }
      Tab.forEach(area, tab => Css.retract(tab.frameLeft.el))
      Tab.forEach(area, tab => Css.retract(tab.frameRight.el))
      Css.remove(win.frameToggleL, 'mini-frame-open')
      Css.remove(win.frameToggleR, 'mini-frame-open')
      return
    }
    Pane.max()
  })

  Cmd.add('new window', () => {
    let win

    win = globalThis.window.open('')
    if (win) {
      win.bred = globalThis.bred
      append(win.document.body, div('hi'))
      return
    }
    Mess.yell('Error')
  })

  Cmd.add('bury', () => {
    Pane.bury()
  })

  Cmd.add('close buffer', (u, we) => {
    let p

    function remove
    () {
      p.buf.remove()
    }

    if (we?.e && (we?.e instanceof globalThis.MouseEvent))
      if (we.e.button == 0)
        p = Pane.holding(we.e.target.parentNode.querySelector('.pane'))
      else
        return
    else
      p = Pane.current()

    if (p.buf)
      if (p.buf.file && p.buf.modified)
        Prompt.demandYN('Save buffer before closing?',
                        'save',
                        yes => {
                          if (yes)
                            Cmd.runMo('save', 'ed', 1, {}, err => {
                              if (err)
                                Mess.toss(err)
                              remove()
                            })
                          else
                            remove()
                        })
      else
        remove()
  })

  Cmd.add('close demand', () => {
    Prompt.close()
  })

  Cmd.add('save histories', () => {
    Hist.save()
  })

  Cmd.add('relaunch', () => {
    Tron.cmd1('restart', [], err => {
      if (err)
        Mess.toss(err)
      Mess.yell('Waiting for restart...')
    })
  })

  Cmd.add('exit', () => {
    Tron.cmd('quit', [], (err) => {
      if (err) {
        Mess.yell('quit: ' + err.message)
        return
      }
    })
  })

  function saveAndX
  (quit) {
    let count, errs, dones

    function done
    (err) {
      if (err) {
        Mess.yell(err.message)
        errs++
      }
      else {
        Mess.say('Saved')
        dones++
      }

      if ((errs + dones) >= count) {
        if (errs) {
          Mess.yell(`${errs}/${count} saves failed`)
          Prompt.close()
          return
        }
        Cmd.run(quit ? 'exit' : 'relaunch')
      }
    }

    count = dones = errs = 0
    Buf.forEach(b => {
      if (b.modified) {
        count++
        b.save(done)
      }
    })

    return
  }

  Cmd.add('save and exit', () => saveAndX(1))
  Cmd.add('save and relaunch', () => saveAndX())

  quitEm = Em.make('Quit')
  quitEm.on('y', 'save and exit')
  quitEm.on('n', 'exit')
  quitEm.on('c', 'close demand')
  Em.on('C-g', 'close demand', quitEm)
  Em.on('Escape', 'close demand', quitEm)

  function quitOrRestart
  (quit) {
    let mods

    mods = Buf.filter(b => b.file && b.modified).map(b => [ divCl('float-f-name', b.name),
                                                            divCl('float-f-path', b.path) ])
    if (mods.length == 0) {
      Cmd.run(quit ? 'exit' : 'relaunch')
      return
    }
    Prompt.demand(quitEm,
                  [ divCl('float-ww',
                          divCl('float-w',
                                [ divCl('float-h',
                                        [ divCl('float-icon', img(Ed.iconPath('save'), 'Save', 'filter-clr-nb3')),
                                          divCl('float-text',
                                                'Save these files before ' + (quit ? 'quitting' : 'restarting') + '?'),
                                          button([ span('y', 'key'), 'es' ],
                                                 '',
                                                 { 'data-run': quit ? 'save and exit' : 'save and relaunch' }),
                                          button([ span('n', 'key'), 'o' ],
                                                 '',
                                                 { 'data-run': quit ? 'exit' : 'relaunch' }),
                                          button([ span('c', 'key'), 'ancel' ],
                                                 '',
                                                 { 'data-run': 'close demand' }) ]),
                                  divCl('float-files', mods) ])),
                    divCl('float-shade') ])
  }

  Cmd.add('quit', () => quitOrRestart(1))
  Cmd.add('restart', () => quitOrRestart())
}

function initBindings
() {
  Em.on('click', 'click')
  Em.on('click.aux', 'click aux')
  Em.on('context', 'context menu')

  Em.on('Enter', 'select')
  Em.on('ArrowUp', 'previous line')
  Em.on('ArrowDown', 'next line')
  Em.on('ArrowLeft', 'backward character')
  Em.on('ArrowRight', 'forward character')
  Em.on('Home', 'buffer start')
  Em.on('End', 'buffer end')
  Em.on('PageUp', 'scroll up')
  Em.on('PageDown', 'scroll down')

  Em.on('C-+', 'zoom in')
  Em.on('C-=', 'zoom in')
  Em.on('C--', 'zoom out')
  Em.on('C-a', 'line start')
  Em.on('C-b', 'backward character')
  Em.on('C-e', 'line end')
  Em.on('C-f', 'forward character')
  Em.on('C-g', 'cancel')
  Em.on('Escape', 'cancel')
  Em.on('C-l', 'recenter')
  Em.on('C-n', 'next line')
  Em.on('C-o', 'pane next or split')
  Em.on('C-p', 'previous line')
  Em.on('C-t', 'add tab')
  Em.on('C-u', 'universal argument')
  Em.on('C-v', 'scroll down')
  Em.on('C-x 0', 'pane close')
  Em.on('C-x 1', 'pane max')
  Em.on('C-x 2', 'split')
  Em.on('C-x k', 'close buffer')
  Em.on('C-x C-b', 'bury')
  Em.on('C-x C-c', 'quit')
  Em.on('C-x C-e', 'evaluate line')
  Em.on('C-x C-j', 'parent')
  Em.on('C-x C-z', 'quit')

  Em.on('A-v', 'scroll up')
  Em.on('A-1', 'switch to tab 1')
  Em.on('A-2', 'switch to tab 2')
  Em.on('A-3', 'switch to tab 3')
  Em.on('A-4', 'switch to tab 4')
  Em.on('A-5', 'switch to tab 5')
  Em.on('A-6', 'switch to tab 6')
  Em.on('A-7', 'switch to tab 7')
  Em.on('A-8', 'switch to tab 8')
  Em.on('A-9', 'switch to tab 9')
  Em.on('A-<', 'buffer start')
  Em.on('A->', 'buffer end')
  Em.on('A-%', 'query replace') // recommend using c-q in init.js instead.

  Em.on('A-g d', 'goto definition')
  Em.on('A-g e', 'goto bred')
  Em.on('A-g h', 'goto home')
}

function initHandlers
() {

  function handleKeyDown
  (e) {
    let buf

    buf = Pane.current()?.buf
    Em.handle({ mouse: 0, e: e, buf: buf },
              buf)
  }

  function handleMouse
  (name, e) {
    let target, buf

    target = globalThis.document.elementFromPoint(e.clientX, e.clientY)
    buf = Pane.holding(target)?.buf
    Em.handle({ mouse: 1, name: name, e: e, buf: buf },
              buf)
  }

  function handleClick
  (e) {
    if (e.button == 0) {
      // main button
      if ((e.target.tagName == 'INPUT')
          && (e.target.getAttribute('type') == 'color'))
        // special case for color picker
        return
      handleMouse('click', e)
    }
    else if (e.button == 1)
      // aux button (usually wheel/middle)
      handleMouse('click.aux', e)
  }

  function handleWheel
  (e) {
    //handleMouse('wheel', e)
    if (e.ctrlKey) {
      e.preventDefault()
      if (e.deltaY < 0)
        Cmd.run('zoom in')
      else
        Cmd.run('zoom out')
    }
  }

  globalThis.onauxclick = handleClick
  globalThis.onclick = handleClick
  globalThis.oncontextmenu = e => handleMouse('context', e)
  globalThis.onkeydown = handleKeyDown
  globalThis.onpaste = handleClick
  globalThis.onwheel = handleWheel
}

export
function initTest
() {
  let mo

  function divW
  () {
    return divCl('test_buffer-ww', divCl('test_buffer-w bred-surface', ''))
  }

  function vinit
  (view) {
    let w, alpha

    function clrs
    () {
      function clr(c) {
        return div('--clr-' + c, '', { style: 'color: var(--clr-' + c + ');' })
      }
      return [ clr('text'),
               clr('text-light'),
               clr('fill'),
               clr('light'),
               clr('nb3'),
               clr('nb0'),
               clr('emph'),
               clr('syntax5'),
               clr('syntax4'),
               clr('syntax3'),
               clr('syntax2'),
               clr('syntax1'),
               clr('syntax0'),
               clr('point'),
               clr('point-border'),
               clr('point-current'),
               clr('scroll'),
               clr('scroll-fill') ]
    }

    function colors
    () {
      function sol(c) {
        return div('--theme-clr-' + c, '', { style: 'color: var(--theme-clr-' + c + ');' })
      }
      return [ sol('base03'),
               sol('base02'),
               sol('base01'),
               sol('base00'),
               sol('base1'),
               sol('base2'),
               sol('base3'),
               sol('yellow'),
               sol('orange'),
               sol('red'),
               sol('magenta'),
               sol('violet'),
               sol('blue'),
               sol('cyan'),
               sol('green'),
               clrs() ]
    }

    function design
    (dark) {
      return [ div(div([ 'Text containing ',
                         span('some words',
                              dark ? 'onfill' : '',
                              { 'data-run': 'yell' }),
                         ' that you can click.' ])),
               div(div([ 'A button: ', button([ span('y', 'key'), 'ell' ],
                                              dark ? 'onfill' : '',
                                              { 'data-run': 'yell' }) ])),
               div([ 'A control: ', divCl('mini-panel',
                                          divCl('mini-icon' + (dark ? ' onfill' : ''),
                                                img('img/split.svg', 'Split', 'filter-clr-text'),
                                                { 'data-run': 'easy split' })) ]),
               div([ 'An icon: ', divCl('mini-panel',
                                        divCl('mini-icon' + (dark ? ' onfill' : ''),
                                              img(Ed.modeIconPath('dir'), 'Dir', 'filter-clr-text'))) ]),
               div([ 'Dir nav: ', divCl('nav-dir', Dir.nav(Loc.home(), 'select dir')) ]) ]
    }

    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''

    alpha = []
    for (let d = 'A'.charCodeAt(0); d <= 'Z'.charCodeAt(0); d++)
      alpha.push(String.fromCharCode(d))

    append(w,
           divCl('test_buffer-1',
                 [ 'This is a DIV.',
                   Dom.create('ol',
                              [ Dom.create('li', [ span('Splitting the pane', 'bold', { 'data-run': 'split' }), ' shows the same buffer in both panes.' ]),
                                Dom.create('li', [ 'Any change to the buffer in one pane should show in the other pane.' ]),
                                Dom.create('li', [ 'Running ',
                                                   span('Test Buffer', 'bold', { 'data-run': 'test buffer' }),
                                                   ' again creates a new buffer.  You can look in the ',
                                                   span('buffer list', 'bold', { 'data-run': 'Buffers' }),
                                                   ' to confirm that multiple versions exist.' ]) ]) ]),
           divCl('test_buffer-2', [ 'This is also a DIV.',
                                    divCl('test_buffer-circle') ]),
           divCl('test_buffer-3', div('This can be resized.')),
           divCl('test_buffer-4', divCl('test_buffer-center',
                                        'Click to change.',
                                        { 'data-run': 'move' })),
           divCl('test_buffer-des', [ divCl('test_buffer-des-h', 'Design'),
                                      Dom.create('hr'),
                                      divCl('test_buffer-des-section light', design()),
                                      divCl('test_buffer-des-section dark', design(1)),
                                      divCl('test_buffer-des-section light', colors()),
                                      divCl('test_buffer-des-section dark', colors()) ]),
           divCl('test_buffer-picker', [ divCl('test_buffer-des-h', 'Color Picker'),
                                         div('#red;'),
                                         div('#FF0000;'),
                                         div('#ff0000;') ]),
           divCl('test_buffer-alpha', [ div("Here's the alphabet to fill some space:"),
                                        Dom.create('hr'),
                                        alpha.map(ch => divCl('test_buffer-alpha-ch', ch)),
                                        Dom.create('hr') ]),
           divCl('test_buffer-end', 'The End.'))
  }

  function move
  () {
    let p

    p = Pane.current()
    p.buf.views.forEach(view => {
      if (view.ele) {
        let d

        d = view.ele.querySelector('.test_buffer-center')
        Css.toggle(d, 'test_buffer-right')
      }
    })
  }

  mo = Mode.add('Test Buffer', { viewInit: vinit })
  Cmd.add('test buffer', () => {
    let b, p

    p = Pane.current()
    b = Buf.add('Test Buffer', 'Test Buffer', divW(), p.dir)
    b.icon = 'help'
    b.addMode('view')
    p.buf = b
  })

  Cmd.add('move', move, mo)
}

function initBrowse
() {
  Cmd.add('browse', () => {
    let p, r

    function resize
    (ch) { //(ch, roes) {
      let r2

      /*
      roes.forEach(roe =>
        Tron.send(ch,
                  { x: Math.floor(roe.contentRect.x),
                    y: Math.floor(roe.contentRect.y),
                    width: Math.floor(roe.contentRect.width),
                    height: Math.floor(roe.contentRect.height) }))
      */
      r2 = p.ele.getBoundingClientRect()
      /* this way messed up values
      Tron.send(ch,
                { x: Math.floor(r2.x),
                  y: Math.floor(r2.y),
                  width: Math.floor(r2.width),
                  height: Math.floor(r2.height) })
      */
      Tron.send(ch,
                Math.floor(r2.x),
                Math.floor(r2.y),
                Math.floor(r2.width),
                Math.floor(r2.height))
    }

    p = Pane.current()
    r = p.ele.getBoundingClientRect()

    Tron.cmd('browse',
             [ Math.floor(r.x),
               Math.floor(r.y),
               Math.floor(r.width),
               Math.floor(r.height),
               'https://electronjs.org' ],
             (err, data) => {
               let obs

               if (err) {
                 Mess.warn('Err browsing: ', err.message)
                 return
               }
               Mess.say('brow')
               obs = new globalThis.ResizeObserver(roe => resize(data.ch, roe), { box: 'border-box' }).observe(p.ele)
               d({ obs })
             })
  })
}

function initMakeDir
() {
  function makeDir
  () {
    let pane

    function make
    (p, name, dir) {
      let abs

      if (name.startsWith('/'))
        abs = name
      else
        abs = Loc.make(dir).join(name)
      Tron.cmd('dir.make', abs, err => {
        if (err) {
          Mess.yell('dir.make: ' + err.message)
          return
        }
        Mess.say('Added dir ' + abs)
      })
    }

    pane = Pane.current()
    Prompt.ask('Make Dir:', (p, name) => make(p, name, pane.dir))
  }

  Cmd.add('make dir', () => makeDir())
}

function initFile
() {
  let mo, buf, under, ml, dirsOnly
  let hist

  function nextSel
  () {
    let p, file

    p = Pane.current()
    file = p.view.ele.querySelector('.bred-open-under-f.selected')
    if (file)
      if (file.nextElementSibling) {
        Css.remove(file, 'selected')
        Css.add(file.nextElementSibling, 'selected')
      }

  }

  function prevSel
  () {
    let p, file

    p = Pane.current()
    file = p.view.ele.querySelector('.bred-open-under-f.selected')
    if (file)
      if (file.previousElementSibling) {
        Css.remove(file, 'selected')
        Css.add(file.previousElementSibling, 'selected')
      }

  }

  function createFile
  (p) {
    let text

    text = buf.text().trim()
    if (text.length) {
      Ed.make(p, text, p.dir)
      // delayed otherwise Ed tries to open file
      p.buf.file = text
    }
  }

  function select
  (we) {
    if (dirsOnly) {
      let path, p, file

      // Open
      p = Pane.current()
      file = p.view.ele.querySelector('.bred-open-under-f.selected')
      file = file || p.view.ele.querySelector('.bred-open-under-f')
      path = file?.dataset.path
      if (path && path.length) {
        if (p.buf.text().length)
          hist.add(p.buf.text())
        Pane.open(path)
      }
      else if (typeof path === 'string')
        Mess.say('Empty')
      else
        Mess.say('Error')
    }
    else
      selectFile(we)
  }

  function selectFile
  (we) {
    let p, file, path

    p = Pane.current()
    if (we?.e && (we.e.button == 0))
      file = we.e.target
    else {
      file = p.view.ele.querySelector('.bred-open-under-f.selected')
      file = file || p.view.ele.querySelector('.bred-open-under-f')
    }
    if (file) {
      // Open
      path = file?.dataset.path
      if (path && path.length) {
        if (file.dataset.name.endsWith('/')) {
          let text

          text = p.buf.text()
          p.buf.clear()
          if (text.length)
            // strip off any partial file.dataset.name
            text = Loc.make(text).dirname
          p.view.insert(text + file.dataset.name)
          return
        }
        if (p.buf.text().length)
          hist.add(p.buf.text())
        Pane.open(path)
      }
      else if (typeof path === 'string')
        Mess.say('Empty')
      else
        Mess.say('Error')
      return
    }

    createFile(p)
  }

  function selectDir
  (we) {
    let p, file, path

    p = Pane.current()
    if (we?.e && (we.e.button == 0))
      file = we.e.target
    else {
      file = p.view.ele.querySelector('.bred-open-under-f.selected')
      file = file || p.view.ele.querySelector('.bred-open-under-f')
    }
    if (file) {
      path = file?.dataset.path
      if (path && path.length) {
        p.buf.clear()
        p.buf.append(Loc.make(file.dataset.path).ensureSlash())
      }
      else if (typeof path === 'string')
        Mess.say('Empty')
      else
        Mess.say('Error')
      return
    }
    Mess.say('Missing dir')
  }

  function divW
  () {
    return Ed.divW(0, 0, { extraWWCss: 'bred-open-ww bred-opener-ww',
                           extraWCss: 'bred-open-w bred-opener-w',
                           extraCo: [ divCl('bred-open-under'),
                                      divCl('bred-open-under-icon', img('img/prompt.svg', '>', 'filter-clr-nb0')) ] })
  }

  function makeF
  (dir, f, index) {
    if (0)
      d(f.name + ' ' + index)
    return divCl('bred-open-under-f onfill',
                 (f.name || '') + (isDir(f) ? '/' : ''),
                 { 'data-name': (f.name || '') + (isDir(f) ? '/' : ''),
                   'data-run': 'select',
                   'data-path': dir + (f.name || '') })
  }

  function isDir
  (f) {
    if (f?.stat) {
      if (f.stat.mode & (1 << 15))
        return 0
      return 1
    }
    return 0
  }

  function refresh
  () {
    let dir, text, path

    text = buf.text() || ''
    under.innerHTML = ''
    if (text.startsWith('/'))
      path = Loc.make(text)
    else {
      path = Loc.make(buf.dir)
      path.ensureSlash()
      path.join(text)
    }
    dir = path.dirname
    d('refresh: ' + path.path)
    Tron.cmd('dir.get', dir, (err, data) => {
      let co, textFile

      if (err) {
        Mess.yell('open: ' + err.message)
        return
      }

      under.innerHTML = ''
      if (ml) {
        ml.innerHTML = ''
        append(ml, [ 'Open ' + (dirsOnly ? 'dir' : 'file') + ' in ',
                     divCl('nav-dir', Dir.nav(dir, 'select dir')) ])
      }

      textFile = Loc.make(text).filename
      if (textFile)
        textFile = textFile.toLowerCase()

      co = data.data
      co = co.filter(f => (f && f.name && f.name.endsWith('~')) == 0) // use Dir for backups
      if (dirsOnly)
        co = co.filter(isDir)

      co = co.map(f => makeF(dir, f))
      co = co.filter(f => {
        if (f && f.dataset.name && f.dataset.name.length) {
          if (text.length == 0) {
            if (f.dataset.name[0] == '.')
              return 0
            return 1
          }
          if (textFile) {
            if (f.dataset.name.toLowerCase().startsWith(textFile))
              return 1
          }
          else
            return 1
        }
        return 0
      })
      if (co.length)
        Css.add(co[0], 'selected')
      else if (ml)
        ml.innerText = 'Create file in ' + dir

      append(under, co)
    })
  }

  function onChange
  () {
    refresh()
  }

  function openFile
  () {
    dirsOnly = 0
    open()
  }

  function openDir
  () {
    dirsOnly = 1
    open()
  }

  function open
  () {
    let p, w, dir

    p = Pane.current()

    w = divW()
    ml = w.querySelector('.edMl')
    if (ml)
      ml.innerText = 'Open file'

    if (buf)
      buf = buf
    else {
      buf = Buf.make('Open', 'Open', w, p.dir)
      buf.icon = 'prompt'
    }

    buf.vars('ed').fillParent = 0
    buf.opts.set('core.autocomplete.enabled', 0)
    buf.opts.set('core.folding.enabled', 0)
    buf.opts.set('core.line.numbers.show', 0)
    buf.opts.set('core.lint.enabled', 0)
    buf.opts.set('core.minimap.enabled', 0)
    hist.reset()
    buf.off('change', onChange)
    buf.clear()
    buf.file = 0
    //buf.dir = 0
    dir = p.dir
    p.buf = buf
    buf.dir = dir

    ml = p.view.ele.querySelector('.edMl')
    under = p.view.ele.querySelector('.bred-open-under') || Mess.toss('under missing')
    if (under) {
      refresh()
      buf.on('change', onChange)
    }
  }

  hist = Hist.ensure('open')

  mo = Mode.add('Open', { hidePoint: 1,
                          viewInit: Ed.viewInit,
                          initFns: Ed.initModeFns,
                          parentsForEm: 'ed' })

  Cmd.add('next', () => hist.next(buf), mo)
  Cmd.add('previous', () => hist.prev(buf), mo)
  Cmd.add('next selection', () => nextSel(), mo)
  Cmd.add('previous selection', () => prevSel(), mo)
  Cmd.add('select', (u, we) => select(we), mo)
  Cmd.add('select dir', (u, we) => selectDir(we), mo)

  Em.on('Enter', 'select', mo)

  Em.on('A-n', 'Next', mo)
  Em.on('A-p', 'Previous', mo)

  Em.on('C-g', 'Close Buffer', mo)
  Em.on('Escape', 'close buffer', mo)
  Em.on('C-n', 'Next Selection', mo)
  Em.on('C-p', 'Previous Selection', mo)
  Em.on('C-s', 'Idle', mo)
  Em.on('C-r', 'Idle', mo)

  Cmd.add('open file', () => openFile())

  Cmd.add('open directory', () => openDir())
  Cmd.add('dir', () => openDir())

  Cmd.add('idle', () => {})

  Em.on('C-x C-f', 'open file')
  Em.on('C-x d', 'open directory')
  Em.on('C-x C-d', 'open directory')

  initMakeDir()
}

function initEvalLine
() {
  function evalLine
  () {
    let p, l

    p = Pane.current()
    l = p.line()
    if (l && l.length) {
      let fn

      fn = new Function ('return ' + l)
      Mess.say('Return: ' + fn())
    }
    else if (typeof l === 'string')
      Mess.say('Line empty')
    else
      Mess.say('Line missing')
  }

  Cmd.add('evaluate line', () => evalLine())
}

export
function initRecent
() {
  let buf

  function divW
  () {
    return divCl('recent-ww',
                 [ divCl('recent-h', 'Recently opened'),
                   divCl('recent-w') ])
  }

  function refresh
  (view) {
    Recent.get((err, all) => {
      let w, co

      if (err) {
        Mess.toss(err.message)
        return
      }
      recents = all

      w = view.ele.querySelector('.recent-w')
      w.innerHTML = ''

      co = recents.map(r => divCl('recent-item',
                                  r.href,
                                  { 'data-run': 'open link',
                                    'data-path': r.href }))

      append(w, co)
    })
  }

  Mode.add('Recent', { viewInit: refresh })

  Cmd.add('Open Recent', () => {
    let p

    p = Pane.current()
    if (buf) {
      p.buf = buf
      refresh(p.view)
    }
    else {
      buf = Buf.add('Recent', 'Recent', divW(), p.dir)
      buf.addMode('view')
      p.buf = buf
    }
  })
}

export
function initCss1
(file) {
  importCss(file)
    .then(m => {
      globalThis.document.adoptedStyleSheets = [ ...globalThis.document.adoptedStyleSheets, m.default ]
    },
          err => Mess.yell('Failed to load  ' + file + ': ' + err.message))
}

function initCss
() {
  let files, file

  files = [ './css/bred.css',
            './css/dir.css',
            './css/describe-cmd.css',
            './css/describe-key.css',
            './css/ed.css',
            './css/exts.css',
            './css/langs.css',
            './css/mess.css',
            './css/buffers.css',
            './css/switch.css',
            './css/cut.css',
            './css/exec.css',
            './css/test-buffer.css',
            './css/manpage.css',
            './css/options.css',
            './css/recent.css',
            './css/vc.css' ]
  files.forEach(initCss1)

  file = './lib/sheets.mjs'
  import(file)
    .then(m => {
      m.sheets.forEach(initCss1)
    },
          err => Mess.yell('Failed to load  ' + file + ': ' + err.message))
}

function scratchMessage
() {
  return `// This is your scratch buffer. For notes, tests or whatever.
// It's in Javascript mode.

`
}

function initFontSize
() {
  let px

  px = Opt.get('core.fontSize')
  if (px === undefined)
    return
  globalThis.document.documentElement.style.fontSize = px + 'px'
}

export
function init
() {
  let path

  function start1
  (data) {
    d('start1')
    Mess.log('backend: ' + data.backend)
    initPackages(data.backend, err => {
      err && Mess.toss('Init error: ' + err.message)
      // Timeout so that errors are thrown outside the Tron cb, else backtraces are for ipc.
      setTimeout(() => start2(data.devtools, data.frames))
    })

    Mess.log('home: ' + data.home)
    Mess.log(' app: ' + data.app)
    Mess.log('user: ' + data.user)
    Mess.log(' cwd: ' + data.cwd)
    Loc.appDirSet(data.app)
    Loc.homeSet(data.home || data.app)
    Loc.iwdSet(data.cwd || data.app)
    $version = data.version
    Loc.configDirSet(data.user)
    Loc.shellSet(data.shell)

    Ed.initCTags()
    Ed.setHaveIcons(1)
    path = Ed.iconPath('javascript')
    Mess.say('Checking for icons...')
    Tron.cmd('file.stat', path, err => {
      if (err) {
        Mess.log(err.message)
        Mess.say('Checking for icons... failed, will use letters')
        Ed.setHaveIcons(0)
      }
      else
        Mess.say('Checking for icons... found')
    })

    d('initCss')
    initCss()
  }

  function start2
  (devtools, frames) {
    let p, tab

    d('start2 (backend is loaded)')

    initCmds()
    initBindings()
    initDoc(devtools)
    initHandlers()
    initTest()
    initBrowse()
    initFile()
    initEvalLine()

    initRecent()
    Ext.loadAll() // async

    tab = Tab.current(area)
    if (frames.left == 0)
      Css.retract(tab.frameLeft.el)
    if (frames.right == 0)
      Css.retract(tab.frameRight.el)
    p = Pane.current(tab.frameLeft)
    p.focus()
    Cmd.run('home')
    p = Pane.current(tab.frameRight)
    p.focus()
    Cmd.run('messages')
    p = Pane.current(tab.frame1)
    p.focus()
    Ed.make(p, 'Scratch.js', p.dir, 0, 0, view => {
      d('INSERT')
      view.insert(scratchMessage())
    })
    if (Opt.get('core.welcome.enabled'))
      Cmd.run('welcome')
    Pane.top(tab.frame1).focus()

    if (1) {
      Mess.say('Loading init...')
      Tron.cmd('init.load', [], (err, data) => {
        if (data.exist == 0)
          Mess.say("Loading init: missing, that's OK")
        else if (err)
          Mess.yell('Error loading init: ', err.message)

        Mess.yell('Ready!')
      })
    }
    else
      Ed.make(Pane.current(), 'Main', ':')
      //Pane.open(':tmp/home.js')//Mess.yell("Ready!")
  }

  globalThis.bred = {}

  Opt.load(() => {
    initFontSize()

    if (0)
      globalThis.onerror = (e, source, lineno, colno, err) => {
        Mess.trace(source + ':' + lineno + ' ' + err?.message)
        Mess.yell(source + ':' + lineno + ' ' + err?.message)
        // cancel err
        return true
      }

    initMouse()

    // closest to onclose/onexit
    globalThis.document.onvisibilitychange = () => {
      let tab

      tab = Tab.current(area)
      Tron.cmd1('brood.set', [ 'frame', 'frameLeft', Css.has(tab.frameLeft.el, 'retracted') ? 0 : 1 ], err => {
        if (err)
          Mess.warn('Failed to save state of frameLeft')
      })
      Tron.cmd1('brood.set', [ 'frame', 'frameRight', Css.has(tab.frameRight.el, 'retracted') ? 0 : 1 ], err => {
        if (err)
          Mess.warn('Failed to save state of frameRight')
      })
      Buf.savePoss()
      Hist.save()
    }

    d('get paths')

    Tron.cmd1('paths', [], (err, d) => {
      if (err) {
        Mess.yell('Err getting dirs: ', err.message)
        return
      }

      // Timeout so that errors are thrown outside the Tron cb, else backtraces are for ipc.
      setTimeout(() => start1(d))
    })
  })
}
