import { button, div, divCl, span, img } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as DirCommon from './dir-common.mjs'
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
import * as Recent from './recent.mjs'
import * as Scroll from './scroll.mjs'
import * as Tron from './tron.mjs'
import * as U from './util.mjs'
import * as DirMarked from './dir-marked.mjs'
import * as DirOps from './dir-ops.mjs'
import { d } from './mess.mjs'

let watching, hist

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

function divW
(path) {
  let hco

  hco = []

  hco.push([ divCl('edMl-type',
                   img(Icon.modePath('dir'), 'Dir', 'filter-clr-text')) ])

  hco.push(nav(path))

  hco.push(button(img('img/tick.svg', 'clear', 'filter-clr-text'),
                  'dir-h-clear hidden',
                  { 'data-run': 'clear marks' }))

  return divCl('dir-ww',
               [ divCl('dir-h', hco),
                 divCl('dir-w bred-surface') ],
               { 'data-path': path })
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

function put
(v, el) {
  if (el) {
    v.point.put(el)
    v.buf.vars('dir').current = el
  }
}

function putByIndex
(v, idx) {
  let lines, scroll, el, path, surf

  lines = v.buf.vars('dir').lines
  if ((idx < 0) || (idx >= lines.length))
    return
  scroll = v.vars('dir').scroll
  path = lines[idx].at(-1).firstElementChild.dataset.path
  el = v.ele.querySelector('.dir-name[data-path="' + path + '"]')
  surf = v.ele.querySelector('.dir-w')
  if (el && (visible(el, surf))) {
    put(v, el)
    return
  }
  el = scroll.toIndex(idx)
  el = v.ele.querySelector('.dir-name[data-path="' + path + '"]')
  put(v, el)
}

function topLine
(v) {
  let all

  all = v.ele.querySelectorAll('.dir-name')
  if (all && all.length) {
    let surf

    surf = all[0].closest('.dir-w')
    for (let i = 0; i < all.length; i++)
      if (visible(all[i], surf)) {
        put(v, all[i])
        return
      }
  }
}

function lastVisibleLine
(v) {
  let all

  all = v.ele.querySelectorAll('.dir-name')
  if (all && all.length) {
    let surf, last

    surf = all[0].closest('.dir-w')
    for (let i = 0; i < all.length; i++)
      if (visible(all[i], surf))
        last = all[i]
    if (last)
      put(v, last)
  }
}

function visible
(el, surf) {
  if (el) {
    surf = surf || el.closest('.dir-w')
    if (surf) {
      let rsurf, rel

      rsurf = surf.getBoundingClientRect()
      rel = el.getBoundingClientRect()
      return (rel.bottom <= rsurf.bottom)
        && (rel.top >= rsurf.top)
    }
  }
}

function nextLine
(u) {
  let bw, h, v, lines, idx, over

  u = u || 1
  bw = u < 0
  u = Math.abs(u)
  v = Pane.current().view
  h = v.ele.querySelector('.dir-h')
  lines = v.buf.vars('dir').lines

  if (v.point.over(h)) {
    putByIndex(v, 0)
    return
  }

  over = v.point.over()
  idx = lines.findIndex(line => {
    let nameEl

    nameEl = line.at(-1).firstElementChild
    return nameEl.dataset.path == over.dataset.path
  })

  if (idx == -1) {
    if (bw)
      topLine(v)
    else
      lastVisibleLine(v)
    return
  }

  idx = Math.max(0, Math.min(idx + (bw ? -u : u), lines.length - 1))
  putByIndex(v, idx)
}

function nearestLine
(v) {
  let h, el

  h = v.ele.querySelector('.dir-h')
  if (v.point.over(h)) {
    //d('over')
    topLine(v)
    return
  }
  el = v.point.over()
  if (el
      // only search when inside the dir-w
      && el.closest('.dir-w')) {
    el = el.parentNode
    //d(el.className)
    do {
      if (Css.has(el.firstElementChild, 'dir-name')) {
        put(v, el.firstElementChild)
        if (visible (el))
          return
        nextLine()
        return
      }
      el = el.nextElementSibling
    }
    while (el)
  }
  topLine(v)
  return
}

function fill
(buf, bak, hid, sort, currentFile, marked) {
  let path

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
             divCl(on, f.user || f.stat?.uid),
             divCl(on, f.group || f.stat?.gid),
             divCl('dir-size' + on, f.stat ? size() : '?'),
             divCl('dir-date' + on, f.stat ? U.formatDate(new Date(f.stat.mtimeMs)) : '?'),
             divCl('dir-name-w' + on, name) ]
  }

  function redraw
  (view) {
    let lines, el, scroll

    lines = view.buf.vars('dir').lines
    el = view.buf.vars('dir').current
    scroll = view.vars('dir').scroll
    scroll.updateItemCount(lines.length)
    scroll.render()
    if (visible(el))
      put(view, el)
    else
      nearestLine(view)
  }

  function init
  (view) {
    let surf, scroll

    surf = view.ele.firstElementChild.firstElementChild.nextElementSibling // dir-ww > dir-h,dir-w

    if (view.vars('dir').scroll)
      view.vars('dir').scroll.destroy()

    scroll = Scroll.make(surf, { itemCount: view.buf.vars('dir').lines.length })
    scroll.renderItem = (el, i) => {
      el.style.display = 'grid'
      el.style.gridTemplateColumns = 'repeat(7, auto)'
      view.buf.vars('dir').lines[i].forEach(cell => el.append(cell.cloneNode(true)))
    }
    view.vars('dir').scroll = scroll
    scroll.onScroll = () => redraw(view)
    scroll.render()
  }

  ////

  d('DIR fill')

  marked = marked || DirMarked.make(buf)

  path = Loc.make(buf.dir)
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
    let co, lines, vars

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
    buf.vars('dir').lines = lines
    buf.vars('dir').marked = marked
    bak = bak ? 1 : 0
    buf.opts.set('dir.show.backups', bak)
    hid = hid ? 1 : 0
    buf.opts.set('dir.show.hidden', hid)
    buf.opts.set('dir.sort', sort)

    vars = buf.vars('dir')

    buf.views.forEach(v => {
      if (v.eleOrReserved) {
        let surf

        surf = v.eleOrReserved.querySelector('.dir-w')
        surf.innerHTML = ''
        if (lines.length == 0)
          surf.append(divCl('dir-empty', 'Empty directory'))
        surf.append(divCl('bred-gap', [], { style: 'height: calc(0 * var(--line-height));' }))
        surf.append(divCl('bred-gap', [], { style: 'height: calc(' + lines.length + ' * var(--line-height));' }))

        init(v)

        if (currentFile) {
          let el

          el = v.eleOrReserved.querySelector('.dir-name[data-name="' + currentFile + '"]')
          if (el)
            put(v, el)
        }
        else {
          let first

          first = v.eleOrReserved.querySelector('.dir-name')
          if (first)
            put(v, first)
        }
      }
    })

    vars.refreshing = 0
    if (vars.pendingRefresh?.length) {
      let pending

      pending = vars.pendingRefresh[0]
      vars.pendingRefresh = vars.pendingRefresh.slice(1)
      d('DIR fill pending refresh')
      refresh(pending.p, pending.bak, pending.hid, pending.sort, pending.marked, pending.file)
    }
  })
}

function watch
(path) {
  if (watching.has(path))
    return
  Tron.cmd1('dir.watch', [ path ], (err, ch) => {
    let off

    if (err) {
      Mess.log('watch failed on ' + path)
      watching.delete(path)
      return
    }

    off = Tron.on(ch, (err, data) => {
      let file, getFile

      // NB Beware of doing anything in here that modifies any dir being watched,
      //    eg logging in dir.get when --logfile, because that causes recursive
      //    behaviour.
      d('DIR 👀 watch ev')
      d({ data })
      getFile = 1
      Pane.forEach(pane => {
        if (pane.buf
            && (pane.buf.mode?.key == 'dir')
            && (pane.buf.path == path)) {
          if (pane.buf.vars('dir').refreshing) {
            // it's likely that the refresh that's in progress covers the change.
            // Also currentFile() could be wrong if the refresh in progress has
            // cleared the buf content.
            d('DIR watch skip')
            return
          }
          file = getFile && currentFile(pane)
          console.log('DIR FILE: ' + file)
          getFile = 0
          if (data.bak) {
            if (pane.buf.opt('dir.show.backups'))
              refreshKeep(pane, { file })
            return
          }
          if (data.hidden) {
            if (pane.buf.opt('dir.show.hidden'))
              refreshKeep(pane, { file })
            return
          }
          refreshKeep(pane, { file })
        }
      })
    })

    watching.set(path, off)
  })
}

function stopWatching
(path) {
  let off

  off = watching.get(path)
  if (off)
    off()
  watching.delete(path)
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

  Recent.add(dir.path, 'inode/directory')

  exist = Buf.find(b => (b.mode?.key == 'dir') && (b.dir == dir.path))
  if (exist) {
    exist.vars('dir').sort = sort
    exist.vars('dir').initialFile = initialFile
    exist.vars('dir').hist = hist
    p.setBuf(exist)
    return
  }

  if (dir.path.length > 1)
    dir.removeSlash()

  b = Buf.add(dir.filename, 'Dir', divW(dir.path), dir.dirname, { file: dir.filename })
  b.icon = Icon.mode('dir').name
  b.fileType = 'dir'
  b.addMode('view')
  b.vars('dir').sort = sort
  b.vars('dir').initialFile = initialFile
  b.vars('dir').hist = hist
  p.setBuf(b)
  b.onRemove(() => stopWatching(dir.path))
  watch(dir.path)
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
(p, bak, hid, sort, marked, file) {
  let vars

  d('DIR refresh')

  vars = p.buf.vars('dir')

  if (vars.refreshing) {
    d('DIR refresh pend')
    vars.pendingRefresh = vars.pendingRefresh || []
    vars.pendingRefresh.push({ p, bak, hid, sort, marked, file })
    return
  }

  d('DIR refresh go')

  vars.refreshing = 1

  if (p.dir && p.buf.file) {
    file = file || currentFile() // must run before clear
    // Clear it before the async file.get so that it flashes
    if (p.view.ele) {
      let surf

      surf = p.view.ele.querySelector('.dir-w')
      surf.innerHTML = ''
    }
    fill(p.buf, bak, hid, sort, file, marked)
  }
  else
    Mess.yell('Missing dir/file')
}

function refreshKeep
(p, spec) { // { bak, hid, sort, file }
  let marked

  spec = spec || {}
  spec.bak = spec.bak ?? p.buf.opt('dir.show.backups')
  spec.hid = spec.hid ?? p.buf.opt('dir.show.hidden')
  spec.sort = spec.sort ?? p.buf.opt('dir.sort')

  marked = DirCommon.getMarked(p.buf)
  refresh(p, spec.bak, spec.hid, spec.sort, marked, spec.file)
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
              { bak: p.buf.opt('dir.show.backups'),
                hid: p.buf.opt('dir.show.hidden'),
                sort: d })
}

function showBak
() {
  let p

  p = Pane.current()
  refreshKeep(p,
              { bak: p.buf.opt('dir.show.backups') ? 0 : 1,
                hid: p.buf.opt('dir.show.hidden'),
                sort: p.buf.opt('dir.sort') })
}

function showHid
() {
  let p

  p = Pane.current()
  refreshKeep(p,
              { bak: p.buf.opt('dir.show.backups'),
                hid: p.buf.opt('dir.show.hidden') ? 0 : 1,
                sort: p.buf.opt('dir.sort') })
}

function currentFile
(p) {
  return DirCommon.current(p)?.dataset.name
}

export
function init
() {
  let m

  function scrollBottom
  (top) {
    let p, el

    p = Pane.current()
    el = p.view.ele.querySelector('.bred-surface')
    if (el) {
      el.scroll(0, (top ? 0 : el.scrollHeight))
      if (top)
        topLine(p.view)
      else
        setTimeout(() => lastVisibleLine(p.view))
    }
  }

  function scrollDown
  (up) {
    let p, el

    p = Pane.current()
    el = p.view.ele.querySelector('.bred-surface')
    if (el)
      el.scrollBy(0, (el.clientHeight / 2) * (up ? -1 : 1))
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
      start = DirCommon.current()
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
          put(Pane.current().view, start.firstElementChild)
          break
        }
      }
    }

    if (next)
      while (next) {
        set(next, 'on')
        if (Css.has(next, 'dir-name-w')) {
          let marked

          marked = DirCommon.getMarked(Pane.current().buf)
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

  function prevLine
  (u) {
    u = u || 1
    nextLine(-u)
  }

  function toggle
  () {
    let p, old, marked, lines

    // toggle marks in lines,marked
    p = Pane.current()
    old = DirCommon.getMarked(p.buf)
    marked = DirMarked.make(p.buf)
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

      w = v.ele?.querySelector('.dir-w')
      if (w)
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
    p.buf.vars('dir').marked = DirMarked.make(p.buf)
    clearViews(p.buf)
  }

  function view
  () {
    let el

    el = DirCommon.current()
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

  watching = new Map()

  function viewInit(view, spec, cb) {
    d('DIR viewInit')
    let dirVars, sort, bak, hid, surf

    dirVars = view.buf.vars('dir')
    sort = dirVars.sort || Opt.get('dir.sort')
    bak = dirVars.bak ?? view.buf.opt('dir.show.backups')
    hid = dirVars.hid ?? view.buf.opt('dir.show.hidden')

    surf = view.ele.querySelector('.dir-w')
    surf.innerHTML = ''
    surf.append(divCl('bred-gap', [], { style: 'height: calc(0 * var(--line-height));' }))
    surf.append(divCl('bred-gap', [], { style: 'height: calc(0 * var(--line-height));' }))

    fill(view.buf, bak, hid, sort, dirVars.initialFile)

    if (cb)
      cb(view)
  }

  hist = Hist.ensure('dir')

  m = Mode.add('Dir', { viewInit })

  Opt.declare('dir.show.backups', 'bool', 0)
  Opt.declare('dir.show.hidden', 'bool', 0)
  Opt.declare('dir.sort', 'str', 'time-desc')

  Cmd.add('buffer start', () => scrollBottom(1), m)
  Cmd.add('buffer end', () => scrollBottom(), m)
  Cmd.add('clear marks', () => clear(), m)
  Cmd.add('mark', mark, m)
  Cmd.add('refresh', () => {
    let p

    p = Pane.current()
    refreshKeep(p, { file: currentFile(p) })
  }, m)
  Cmd.add('scroll down', () => scrollDown(), m)
  Cmd.add('scroll up', () => scrollDown(1), m)
  Cmd.add('sort by name', () => sortBy('name'), m)
  Cmd.add('sort by size', () => sortBy('size'), m)
  Cmd.add('sort by time', () => sortBy('time'), m)
  Cmd.add('show backups', () => showBak(), m)
  Cmd.add('show hidden', () => showHid(), m)
  Cmd.add('toggle marks', () => toggle(), m)
  Cmd.add('unmark', (u, we) => mark(u, we, 1), m)
  Cmd.add('up', () => up(), m)
  Cmd.add('view', () => view(), m)

  Em.on('g', 'refresh', 'Dir')
  Em.on('m', 'mark', 'Dir')
  Em.on('n', 'next line', 'Dir')
  Em.on('p', 'previous line', 'Dir')
  Em.on('q', 'bury', 'Dir')
  Em.on('t', 'toggle marks', 'Dir')
  Em.on('u', 'unmark', 'Dir')
  Em.on('v', 'view', 'Dir')
  Em.on('U', 'clear marks', 'Dir')
  Em.on('^', 'up', 'Dir')
  Em.on('Enter', 'select', 'Dir')
  Em.on('A-,', 'top of pane', 'Dir')
  Em.on('A-.', 'bottom of pane', 'Dir')

  Em.on('s b', 'show backups', 'Dir')
  Em.on('s h', 'show hidden', 'Dir')
  Em.on('s n', 'sort by name', 'Dir')
  Em.on('s s', 'sort by size', 'Dir')
  Em.on('s t', 'sort by time', 'Dir')

  Cmd.add('top of pane', () => topLine(Pane.current().view), m)
  Cmd.add('bottom of pane', () => lastVisibleLine(Pane.current().view), m)
  Cmd.add('next line', nextLine, m)
  Cmd.add('previous line', prevLine, m)

  Cmd.add('home', () => add(Pane.current(), ':'))
  Cmd.add('root', () => add(Pane.current(), '/'))

  DirOps.init(m)
}
