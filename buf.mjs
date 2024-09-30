import { divCl } from './dom.mjs'

import * as Cmd from './cmd.mjs'
import * as Dom from './dom.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Opt from './opt.mjs'
import * as Pane from './pane.mjs'
import * as Tron from './tron.mjs'
import * as View from './view.mjs'
import { d } from './mess.mjs'

let buffers, ring, id

export
function getRing
() {
  return ring
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
  let b, mode, modeVars, views, vid, fileType, icon

  function remove
  () {
    buffers = buffers.filter(e => e !== b)
    ring = ring.filter(e => e !== b)
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

  function addExt
  (ext) {
    if (b.mode?.key
        && b.mode?.addExt)
      return b.mode.addExt(b, ext)
    return 0
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
        b.minors = b.minors.filter(m => m !== mo)
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
    let i

    i = ring.findIndex(b2 => b2.id == b.id)
    if (i > -1)
      ring.push(ring.splice(i, 1)[0])
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
  (p) {
    if (b.mode?.key)
      if (b.mode?.line)
        return b.mode.line(p)

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

  function removeExt
  (ext) {
    if (b.mode?.key
        && b.mode?.removeExt)
      return b.mode.removeExt(b, ext)
    return 0
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

  function view
  (ele, // pane element
   elePoint,
   lineNum,
   whenReady) {
    return View.make(b, vid++, mode, views, ele, elePoint, lineNum, whenReady)
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

  function setLang
  (id) {
    if (b.mode?.key) {
      if (b.mode?.setLang)
        return b.mode.setLang(b, id)
      Mess.say('buf.add: setLang missing: ' + b.mode.key)
    }
    return 0
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
    d('BUF.OPT ' + name + ' VAL: ' + val)
    if (val === undefined)
      return Opt.get(name)
    d('BUF.OPT ' + name + ' VAL 2: ' + val)
    return val
  }

  function anyView
  () {
    return b.views.find(view => view.ele)
  }

  if (name) {
    let old, suffix

    suffix = 1
    old = name
    while (buffers.find(b => b.name == name))
      name = old + '<' + suffix++ + '>'
  }

  modeVars = {}
  views = []
  vid = 1

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

  b = { id: id,
        //
        co: content,
        minors: [],
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
        get path() {
          return dir ? (dir + (file || '')) : file
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
        set lang(id) {
          return setLang(id)
        },
        set mode(key) {
          setMode(key)
        },
        //
        addExt,
        addMode,
        append,
        anyView,
        bury,
        clear,
        clearLine,
        line,
        remove,
        removeExt,
        insert,
        off,
        on,
        opt,
        save,
        text,
        toggleMode,
        vars,
        view }

  b.opts = Opt.buf(b)
  b.dir = dir

  id++
  return b
}

export
function add
(name, modeName, content, dir, file, lineNum) {
  let b

  b = make(name, modeName, content, dir, file, lineNum)
  buffers.push(b)
  ring.unshift(b)
  return b
}

// move buf to top of ring
export
function queue
(buf) {
  let i

  i = ring.findIndex(b2 => b2.id == buf.id)
  if (i > -1)
    ring.unshift(ring.splice(i, 1)[0])
}

export
function top
(buf) {
  if (ring.length == 1)
    return ring[0]
  if (buf && (ring[0].id == buf.id))
    return ring[1]
  return ring[0]
}

export
function after
(buf) {
  let i

  i = ring.indexOf(b => b.id == buf.id)
  if ((i == -1)
      || (i >= ring.length))
    return ring[0]
  return ring[i + 1]
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
  return buffers.find(fn)
}

export
function map
(fn) { // (b)
  return buffers.map(fn)
}

export
function filter
(fn) { // (b)
  return buffers.filter(fn)
}

export
function forEach
(fn) { // (b)
  return buffers.forEach(fn)
}

export
function init
() {
  let mo, bBuffers

  function divW
  () {
    return divCl('buffers-ww', divCl('buffers-w bred-surface', ''))
  }

  function open
  (u, we) {
    let b

    b = we.e.target.dataset.id && find(b => b.id == we.e.target.dataset.id)
    if (b)
      Pane.current().buf = b
    else
      Mess.say('Missing target ID')
  }

  function refresh
  (view) {
    let all

    all = ring
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

  buffers = []
  ring = []
  id = 1

  mo = Mode.add('Buffers', { viewInit: refresh })

  Cmd.add('buffers', () => {
    let p

    p = Pane.current()
    if (bBuffers) {
      p.buf = bBuffers
      refresh(p.view)
    }
    else {
      bBuffers = add('Buffers', 'Buffers', divW(), p.dir)
      bBuffers.icon = 'list'
      bBuffers.addMode('view')
      p.buf = bBuffers
    }
  })
  Em.on('C-x A-b', 'buffers')

  Cmd.add('open buffer', open, mo)
  Cmd.add('refresh', () => refresh(Pane.current().view), mo)

  Em.on('g', 'refresh', mo)
}
