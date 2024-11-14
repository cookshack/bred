import { append, div, divCl, span, img } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Hist from './hist.mjs'
import * as Icon from './icon.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Scib from './scib.mjs'
import * as Shell from './shell.mjs'
import * as Tron from './tron.mjs'
import { d } from './mess.mjs'

export
function nav
(path, run) {
  let hco, dir, first

  run = run || 'open link'
  dir = ''
  first = 1
  hco = [ divCl('dir-h-dir',
                '/',
                { 'data-path': '/',
                  'data-run': 'open link' }) ]
  path.split('/').forEach(file => {
    if (file.length) {
      dir = dir + '/' + file
      hco.push([ first ? [] : divCl('dir-h-sep', '/'),
                 divCl('dir-h-dir',
                       file,
                       { 'data-path': dir,
                         'data-run': run }) ])
      first = 0
    }
  })
  return hco
}

function dirW
(path, co, args) {
  let hco

  hco = []

  hco.push([ divCl('edMl-type',
                   img(Icon.modePath('dir'), 'Dir', 'filter-clr-text')) ])

  hco.push(nav(path))

  return divCl('dir-ww',
               [ divCl('dir-h', hco),
                 divCl('dir-w bred-surface', co) ],
               args)
}

/*
(defun print-mode (mode &optional stream)
  (macrolet ((frob (bit name &optional sbit sname negate)
               `(if ,(if negate
                         `(not (logbitp ,bit mode))
                         `(logbitp ,bit mode))
                    ,(if sbit
                         `(if (logbitp ,sbit mode)
                              (write-char ,sname stream)
                              (write-char ,name stream))
                         `(write-char ,name stream))
                    (write-char #\- stream))))
    (frob 15 #\d () () t)
    (frob 8 #\r)
    (frob 7 #\w)
    (frob 6 #\x 11 #\s)
    (frob 5 #\r)
    (frob 4 #\w)
    (frob 3 #\x 10 #\s)
    (frob 2 #\r)
    (frob 1 #\w)
    (frob 0 #\x)))
*/

function printMode
(stat) {
  let mode

  function frob
  (bit, name, sbit, sname, negate) {
    if (negate
        ? (0 == (mode & (1 << bit)))
        : (mode & (1 << bit))) {
      if (sbit
          && (mode & (1 << sbit)))
        return sname
      return name
    }
    return '-'
  }

  mode = stat.mode
  if (mode)
    return (stat.link ? 'l' : frob(15, 'd', 0, 0, 1))
      + frob(8, 'r')
      + frob(7, 'w')
      + frob(6, 'x', 11, 's')
      + frob(5, 'r')
      + frob(4, 'w')
      + frob(3, 'x', 10, 's')
      + frob(2, 'r')
      + frob(1, 'w')
      + frob(0, 'x')
  return '?????????'
}

export
function formatTime
(date,
 tz, // else use local tz (on client side: from browser)
 timeFormat,
 includeSeconds) {
  let p, options, timeDivider, seconds, timeSuffix

  // 1: 14h16
  // 2: 2:16 PM

  date = date || new Date()

  options = {}
  if (timeFormat == 2) {
    // 9:07am 9:07pm
    options.hour = 'numeric'
    options.minute = '2-digit'
    options.hour12 = true
    options.dayPeriod = 'short'
    timeDivider = ':'
  }
  else {
    // 09h07 21h07
    options.hour = '2-digit'
    options.minute = '2-digit'
    options.hour12 = false
    timeDivider = 'h'
  }

  if (includeSeconds)
    options.second = '2-digit'

  if (tz)
    options.timeZone = tz

  p = Intl.DateTimeFormat('UTC', options)
    .formatToParts(date)

  seconds = ''
  if (includeSeconds) {
    if (timeFormat == 2)
      seconds = ':'
    else
      seconds = 'm'
    seconds += p.find(e => e.type == 'second').value
  }

  timeSuffix = ''
  if (timeFormat == 2)
    timeSuffix = date.getHours() >= 12 ? ' PM' : ' AM'

  return String(p.find(e => e.type == 'hour').value).padStart(2, ' ')
    + timeDivider
    + p.find(e => e.type == 'minute').value
    + seconds
    + timeSuffix
}

function formatDateMonthDay
(date,
 tz) { // else use local tz (on client side: from browser)
  let p, options

  // Jan 23

  date = date || new Date()

  options = { month: 'short', day: '2-digit' }

  if (tz)
    options.timeZone = tz

  p = Intl.DateTimeFormat('UTC', options)
    .formatToParts(date)

  return p.find(e => e.type == 'month').value + ' ' + p.find(e => e.type == 'day').value
}

function formatDate
(date,
 tz, // else use local tz (on client side: from browser)
 timeFormat) {
  // 1: Jan 23, 14h16
  // 2: Jan 23, 2:16 PM

  return formatDateMonthDay(date, tz) + ', ' + formatTime(date, tz, timeFormat)
}

function fill
(p, bak, hid, sort, currentFile, marked) {
  let path, toScroll

  function makeF
  (f) {
    let name, file, on

    function join
    (dir, file) {
      if (dir.endsWith('/'))
        return dir + file
      return dir + '/' + file
    }

    function size
    () {
      let sz

      sz = []
      if (f.stat.size < 1000)
        sz.push(span(String(f.stat.size)))
      else {
        if (f.stat.size < 1000000)
          sz.push(span(String(Math.floor((f.stat.size % 1000000) / 1000)),
                       'dir-size-thou'))

        else {
          sz.push(span(String(Math.floor(f.stat.size / 1000000)),
                       'dir-size-mil'))
          sz.push(span(String(Math.floor((f.stat.size % 1000000) / 1000)).padStart(3, '0'),
                       'dir-size-thou'))
        }
        sz.push(span(String(f.stat.size % 1000).padStart(3, '0')))
      }
      return sz
    }

    if (f.stat)
      file = f.stat.mode & (1 << 15)
    else
      file = 1

    f.name = f.name || '???'

    name = div(f.name + (file ? '' : '/'),
               'dir-name',
               { 'data-type': f.stat?.link ? 'l' : (file ? 'f' : 'd'),
                 'data-name': f.name,
                 'data-path': join(path, f.name),
                 'data-run': 'open link' })

    on = marked.has(f.name) ? ' on' : ''

    return [ divCl('dir-mark' + on,
                   img('img/tick.svg', '*', 'filter-clr-text'),
                   { 'data-run': 'mark',
                     'data-nameonmark': f.name }),
             divCl('dir-mode' + on, printMode(f.stat)),
             divCl(on, f.stat?.uid),
             divCl(on, f.stat?.gid),
             divCl('dir-size' + on, f.stat ? size() : '?'),
             divCl('dir-date' + on, f.stat ? formatDate(Math.floor(f.stat.mtimeMs / 1000)) : '?'),
             divCl('dir-name-w' + on, name) ]
  }

  function redraw
  (view) {
    let surf, px, rect, avail, frag, lines, shown, above
    let first // top gap div
    let end // bottom gap div

    d('== redraw')

    lines = view.buf.vars('dir').lines

    surf = view.ele.firstElementChild.firstElementChild.nextElementSibling
    rect = surf.getBoundingClientRect()
    d('surf: ' + rect.height)
    px = parseFloat(globalThis.getComputedStyle(globalThis.document.documentElement).fontSize)
    px *= (parseFloat(globalThis.getComputedStyle(surf).getPropertyValue('--line-height') || 1) || 1)
    d('px: ' + px)

    avail = Math.ceil(rect.height / px)

    d('avail: ' + avail)
    d('scrollTop: ' + surf.scrollTop)

    first = surf.firstElementChild
    first.dataset.above = first.dataset.above || 0
    first.dataset.scrolltop = first.dataset.scrolltop || 0
    shown = first.dataset.shown

    d('first.dataset.above: ' + first.dataset.above)
    d('first.dataset.scrolltop: ' + first.dataset.scrolltop)
    d('first.dataset.shown: ' + first.dataset.shown)

    if (first.dataset.scrolltop == Math.floor(surf.scrollTop)) {
      d('same')
      return
    }

    first.dataset.scrolltop = Math.floor(surf.scrollTop)

    if (surf.scrollTop == 0)
      above = 0
    else
      above = Math.floor(surf.scrollTop / px)
    d('above: ' + above)

    if (above > first.dataset.above) {
      // remove lines above
      d('= remove ' + (above - first.dataset.above) + ' lines above')
      for (let i = 0; i < (above - first.dataset.above) * 7; i++)
        if (first.nextElementSibling)
          first.nextElementSibling.remove()
      shown -= (above - first.dataset.above)
    }
    else if (above < first.dataset.above) {
      // add lines above
      d('= add ' + (first.dataset.above - above) + ' lines above')
      frag = new globalThis.DocumentFragment()
      for (let i = 0; i < (first.dataset.above - above); i++) {
        lines[i + above].forEach(cell => append(frag, cell))
        shown++
      }
      first.after(frag)
    }

    // adjust top gap
    first.style.height = 'calc(' + above + ' * var(--line-height))'
    first.dataset.above = above

    end = surf.lastElementChild

    {
      let mustShow

      mustShow = Math.min(avail, (lines.length - above))
      d({ shown })
      d({ mustShow })

      if (shown < mustShow) {
        // add lines below
        frag = new globalThis.DocumentFragment()
        d('= add ' + (mustShow - shown) + ' lines below')
        while (shown < mustShow) {
          d('add line ' + (above + shown))
          lines[above + shown].forEach(cell => {
            append(frag, cell)
          })
          shown++
        }
        end.before(frag)
      }
      else if (shown > mustShow) {
        // remove lines below
        d('= remove ' + (shown - mustShow) + ' lines below')
        while (mustShow < shown) {
          d('remove last line')
          for (let i = 0; i < 7; i++)
            if (end.previousElementSibling)
              end.previousElementSibling.remove()
          shown--
        }
      }
    }

    // adjust bottom gap
    end.style.height = 'calc(' + (lines.length - shown - above) + ' * var(--line-height))'
    first.dataset.shown = shown

    d('== done')
    toScroll = 0
  }

  function onscroll
  (view) {
    d('scr')
    if (toScroll)
      return
    toScroll = setTimeout(e => redraw(view, e), 100)
  }

  function init
  (view) {
    let surf, px, rect, avail, first, frag, lines, shown, end

    lines = view.buf.vars('dir').lines

    surf = view.ele.firstElementChild.firstElementChild.nextElementSibling
    d(surf)
    rect = surf.getBoundingClientRect()
    d('surf: ' + rect.height)
    px = parseFloat(globalThis.getComputedStyle(globalThis.document.documentElement).fontSize)
    px *= (parseFloat(globalThis.getComputedStyle(surf).getPropertyValue('--line-height') || 1) || 1)
    d(px)

    avail = Math.ceil(rect.height / px)
    d(avail)

    first = surf.firstElementChild
    frag = new globalThis.DocumentFragment()
    shown = Math.min(avail, lines.length)
    for (let i = 0; i < shown; i++)
      lines[i].forEach(cell => append(frag, cell))
    first.after(frag)

    end = surf.lastElementChild
    end.style.height = 'calc(' + (lines.length - shown) + ' * var(--line-height))'
    first.dataset.shown = shown

    surf.onscroll = e => onscroll(view, e)
  }

  marked = marked || new Set()

  path = Loc.make(p.dir)
  path.ensureSlash()

  sort = sort || 'name'
  if (sort == 'time')
    sort = 'time-desc'
  else if (sort == 'name')
    sort = 'name-asc'
  else if (sort == 'size')
    sort = 'size-asc'

  path = path.expand()
  Tron.cmd('dir.get', path, (err, data) => {
    let co, lines

    if (err) {
      Mess.yell('Dir.fill: ' + err.message)
      return
    }

    // TODO could have modified buffer eg refresh before arrives?
    //d(data)
    //d(data.data)

    co = data.data
    if (hid) {
      // show hidden
    }
    else
      co = co.filter(f => f.hidden ? 0 : 1)

    if (bak) {
      // show backups
    }
    else
      co = co.filter(f => f.bak ? 0 : 1)

    if (sort == 'size-asc')
      co = co.sort((f1,f2) => f1.stat?.size - f2.stat?.size)
    else if (sort == 'size-desc')
      co = co.sort((f1,f2) => f2.stat?.size - f1.stat?.size)
    else if (sort == 'time-asc')
      co = co.sort((f1,f2) => f1.stat?.mtimeMs - f2.stat?.mtimeMs)
    else if (sort == 'time-desc')
      co = co.sort((f1,f2) => f2.stat?.mtimeMs - f1.stat?.mtimeMs)
    else if (sort == 'name-asc')
      co = co.sort()
    else if (sort == 'name-desc')
      co = co.sort().reverse()

    lines = co.map(makeF)
    p.buf.vars('dir').lines = lines
    p.buf.vars('dir').marked = marked
    bak = bak ? 1 : 0
    p.buf.vars('dir').bak = bak
    hid = hid ? 1 : 0
    p.buf.vars('dir').hid = hid
    p.buf.vars('dir').sort = sort

    p.buf.content = dirW(path,
                         [ divCl('bred-gap', [], { style: 'height: calc(0 * var(--line-height));' }),
                           divCl('bred-gap', [], { style: 'height: calc(' + lines.length + ' * var(--line-height));' }) ],
                         { 'data-bak': bak,
                           'data-hid': hid,
                           'data-sort': sort })

    p.buf.views.forEach(v => v.ele && init(v))

    if (currentFile) {
      let el

      el = p.view.ele.querySelector('.dir-name[data-name="' + currentFile + '"]')
      if (el)
        p.view.point.put(el)
    }
    else {
      let first

      first = p.view.ele.querySelector('.dir-name')
      if (first)
        p.view.point.put(first)
    }
  })
}

let watching

function watch
(path) {
  if (watching.has(path))
    return
  watching.add(path)
  Tron.cmd1('dir.watch', [ path ], (err, ch) => {
    if (err) {
      Mess.log('watch failed on ' + path)
      watching.delete(path)
      return
    }
    Tron.on(ch, (err, data) => {
      // NB Beware of doing anything in here that modifies any dir being watched,
      //    eg logging in dir.get when --logfile, because that causes recursive
      //    behaviour.
      d('--- watch ev ---')
      d({ data })
      Pane.forEach(pane => {
        if (pane.buf
            && (pane.buf.mode?.key == 'dir')
            && (pane.buf.path == path)) {
          if (data.bak) {
            if (pane.buf.vars('dir').bak)
              refreshKeep(pane)
            return
          }
          if (data.hidden) {
            if (pane.buf.vars('dir').hid)
              refreshKeep(pane)
            return
          }
          refreshKeep(pane)
        }
      })
    })
  })
}

export
function add
(p, dir, initialFile) {
  let b, exist

  dir = Loc.make(dir)
  dir.expand()
  dir.ensureSlash()

  exist = Buf.find(b => (b.mode?.key == 'dir') && (b.dir == dir.path))
  if (exist) {
    p.setBuf(exist, {}, () => refreshKeep(p, undefined, undefined, undefined, initialFile))
    return
  }

  if (dir.path.length > 1)
    dir.removeSlash()

  b = Buf.add(dir.filename, 'Dir', 0, dir.dirname, dir.filename)
  b.icon = Icon.mode('dir').name
  b.fileType = 'dir'
  b.addMode('view')
  p.setBuf(b, {}, () => {
    fill(p, undefined, undefined, undefined, initialFile)
    watch(dir.path)
  })
}

function up
() {
  let p

  p = Pane.current()
  if (p.dir) {
    let dir

    dir = Loc.make(p.dir)
    dir.removeSlash()
    add(p, dir.dirname, dir.filename)
  }
  else
    Mess.yell('Missing dir')
}

function refresh
(p, bak, hid, sort, marked, currentFile) {
  if (p.dir && p.buf.file) {
    p.buf.clear()
    if (currentFile)
      fill(p, bak, hid, sort, currentFile, marked)
    else {
      let el

      el = p.view.point.over()
      fill(p, bak, hid, sort, el?.dataset.name, marked)
    }
  }
  else
    Mess.yell('Missing dir/file')
}

function refreshKeep
(p, bak, hid, sort, currentFile) {
  let marked

  bak = bak ?? p.buf.vars('dir').bak
  hid = hid ?? p.buf.vars('dir').hid
  sort = sort ?? p.buf.vars('dir').sort

  marked = getMarked(p.buf)
  refresh(p, bak, hid, sort, marked, currentFile)
}

function sortBy
(d) {
  let p, sort

  p = Pane.current()
  sort = p.buf.vars('dir').sort
  if (sort) {
    let ss

    ss = sort.split('-')
    if (d == ss[0])
      d = d + (ss[1] == 'asc' ? '-desc' : '-asc')
  }
  refreshKeep(p,
              p.buf.vars('dir').bak,
              p.buf.vars('dir').hid,
              d)
}

function showBak
() {
  let p

  p = Pane.current()
  refreshKeep(p,
              p.buf.vars('dir').bak ? 0 : 1,
              p.buf.vars('dir').hid,
              p.buf.vars('dir').sort)
}

function showHid
() {
  let p

  p = Pane.current()
  refreshKeep(p,
              p.buf.vars('dir').bak,
              p.buf.vars('dir').hid ? 0 : 1,
              p.buf.vars('dir').sort)
}

function initSearchFiles
() {
  let moSr
  let hist

  function follow
  (other) {
    let p, line

    p = Pane.current()
    if (other)
      Pane.nextOrSplit()

    line = p.line()
    if (line.length) {
      let s

      s = line.split(':', 3)
      if ((s.length > 2) && s[0].length)
        if ((s[0].length > 2) && (s[0].startsWith('./')))
          Pane.open(p.dir + s[0].slice(2), s[1])
        else
          Pane.open(p.dir + s[0], [ 1 ])
    }
  }

  function searchFiles
  (needle) {
    let p

    p = Pane.current()
    if (needle && needle.length) {
      hist.add(needle)
      // find . -type f -not -name \*.BAK -not -name \*.CKP -not -name \*~ -maxdepth 1 2>/dev/null | xargs grep --ignore-case --fixed-strings --line-number "$1" -H -I 2>/dev/null # -I -e -H 2>/dev/null
      Shell.spawn1(Loc.appDir().join('bin/sr'), 1, 1, [ needle, p.buf.opt('core.search.files.recurse') ? '1' : '0' ], 0, b => {
        b.mode = 'sr'
        b.addMode('view')
      })
    }
    else if (typeof needle === 'string')
      Mess.say('Empty')
    else
      Mess.say('Error')
  }

  function search
  () {
    Prompt.ask({ text: 'Search files',
                 hist: hist },
               searchFiles)
  }

  hist = Hist.ensure('search files')

  moSr = Mode.add('Sr', { viewInit: Ed.viewInit,
                          viewInitSpec: Ed.viewInitSpec,
                          initFns: Ed.initModeFns,
                          parentsForEm: 'ed',
                          decorators: [ { regex: /^([^:]+:[0-9]+:).*$/d,
                                          decor: [ { attr: { style: 'color: var(--clr-emph-light); --background-color: var(--clr-fill);',
                                                             class: 'bred-bg',
                                                             'data-run': 'select' } } ] } ] })

  Cmd.add('select', () => follow(), moSr)
  Cmd.add('select in other pane', () => follow(1), moSr)

  Em.on('Enter', 'select', moSr)
  Em.on('o', 'select in other pane', moSr)

  Cmd.add('search files', () => search())
}

export
function getMarked
(b) {
  let marked

  marked = b.vars('dir').marked || new Set()
  b.vars('dir').marked = marked
  return marked
}

export
function init
() {
  let m

  function current
  (p) {
    p = p || Pane.current()
    return p?.view?.point?.over()
  }

  function abs
  (to, dir) {
    if (to.startsWith('/'))
      return to
    return Loc.make(dir).join(to)
  }

  function chmod
  () {
    let p, el, path

    function run
    (mode, dir) {
      let absPath

      absPath = abs(path, dir)
      Tron.cmd('file.chmod', [ mode, absPath ], err => {
        if (err) {
          Mess.yell('file.chmod: ' + err.message)
          return
        }
        Mess.say('Mode changed')
      })
    }

    p = Pane.current()
    if (getMarked(p.buf).size) {
      Mess.throw('Clear marks first')
      return
    }

    el = current()
    if (el && el.dataset.path)
      path = el.dataset.name ?? el.dataset.path
    else {
      Mess.say('Move to a file first')
      return
    }

    Prompt.ask({ text: 'Update mode for ' + path },
               mode => run(mode, p.dir))
  }

  function del
  () {
    let p, el

    p = Pane.current()
    el = current(p)
    if (el && el.dataset.path) {
      let msg, dir

      dir = el.dataset.type == 'd'
      msg = div([ 'Delete ' + (dir ? 'dir' : 'file') + ' ',
                  span(el.dataset.path, 'bold'), '?' ])
      Prompt.yn(msg, 'trash', yes =>
        yes && Tron.cmd(dir ? 'dir.rm' : 'file.rm', [ el.dataset.path ], err => {
          if (err) {
            Mess.yell('Error deleting: ' + err.message)
            return
          }
          Mess.say('Deleted ' + (dir ? 'dir' : 'file') + ' ' + el.dataset.path)
          refreshKeep(p)
        }))
    }
    else
      Mess.say('Move to a file first')
  }

  function link
  () {
    let p, el, target

    function run
    (from, target, dir) {
      let absTarget

      absTarget = abs(target, dir)
      Tron.cmd('file.ln', [ absTarget, from ], (err, data) => {
        Mess.log('file.ln:  ' + data.from + ' ⎘ ' + data.target + ' in ' + data.cwd)
        Mess.log('file.ln: (' + data.absFrom + ' ⎘ ' + data.absTarget + ')')
        if (err) {
          Mess.yell('file.ln: ' + err.message)
          return
        }
        Mess.say(from + ' ⮜⮞ ' + target)
      })
    }

    p = Pane.current()
    if (getMarked(p.buf).size) {
      Mess.throw('Clear marks first')
      return
    }

    el = current()
    if (el && el.dataset.path)
      target = el.dataset.name ?? el.dataset.path
    else {
      Mess.say('Move to a file first')
      return
    }

    Prompt.ask({ text: 'Link from:' },
               name => run(name, target, p.dir))
  }

  function copy
  () {
    let p, marked, files, dir

    function run
    (from, to, dir) {

      function ok
      () {
        Tron.cmd('file.cp', [ from, to ], err => {
          if (err) {
            Mess.yell('file.cp: ' + err.message)
            return
          }
          Mess.say(from + ' ⧉⮞ ' + to)
        })
      }

      function confirm
      () {
        Prompt.yn('File exists. Overwrite?',
                  'warning',
                  yes => yes && ok())
      }

      to = abs(to, dir)
      from = abs(from, dir)
      Tron.cmd('file.stat', to, (err, data) => {
        if (err)
          if (err.code == 'ENOENT')
            // new file
            ok()
          else
            Mess.toss('file.stat: ' + err.message)
        else
          // dest exists
          if (data.data.mode & (1 << 15))
            // dest is file
            confirm()
          else {
            // dest is dir, cp file into that dir
            to = Loc.make(to).join(Loc.make(from).filename)
            Tron.cmd('file.stat', to, err => {
              if (err)
                if (err.code == 'ENOENT')
                  // new file
                  ok()
                else
                  Mess.toss('file.stat: ' + err.message)
              else
                confirm()
            })
          }
      })
    }

    p = Pane.current()
    marked = getMarked(p.buf)
    dir = Loc.make(p.dir).ensureSlash()
    if (marked.size) {
      files = [ ...marked ].map(f => Loc.make(dir).join(f))
      d({ files })
      Mess.yell('FIX marked')
      return
    }
    else {
      let el, file

      el = current()
      if (el && el.dataset.path)
        file = el.dataset.path
      else {
        Mess.say('Move to a file first')
        return
      }

      d({ file })
      Prompt.ask({ text: 'Copy to:' },
                 name => run(file, name, p.dir))
    }
  }

  function rename
  () {
    let p, marked, files, dir

    function run
    (from, to, dir) {
      d('run from: ' + from)
      to = abs(to, dir)
      from = abs(from, dir)
      Tron.cmd('file.mv', [ from, to ], err => {
        if (err) {
          Mess.yell('file.mv: ' + err.message)
          return
        }
        Mess.say(from + ' ⮞ ' + to)
      })
    }

    p = Pane.current()
    marked = getMarked(p.buf)
    dir = Loc.make(p.dir).ensureSlash()
    if (marked.size) {
      files = [ ...marked ].map(f => Loc.make(dir).join(f))
      d({ files })
      Mess.yell('FIX marked')
      return
    }
    else {
      let el, file

      el = current()
      if (el && el.dataset.path)
        file = el.dataset.path
      else {
        Mess.say('Move to a file first')
        return
      }

      d({ file })
      Prompt.ask({ text: 'Rename to:' },
                 name => run(file, name, p.dir))
    }
  }

  function touch
  () {
    let p, marked, files, dir

    p = Pane.current()
    marked = getMarked(p.buf)
    dir = Loc.make(p.dir).ensureSlash()
    if (marked.size)
      files = [ ...marked ].map(f => Loc.make(dir).join(f))
    else {
      let el

      el = current(p)
      if (el && el.dataset.path)
        files = [ el.dataset.path ]
      else {
        Mess.say('Move to a file first')
        return
      }
    }
    Tron.cmd('file.touch', files, err => {
      if (err) {
        Mess.yell('Error touching: ' + err.message)
        return
      }
      if (files.length > 1)
        Mess.say('Touched files')
      else
        Mess.say('Touched file ' + files[0])
      refreshKeep(p)
    })
  }

  function scof
  () {
    let el

    el = current()
    if (el && el.dataset.path)
      Scib.scib(pane => {
        pane.view.buf.append(' ' + el.dataset.path)
        //pane.view.point.bufStart() // two points
        Cmd.runMo('buffer start', 'Ed', 1)
      })
    else
      Mess.say('Move to a file first')
  }

  function mark
  (u, we, remove) {
    let next, set

    if (Css.has(we?.e?.target, 'dir-mark')) {
      // clicked the mark checkbox
      next = we.e.target
      set = Css.toggle
    }
    else {
      let start

      // pressed m
      start = current()
      next = start
      while (next) {
        if (Css.has(next, 'dir-name'))
          next = next.parentNode
        if (Css.has(next, 'dir-mark'))
          break
        next = next.previousElementSibling
      }
      set = remove ? Css.remove : Css.add
      // mv to next line
      while (start) {
        if (Css.has(start, 'dir-name'))
          start = start.parentNode
        start = start.nextElementSibling
        if (Css.has(start, 'dir-name-w')) {
          Pane.current().view.point.put(start.firstElementChild)
          break
        }
      }
    }

    if (next)
      while (next) {
        set(next, 'on')
        if (Css.has(next, 'dir-name-w')) {
          let marked

          marked = getMarked(Pane.current().buf)
          if (Css.has(next, 'on'))
            marked.add(next.firstElementChild.dataset.name)
          else
            marked.delete(next.firstElementChild.dataset.name)
          break
        }
        next = next.nextElementSibling
      }
    else
      Mess.yell('Move to a file line first')
  }

  function firstLine
  (v) {
    v.point.put(v.ele.querySelector('.dir-name'))
  }

  function nextLine
  () {
    let h, el, v

    v = Pane.current().view
    h = v.ele.querySelector('.dir-h')
    if (v.point.over(h)) {
      firstLine(v)
      return
    }
    el = v.point.over()
    if (el) {
      el = el.parentNode
      while ((el = el.nextElementSibling))
        if (Css.has(el.firstElementChild, 'dir-name')) {
          v.point.put(el.firstElementChild)
          return
        }

    }
    else
      firstLine(v)
  }

  function other
  () {
    let el

    el = current()
    if (el && el.dataset.path)
      Pane.nextOrSplit().open(el.dataset.path)
    else
      Mess.say('Move to a file first')
  }

  function toggle
  () {
    let p, old, marked, lines

    // toggle marks in lines,marked
    p = Pane.current()
    old = getMarked(p.buf)
    marked = new Set()
    lines = p.buf.vars('dir').lines
    lines.forEach(line => {
      let name

      name = line.at(-1).firstElementChild?.dataset.name
      if (old.has(name)) {
        line.forEach(cell => Css.remove(cell, 'on'))
        return
      }
      line.forEach(cell => Css.add(cell, 'on'))
      marked.add(name)
    })
    p.buf.vars('dir').marked = marked

    // refresh views
    remark(p.buf, marked)
  }

  function clearViews
  (buf) {
    buf.views.forEach(v => {
      let w

      w = v.ele.querySelector('.dir-w')
      for (let i = 0; i < w.children.length; i++)
        Css.remove(w.children[i], 'on')
    })
  }

  function remark
  (buf, marked) {
    clearViews(buf)

    buf.views.forEach(view => {
      let w, on

      w = view.ele.querySelector('.dir-w')
      on = 0
      for (let i = 0; i < w.children.length; i++) {
        if (Css.has(w.children[i], 'dir-mark'))
          on = marked.has(w.children[i].dataset.nameonmark)
        on && Css.add(w.children[i], 'on')
      }
    })
  }

  function clear
  () {
    let p

    p = Pane.current()
    p.buf.vars('dir').marked = new Set()
    clearViews(p.buf)
  }

  function view
  () {
    let el, p

    p = Pane.current()
    el = current()
    if (el && el.dataset.path)
      Shell.run(0, p.dir, 'xdg-open', 0, 0, [ el.dataset.path ], 0)
    else
      Mess.say('Move to a file first')
  }

  watching = new Set()

  m = Mode.add('Dir')

  Cmd.add('chmod', () => chmod(), m)
  Cmd.add('clear marks', () => clear(), m)
  Cmd.add('copy file', () => copy(), m)
  Cmd.add('delete', () => del(), m)
  Cmd.add('link', () => link(), m)
  Cmd.add('mark', mark, m)
  Cmd.add('refresh', () => refreshKeep(Pane.current()), m)
  Cmd.add('rename', () => rename(), m)
  Cmd.add('sort by name', () => sortBy('name'), m)
  Cmd.add('sort by size', () => sortBy('size'), m)
  Cmd.add('sort by time', () => sortBy('time'), m)
  Cmd.add('shell command on file', () => scof(), m)
  Cmd.add('show backups', () => showBak(), m)
  Cmd.add('show hidden', () => showHid(), m)
  Cmd.add('toggle marks', () => toggle(), m)
  Cmd.add('touch', () => touch(), m)
  Cmd.add('unmark', (u, we) => mark(u, we, 1), m)
  Cmd.add('up', () => up(), m)
  Cmd.add('view', () => view(), m)

  Em.on('c', 'copy file', 'Dir')
  Em.on('d', 'delete', 'Dir')
  Em.on('g', 'refresh', 'Dir')
  Em.on('l', 'link', 'Dir')
  Em.on('m', 'mark', 'Dir')
  Em.on('M', 'chmod', 'Dir')
  Em.on('n', 'next line', 'Dir')
  Em.on('o', 'open in other pane', 'Dir')
  Em.on('p', 'previous line', 'Dir')
  Em.on('q', 'bury', 'Dir')
  Em.on('r', 'rename', 'Dir')
  Em.on('t', 'toggle marks', 'Dir')
  Em.on('u', 'unmark', 'Dir')
  Em.on('v', 'view', 'Dir')
  Em.on('D', 'delete', 'Dir')
  Em.on('T', 'touch', 'Dir')
  Em.on('U', 'clear marks', 'Dir')
  Em.on('^', 'up', 'Dir')
  Em.on('!', 'shell command on file', 'Dir')
  Em.on('+', 'make dir', 'Dir')

  Em.on('s b', 'show backups', 'Dir')
  Em.on('s h', 'show hidden', 'Dir')
  Em.on('s n', 'sort by name', 'Dir')
  Em.on('s s', 'sort by size', 'Dir')
  Em.on('s t', 'sort by time', 'Dir')

  Cmd.add('next line', () => nextLine(), m)
  Cmd.add('open in other pane', () => other(), m)

  Cmd.add('home', () => add(Pane.current(), ':'))
  Cmd.add('root', () => add(Pane.current(), '/'))

  initSearchFiles()
}
