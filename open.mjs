import { append, divCl, img } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Dir from './dir.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Hist from './hist.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Tron from './tron.mjs'
import * as U from './util.mjs'
import { d } from './mess.mjs'

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

export
function init
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
  (u) {
    dirsOnly = 0
    open(u)
  }

  function openDir
  () {
    dirsOnly = 1
    open()
  }

  function open
  (u) {
    let p, w, dir, ph

    p = Pane.current()

    w = divW()
    ml = w.querySelector('.edMl')
    if (ml)
      ml.innerText = 'Open file'

    if ((u == 4) && p.view.ed) {
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
                       modeName: 'Open',
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

  Cmd.add('open file', openFile)

  Cmd.add('open directory', () => openDir())
  Cmd.add('dir', () => openDir())

  Cmd.add('idle', () => {})

  Em.on('C-x C-f', 'open file')
  Em.on('C-x d', 'open directory')
  Em.on('C-x C-d', 'open directory')

  initMakeDir()
}
