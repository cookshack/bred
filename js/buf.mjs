import { divCl, button } from './dom.mjs'

import * as Css from './css.mjs'
import * as Dom from './dom.mjs'
import * as Loc from './loc.mjs'
import Mk from './mk.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Opt from './opt.mjs'
import * as Pane from './Pane.mjs'
import * as Recent from './recent.mjs'
import * as Tron from './tron.mjs'
import * as U from './util.mjs'
import * as Win from './win.mjs'
import { d } from './mess.mjs'

import * as BufCommon from './buf-common.mjs'

export
function shared
() {
  return Win.shared().buf
}

export
function make
(spec = {}) { // { name, modeKey, content, dir, file, placeholder, single, vars }
  let { dir, file } = spec
  let b, mode, modeVars, views, vid, fileType, icon, onRemoves, modifiedOnDisk, ed
  let placeholder, ml

  function addToRecents
  () {
    let mtype

    if (b.mode.mime) {
      let i

      i = b.file.lastIndexOf('.')
      if (i >= 0) {
        let ext

        ext = b.file.slice(i + 1)
        mtype = b.mode?.mime?.find(mi => mi.ext == ext)
      }
    }
    Recent.add(Loc.make(b.dir).join(b.file),
               mtype ? mtype.type : 'text/plain')
  }

  function makePsn
  () {
    let psn, row, bep // always cm type bep, because peer uses cm internally.

    bep = 0
    row = 0

    psn = { get bep
            () {
              return bep
            },
            get line // async
            () {
              return (async () => {
                let data

                data = await Tron.acmd('peer.psn.line', [ b.id, bep ])

                return data.text
              })()
            },
            get row
            () {
              return row
            },
            //
            async lineNext
            () {
              let data

              data = await Tron.acmd('peer.psn.lineNext', [ b.id, bep ])
              bep = data.bep ?? bep
              row = data.row ?? row
              return data.more
            } }

    return psn
  }

  function remove
  () {
    let sh, buf

    sh = shared()
    sh.buffers.removeIf(e => e == b)
    sh.ring.removeIf(e => e == b)
    buf = BufCommon.top()
    Pane.forEach(p2 => {
      if (p2.buf && (p2.buf.id == b.id))
        p2.setBuf(buf)
    })
    if (mode?.onRemove)
      mode.onRemove(b)
    onRemoves.forEach(cb => {
      try {
        cb(b)
      }
      catch (err) {
        Mess.warn('Error in buffer onRemove handler: ' + err.message)
      }
    })
    onRemoves.length = 0 // Clear the array to prevent memory leaks
  }

  function setMode
  (key) {
    let mo

    d('BUF setMode')
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

  function bepEnd
  () {
    if (b.mode?.key)
      if (b.mode?.bepEnd) {
        let v

        v = anyView()
        if (v)
          return b.mode.bepEnd(v)
        return 0
      }

    Mess.say('buf.add: bepEnd missing: ' + b.mode.key)
    return 0
  }

  // remove minor mode
  function rmMode
  (modeOrKey) {
    let mo

    mo = getMo(modeOrKey)
    if (mo)
      if (b.minors.find(m => m == mo)) {
        b.minors.removeIf(m => m == mo)
        mo.stop(b)
      }
  }

  // toggle minor mode
  function toggleMode
  (modeOrKey) {
    let mo

    mo = getMo(modeOrKey)
    if (mo) {
      if (b.minors.find(m => m == mo)) {
        b.minors.removeIf(m => m == mo)
        mo.stop(b)
        return 0
      }
      b.minors.push(mo)
      mo.start(b)
      return 1
    }
    return 0
  }

  function nest
  (childBuf) {
    let nestedView

    Mess.log('nest: b.views.length=' + b.views.length)
    if (b.views.length == 0)
      Mess.log('nest: parent buf has no views!')
    b.views.forEach(parentView => {
      let container

      Mess.log('nest: processing parentView')
      parentView.ele || Mess.toss('nest: parent view missing ele')

      container = parentView.ele.querySelector('[data-bred-nested-buf-id="' + childBuf.id + '"]')
      if (container) {
        let paneW, pane, overlayW, overlay, point, pointLine, headW, head, lint, col

        container.innerHTML = ''

        point = divCl('bred-point')
        pointLine = divCl('bred-point-line')
        lint = divCl('bred-head-ed bred-head-lint hidden',
                     divCl('bred-lint-marker', [],
                           { 'data-run': 'first diagnostic' }))
        col = divCl('bred-head bred-head-end',
                    [ divCl('bred-head-ed bred-head-col', 'C1') ])
        head = divCl('bred-head bred-head-mid', [ lint ])
        headW = divCl('bred-head-w', [ head, col ])
        overlay = divCl('bred-overlay', [ point, pointLine, headW ])
        overlayW = divCl('bred-overlay-w bred-nested', overlay)
        pane = divCl('pane bred-nested', [])
        paneW = divCl('paneW bred-nested', [ pane, overlayW ])

        paneW.onscroll = () => {
          if (nestedView.ed)
            return
          if (nestedView.scroll?.manual)
            return
          nestedView.point.ensureInView()
        }

        container.appendChild(paneW)
        Mess.log('nest: added paneW to container, container children: ' + container.children.length)

        if (pane)
          nestedView = BufCommon.view(childBuf,
                                      { ele: pane, elePoint: point },
                                      v => {
                                        if (v.ed)
                                          Css.add(paneW, 'ed')
                                        Mess.log('nest: view ready, pane children: ' + pane.children.length)
                                      })
        else
          Mess.log('nest: pane is null!')
        if (nestedView)
          Mess.log('nest: view created, pane children: ' + pane.children.length)

        parentView.nestedViews = parentView.nestedViews || []
        parentView.nestedViews.push(nestedView)
      }
      else
        Mess.log('nest: container not found for buf id ' + childBuf.id)
    })

    childBuf.nested = 1
    childBuf.parent = b

    b.children = b.children || []
    b.children.push(childBuf)
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
        let v

        v = anyView()
        if (v)
          return b.mode.line(v, n)
        return 0
      }

    Mess.say('buf.add: line missing: ' + b.mode.key)
    return 0
  }

  function append
  (str, afterEndPoint) { // if point at end, then final position of point will be before str.
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
    BufCommon.divExts.forEach(dext => {
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
  (modeKey) {
    if (modeKey) {
      modeKey = modeKey.toLowerCase()
      modeVars[modeKey] = modeVars[modeKey] || {}
      return modeVars[modeKey]
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
  (val) {
    dir = BufCommon.prepDir(val)
    //D("set dir of buff " + b.name + " to " + dir)
    return dir
  }

  function setPlaceholder
  (val) {
    placeholder = val
    if (b.mode?.setPlaceholder) {
      b.views.forEach(v => b.mode.setPlaceholder(v, val))
      return val
    }
    Mess.toss('buf.make: setPlaceholder missing')
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
    if (U.isDefined(val))
      return val
    val = b.mode?.opts?.get(name)
    if (U.isDefined(val))
      return val
    return Opt.get(name)
  }

  // Return one of the active views, if there are any.
  function anyView
  (lax) { // resort to closed views if needed
    let v

    v = b.views.find(v2 => v2.ready && v2.ele)
    if (v)
      return v

    if (lax)
      return b.views.length && b.views[0]

    return 0
  }

  if (spec.name) {
    let old, suffix, sh

    sh = shared()
    suffix = 1
    old = spec.name
    while (sh.buffers.find(buf => buf.name == spec.name))
      spec.name = old + '<' + suffix++ + '>'
  }

  placeholder = spec.placeholder
  spec.modeKey = spec.modeKey || 'div'
  modeVars = spec.vars || {}
  views = []
  vid = 1
  onRemoves = []

  mode = Mode.getOrAdd(spec.modeKey)

  {
    function set
    (name, co) {
      b.views.forEach(v => {
        if (v.ele) {
          let el

          el = v.ele.querySelector('.ml')
          if (el) {
            let field

            field = el.querySelector('.ml-' + name)
            if (field) {
              field.innerHTML = ''
              Dom.append(field, co)
            }
          }
        }
      })
    }

    ml = { set }
  }

  b = { id: shared().id,
        vid,
        //
        co: spec.content,
        minors: Mk.array,
        modified: 0,
        ml,
        //
        get bepEnd
        () {
          return bepEnd()
        },
        get dir
        () { // guarantees trailing /
          return getDir()
        },
        get ed
        () {
          return ed
        },
        get file
        () {
          return file
        },
        get fileType
        () {
          return fileType || 'file'
        },
        get icon
        () {
          return icon
        },
        get mode
        () {
          return mode
        },
        get modifiedOnDisk
        () {
          return modifiedOnDisk
        },
        get name
        () {
          return spec.name
        },
        get path
        () {
          return dir ? (dir + (file || '')) : file
        },
        get placeholder
        () {
          return placeholder
        },
        get single
        () {
          return spec.single
        },
        get syntaxTreeStr
        () {
          return syntaxTreeStr(b)
        },
        get views
        () {
          return views
        },
        //
        set content
        (content) {
          b.co = content
          b.views.forEach(v => v.content = (content ? content.cloneNode(1) : content))
        },
        set dir
        (val) {
          return setDir(val)
        },
        set ed
        (val) {
          return ed = val ? 1 : 0
        },
        set file
        (f) {
          return file = Loc.make(f).removeSlash()
        },
        set fileType
        (t) {
          return fileType = t
        },
        set icon
        (name) {
          return icon = name
        },
        set mode
        (key) {
          setMode(key)
        },
        set modifiedOnDisk
        (val) {
          d('modifiedOnDisk: ' + val)
          modifiedOnDisk = val ? 1 : 0
          if (modifiedOnDisk)
            b.views.forEach(v => {
              let ele, ww

              ele = v.eleOrReserved
              if (ele?.querySelector('.bred-info-w.bred-info-disk'))
                return
              ww = ele?.querySelector('.bred-info-ww')
              if (ww)
                Dom.append(ww,
                           divCl('bred-info-w bred-info-disk',
                                 [ divCl('bred-info-marker'),
                                   'Buffer modified on disk',
                                   button('Revert', '', { 'data-run': 'Revert Buffer' }),
                                   button('Overwrite', '', { 'data-run': 'Save' }) ]))
            })
          else
            b.views.forEach(v => {
              v.eleOrReserved?.querySelectorAll('.bred-info-w.bred-info-disk').forEach(w => w.remove())
            })
        },
        set placeholder
        (val) {
          return setPlaceholder(val)
        },
        //
        addMode,
        addToRecents,
        append,
        anyView,
        bury,
        clear,
        clearLine,
        line,
        makePsn,
        nest,
        remove,
        rmMode,
        insert,
        off,
        on,
        onRemove
        (cb) {
          onRemoves.push(cb)
        },
        opt,
        reconf,
        save,
        text,
        toggleMode,
        vars,
        _internal: { modeVars } }

  b.opts = Opt.buf(b)
  b.dir = dir

  shared().id = shared().id + 1
  return b
}
