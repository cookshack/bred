import { append, button, divCl } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Em from './em.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import * as Style from './style.mjs'
import * as Tron from './tron.mjs'
import * as Win from './win.mjs'
import { d } from './mess.mjs'

let exts

export
function load
(dir, name, cb) {
  let loc

  function onLoad
  (name, ext) {
    exts[name] = ext
    if (ext.init)
      ext.init()
    Mess.log('Loading extension ' + name + ' JS... done')
    if (cb)
      cb()
  }

  loc = Loc.make(dir)
  loc.join(name)
  loc.join(name + '.mjs')
  Mess.log('Loading extension ' + name + ' JS...')
  import(loc.path).then(ext => onLoad(name, ext),
                        err => Mess.yell('Extension: ' + name + ': ' + err.message))

  loc = Loc.make(dir)
  loc.join(name)
  loc.join(name + '.css')
  Tron.cmd('file.exists', loc.path, (err, data) => {
    if (err)
      return
    if (data.exists)
      Style.initCss1(loc.path, Mess.yell)
  })
}

export
function loadAll
() {
  let dir

  function ok
  (name) {
    if ((name == 'core')
        || (name == 'ed')) {
      Mess.log('Skipping extension that uses reserved name: ' + name)
      return 0
    }
    return 1
  }

  function isDir
  (f) {
    if (f && (f.stat.mode & (1 << 15)))
      return 0
    return 1
  }

  setTimeout(() => load(dir, 'core'))

  dir = Loc.appDir()
  dir.join('ext')
  dir.ensureSlash()
  Tron.cmd('dir.get', dir.path, (err, data) => {
    if (err) {
      Mess.yell('dir.get: ' + err.message)
      return
    }

    data.data.filter(f => (f && f.name && isDir(f) && ok(f.name))).forEach(f => {
      let loc

      loc = Loc.make(dir)
      loc.join(f.name)
      loc.join('.ADDED')
      Tron.cmd('file.exists', loc.path, (err, data) => {
        if (err)
          return
        if (data.exists)
          load(dir, f.name)
      })
    })
  })
}

function canon
(name) {
  // 'blank-lines' => 'blankLines'
  //return name.split('-').map((w,i) => i ? Buf.capitalize(w) : w).join('')

  // 'blankLines' => 'blank-lines'
  return name.split(/(?=[A-Z])/).map(w => w.toLowerCase()).join('-')
}

export
function get
(name) {
  return exts[canon(name)]
}

export
function init
() {
  let mo

  function divW
  () {
    return divCl('bred-exts-ww', divCl('bred-exts-w bred-surface', ''))
  }

  function viewInitSpec
  (view, spec, cb) { // (view)
    let w, all

    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''

    Tron.cmd('ext.all', [], (err, data) => {
      d({ data })
      if (err)
        Mess.toss('Error getting extensions')

      all = data.exts?.map(ext => {
        let b

        if (ext.mandatory)
          b = []
        else if (ext.added)
          b = button('Remove', '', { 'data-run': 'Remove Extension',
                                     'data-name': ext.name })
        else
          b = button('Add', '', { 'data-run': 'Add Extension',
                                  'data-name': ext.name })

        return [ divCl('bred-exts-name', ext.name),
                 divCl('bred-exts-buttons', b) ]
      })
      append(w,
             divCl('bred-exts-h', 'Extensions'),
             divCl('bred-exts-all', all))
      if (cb)
        cb(view)
    })
  }

  function add
  (u, we) {
    let name, target

    if (we?.e && (we.e.button == 0)) {
      target = we.e.target
      name = target.dataset.name
    }
    else
      Mess.toss('Need an extension')

    if (name) {
      Css.disable(target)
      Tron.cmd('ext.add', [ name ], (err, data) => {
        let dir

        Css.enable(target)
        d({ data })
        if (err)
          Mess.toss('Error: ' + err.message)

        dir = Loc.appDir()
        dir.join('ext')
        dir.ensureSlash()
        load(dir, name, () => {
          target.innerText = 'Remove'
          target.dataset.run = 'Remove Extension'
        })
      })
    }
  }

  function remove
  (u, we) {
    let name, target

    if (we?.e && (we.e.button == 0)) {
      target = we.e.target
      name = target.dataset.name
    }
    else
      Mess.toss('Need an extension')

    if (name) {
      Css.disable(target)
      Tron.cmd('ext.remove', [ name ], err => {
        let free

        Css.enable(target)
        if (err)
          Mess.toss('Error removing extension: ' + err.message)

        free = exts[name].free
        delete exts[name]
        free && free()

        target.innerText = 'Add'
        target.dataset.run = 'Add Extension'
      })
    }
  }

  if (Win.root())
    Win.shared().exts = {}

  exts = {}

  mo = Mode.add('Exts', { viewInitSpec })

  Cmd.add('add extension', add, mo)
  Cmd.add('remove extension', remove, mo)

  Cmd.add('extensions', () => {
    let p, buf

    buf = Win.shared().exts.buf
    p = Pane.current()
    if (buf)
      p.setBuf(buf, {}, view => viewInitSpec(view))
    else {
      buf = Buf.add('Extensions', 'Exts', divW(), p.dir)
      Win.shared().exts.buf = buf
      buf.icon = 'clipboard'
      buf.addMode('view')
      p.setBuf(buf)
    }
  })

  Cmd.add('refresh', () => {
    let p

    p = Pane.current()
    viewInitSpec(p.view)
  },
          mo)

  Em.on('g', 'refresh', mo)
}

export const _internals = { canon, exts }
