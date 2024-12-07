import { divCl, button } from './dom.mjs'

import * as Cmd from './cmd.mjs'
import * as Dom from './dom.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Loc from './loc.mjs'
import Mk from './mk.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Opt from './opt.mjs'
import * as Pane from './pane.mjs'
import * as Tron from './tron.mjs'
import * as View from './view.mjs'
import * as Win from './win.mjs'
import { d } from './mess.mjs'

let divExts

export
function shared
() {
  return Win.shared().buf
}

export
function getRing
() {
  return shared().ring
}

export
function capitalize
(string) {
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase()
}

export
function prepDir
(dir) {
  if (dir) {
    dir = Loc.make(dir)

    if (dir.needsDotExpand())
      Mess.toss('. expansion is hard')

    dir.ensureSlash()
    dir.expand()

    if (dir.isRelative())
      Mess.toss('Absolute path required')

    if (dir.length)
      return dir.path

  }
  return Mess.toss('dir required')
}

export
function savePoss
() {
  forEach(b => {
    if ((b.fileType == 'file') && b.file) {
      let v, pos

      v = b.views.find(v2 => v2.ele)
      pos = v.pos
      Tron.cmd1('brood.set', [ 'poss', b.path, { row: Ed.posRow(pos), col: Ed.posCol(pos) } ], err => {
        if (err)
          Mess.warn('Failed to save pos of ' + b.path + ': ' + err.message)
      })
    }
  })
}

export
function make
(name, modeName, content, dir, file) {
  return make2({ name: name,
                 modeName: modeName,
                 content: content,
                 dir: dir,
                 file: file })
}

export
function make2
(spec = {}) { // { ..., placeholder, vars }
  let { name, modeName, content, dir, file } = spec
  let b, mode, modeVars, views, vid, fileType, icon, onRemoves, modifiedOnDisk

  function remove
  () {
    let sh, id, buf

    id = Pane.current().buf?.id
    sh = shared()
    sh.buffers.removeIf(e => e === b)
    sh.ring.removeIf(e => e === b)
    buf = top()
    Pane.forEach(p2 => {
      if (p2.buf && (p2.buf.id == id))
        p2.setBuf(buf)
    })
    onRemoves.forEach(cb => cb(b))
  }

  function setMode
  (key) {
    let mo

    d('buf.setMode')
    mo = Mode.getOrAdd(key)
    if (mo) {
      mode?.stop(b)
      mode = mo
      if (mode.seize)
        mode.seize(b)
      mode.start(b)
    }
    else
      Mess.warn('setMode: missing ' + key)
  }

  function getMo
  (modeOrKey) {
    let mo

    if (typeof modeOrKey == 'string') {
      modeOrKey = modeOrKey.toLowerCase()
      mo = Mode.get(modeOrKey)
      mo || Mess.say('addMode: missing ' + modeOrKey)
    }
    else
      mo = modeOrKey
    return mo
  }

  // add minor mode
  function addMode
  (modeOrKey) {
    let mo

    mo = getMo(modeOrKey)
    if (mo) {
      if (b.minors.find(m => m == mo))
        return
      b.minors.push(mo)
      mo.start(b)
    }
  }

  // toggle minor mode
  function toggleMode
  (modeOrKey) {
    let mo

    mo = getMo(modeOrKey)
    if (mo) {
      if (b.minors.find(m => m == mo)) {
        b.minors.removeIf(m => m === mo)
        mo.stop(b)
        return 0
      }
      b.minors.push(mo)
      mo.start(b)
      return 1
    }
    return 0
  }

  function bury
  () {
    let i, sh

    sh = shared()
    i = sh.ring.findIndex(b2 => b2.id == b.id)
    if (i > -1)
      sh.ring.push(sh.ring.splice(i, 1)[0])
  }

  function clear
  () {
    if (b.mode?.key)
      if (b.mode?.clear)
        return b.mode.clear(b)
    b.content = 0
    return 0
  }

  function clearLine
  () {
    if (b.mode?.key) {
      if (b.mode?.clearLine)
        return b.mode.clearLine(b)
      Mess.say('buf.add: clearLine missing: ' + b.mode.key)
    }
    b.content = 0
    return 0
  }

  function line
  (n) {
    if (b.mode?.key)
      if (b.mode?.line) {
        let view

        view = anyView()
        if (view)
          return b.mode.line(view, n)
        return 0
      }

    Mess.say('buf.add: line missing: ' + b.mode.key)
    return 0
  }

  function append
  (str, afterEndPoint) {
    if (b.mode?.append)
      return b.mode.append(b, str, afterEndPoint)
    Mess.toss('buf.add: append missing')
    return 0
  }

  function insert
  (str, bep, afterEndPoint) {
    if (b.mode?.insert)
      return b.mode.insert(b, str, bep, afterEndPoint)
    Mess.toss('buf.add: insert missing')
    return 0
  }

  // turn off event handler
  function off
  (name, cb) {
    if (b.mode?.off)
      b.mode.off(b, name, cb)
    else
      Mess.say('buf.add: off missing: ' + b.mode.key)
  }

  // on event name do cb
  function on
  (name, cb) {
    if (b.mode?.on)
      b.mode.on(b, name, cb)
    else
      Mess.say('buf.add: on missing: ' + b.mode.key)
  }

  function reconf
  () {
    // reconf all the 'div' extensions for this buf so they're initialised for the view
    divExts.forEach(dext => {
      0 && d('dext ' + dext.name)
      dext?.reconf(b)
    })
  }

  function save
  (cb) {
    if (b.mode?.key) {
      if (b.mode?.save)
        return b.mode.save(b, cb)
      Mess.say('buf.add: save missing: ' + b.mode.key)
    }
    return 0
  }

  function text
  () {
    let v

    v = b.views.find(v2 => v2.ele) || Mess.toss('view missing')
    if (b.mode?.text)
      return b.mode.text(v)
    Mess.toss('buf.add: text missing: ' + b.mode.key)
    return 0
  }

  function vars
  (modeName) {
    if (modeName) {
      modeName = modeName.toLowerCase()
      modeVars[modeName] = modeVars[modeName] || {}
      return modeVars[modeName]
    }
    return modeVars
  }

  function getDir
  () {
    if (fileType == 'dir') {
      let loc

      loc = Loc.make(dir)
      loc.join(file)
      loc.ensureSlash()
      return loc.path
    }
    return dir
  }

  function setDir
  (d) {
    dir = prepDir(d)
    //D("set dir of buff " + b.name + " to " + dir)
    return dir
  }

  function syntaxTreeStr
  () {
    if (b.mode?.key) {
      if (b.mode?.syntaxTreeStr)
        return b.mode.syntaxTreeStr(b)
      Mess.say('buf.add: syntaxTreeStr missing: ' + b.mode.key)
    }
    return 0
  }

  function opt
  (name) {
    let val

    val = b.opts.get(name)
    //d('BUF.OPT ' + name + ' VAL: ' + val)
    if (val === undefined)
      return Opt.get(name)
    //d('BUF.OPT ' + name + ' VAL 2: ' + val)
    return val
  }

  function anyView
  () {
    return b.views.find(view => view.ready && view.ele)
  }

  if (name) {
    let old, suffix, sh

    sh = shared()
    suffix = 1
    old = name
    while (sh.buffers.find(b => b.name == name))
      name = old + '<' + suffix++ + '>'
  }

  modeVars = spec.vars || {}
  views = []
  vid = 1
  onRemoves = []

  mode = Mode.getOrAdd(modeName)

  let ml

  {
    function set
    (name, co) {
      b.views.forEach(view => {
        if (view.ele) {
          let line

          line = view.ele.querySelector('.ml')
          if (line) {
            let field

            field = line.querySelector('.ml-' + name)
            if (field) {
              field.innerHTML = ''
              Dom.append(field, co)
            }
          }
        }
      })
    }

    ml = { set: set }
  }

  b = { id: shared().id,
        vid: vid,
        //
        co: content,
        minors: Mk.array,
        modified: 0,
        name: name,
        ml: ml,
        //
        get dir() {
          return getDir()
        },
        get file() {
          return file
        },
        get fileType() {
          return fileType || 'file'
        },
        get icon() {
          return icon
        },
        get mode() {
          return mode
        },
        get modifiedOnDisk() {
          return modifiedOnDisk
        },
        get path() {
          return dir ? (dir + (file || '')) : file
        },
        get placeholder() {
          return spec.placeholder
        },
        get syntaxTreeStr() {
          return syntaxTreeStr(b)
        },
        get views() {
          return views
        },
        //
        set content(content) {
          b.co = content
          b.views.forEach(v => v.content = (content ? content.cloneNode(1) : content))
        },
        set dir(d) {
          return setDir(d)
        },
        set file(f) {
          return file = Loc.make(f).removeSlash()
        },
        set fileType(t) {
          return fileType = t
        },
        set icon(name) {
          return icon = name
        },
        set mode(key) {
          setMode(key)
        },
        set modifiedOnDisk(val) {
          d('modifiedOnDisk: ' + val)
          modifiedOnDisk = val ? 1 : 0
          if (modifiedOnDisk)
            b.views.forEach(view => {
              let ww

              if (view.ele?.querySelector('.bred-info-w.bred-info-disk'))
                return
              ww = view.ele?.querySelector('.bred-info-ww')
              if (ww)
                Dom.append(ww,
                           divCl('bred-info-w bred-info-disk',
                                 [ divCl('bred-info-marker'),
                                   'Buffer modified on disk',
                                   button('Revert', '', { 'data-run': 'Revert Buffer' }),
                                   button('Overwrite', '', { 'data-run': 'Save' }) ]))
            })
          else
            b.views.forEach(view => {
              view.ele?.querySelectorAll('.bred-info-w.bred-info-disk').forEach(w => w.remove())
            })
        },
        //
        addMode,
        append,
        anyView,
        bury,
        clear,
        clearLine,
        line,
        remove,
        insert,
        off,
        on,
        onRemove(cb) {
          onRemoves.push(cb)
        },
        opt,
        reconf,
        save,
        text,
        toggleMode,
        vars,
        view }

  b.opts = Opt.buf(b)
  b.dir = dir

  shared().id = shared().id + 1
  return b
}

export
function add2
(name, modeName, content, dir, spec) { // { file, lineNum, vars }
  let b, sh

  b = make2({ name: name,
              modeName: modeName,
              content: content,
              dir: dir,
              file: spec.file,
              lineNum: spec.lineNum,
              vars: spec.vars })
  sh = shared()
  sh.buffers.push(b)
  shared().ring.unshift(b)
  return b
}

export
function add
(name, modeName, content, dir, file, lineNum) {
  return add2(name, modeName, content, dir, { file: file, lineNum: lineNum })
}

// move buf to top of ring
export
function queue
(buf) {
  let i, sh

  sh = shared()
  i = sh.ring.findIndex(b2 => b2.id == buf.id)
  if (i > -1)
    sh.ring.unshift(sh.ring.splice(i, 1)[0])
}

export
function top
(buf) {
  let sh

  sh = shared()
  if (sh.ring.length == 1)
    return sh.ring[0]
  if (buf && (sh.ring[0].id == buf.id))
    return sh.ring[1]
  return sh.ring[0]
}

export
function after
(buf) {
  let i, sh

  sh = shared()
  i = sh.ring.indexOf(b => b.id == buf.id)
  if ((i == -1)
      || (i >= sh.ring.length))
    return sh.ring[0]
  return sh.ring[i + 1]
}

export
function clear
(buf) {
  buf.co.remove()
  buf.co = undefined
  Pane.clearBuf(buf)
}

export
function find
(fn) { // (b)
  return shared().buffers.find(fn)
}

export
function map
(fn) { // (b)
  return shared().buffers.map(fn)
}

export
function filter
(fn) { // (b)
  return shared().buffers.filter(fn)
}

export
function forEach
(fn) { // (b)
  return shared().buffers.forEach(fn)
}

export
function init
() {
  let mo

  divExts = Mk.array

  function divW
  () {
    return divCl('buffers-ww', divCl('buffers-w bred-surface', ''))
  }

  function open
  (u, we) {
    let b

    b = we.e.target.dataset.id && find(b => b.id == we.e.target.dataset.id)
    if (b)
      Pane.current().setBuf(b)
    else
      Mess.say('Missing target ID')
  }

  function refresh
  (view) {
    let all

    all = shared().ring
    if (all.length > 1) {
      let bufs

      bufs = all[0]
      all = all.slice(1)
      all.push(bufs)
    }

    view.ele.firstElementChild.firstElementChild.innerHTML = ''
    Dom.append(view.ele.firstElementChild.firstElementChild,
               all.map(b => [ divCl('buffers-id', b.id),
                              divCl('buffers-mode', b.mode.name),
                              divCl('buffers-name',
                                    b.name,
                                    { 'data-id': b.id,
                                      'data-run': 'open buffer' }),
                              divCl('buffers-path', b.path) ]))
  }

  if (Win.root())
    Win.shared().buf = { buffers: Mk.array,
                         ring: Mk.array,
                         id: 1 }

  mo = Mode.add('Buffers', { viewInit: refresh })

  Cmd.add('buffers', () => {
    let p, bBuffers

    // ERR mode is from root globalThis  eg Buffers in root then in child, child missing mode
    bBuffers = shared().bBuffers
    p = Pane.current()
    if (bBuffers)
      p.setBuf(bBuffers, {}, view => refresh(view))
    else {
      bBuffers = add('Buffers', 'Buffers', divW(), p.dir)
      shared().bBuffers = bBuffers
      bBuffers.icon = 'list'
      bBuffers.addMode('view')
      p.setBuf(bBuffers)
    }
  })
  Em.on('C-x A-b', 'buffers')

  Cmd.add('open buffer', open, mo)
  Cmd.add('refresh', () => refresh(Pane.current().view), mo)

  Em.on('g', 'refresh', mo)
}

// was inside buf, but then runs in globalThis of buf
export
function view
(buf,
 spec, // { ele /* pane element */, elePoint, lineNum, whenReady /* FIX called when file loaded */ }
 cb) { // called when buf ready to use
  let mode, v

  buf.vid++
  mode = Mode.get(buf.mode?.key) // want the one in current globalThis
  v = View.make(buf,
                { vid: buf.vid,
                  mode: mode,
                  views: buf.views,
                  ele: spec.ele,
                  elePoint: spec.elePoint,
                  lineNum: spec.lineNum,
                  whenReady: spec.whenReady },
                cb)
  return v
}

export
function print
() {
  d('-- BUFS')
  shared().buffers.forEach(buf => {
    d('-- VIEWS in buf ' + buf.id + ' ' + buf.name)
    buf.views?.forEach(view => d('-- ' + view.vid + ', ele: ' + view.ele.innerHTML))
  })
  d('-- end')
}

// like Ed.register, but for div bufs
export
function register
(spec) {
  if (spec.reconf)
    spec.reconfOpts?.forEach(name => {
      // these will just listen forever, which is ok
      Opt.onSet(name, () => forEach(buf => spec.reconf(buf, name)))
      Opt.onSetBuf(name, buf => spec.reconf(buf, name))
      // reconfigure the opt on all bufs, in case any other extensions use the opt
      forEach(buf => spec.reconf(buf, name))
    })
  divExts.push(spec)
}
