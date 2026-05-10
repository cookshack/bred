import { append, divCl, img } from './dom.mjs'
import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Dir from './dir.mjs'
import * as Ed from './ed.mjs'
import * as Em from './Em.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './Pane.mjs'
import * as Tron from './tron.mjs'
import * as U from './util.mjs'
import { d } from './mess.mjs'

export
function init
() {
  let mo, buffer, under, ml
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
    text = buffer.text()
    if (pre.length > text.length) {
      p.buf.clear()
      p.buf.insert(pre)
      p.view.bufEnd()
    }
  }

  function nextSel
  () {
    let p, el

    p = Pane.current()
    el = p.view.ele.querySelector('.bred-open-under-f.selected')
    if (el)
      if (el.nextElementSibling) {
        Css.remove(el, 'selected')
        Css.add(el.nextElementSibling, 'selected')
      }

  }

  function prevSel
  () {
    let p, el

    p = Pane.current()
    el = p.view.ele.querySelector('.bred-open-under-f.selected')
    if (el)
      if (el.previousElementSibling) {
        Css.remove(el, 'selected')
        Css.add(el.previousElementSibling, 'selected')
      }

  }

  function createFile
  (p) {
    let text

    text = buffer.text().trim()
    if (text.length)
      cbCreate && cbCreate(p, text)
  }

  function select
  (we) {
    if (dirsOnly) {
      let path, p, el

      // Open
      p = Pane.current()
      el = p.view.ele.querySelector('.bred-open-under-f.selected')
      el = el || p.view.ele.querySelector('.bred-open-under-f')
      path = el?.dataset.path
      if (path && path.length) {
        if (p.buf.text().length)
          hist?.add(p.buf.text())
        cbOpen && cbOpen(path)
      }
      else if (typeof path == 'string')
        Mess.say('Empty')
      else
        Mess.yell('Error, path was ' + (typeof path))
    }
    else
      selectFile(we)
  }

  function selectFile
  (we) {
    let p, el

    p = Pane.current()
    if (we?.e && (we.e.button == 0))
      el = we.e.target
    else {
      el = p.view.ele.querySelector('.bred-open-under-f.selected')
      el = el || p.view.ele.querySelector('.bred-open-under-f')
    }
    if (el) {
      let path

      // Open
      path = el?.dataset.path
      if (path && path.length) {
        if (el.dataset.name.endsWith('/')) {
          let text

          text = p.buf.text()
          p.buf.clear()
          if (text.length)
            // strip off any partial el.dataset.name
            text = Loc.make(text).dirname
          p.view.insert(text + el.dataset.name)
          return
        }
        if (p.buf.text().length)
          hist?.add(p.buf.text())
        cbOpen && cbOpen(path)
      }
      else if (typeof path == 'string')
        Mess.say('Empty')
      else
        Mess.yell('Error, path was ' + (typeof path))
      return
    }

    createFile(p)
  }

  function selectDir
  (we) {
    let p, el

    p = Pane.current()
    if (we?.e && (we.e.button == 0))
      el = we.e.target
    else {
      el = p.view.ele.querySelector('.bred-open-under-f.selected')
      el = el || p.view.ele.querySelector('.bred-open-under-f')
    }
    if (el) {
      let path

      path = el?.dataset.path
      if (path && path.length) {
        p.buf.clear()
        p.buf.append(Loc.make(el.dataset.path).ensureSlash())
      }
      else if (typeof path == 'string')
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

    text = buffer.text() || ''
    under.innerHTML = ''
    if (text.startsWith('/'))
      path = Loc.make(text)
    else {
      path = Loc.make(buffer.dir)
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
      let l

      l = p.line()
      if (l) {
        let pos, url

        pos = p.pos()
        pos = pos.col
        url = U.urlAt(l, pos)
        if (url?.protocol == 'file:')
          ph = url.pathname
      }
    }

    if (buffer)
      buffer.placeholder = ph
    else {
      buffer = Buf.make({ name: 'Open',
                          modeKey: 'open',
                          content: w,
                          dir: p.dir,
                          placeholder: ph })
      buffer.icon = 'prompt'
    }

    buffer.vars('ed').fillParent = 0
    buffer.opts.set('core.autocomplete.enabled', 0)
    buffer.opts.set('core.folding.enabled', 0)
    buffer.opts.set('core.line.numbers.show', 0)
    buffer.opts.set('core.lint.enabled', 0)
    buffer.opts.set('minimap.enabled', 0)
    spec.hist?.reset()
    buffer.off('change', onChange)
    buffer.file = 0
    //buffer.dir = 0
    dir = p.dir
    p.setBuf(buffer, {}, () => {
      buffer.clear()
      buffer.dir = dir

      ml = p.view.ele.querySelector('.edMl')
      under = p.view.ele.querySelector('.bred-open-under') || Mess.toss('under missing')
      if (under) {
        refresh()
        buffer.on('change', onChange)
      }
    })
  }

  mo = Mode.add('Open', { hidePoint: 1,
                          viewInit: Ed.viewInit,
                          initFns: Ed.initModeFns,
                          parentsForEm: 'ed' })

  Cmd.add('complete', () => complete(), mo)
  Cmd.add('next', () => hist?.next(buffer), mo)
  Cmd.add('previous', () => hist?.prev(buffer), mo)
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
  Cmd.add('shrug', () => Mess.say(U.shrug))

  return open
}
