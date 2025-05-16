import { append, button, div, divCl, span, img } from './dom.mjs'

import * as About from './about.mjs'
import * as Area from './area.mjs'
import * as Apt from './apt.mjs'
import * as Browse from './browse.mjs'
import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Cut from './cut.mjs'
import * as Css from './css.mjs'
import * as Dir from './dir.mjs'
import * as Dom from './dom.mjs'
import * as Exec from './exec.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Ext from './ext.mjs'
import * as Frame from './frame.mjs'
import * as Hist from './hist.mjs'
import * as Icon from './icon.mjs'
import * as Loc from './loc.mjs'
import * as Lsp from './lsp.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Open from './open.mjs'
import * as Opt from './opt.mjs'
import * as OptUi from './opt-ui.mjs'
import * as Pane from './pane.mjs'
import * as Place from './place.mjs'
import * as Prompt from './prompt.mjs'
import * as Recent from './recent.mjs'
import * as Shell from './shell.mjs'
import * as Style from './style.mjs'
import * as Switch from './switch.mjs'
import * as Tab from './tab.mjs'
import * as Tron from './tron.mjs'
import * as U from './util.mjs'
import * as Vc from './vc.mjs'
import * as ViewMode from './view-mode.mjs'
import * as Win from './win.mjs'
import { d } from './mess.mjs'

import { v4 as uuidv4 } from '../lib/uuid/index.js'

//import * as Linters from "../lib/ace-linters/ace-linters.js"

let $version, mouse, recents

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
  let win

  win = Win.current()
  win.context.close()
  win.menu.close()
  focus(we)
}

function clickAux
(u, we) {
  let win

  win = Win.current()
  win.context.close()
  win.menu.close()
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
    Apt.init()
    Vc.init()
    About.init()
    Prompt.init()
    Open.init()
    Switch.init()
    Tab.init()
    Ext.init()
    Place.init()
    OptUi.init()

    globalThis.bred = { ...globalThis.bred,
                        Buf,
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
                        Shell,
                        Win }

    cb()
  })
}

function initDoc
(devtools) {
  Mess.say('Building...')
  d('building')
  if (globalThis.bredWin)
    return
  Win.add(globalThis, { devtools })
  globalThis.restartForError.remove()
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
      let text

      if (e.target?.dataset?.run == 'open link')
        text = Cmd.canon(e.target.dataset.run) + ': ' + e.target.dataset.path
      else if (e.target?.dataset?.run == 'open externally')
        text = Cmd.canon(e.target.dataset.run) + ': ' + e.target.dataset.url
      else
        text = Cmd.canon(e.target?.dataset?.run)
      if (hover)
        return
      Tron.acmd('hover.on', [ text ])
      hover = 1
    }
    else if (hover) {
      Tron.acmd('hover.off')
      hover = 0
    }
  }
}

function makeScratch
(p, cb) {
  Ed.make(p,
          { name: 'Scratch.js',
            dir: Loc.home() },
          view => {
            view.buf.file = 'Scratch.js'
            view.insert(scratchMessage())
            view.buf.modified = 0
            Ed.setIcon(view.buf, '.edMl-mod', 'blank')
            if (cb)
              cb()
          })
}

function initCmds
() {
  Cmd.add('click', click)
  Cmd.add('click aux', clickAux)

  Cmd.add('universal argument', () => Cmd.setUniversal())

  Cmd.add('copy', () => {
    let text

    text = Win.current().selection.toString()
    if (text.length)
      Cut.add(text)
  })

  Cmd.add('toggle devtools', () => {
    let win

    win = Win.current()
    Css.disable(win.menu?.devtoolsToggle)
    Tron.cmd1('devtools.toggle', [], err => {
      if (err) {
        Css.enable(win.menu?.devtoolsToggle)
        Mess.toss(err)
      }
    })
  })

  Cmd.add('switch to tab', (u, we) => {
    d('s')
    if (we.e.target.dataset.id) {
      let tab

      d(we.e.target.dataset.id)
      tab = Tab.get(Win.current().main, we.e.target.dataset.id)
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
    tab = Tab.add(p.win.main)
    Css.expand(p.win.main.tabbar)
    p = tab.pane()
    p.setBuf(buf)
  })

  Cmd.add('close tab', (u, we) => {
    let id, tab, area

    id = we.e?.dataset?.tabid
    area = Win.current().main
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

    t = Tab.getByIndex(Win.current().main, i)
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

    win = Win.current()
    tab = Tab.current(win.main)
    if (Css.toggle(tab.frameRight.el, 'retracted')) {
      Tab.forEach(win.main, tab => {
        tab.frame1.focus()
        tab.framesRight.forEach(fr => fr.retract())
      })
      tab.frame1.focus()
      Css.remove(win.frameToggleR, 'mini-frame-open')
    }
    else {
      Tab.forEach(win.main, tab => {
        tab.framesRight.forEach(fr => fr.expand())
      })
      Css.add(win.frameToggleR, 'mini-frame-open')
    }
  })

  Cmd.add('toggle frame left', () => {
    let win, tab

    win = Win.current()
    tab = Tab.current(win.main)
    if (Css.toggle(tab.frameLeft.el, 'retracted')) {
      Tab.forEach(win.main, tab => {
        tab.frame1.focus()
        tab.frameLeft.retract()
      })
      tab.frame1.focus()
      Css.remove(win.frameToggleL, 'mini-frame-open')
    }
    else {
      Tab.forEach(win.main, tab => {
        tab.frameLeft.expand()
      })
      Css.add(win.frameToggleL, 'mini-frame-open')
    }
  })

  Cmd.add('close menu', () => {
    Win.current().menu.close()
  })

  Cmd.add('open menu item', (u, we) => {
    if (we.e.target.dataset.menu) {
      let el

      el = globalThis.document.querySelector('#' + we.e.target.dataset.menu)
      if (el) {
        let parent

        Win.current().menu.fill(el)
        parent = el.parentNode
        if (Css.has(parent, 'bred-open')) {
          Win.current().menu.close()
          Css.remove(parent, 'bred-open')
        }
        else {
          Win.current().menu.open()
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
    let win

    we.e.preventDefault()
    win = Win.current()
    win.context.open(we, () => {
      let x, y, rect

      x = we.e.x
      y = we.e.y
      win.lastContextClick = { x, y }
      rect = win.context.el.getBoundingClientRect()
      if ((rect.height + y) > win.window.innerHeight)
        y = win.window.innerHeight - rect.height - 10
      if ((rect.width + x) > win.window.innerWidth)
        x = win.window.innerWidth - rect.width - 10
      win.lastContext = { x, y }
      win.context.el.style.left = x + 'px'
      win.context.el.style.top = y + 'px'
    })
  })

  Cmd.add('inspect element', (u, we) => {
    let x, y

    if (we?.e) {
      let win

      win = Win.current()
      x = win.lastContextClick?.x ?? 0
      y = win.lastContextClick?.y ?? 0
    }
    else {
      x = mouse.x
      y = mouse.y
    }
    Tron.cmd('devtools.inspect', [ x, y ], err => {
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
      Pane.open(ctag.loc, 1, view => {
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
                         regExp: 1,
                         reveal: 2 })
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
      p.setBuf(buf)
      return
    }

    makeScratch(p)
  })

  Cmd.add('evaluate expression', () => {
    d('ee')
  })

  Cmd.add('open externally', (u, we) => {
    let url

    url = we.e.target.dataset.url?.trim()
    if (url)
      if (url.startsWith('#')) {
        let p, el

        p = Pane.current()
        el = p.view.ele?.querySelector('[data-target="' + url.slice(1) + '"]')
        if (el)
          el.scrollIntoView()
        else
          Mess.yell('Missing target')
      }
      else
        Tron.cmd('shell.open', [ url ], err => {
          if (err) {
            Mess.yell('shell.open: ' + err.message)
            return
          }
        })
    else
      Mess.say('Target missing URL')
  })

  Cmd.add('open link', (u, we) => {
    if (we.e.target.dataset.path)
      Open.link(we.e.target.dataset.path,
                we.e.target.dataset.line)
    else
      Mess.say('Target missing path')
  })

  Cmd.add('open link in new tab', (u, we) => {
    if (we.e.target.dataset.path)
      Open.link(we.e.target.dataset.path,
                we.e.target.dataset.line,
                1)
    else
      Mess.say('Target missing path')
  })

  Cmd.add('say', () => Mess.say('Test of Mess.say'))
  Cmd.add('warn', () => Mess.warn('Test of Mess.warn'))
  Cmd.add('yell', () => Mess.yell('Test of Mess.yell'))

  Cmd.add('cancel', () => {
    Win.current().menu.close()
    Pane.cancel()
  })

  Cmd.add('recenter', () => Pane.recenter())

  Cmd.add('backward', () => Pane.current().view.backward())
  Cmd.add('forward', () => Pane.current().view.forward())
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

  Cmd.add('view url at point', () => {
    let p, l, pos, url

    p = Pane.current()
    l = p.line()
    pos = p.pos()
    pos = pos.col
    url = U.urlAt(l, pos)
    if (url?.protocol == 'file:')
      Pane.open(url.pathname)
    else if (url)
      Tron.cmd('shell.open', [ url.href ], err => err && Mess.yell('shell.open: ' + err.message))
    else
      Mess.say('Point must be over an URL')
  })

  Cmd.add('scroll up', () => {
    let ele

    ele = Pane.current().ele.parentNode
    ele.scrollTo({ top: ele.scrollTop - (ele.clientHeight * 0.9),
                   left: 0,
                   behavior: 'auto' })
  })

  Cmd.add('scroll down', () => {
    let ele

    ele = Pane.current().ele.parentNode
    ele.scrollTo({ top: ele.scrollTop + (ele.clientHeight * 0.9),
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

    win = Win.current()
    f = Frame.current(Tab.current(win.main))
    if (f.panes.length <= 1) {
      if (f == f.tab.frameLeft) {
        Tab.forEach(win.main, tab => Css.retract(tab.frameLeft.el))
        Css.remove(win.frameToggleL, 'mini-frame-open')
        f.tab.frame1.focus()
        return
      }
      if (f == f.tab.frameRight) {
        Tab.forEach(win.main, tab => tab.framesRight.forEach(fr => Css.retract(fr.el)))
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

    win = Win.current()
    tab = Tab.current(win.main)
    f = Frame.current(tab)
    if (f.panes.length <= 1) {
      if (Css.has(tab.frameLeft.el, 'retracted')
          && Css.has(tab.frameRight.el, 'retracted')) {
        Css.disable(win.menu?.devtoolsToggle)
        Tron.cmd1('devtools.close', [], err => {
          if (err) {
            Css.enable(win.menu?.devtoolsToggle)
            Mess.yell(err.message)
          }
        })
        return
      }
      Tab.forEach(win.main, tab => Css.retract(tab.frameLeft.el))
      Tab.forEach(win.main, tab => tab.framesRight.forEach(fr => Css.retract(fr.el)))
      Css.remove(win.frameToggleL, 'mini-frame-open')
      Css.remove(win.frameToggleR, 'mini-frame-open')
      return
    }
    Pane.max()
  })

  Cmd.add('new window', () => {
    let windowProxy

    windowProxy = globalThis.window.open('', 'bred:win/' + uuidv4())
    windowProxy || Mess.yell('Error')
  })

  Cmd.add('bury', () => {
    Pane.bury()
  })

  Cmd.add('close buffer', (u, we) => {
    let p

    if (we?.e && (we?.e instanceof globalThis.MouseEvent))
      if (we.e.button == 0)
        p = Pane.holding(we.e.target.parentNode.querySelector('.pane'))
      else
        return
    else
      p = Pane.current()

    if (p.buf)
      if (p.buf.file && p.buf.modified)
        Prompt.yn('Save buffer before closing?',
                  { icon: 'save' },
                  yes => {
                    if (yes)
                      Cmd.runMo('save', 'ed', 1, {}, err => {
                        if (err)
                          Mess.toss(err)
                        p.buf.remove()
                      })
                    else
                      p.buf.remove()
                  })
      else
        p.buf.remove()
  })

  Cmd.add('close demand', () => {
    Prompt.close()
  })

  Cmd.add('relaunch', () => {
    Tron.cmd1('restart', [], err => {
      if (err)
        Mess.toss(err)
      Mess.yell('Waiting for restart...')
    })
  })

  Cmd.add('exit', () => {
    Tron.cmd('quit', [], err => {
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

  function quitOrRestart
  (quit) {
    let mods

    mods = Buf.filter(b => b.file && b.modified).map(b => [ divCl('float-f-name', b.name),
                                                            divCl('float-f-path', b.path) ])
    if (mods.length == 0) {
      Cmd.run(quit ? 'exit' : 'relaunch')
      return
    }
    Prompt.yn('Save these files before ' + (quit ? 'quitting' : 'restarting') + '?',
              { icon: 'save',
                under: divCl('float-files', mods) },
              yes => {
                if (yes)
                  if (quit)
                    Cmd.run('save and exit')
                  else
                    Cmd.run('save and relaunch')
                else
                  if (quit)
                    Cmd.run('exit')
                  else
                    Cmd.run('relaunch')
              })
  }

  Cmd.add('quit', () => quitOrRestart(1))
  Cmd.add('restart', () => quitOrRestart())

  Cmd.add('throw', () => {
    Tron.cmd1('test.throw', [], err => {
      if (err) {
        Mess.yell('test.throw: ' + err.message)
        return
      }
    })
  })

  Cmd.add('toss', () => {
    Mess.toss('test toss')
  })
}

export
function initSearch
(vfind, spec) { // { Backend, cancel, cleanup, mode }
  let s, mapSearch, lastNeedle, mo

  function cleanup
  () {
    s.st.view.buf.opts.set('core.highlight.occurrences.enabled', s.st.occur)
    spec.cleanup && spec.cleanup(s)

    Css.show(s.st.win.echo)
    s.st.mini.remove()
    Css.remove(s.st.win.mini, 'active')
    Css.remove(s.st.win.mini, 'search')
    globalThis.onkeydown = s.st.oldOnKeyDown
    spec.cancel && spec.cancel()
  }

  function searchCancel
  (keepPos) {
    cleanup()
    if (keepPos) {
      s.st.view.marks?.push(spec.Backend?.posToBep(s.st.view, s.st.start))
      if (s.st.needle.length)
        lastNeedle = s.st.needle
    }
    else
      spec.Backend?.vsetPos(s.st.view, s.st.start, 1)

    s.st = 0
  }

  function done
  () {
    if (s.st.needle.length)
      lastNeedle = s.st.needle

    s.st.view.marks?.push(spec.Backend?.posToBep(s.st.view, s.st.start))

    cleanup()
    s.st = 0
  }

  function next
  (skipCurrent) {
    let range

    if ((s.st.needle.length == 0)
        && lastNeedle)
      s.st.needle = lastNeedle

    //vexec(s.st.v, "keyboardQuit")
    range = vfind(s.st.view,
                  s.st.needle,
                  s.st,
                  { skipCurrent,
                    backwards: 0,
                    wrap: 0,
                    caseSensitive: 0,
                    wholeWord: 0,
                    regExp: 0 })
    if (range) {
      s.st.stack.push({ range, needle: s.st.needle, backwards: 0 })
      Css.remove(s.st.echo, 'mini-search-fail')
    }
    else
      //d("got all")
      Css.add(s.st.echo, 'mini-search-fail')

    s.st.echo.innerText = s.st.needle
  }

  function previous
  (skipCurrent) {
    let range

    //d("previous: " + s.st.needle)
    if ((s.st.needle.length == 0)
        && lastNeedle)
      s.st.needle = lastNeedle

    // seems ace keeps some state when the find is active that messes up the backward search
    //vexec(s.st.view, "keyboardQuit")
    range = vfind(s.st.view,
                  s.st.needle,
                  s.st,
                  { skipCurrent,
                    backwards: 1,
                    wrap: 0,
                    caseSensitive: 0,
                    wholeWord: 0,
                    regExp: 0 })
    s.st.stack.push({ range, needle: s.st.needle, backwards: 1 })
    if (range)
      Css.remove(s.st.echo, 'mini-search-fail')
    else
      Css.add(s.st.echo, 'mini-search-fail')

    s.st.echo.innerText = s.st.needle
  }

  function removeOneFromSearch
  () {
    if (s.st?.stack?.length) {
      let match, oldNeedle

      s.st.stack.pop()
      if (s.st.stack.length == 0) {
        d('stack now empty')
        s.st.needle = ''
        s.st.echo.innerText = ''
        spec.cleanup && spec.cleanup(s)
        spec.Backend?.vsetPos(s.st.view, s.st.start, 1)
        return
      }

      d(s.st.stack)
      match = s.st.stack.at(-1)
      d(match)

      oldNeedle = s.st.needle
      s.st.needle = match.needle
      s.st.echo.innerText = s.st.needle

      spec.Backend?.setDecorMatch(s.st, s.st.view, match.range)
      if (oldNeedle == s.st.needle) {
        // removed a match that was added with 'search * again', so the decor is the same
      }
      else
        spec.Backend?.setDecorAll(s.st, s.st.view, s.st.needle, { regExp: s.st.regExp, caseSensitive: s.st.caseSensitive })

      if (match.range) {
        let bep

        bep = match.backwards ? spec.Backend?.rangeStartBep(match.range) : spec.Backend?.rangeEndBep(match.range)
        spec.Backend?.vsetBep(s.st.view, bep, 1)
      }
    }
    else
      d('stack was empty')
  }

  function addCharToSearch
  (u, we) {
    if (s.st) {
      let match

      //d("adding '" + we.e.key + "'")
      s.st.needle += we.e.key
      match = s.st.stack?.at(-1)
      if (match?.range)
        if (s.st.backward) {
          let bep

          bep = spec.Backend?.rangeEndBep(match.range)
          bep = spec.Backend?.vbepIncr(s.st.view, bep)
          spec.Backend?.vsetBep(s.st.view, bep)
        }
        else
          spec.Backend?.vsetBep(s.st.view, spec.Backend?.rangeStartBep(match.range))

      if (s.st.backward)
        previous(0)
      else
        next(0)
    }
  }

  function addWordToSearch
  () {
    if (s.st) {
      let needleRe, range, match

      if (s.st.needle.length == 0)
        s.st.needle = ''

      // about to search forward
      match = s.st.stack?.at(-1)
      if (match)
        spec.Backend?.vsetBep(s.st.view, spec.Backend?.rangeStartBep(match.range))

      needleRe = Ed.escapeForRe(s.st.needle) + '[^a-zA-Z0-9]*[a-zA-Z0-9]+'
      //d("needleRe: " + needleRe)
      range = vfind(s.st.view,
                    needleRe,
                    s.st,
                    { skipCurrent: 0,
                      backwards: 0,
                      wrap: 0,
                      caseSensitive: 0,
                      wholeWord: 0,
                      regExp: 1 })
      if (range) {
        s.st.needle = spec.Backend?.vrangeText(s.st.view, range)
        s.st.stack.push({ range, needle: s.st.needle, backwards: 0 })
        s.st.echo.innerText = s.st.needle
      }
    }
  }

  function search
  (backward) {
    let oldOnKeyDown, p

    if (s.st) {
      s.st = 0
      return
    }

    p = Pane.current()
    if (Css.has(p.win.mini, 'active'))
      return

    s.st = { stack: [],
             caseSensitive: 0,
             regExp: 0 }
    s.st.win = p.win
    s.st.view = p.view
    s.st.needle = ''
    s.st.start = s.st.view.pos
    s.st.backward = backward

    Css.add(s.st.win.mini, 'active')
    Css.add(s.st.win.mini, 'search')
    s.st.echo = divCl('mini-echo')
    Css.hide(s.st.win.echo)
    s.st.mini = divCl('mini-search-w',
                      [ divCl('mini-icon icon-ed-search',
                              img('img/up.svg', 'Previous', 'filter-clr-nb0'),
                              { 'data-run': 'search backward again' }),
                        divCl('mini-icon icon-ed-search',
                              img('img/down.svg', 'Next', 'filter-clr-nb0'),
                              { 'data-run': 'search forward again' }),
                        divCl('mini-icon',
                              img('img/x.svg', 'X', 'filter-clr-nb0'),
                              { 'data-run': 'search cancel' }),
                        divCl('mini-icon',
                              img('img/search.svg', 'Search', 'filter-clr-nb0'),
                              { 'data-run': 'search done' }),
                        s.st.echo ])
    s.st.win.mini.firstElementChild.after(s.st.mini)

    oldOnKeyDown = globalThis.onkeydown
    s.st.oldOnKeyDown = oldOnKeyDown

    let wes

    wes = []
    s.st.occur = s.st.view.buf.opts.get('core.highlight.occurrences.enabled')
    s.st.view.buf.opts.set('core.highlight.occurrences.enabled', 0)
    globalThis.onkeydown = e => {
      let we

      if ([ 'Alt', 'Control', 'CapsLock', 'Shift' ].includes(e.key))
        // see note at top of em.look1
        return

      we = { mouse: 0, e }
      // if in search em then do that
      // else if in old em then cancel search and do that
      wes.push(we)
      mapSearch.look(wes, to => {
        if (to) {
          e.preventDefault()

          if (to.ons)
            // map
            return

          // cmd
          Cmd.run(to, s.st.view?.buf, 1, we)
          wes = []
          return
        }

        // empty/error
        // if in regular em then exit and run the original handler
        d('empty/error')
        Em.look(wes, 0, s.st.view?.buf, (map, to) => {
          // Simple because only want to know if there's a binding.
          if (to) { // cmd/map
            searchCancel(1)
            oldOnKeyDown(e)
          }
        })
      })
    }
  }

  spec = spec || {}
  mo = spec.mode

  s = { s: 0, // state
        search,
        addCharToSearch,
        addWordToSearch,
        removeCharFromSearch: removeOneFromSearch,
        next,
        previous,
        done }

  mapSearch = Em.make(spec.emName)

  Cmd.add('find', () => search(0), mo)
  Cmd.add('search forward', () => search(0), mo)
  Cmd.add('search backward', () => search(1), mo)
  Cmd.add('add char to search', addCharToSearch, mo)
  Cmd.add('add word to search', addWordToSearch, mo)
  Cmd.add('remove char from search', () => removeOneFromSearch(), mo)
  Cmd.add('search cancel', () => searchCancel(), mo)
  Cmd.add('search forward again', () => next(1), mo)
  Cmd.add('search backward again', () => previous(1), mo)
  Cmd.add('search done', () => done(), mo)

  Em.on('C-r', 'search backward', mo)
  Em.on('C-s', 'search forward', mo)

  for (let d = 32; d <= 127; d++)
    Em.on(String.fromCharCode(d), 'add char to search', mapSearch)
  Em.on('Enter', 'search done', mapSearch)
  Em.on('Backspace', 'remove char from search', mapSearch)

  Em.on('C-g', 'search cancel', mapSearch)
  Em.on('Escape', 'search cancel', mapSearch)
  Em.on('C-s', 'search forward again', mapSearch)
  Em.on('C-r', 'search backward again', mapSearch)
  Em.on('C-w', 'add word to search', mapSearch)
}

function initDivSearch
() {
  function vfind
  (view, needle, decorParent,
   // { backwards,
   //   caseSensitive,
   //   regExp,
   //   skipCurrent,
   //   wrap,
   //   stayInPlace }
   spec) {
    d('div vfind')
    return view.point.search(needle, spec)
  }

  initSearch(vfind,
             { emName: 'Div: Search' })
}

function initBindings
() {
  d('init bindings')

  Em.on('click', 'click')
  Em.on('click.aux', 'click aux')
  Em.on('context', 'context menu')

  // Keys like PageUp go in the modes (mainly div,browse,ed,view) so that the
  // browse mode WebContentsView gets them (see main-browse.mjs).

  Em.on('C-+', 'zoom in')
  Em.on('C-=', 'zoom in')
  Em.on('C--', 'zoom out')
  Em.on('C-a', 'line start')
  Em.on('C-b', 'backward')
  Em.on('C-e', 'line end')
  Em.on('C-f', 'forward')
  Em.on('C-g', 'cancel')
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
    let view

    view = Pane.current()?.view
    Em.handle({ mouse: 0, e, buf: view?.buf },
              view)
  }

  function handleMouse
  (name, e) {
    let target, view

    target = globalThis.document.elementFromPoint(e.clientX, e.clientY)
    view = Pane.holding(target)?.view
    Em.handle({ mouse: 1, name, e, buf: view?.buf },
              view)
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

  d('init handlers')
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
  (view, spec, cb) {
    let w, alpha

    function clr(c) {
      return div('--clr-' + c, '', { style: 'color: var(--clr-' + c + ');' })
    }

    function clrName(c) {
      return div('--clr-' + c, '')
    }

    function clrs
    (clr) {
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

    function sol(c) {
      return div('--theme-clr-' + c, '', { style: 'color: var(--theme-clr-' + c + ');' })
    }

    function solName(c) {
      return div('--theme-clr-' + c, '')
    }

    function colors
    (sol, clr) {
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
               clrs(clr) ]
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
                                              img(Icon.modePath('dir'), 'Dir', 'filter-clr-text'))) ]),
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
                                      divCl('test_buffer-des-three',
                                            [ divCl('test_buffer-des-section light', colors(solName, clrName)),
                                              divCl('test_buffer-des-section light', colors(sol, clr)),
                                              divCl('test_buffer-des-section dark', colors(sol, clr)) ]) ]),
           divCl('test_buffer-picker', [ divCl('test_buffer-des-h', 'Color Picker'),
                                         div('#red;'),
                                         div('#FF0000;'),
                                         div('#ff0000;') ]),
           divCl('test_buffer-alpha', [ div("Here's the alphabet to fill some space:"),
                                        Dom.create('hr'),
                                        alpha.map(ch => divCl('test_buffer-alpha-ch', ch)),
                                        Dom.create('hr') ]),
           divCl('test_buffer-end', 'The End.'))

    if (cb)
      cb(view)
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

  mo = Mode.add('Test Buffer', { viewInitSpec: vinit })
  Cmd.add('test buffer', () => {
    let b, p

    p = Pane.current()
    b = Buf.add('Test Buffer', 'Test Buffer', divW(), p.dir)
    b.icon = 'help'
    b.addMode('view')
    p.setBuf(b)
  })

  Cmd.add('move', move, mo)
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
    Recent.get(0, (err, all) => {
      let w, co

      if (err) {
        Mess.toss(err.message)
        return
      }
      recents = all

      w = view.ele.querySelector('.recent-w')
      w.innerHTML = ''

      co = recents.map(r => divCl('recent-item',
                                  Loc.cleanHref(r.href),
                                  { 'data-run': 'open link',
                                    'data-runaux': 'open link in new tab',
                                    'data-path': r.href }))

      append(w, co)
    })
  }

  Mode.add('Recent', { viewInitSpec: refresh })

  Cmd.add('Open Recent', () => {
    let p

    p = Pane.current()
    if (buf)
      p.setBuf(buf, {}, view => refresh(view))
    else {
      buf = Buf.add('Recent', 'Recent', divW(), p.dir)
      buf.addMode('view')
      p.setBuf(buf)
    }
  })
}

function scratchMessage
() {
  return '// This is your Javascript scratch buffer. For notes, tests or whatever.\n\n'
}

function initFontSize
() {
  let px

  px = Opt.get('core.fontSize')
  if (px === undefined)
    return
  globalThis.document.documentElement.style.fontSize = px + 'px'
}

function initDivMode
() {
  let mo

  mo = Mode.add('Div', {})

  Em.on('Escape', 'cancel', mo)
  Em.on('Enter', 'select', mo)
  Em.on('ArrowUp', 'previous line', mo)
  Em.on('ArrowDown', 'next line', mo)
  Em.on('ArrowLeft', 'backward', mo)
  Em.on('ArrowRight', 'forward', mo)
  Em.on('Home', 'buffer start', mo)
  Em.on('End', 'buffer end', mo)
  Em.on('PageUp', 'scroll up', mo)
  Em.on('PageDown', 'scroll down', mo)
}

function start1
(data, start2) {
  let path

  d('start1')

  Tron.on('thrown', err => {
    Mess.yell(err.message)
    if (err.stack)
      Mess.log(err.stack)
  })

  Mess.log('backend: ' + data.backend)
  initPackages(data.backend, err => {
    err && Mess.toss('Init error: ' + err.message)
    if (start2)
      // Timeout so that errors are thrown outside the Tron cb, else backtraces are for ipc.
      setTimeout(() => start2(data.devtools, data.frames))
  })

  d(data)
  Mess.log('   home: ' + data.home)
  Mess.log('    app: ' + data.app)
  Mess.log('   user: ' + data.user)
  Mess.log('    cwd: ' + data.cwd)
  Mess.log('profile: ' + data.profile)
  Loc.appDirSet(data.app)
  Loc.homeSet(data.home || data.app)
  U.homeSet(data.home || data.app)
  Loc.iwdSet(data.cwd || data.app) // initial working dir
  $version = data.version
  Loc.configDirSet(data.user)
  Loc.shellSet(data.shell)
  Loc.profileSet(data.profile)

  Ed.initCTags()
  Icon.setHave(1)
  path = Icon.path('javascript')
  Mess.say('Checking for icons...')
  Tron.cmd('file.stat', path, err => {
    if (err) {
      Mess.log(err.message)
      Mess.say('Checking for icons... failed, will use letters')
      Icon.setHave(0)
    }
    else
      Mess.say('Checking for icons... found')
  })

  d('initCss')
  Style.initCss(Mess.yell)
}

function start2
(devtools, frames) {
  let p, tab

  d('start2 (backend is loaded)')

  initDivMode()
  initCmds()
  initBindings()
  initDoc(devtools)
  initHandlers()
  initTest()
  initDivSearch()
  Browse.init()
  initEvalLine()

  initRecent()
  Ext.loadAll() // async

  d('filling panes')
  tab = Tab.current(Win.current().main)
  if (frames.left == 0)
    tab.frameLeft.retract()
  if (frames.right == 0)
    tab.framesRight.forEach(fr => fr.retract())
  p = Pane.current(tab.frameLeft)
  p.focus()
  Cmd.run('home')
  p = Pane.current(tab.frameRight)
  p.focus()
  Cmd.run('messages')
  p = Pane.current(tab.frame1)
  p.focus()
  if (Win.root()) {
    d('creating Scratch.js')
    makeScratch(p, () => start3(tab))
    return
  }
  start3(tab)
}

function start3
(tab) {
  d('running welcome')
  if (Opt.get('core.welcome.enabled'))
    Cmd.run('welcome')
  Pane.top(tab.frame1).focus()

  if (1) {
    Mess.say('Loading init...')
    d('loading init')
    Tron.cmd('init.load', [], (err, data) => {
      if (data.exist == 0)
        Mess.say("Loading init: missing, that's OK")
      else if (err)
        Mess.yell('Error loading init: ', err.message)

      Mess.yell('Ready!')
    })
  }
  else {
    Ed.make(Pane.current(), { name: 'Main', dir: Loc.home() })
    Mess.yell('Ready!')
  }
}

function start0
(start2) {
  d('get paths')

  Tron.cmd1('paths', [], (err, d) => {
    if (err) {
      Mess.yell('Err getting dirs: ', err.message)
      return
    }

    // Timeout so that errors are thrown outside the Tron cb, else backtraces are for ipc.
    setTimeout(() => start1(d, start2))
  })
}

export
function initShared
() {
  let window

  window = globalThis
  window.bred = {}
  if (window.opener) {
    let root

    root = window.opener
    while (root.opener)
      root = root.opener
    window.bred._shared = () => root.bred._shared()
  }
  else {
    let shared

    shared = {}
    window.bred._shared = () => shared
  }
}

export
function init
() {
  initShared()
  Opt.init()

  Opt.load(() => {
    initFontSize()

    if (1)
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

      tab = Tab.current(Win.current().main)
      tab.frameLeft.save()
      tab.frameRight.save()
      Buf.savePoss()
    }

    start0(start2)
  })
}

export
function initNewWindow
() {
  initShared()
  Opt.init()

  Opt.load(() => {
    initFontSize()

    initMouse()
    start0(start2)
  })
}

export { mouse }
