import { append, div, divCl, span, img } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Ext from './ext.mjs'
import * as Hist from './hist.mjs'
import * as Icon from './icon.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Opt from './opt.mjs'
import * as Pane from './pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Scib from './scib.mjs'
import * as Scroll from './scroll.mjs'
import * as Tron from './tron.mjs'
import { d } from './mess.mjs'

let Marked

Marked = {
  make() {
    let marked, items

    function add
    (name, type) {
      if (has(name))
        return
      items.push({ name, type })
    }

    function has
    (name) {
      return items.find(item => item.name == name)
    }

    function map
    (cb) {
      return items.map(item => cb && cb(item))
    }

    function rm
    (name) {
      items = items.filter(item => {
        if (item.name == name)
          return 0
        return 1
      })
    }

    items = []
    marked = { add,
               has,
               map,
               rm,
               //
               get length() {
                 return items.length
               } }

    return marked
  }
}

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
    let name, file, on, type

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

    ////

    if (f.stat)
      file = f.stat.mode & (1 << 15)
    else
      file = 1

    f.name = f.name || '???'

    type = f.stat?.link ? 'l' : (file ? 'f' : 'd')
    name = div(f.name + (file ? '' : '/'),
               'dir-name',
               { 'data-type': type,
                 'data-name': f.name,
                 'data-path': join(path, f.name) + (type == 'd' ? '/' : ''),
                 'data-run': 'open link' })

    on = marked.has(f.name) ? ' on' : ''

    return [ divCl('dir-mark' + on,
                   img('img/tick.svg', '*', 'filter-clr-text'),
                   { 'data-run': 'mark',
                     'data-nameonmark': f.name }),
             divCl('dir-mode' + on, printMode(f.stat),
                   { 'data-run': 'chmod' }),
             divCl(on, f.stat?.uid),
             divCl(on, f.stat?.gid),
             divCl('dir-size' + on, f.stat ? size() : '?'),
             divCl('dir-date' + on, f.stat ? formatDate(new Date(f.stat.mtimeMs)) : '?'),
             divCl('dir-name-w' + on, name) ]
  }

  function redraw
  (view) {
    let lines

    lines = view.buf.vars('dir').lines
    Scroll.redraw(view,
                  lines.length,
                  7,
                  (frag, i) => lines[i].forEach(cell => append(frag, cell)))
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
    let surf, first, frag, lines, shown, end

    lines = view.buf.vars('dir').lines
    surf = view.ele.firstElementChild.firstElementChild.nextElementSibling // dir-ww > dir-h,dir-w

    first = surf.firstElementChild
    frag = new globalThis.DocumentFragment()
    shown = Scroll.show(surf, lines.length)
    for (let i = 0; i < shown; i++)
      lines[i].forEach(cell => append(frag, cell))
    first.after(frag)

    end = surf.lastElementChild
    end.style.height = 'calc(' + (lines.length - shown) + ' * var(--line-height))'
    first.dataset.shown = shown

    surf.onscroll = e => onscroll(view, e)
  }

  ////

  d('DIR fill')

  marked = marked || Marked.make()

  path = Loc.make(p.dir)
  path.ensureSlash()

  sort = sort || Opt.get('dir.sort')
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
    p.buf.opts.set('dir.show.backups', bak)
    hid = hid ? 1 : 0
    p.buf.opts.set('dir.show.hidden', hid)
    p.buf.opts.set('dir.sort', sort)

    p.buf.content = dirW(path,
                         [ lines.length ? null : divCl('dir-empty', 'Empty directory'),
                           divCl('bred-gap', [], { style: 'height: calc(0 * var(--line-height));' }),
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
            if (pane.buf.opt('dir.show.backups'))
              refreshKeep(pane)
            return
          }
          if (data.hidden) {
            if (pane.buf.opt('dir.show.hidden'))
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
  let b, exist, sort

  dir = Loc.make(dir)
  dir.expand()
  dir.ensureSlash()

  if (p.buf.mode?.key == 'dir')
    sort = p.buf.opt('dir.sort')

  exist = Buf.find(b => (b.mode?.key == 'dir') && (b.dir == dir.path))
  if (exist) {
    p.setBuf(exist, {}, () => refreshKeep(p, undefined, undefined, sort, initialFile))
    return
  }

  if (dir.path.length > 1)
    dir.removeSlash()

  b = Buf.add(dir.filename, 'Dir', 0, dir.dirname, { file: dir.filename })
  b.icon = Icon.mode('dir').name
  b.fileType = 'dir'
  b.addMode('view')
  p.setBuf(b, {}, () => {
    fill(p, undefined, undefined, sort, initialFile)
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

  bak = bak ?? p.buf.opt('dir.show.backups')
  hid = hid ?? p.buf.opt('dir.show.hidden')
  sort = sort ?? p.buf.opt('dir.sort')

  marked = getMarked(p.buf)
  refresh(p, bak, hid, sort, marked, currentFile)
}

function sortBy
(d) {
  let p, sort

  p = Pane.current()
  sort = p.buf.opt('dir.sort')
  if (sort) {
    let ss

    ss = sort.split('-')
    if (d == ss[0])
      d = d + (ss[1] == 'asc' ? '-desc' : '-asc')
  }
  refreshKeep(p,
              p.buf.opt('dir.show.backups'),
              p.buf.opt('dir.show.hidden'),
              d)
}

function showBak
() {
  let p

  p = Pane.current()
  refreshKeep(p,
              p.buf.opt('dir.show.backups') ? 0 : 1,
              p.buf.opt('dir.show.hidden'),
              p.buf.opt('dir.sort'))
}

function showHid
() {
  let p

  p = Pane.current()
  refreshKeep(p,
              p.buf.opt('dir.show.backups'),
              p.buf.opt('dir.show.hidden') ? 0 : 1,
              p.buf.opt('dir.sort'))
}

export
function getMarked
(b) {
  let marked

  marked = b.vars('dir').marked || Marked.make()
  b.vars('dir').marked = marked
  return marked
}

function abs
(to, dir) {
  if (to.startsWith('/'))
    return to
  return Loc.make(dir).join(to)
}

function current
(p) {
  p = p || Pane.current()
  return p?.view?.point?.over()
}

function currentFile
() {
  let el

  el = current()
  return el?.dataset.name
}

function initChmod
(m) {
  let hist

  function chmodMarked
  (dir, marked) {
    let list

    list = under(dir, marked)
    Prompt.ask({ text: 'Update mode of these files',
                 hist: hist,
                 under: divCl('float-files', list.divs) },
               mode => {
                 hist.add(mode)
                 list.paths.forEach(item => {
                   let absPath

                   absPath = abs(item.path, dir)
                   Tron.cmd('file.chmod', [ mode, absPath ], err => {
                     if (err) {
                       Mess.yell('file.chmod: ' + err.message)
                       return
                     }
                   })
                 })
               })
  }

  function chmod
  (u, we) {
    let p, el, path, marked

    function run
    (mode, dir) {
      let absPath

      absPath = abs(path, dir)
      hist.add(mode)
      Tron.cmd('file.chmod', [ mode, absPath ], err => {
        if (err) {
          Mess.yell('file.chmod: ' + err.message)
          return
        }
        Mess.say('Mode changed')
      })
    }

    p = Pane.current()

    marked = getMarked(p.buf)
    if (marked.length) {
      chmodMarked(Loc.make(p.dir).ensureSlash(), marked)
      return
    }

    if (we?.e && (we.e.button == 0)) {
      let next

      next = we.e.target
      while (next) {
        if (Css.has(next, 'dir-name-w'))
          break
        next = next.nextElementSibling
      }
      if (next)
        p.view.point.put(next)
    }

    el = current()
    if (el && el.dataset.path)
      path = el.dataset.name ?? el.dataset.path
    else {
      Mess.say('Move to a file first')
      return
    }

    Prompt.ask({ text: 'Update mode of ' + path,
                 hist: hist },
               mode => run(mode, p.dir))
  }

  hist = Hist.ensure('dir.chmod')
  Cmd.add('chmod', chmod, m)
  Em.on('M', 'chmod', 'Dir')
}

function under
(dir, marked) {
  let divs, paths

  paths = []
  divs = marked.map(m => {
    let path

    path = Loc.make(dir).join(m.name)
    paths.push({ name: m.name, isDir: m.type == 'd', path: path })
    return [ divCl('float-f-name', m.name),
             divCl('float-f-path', path) ]
  })

  return { divs: divs, paths: paths }
}

export
function init
() {
  let m, hist

  function placeholder
  (p, from) {
    let next

    next = p.next
    if (next
        && (next.buf?.mode.key == 'dir'))
      return Loc.make(next.buf.path).join(Loc.make(from).filename)
  }

  function delMarked
  (dir, marked) {
    let list

    list = under(dir, marked)
    Prompt.yn('Delete these?',
              { icon: 'trash',
                under: divCl('float-files', list.divs) },
              yes => {
                if (yes)
                  list.paths.forEach(item =>
                    Tron.cmd(item.isDir ? 'dir.rm' : 'file.rm',
                             [ item.path ],
                             err => {
                               if (err) {
                                 Mess.yell('Error deleting: ' + err.message)
                                 return
                               }
                               marked.rm(item.name)
                             }))
              })
  }

  function del
  () {
    let p, el, marked

    p = Pane.current()

    marked = getMarked(p.buf)
    if (marked.length) {
      delMarked(Loc.make(p.dir).ensureSlash(), marked)
      return
    }
    el = current(p)
    if (el && el.dataset.path) {
      let msg, dir

      dir = el.dataset.type == 'd'
      msg = div([ 'Delete ' + (dir ? 'dir' : 'file') + ' ',
                  span(el.dataset.path, 'bold'), '?' ])
      Prompt.yn(msg, { icon: 'trash' }, yes =>
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
    if (getMarked(p.buf).length) {
      Mess.yell('Clear marks first')
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
        hist.add(to)
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
                  { icon: 'warning' },
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
    if (marked.length) {
      files = marked.map(m => Loc.make(dir).join(m.name))
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

      //d({ file })
      Prompt.ask({ text: 'Copy to:',
                   placeholder: placeholder(p, file),
                   hist: hist },
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
      hist.add(to)
      Tron.cmd('file.mv', [ from, to ], err => {
        if (err?.exists) {
          Prompt.yn('File exists. Overwrite?',
                    { icon: 'warning' },
                    yes => {
                      if (yes)
                        Tron.cmd('file.mv', [ from, to, { overwrite: 1 } ], err => {
                          if (err) {
                            Mess.yell('file.mv: ' + err.message)
                            return
                          }
                          Mess.say(from + ' ⮞ ' + to)
                        })
                    })
          return
        }
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
    if (marked.length) {
      files = marked.map(m => Loc.make(dir).join(m.name))
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
      Prompt.ask({ text: 'Rename to:',
                   placeholder: placeholder(p, file),
                   hist: hist },
                 name => run(file, name, p.dir))
    }
  }

  function touch
  () {
    let p, marked, files, dir

    p = Pane.current()
    marked = getMarked(p.buf)
    dir = Loc.make(p.dir).ensureSlash()
    if (marked.length)
      files = marked.map(m => Loc.make(dir).join(m.name))
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
            marked.add(next.firstElementChild.dataset.name,
                       next.firstElementChild.dataset.type)
          else
            marked.rm(next.firstElementChild.dataset.name)
          break
        }
        next = next.nextElementSibling
      }
    else
      Mess.yell('Move to a file line first')
  }

  function edit
  () {
    let el

    el = current()
    if (el && el.dataset.path)
      Pane.open(el.dataset.path)
    else
      Mess.say('Move to a file first')
  }

  function editIfSupported
  () {
    let el

    el = current()
    if (el && el.dataset.path) {
      if (el.dataset.type == 'd') {
        Pane.open(el.dataset.path)
        return
      }
      if (el.dataset.path.includes('.')) {
        let ext, mtype

        ext = el.dataset.path.slice(el.dataset.path.lastIndexOf('.') + 1)
        mtype = Ed.mtypeFromExt(ext)
        if (mtype && Ed.supports(mtype)) {
          Pane.open(el.dataset.path)
          return
        }
      }
      Tron.cmd('shell.open', [ 'file://' + el.dataset.path ], err => {
        if (err) {
          Mess.yell('shell.open: ' + err.message)
          return
        }
      })
    }
    else
      Mess.say('Move to a file first')
  }

  function firstLine
  (v) {
    //d('firstLine')
    v.point.put(v.ele.querySelector('.dir-name'))
  }

  function nextLine
  () {
    let h, el, v

    //d('nextLine')
    v = Pane.current().view
    h = v.ele.querySelector('.dir-h')
    if (v.point.over(h)) {
      //d('over')
      firstLine(v)
      return
    }
    el = v.point.over()
    if (el
        // only search when inside the dir-w
        && el.closest('.dir-w')) {
      el = el.parentNode
      //d(el.className)
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
    marked = Marked.make()
    lines = p.buf.vars('dir').lines
    lines.forEach(line => {
      let ch, name, type

      ch = line.at(-1).firstElementChild
      name = ch?.dataset.name
      type = ch?.dataset.type
      if (old.has(name)) {
        line.forEach(cell => Css.remove(cell, 'on'))
        return
      }
      line.forEach(cell => Css.add(cell, 'on'))
      marked.add(name, type)
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

  function showInFolder
  () {
    let el

    el = current()
    if (el && el.dataset.path)
      Tron.cmd('shell.show', [ 'file://' + el.dataset.path ], err => {
        if (err) {
          Mess.yell('shell.show: ' + err.message)
          return
        }
      })
    else
      Mess.say('Move to a file first')
  }

  function clear
  () {
    let p

    p = Pane.current()
    p.buf.vars('dir').marked = Marked.make()
    clearViews(p.buf)
  }

  function view
  () {
    let el

    el = current()
    if (el && el.dataset.path) {
      if (el.dataset.type == 'd') {
        Pane.open(el.dataset.path)
        return
      }
      if (el.dataset.path.includes('.')) {
        let ext, mtype

        ext = el.dataset.path.slice(el.dataset.path.lastIndexOf('.') + 1)
        mtype = Ed.mtypeFromExt(ext)
        if (mtype) {
          let rich

          rich = Ext.get('rich')
          if (rich && rich.supports(mtype)) {
            rich.open(el.dataset.path)
            return
          }
        }
        if (mtype && Ed.supports(mtype)) {
          Pane.open(el.dataset.path)
          return
        }
      }
      Tron.cmd('shell.open', [ 'file://' + el.dataset.path ], err => {
        if (err) {
          Mess.yell('shell.open: ' + err.message)
          return
        }
      })
    }
    else
      Mess.say('Move to a file first')
  }

  watching = new Set()

  hist = Hist.ensure('dir')

  m = Mode.add('Dir')

  Opt.declare('dir.show.backups', 'bool', 0)
  Opt.declare('dir.show.hidden', 'bool', 0)
  Opt.declare('dir.sort', 'str', 'time-desc')

  Cmd.add('clear marks', () => clear(), m)
  Cmd.add('copy file', () => copy(), m)
  Cmd.add('delete', () => del(), m)
  Cmd.add('edit', () => edit(), m)
  Cmd.add('edit if supported', () => editIfSupported(), m)
  Cmd.add('link', () => link(), m)
  Cmd.add('mark', mark, m)
  Cmd.add('refresh', () => refreshKeep(Pane.current(), 0, 0, 0, currentFile()), m)
  Cmd.add('rename', () => rename(), m)
  Cmd.add('show in folder', () => showInFolder(), m)
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
  Em.on('e', 'edit', 'Dir')
  Em.on('E', 'edit if supported', 'Dir')
  Em.on('f', 'show in folder', 'Dir')
  Em.on('g', 'refresh', 'Dir')
  Em.on('l', 'link', 'Dir')
  Em.on('m', 'mark', 'Dir')
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

  initChmod(m)
}
