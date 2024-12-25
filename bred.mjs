import { append, button, div, divCl, span, img } from './dom.mjs'

import * as About from './about.mjs'
import * as Area from './area.mjs'
import * as Apt from './apt.mjs'
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
import * as Vc from './vc.mjs'
import * as ViewMode from './view-mode.mjs'
import * as Win from './win.mjs'
import { d } from './mess.mjs'

import { v4 as uuidv4 } from './lib/uuid/index.js'

//import * as Linters from "./lib/ace-linters/ace-linters.js"

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
  Win.add(globalThis, { devtools: devtools })
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
    let win

    win = Win.current()
    x = e.pageX
    y = e.pageY
    if (e.target?.dataset?.run) {
      if (e.target?.dataset?.run == 'open link')
        win.hover.innerText = Cmd.canon(e.target.dataset.run) + ': ' + e.target.dataset.path
      else if (e.target?.dataset?.run == 'open externally')
        win.hover.innerText = Cmd.canon(e.target.dataset.run) + ': ' + e.target.dataset.url
      else
        win.hover.innerText = Cmd.canon(e.target?.dataset?.run)
      if (hover)
        return
      Css.show(win.hover)
      hover = 1
    }
    else if (hover) {
      Css.hide(win.hover)
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
        tab.framesRight.forEach(fr => Css.retract(fr.el))
      })
      tab.frame1.focus()
      Css.remove(win.frameToggleR, 'mini-frame-open')
    }
    else {
      Tab.forEach(win.main, tab => {
        tab.framesRight.forEach(fr => Css.expand(fr.el))
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
        Css.retract(tab.frameLeft.el)
      })
      tab.frame1.focus()
      Css.remove(win.frameToggleL, 'mini-frame-open')
    }
    else {
      Tab.forEach(win.main, tab => {
        Css.expand(tab.frameLeft.el)
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
    win.context.open(we)
    win.lastContext = { x: we.e.x, y: we.e.y }
    win.context.el.style.left = we.e.x + 'px'
    win.context.el.style.top = we.e.y + 'px'
  })

  Cmd.add('inspect element', (u, we) => {
    let x, y

    if (we?.e) {
      let win

      win = Win.current()
      x = win.lastContext?.x ?? 0
      y = win.lastContext?.y ?? 0
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
    function shell
    () {
      Tron.cmd('shell.open', [ we.e.target.dataset.path ], err => {
        if (err) {
          Mess.yell('shell.open: ' + err.message)
          return
        }
      })
    }

    if (we.e.target.dataset.path) {
      let ext, mtype

      if (we.e.target.dataset.path.includes('.')) {
        ext = we.e.target.dataset.path.slice(we.e.target.dataset.path.indexOf('.') + 1)
        mtype = Ed.mtypeFromExt(ext)
        if (mtype && Ed.supports(mtype)) {
          let rich

          rich = Ext.get('rich')
          if (rich?.supports(mtype)) {
            rich.open(we.e.target.dataset.path, we.e.target.dataset.line)
            return
          }

          Pane.open(we.e.target.dataset.path, we.e.target.dataset.line)
        }
        else
          shell()
        return
      }
      Pane.open(we.e.target.dataset.path, we.e.target.dataset.line)
    }
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
    l = l.replace(/\x1B\[[0-?9;]*[mK]/g, '') // remove ansi sequences
    //l = l.replace(/[\x00-\x1F\x7F]/g, '') // remove control chars

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
      Tron.cmd('shell.open', [ url ], err => err && Mess.yell('shell.open: ' + err.message))
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
                  { skipCurrent: skipCurrent,
                    backwards: 0,
                    wrap: 0,
                    caseSensitive: 0,
                    wholeWord: 0,
                    regExp: 0 })
    if (range) {
      s.st.stack.push({ range: range, needle: s.st.needle, backwards: 0 })
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
                  { skipCurrent: skipCurrent,
                    backwards: 1,
                    wrap: 0,
                    caseSensitive: 0,
                    wholeWord: 0,
                    regExp: 0 })
    s.st.stack.push({ range: range, needle: s.st.needle, backwards: 1 })
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
        s.st.stack.push({ range: range, needle: s.st.needle, backwards: 0 })
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

      we = { mouse: 0, e: e }
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
        search: search,
        addCharToSearch: addCharToSearch,
        addWordToSearch: addWordToSearch,
        removeCharFromSearch: removeOneFromSearch,
        next: next,
        previous: previous,
        done: done }

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

function initBrowse
() {
  let mo

  function divW
  () {
    return divCl('web-ww', divCl('web-w bred-surface', ''))
  }

  function refresh
  (view, spec, cb) {
    let w, wv, preload

    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''
    preload = 'file://' + Loc.appDir().join('preload-web.js')
    d({ preload })
    wv = Dom.create('webview', [], '',
                    { src: 'https://en.wikipedia.org/wiki/Edvard_Munch',
                      preload: preload })

    append(w, wv)
    wv.addEventListener('context-menu', e => {
      d('context menu')
      e.clientX = e.params.x
      e.clientY = e.params.y
      e.x = e.params.x
      e.y = e.params.y
      Cmd.run('context menu', 0, 1, { mouse: 1, name: 'context', e: e })
    })
    wv.addEventListener('dom-ready', () => {
      d('dom-ready')
      //wv.executeJavascript('console.log("OK")')
    })
    //wv.executeJavascript('console.log("OK")')

    if (cb)
      cb(view)
  }

  mo = Mode.add('Web', { viewInitSpec: refresh })
  d(mo)

  Cmd.add('web', () => {
    let b, p

    p = Pane.current()
    b = Buf.add('Web', 'Web', divW(), p.dir)
    b.icon = 'help'
    b.addMode('view')
    p.setBuf(b)
  })

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
    (name, dir) {
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
    Prompt.ask({ text: 'Make Dir:' },
               name => make(name, pane.dir))
  }

  Cmd.add('make dir', () => makeDir())
}

function initFile
() {
  let mo, buf, under, ml, dirsOnly
  let hist

  function prefix
  (files) {
    let i, end

    if (files.length == 0)
      return ''

    if (files.length == 1)
      return files[0]

    i = 0
    end = files.length - 1
    while (files[0][i]) {
      if (files[0][i] == '/')
        break
      if (files[0][i] == files[end][i])
        i++
      else
        break
    }
    return files[0].slice(0, i)
  }

  function complete
  () {
    let p, files, pre, text

    p = Pane.current()
    files = []
    files = [ ...p.view.ele.querySelectorAll('.bred-open-under-f') ].map(el => el.dataset.name)
    pre = prefix(files)
    text = buf.text()
    if (pre.length > text.length) {
      p.buf.clear()
      p.buf.insert(pre)
      p.view.bufEnd()
    }
  }

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
    if (text.length)
      Ed.make(p,
              { name: text, dir: p.dir },
              () => {
                // delayed otherwise Ed tries to open file
                p.buf.file = text
              })
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
    buf.opts.set('minimap.enabled', 0)
    hist.reset()
    buf.off('change', onChange)
    buf.file = 0
    //buf.dir = 0
    dir = p.dir
    p.setBuf(buf, {}, () => {
      buf.clear()
      buf.dir = dir

      ml = p.view.ele.querySelector('.edMl')
      under = p.view.ele.querySelector('.bred-open-under') || Mess.toss('under missing')
      if (under) {
        refresh()
        buf.on('change', onChange)
      }
    })
  }

  hist = Hist.ensure('open')

  mo = Mode.add('Open', { hidePoint: 1,
                          viewInitSpec: Ed.viewInitSpec,
                          viewInit: Ed.viewInit,
                          initFns: Ed.initModeFns,
                          parentsForEm: 'ed' })

  Cmd.add('complete', () => complete(), mo)
  Cmd.add('next', () => hist.next(buf), mo)
  Cmd.add('previous', () => hist.prev(buf), mo)
  Cmd.add('next selection', () => nextSel(), mo)
  Cmd.add('previous selection', () => prevSel(), mo)
  Cmd.add('select', (u, we) => select(we), mo)
  Cmd.add('select dir', (u, we) => selectDir(we), mo)

  Em.on('Enter', 'select', mo)
  Em.on('Tab', 'complete', mo)

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

  Mess.log('home: ' + data.home)
  Mess.log(' app: ' + data.app)
  Mess.log('user: ' + data.user)
  Mess.log(' cwd: ' + data.cwd)
  Loc.appDirSet(data.app)
  Loc.homeSet(data.home || data.app)
  Loc.iwdSet(data.cwd || data.app) // initial working dir
  $version = data.version
  Loc.configDirSet(data.user)
  Loc.shellSet(data.shell)

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

  initCmds()
  initBindings()
  initDoc(devtools)
  initHandlers()
  initTest()
  initDivSearch()
  initBrowse()
  initFile()
  initEvalLine()

  initRecent()
  Ext.loadAll() // async

  d('filling panes')
  tab = Tab.current(Win.current().main)
  if (frames.left == 0)
    Css.retract(tab.frameLeft.el)
  if (frames.right == 0)
    tab.framesRight.forEach(fr => Css.retract(fr.el))
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
