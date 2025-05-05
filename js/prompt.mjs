import { append, button, divCl, img, span } from './dom.mjs'

import * as Area from './area.mjs'
import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Dir from './dir.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Icon from './icon.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import * as Tab from './tab.mjs'
import * as Tron from './tron.mjs'
import * as U from './util.mjs'
import * as Win from './win.mjs'
import { d } from './mess.mjs'

let buf, $callerView, ynEm, ynCb, open

export
function callerView
() {
  return $callerView
}

export
function yn
(content,
 spec, // { icon, under }
 cb) { // (yes)
  spec = spec || {}
  ynCb = cb
  demand(ynEm,
         [ divCl('float-ww',
                 divCl('float-w',
                       [ divCl('float-h',
                               [ divCl('float-icon' + (spec.icon ? '' : ' retracted'),
                                       img(Icon.path(spec.icon || 'blank'),
                                           Icon.alt(spec.icon),
                                           'filter-clr-nb3')),
                                 divCl('float-text', content),
                                 button([ span('y', 'key'), 'es' ], '', { 'data-run': 'yes' }),
                                 button([ span('n', 'key'), 'o' ], '', { 'data-run': 'no' }),
                                 button([ span('c', 'key'), 'ancel' ], '', { 'data-run': 'close demand' }) ]),
                         spec.under ])),
           divCl('float-shade') ])
}

export
function demand
(em, co) {
  let p, area

  p = Pane.current()
  $callerView = p.view
  Area.getByName(p.win, 'bred-float')?.close()
  area = Area.add(p.win, 'bred-float')
  if (em)
    Em.replace(() => [ em ])
  append(area.el, co)
  area.show()
  return
}

export
function demandBuf
(w) {
  let win, p, buf, area, ml

  win = Win.current()
  Area.getByName(win, 'bred-float')?.close()
  area = Area.add(win, 'bred-float')
  Tab.add(area, { singleFrame: 1 })

  p = Pane.current()
  ml = w.querySelector('.edMl')
  if (ml)
    ml.innerText = 'Query replace'
  buf = Buf.make({ name: 'QR',
                   modeKey: 'qr',
                   content: w,
                   dir: p.dir })
  buf.vars('ed').fillParent = 0
  buf.opts.set('core.autocomplete.enabled', 0)
  buf.opts.set('core.brackets.close.enabled', 0)
  buf.opts.set('core.folding.enabled', 0)
  buf.opts.set('core.line.numbers.show', 0)
  buf.opts.set('core.lint.enabled', 0)
  buf.opts.set('minimap.enabled', 0)
  buf.icon = 'prompt'
  area.tab.frame.pane.setBuf(buf,
                             {},
                             () => {
                               area.show()
                               area.tab.frame.pane.focus()
                             })
  return p
}

export
function close
() {
  let win

  win = Win.current()
  Area.hide(win, 'bred-float')
  Em.replace()
  Area.show(win, 'bred-main')
}

export
function ask
(spec, // { hist, text, onReady, suggest, under, w }
 cb) { // (text)
  let win, p, buf, area, tab, ml, under

  function refresh
  () {
    if (spec.suggest) {
      Css.disable(under)
      spec.suggest(under, buf.text())
    }
  }

  function onChange
  () {
    refresh()
  }

  spec = spec || {}

  if (spec.under && spec.suggest)
    Mess.toss('under and suggest both given')

  if (spec.suggest)
    spec.under = divCl('bred-prompt-under')

  spec.w = spec.w || Ed.divW(0, 0, { extraWWCss: 'bred-prompt-buf-ww bred-prompt-attract',
                                     extraCo: spec.under })
  win = Win.current()
  Area.getByName(win, 'bred-float')?.close()
  area = Area.add(win, 'bred-float')
  tab = Tab.add(area, { singleFrame: 1 })

  p = Pane.current()
  ml = spec.w.querySelector('.edMl')
  if (ml)
    ml.innerText = spec.text || 'Enter text'
  buf = Buf.make({ name: 'Prompt2',
                   modeKey: 'prompt2',
                   content: spec.w,
                   dir: p.dir,
                   placeholder: spec.placeholder ?? spec.hist?.nth(0)?.toString() })
  buf.vars('ed').fillParent = 0
  buf.opts.set('blankLines.enabled', 0)
  buf.opts.set('core.autocomplete.enabled', 0)
  buf.opts.set('core.brackets.close.enabled', 0)
  buf.opts.set('core.folding.enabled', 0)
  buf.opts.set('core.highlight.activeLine.enabled', 0)
  buf.opts.set('core.head.enabled', 0)
  buf.opts.set('core.line.numbers.show', 0)
  buf.opts.set('core.lint.enabled', 0)
  buf.opts.set('minimap.enabled', 0)
  buf.opts.set('ruler.enabled', 0)
  buf.icon = 'prompt'
  buf.vars('prompt').run = cb
  buf.vars('prompt').orig = p.buf
  spec.hist?.reset()
  buf.vars('prompt').hist = spec.hist
  buf.off('change', onChange)
  tab.frame.pane.setBuf(buf,
                        {},
                        view => {
                          area.show()
                          tab.frame.pane.focus()
                          spec.onReady && spec.onReady(tab.frame.pane)
                          setTimeout(() => {
                            buf.views.forEach(v => {
                              let w

                              w = v.ele.querySelector('.bred-prompt-buf-ww')
                              Css.remove(w, 'bred-prompt-attract')
                            })
                          },
                                     0.35 * 1000)
                          if (spec.suggest) {
                            under = view.ele.querySelector('.bred-prompt-under') || Mess.toss('under missing')
                            refresh()
                            buf.on('change', onChange)
                          }
                        })
  return p
}

function initFile
() {
  let mo, buf, under, ml
  let cbCreate, cbOpen, dirsOnly, hist

  function divW
  () {
    return Ed.divW(0, 0, { extraWWCss: 'bred-open-ww bred-opener-ww',
                           extraWCss: 'bred-open-w bred-opener-w',
                           extraCo: [ divCl('bred-open-under'),
                                      divCl('bred-open-under-icon', img('img/prompt.svg', '>', 'filter-clr-nb0')) ] })
  }

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
      cbCreate && cbCreate(p, text)
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
          hist?.add(p.buf.text())
        cbOpen && cbOpen(path)
      }
      else if (typeof path === 'string')
        Mess.say('Empty')
      else
        Mess.yell('Error, path was ' + (typeof path))
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
          hist?.add(p.buf.text())
        cbOpen && cbOpen(path)
      }
      else if (typeof path === 'string')
        Mess.say('Empty')
      else
        Mess.yell('Error, path was ' + (typeof path))
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

  function open
  (spec) {
    let p, w, dir, ph

    cbCreate = spec.create
    cbOpen = spec.open
    hist = spec.hist
    dirsOnly = spec.dirsOnly
    p = Pane.current()

    w = divW()
    ml = w.querySelector('.edMl')
    if (ml)
      ml.innerText = 'Open file'

    if (spec.atPoint && p.view.ed) {
      let l, pos, url

      l = p.line()
      if (l) {
        pos = p.pos()
        pos = pos.col
        url = U.urlAt(l, pos)
        if (url?.protocol == 'file:')
          ph = url.pathname
      }
    }

    if (buf)
      buf.placeholder = ph
    else {
      buf = Buf.make({ name: 'Open',
                       modeKey: 'open',
                       content: w,
                       dir: p.dir,
                       placeholder: ph })
      buf.icon = 'prompt'
    }

    buf.vars('ed').fillParent = 0
    buf.opts.set('core.autocomplete.enabled', 0)
    buf.opts.set('core.folding.enabled', 0)
    buf.opts.set('core.line.numbers.show', 0)
    buf.opts.set('core.lint.enabled', 0)
    buf.opts.set('minimap.enabled', 0)
    spec.hist?.reset()
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

  mo = Mode.add('Open', { hidePoint: 1,
                          viewInitSpec: Ed.viewInitSpec,
                          initFns: Ed.initModeFns,
                          parentsForEm: 'ed' })

  Cmd.add('complete', () => complete(), mo)
  Cmd.add('next', () => hist?.next(buf), mo)
  Cmd.add('previous', () => hist?.prev(buf), mo)
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

  Cmd.add('idle', () => {})

  return open
}

export
function dir
(spec) {
  spec.dirsOnly = 1
  open(spec)
}

export
function file
(spec) {
  spec.dirsOnly = 0
  open(spec)
}

function initPrompt2
() {
  let mo

  function prevHist
  (nth) {
    let p, prev, hist

    p = Pane.current()
    hist = p.buf.vars('prompt').hist
    if (hist) {
      prev = nth < 0 ? hist.next() : hist.prev()
      if (prev) {
        p.buf.clear()
        p.view.insert(prev)
      }
    }
  }

  function ok
  () {
    let p, cb, term

    p = Pane.current()
    term = p.text()
    if (term.length == 0)
      term = p.buf.placeholder
    cb = p.buf.vars('prompt').run
    close()
    if (cb)
      cb(term)
  }

  mo = Mode.add('Prompt2', { hidePoint: 1,
                             viewInitSpec: Ed.viewInitSpec,
                             viewCopy: Ed.viewCopy,
                             initFns: Ed.initModeFns,
                             parentsForEm: 'ed' })

  Cmd.add('close buffer', () => close(), mo)
  Cmd.add('next history item', () => prevHist(-1), mo)
  Cmd.add('previous history item', () => prevHist(), mo)
  Cmd.add('ok', () => ok(), mo)

  Em.on('ArrowUp', 'previous history item', mo)
  Em.on('ArrowDown', 'next history item', mo)
  Em.on('A-p', 'previous history item', mo)
  Em.on('A-n', 'next history item', mo)
  Em.on('C-c C-c', 'ok', mo)
  Em.on('C-g', 'close demand', mo)
  Em.on('Escape', 'close demand', mo)
  Em.on('Enter', 'ok', mo)
}

export
function init
() {
  let mo

  function run
  () {
    let p, text, orig

    function run1
    () {
      let cb

      cb = buf.vars('Prompt').run
      if (cb)
        cb(p, text)
    }

    p = Pane.current()
    text = p.text()
    orig = buf.vars('Prompt').orig
    if (orig)
      p.setBuf(orig, {}, () => run1())
    else
      run1()
  }

  Cmd.add('yes', () => {
    Cmd.run('close demand')
    ynCb && ynCb(1)
  })
  Cmd.add('no', () => {
    Cmd.run('close demand')
    ynCb && ynCb(0)
  })
  Cmd.add('close yes/no', () => {
    ynCb = null
    Cmd.run('close demand')
  })

  ynEm = Em.make('YN')
  ynEm.on('y', 'yes')
  ynEm.on('n', 'no')
  ynEm.on('c', 'close yes/no')
  Em.on('C-g', 'close yes/no', ynEm)
  Em.on('Escape', 'close yes/no', ynEm)

  mo = Mode.add('Prompt', { viewInitSpec: Ed.viewInitSpec,
                            viewCopy: Ed.viewCopy,
                            initFns: Ed.initModeFns,
                            parentsForEm: 'ed' })

  Cmd.add('run', () => run(), mo)

  Em.on('Enter', 'run', mo)

  Em.on('C-g', 'close buffer', mo)
  Em.on('Escape', 'close buffer', mo)
  Em.on('C-c', 'run', mo)

  initPrompt2()
  open = initFile()
}
