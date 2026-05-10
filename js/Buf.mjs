import { divCl } from './dom.mjs'

import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Dom from './dom.mjs'
import * as Ed from './ed.mjs'
import * as Em from './Em.mjs'
import Mk from './mk.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Opt from './opt.mjs'
import * as Pane from './Pane.mjs'
import * as Tron from './tron.mjs'
import * as View from './view.mjs'
import * as Win from './win.mjs'
import { d } from './mess.mjs'

import * as BufCommon from './buf-common.mjs'
import { make, shared } from './buf.mjs'
export { make, shared } from './buf.mjs'
export { prepDir, top, view } from './buf-common.mjs'

export
function getRing
() {
  return shared().ring
}

export
function savePoss
() {
  forEach(b => {
    if ((b.fileType == 'file') && b.file) {
      let v

      v = b.views.find(v2 => v2.ele)
      if (v) {
        let pos

        pos = v.pos
        Tron.cmd1('profile.set', [ 'poss', b.path, { row: Ed.posRow(pos), col: Ed.posCol(pos) } ], err => {
          if (err)
            Mess.warn('Failed to save pos of ' + b.path + ': ' + err.message)
        })
      }
    }
  })
}

export
function add
(name, modeKey, content, dir, spec) { // { file, lineNum, vars }
  let b, sh

  spec = spec || {}

  b = make({ name,
             modeKey,
             content,
             dir,
             file: spec.file,
             lineNum: spec.lineNum,
             vars: spec.vars })
  sh = shared()
  sh.buffers.push(b)
  shared().ring.unshift(b)
  return b
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

  function divW
  () {
    return divCl('buffers-ww', divCl('buffers-w bred-surface', ''))
  }

  function open
  (u, we) {
    let p, el

    function go
    (id) {
      let buf

      buf = find(b => b.id == id)
      if (buf)
        p.setBuf(buf)
      else
        Mess.say('Missing buffer: ' + id)
    }

    p = Pane.current()

    if (we?.e && (we.e.button == 0)) {
      go(we.e.target.dataset.id || Mess.toss('Missing buffer id'))
      return
    }

    el = p.view?.point?.over()
    while (el) {
      if (Css.has(el, 'buffers-id')) {
        go(el.innerText.trim())
        return
      }
      el = el.previousElementSibling
    }
    Mess.say('Move to buffer line')
  }

  function viewInit
  (v, spec, cb) { // (view)
    let all

    all = shared().ring
    if (all.length > 1) {
      let bufs

      bufs = all[0]
      all = all.slice(1)
      all.push(bufs)
    }

    v.ele.firstElementChild.firstElementChild.innerHTML = ''
    Dom.append(v.ele.firstElementChild.firstElementChild,
               all.map(b => [ divCl('buffers-id', b.id),
                              divCl('buffers-mode', b.mode.name),
                              divCl('buffers-name',
                                    b.name,
                                    { 'data-id': b.id,
                                      'data-run': 'open buffer' }),
                              divCl('buffers-path', Ed.makeMlDir(b.path)) ]))

    if (cb)
      cb(v)
  }

  BufCommon.init()

  if (Win.root())
    Win.shared().buf = { buffers: Mk.array,
                         ring: Mk.array,
                         id: 1 }

  mo = Mode.add('Buffers', { viewInit })

  Cmd.add('buffers', () => {
    let p, bBuffers

    // ERR mode is from root globalThis  eg Buffers in root then in child, child missing mode
    bBuffers = shared().bBuffers
    p = Pane.current1()
    p.focus()
    if (bBuffers)
      p.setBuf(bBuffers, {}, v => viewInit(v))
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
  Cmd.add('refresh', () => viewInit(View.current()), mo)

  Em.on('g', 'refresh', mo)
  Em.on('Enter', 'open buffer', mo)
}

export
function print
() {
  d('-- BUFS')
  shared().buffers.forEach(buf => {
    d('-- VIEWS in buf ' + buf.id + ' ' + buf.name)
    buf.views?.forEach(v => d('-- ' + v.vid + ', ele: ' + v.ele.innerHTML))
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
  BufCommon.divExts.push(spec)
}
