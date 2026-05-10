import { divCl, img } from './dom.mjs'
import * as Buf from './Buf.mjs'
import * as Css from './css.mjs'
import * as Dir from './dir.mjs'
import * as Dom from './dom.mjs'
import * as Em from './Em.mjs'
import * as Ed from './ed.mjs'
import * as Frame from './frame.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Tron from './tron.mjs'
import * as View from './view.mjs'
import { d } from './mess.mjs'

import * as PaneUtil from './pane-util.mjs'

import * as PaneOn from './pane-on.mjs'

let bootBuf, id

function chPx
(el, char) {
  let canvas, context, style

  char = char ?? '0'
  canvas = Dom.create('canvas')
  style = globalThis.getComputedStyle(el)

  context = canvas.getContext('2d')
  context.font = style.fontSize + ' ' + style.fontFamily

  return context.measureText(char).width
}

function getBootBuf
() {
  // delayed til needed, so that iwd is set
  d('using boot buf')
  if (bootBuf)
    return bootBuf
  d('Making boot buf')
  return bootBuf = Buf.make({ dir: Loc.iwd().path })
}

export
function add
(frame, b, lineNum,
 // { setBufCb } // (view) // when b is set on the added frame
 spec) {
  let p, curr, view, ele, elePoint, elePointLine, eleHead, eleLint, paneW, inputQueue

  function focusViewAt
  (target) {
    let nestedPane

    focus() // Ensure pane is in correct state
    nestedPane = target.closest('.pane.bred-nested')
    if (nestedPane) {
      let nestedView

      view.ele.querySelectorAll('.pane.bred-nested.current').forEach(el => Css.remove(el, 'current'))
      Css.add(nestedPane, 'current')
      nestedView = view.nestedViews?.find(nv => nv.ele.parentElement == nestedPane)
      if (nestedView?.ed)
        nestedView.ed.focus()
      if (View.onFocuss)
        View.onFocuss.forEach(cb => cb(nestedView))
    }
    else
      view.ele.querySelectorAll('.pane.bred-nested.current').forEach(el => Css.remove(el, 'current'))
  }

  function cols
  () {
    let r

    r = ele.getBoundingClientRect()
    return Math.floor(r.width / chPx(ele)) || 80
  }

  function line
  () {
    if (p.view)
      if (p.buf?.mode?.line)
        return p.buf.mode.line(p.view)

    Mess.say('pane.add: line missing: ' + p.buf?.mode.key)
    return null
  }

  function goXY
  (x, y) {
    if (p.view)
      if (p.buf?.mode?.goXY)
        return p.buf.mode.goXY(p.view, x, y)

    Mess.say('pane.add: goXY missing: ' + p.buf?.mode.key)
    return null
  }

  function pos
  () {
    if (p.view)
      if (p.buf?.mode?.pos)
        return p.buf.mode.pos(p.view)

    Mess.say('pane.add: pos missing: ' + p.buf?.mode.key)
    return null
  }

  function text
  () {
    if (p.buf && p.view) {
      if (p.buf.mode?.text)
        return p.buf.mode.text(p.view)
      Mess.toss('pane.add: text missing: ' + p.buf?.mode.key)
    }
    return null
  }

  // close the pane
  function close
  () {
    let i

    if (frame.panes.length == 1) {
      Mess.yell('Only pane')
      return
    }

    i = frame.panes.findIndex(p2 => p.id == p2.id)
    if (view)
      view.close()
    p.w.remove()
    if (i == -1) {
      Mess.warn('pane.close: missing')
      frame.panes[0].focus()
      return
    }
    frame.panes.splice(i, 1)
    frame.panes[i >= frame.panes.length ? 0 : i].focus()
  }

  function focus
  (skipEd, skipEle) {
    let pane

    frame.focus()
    pane = PaneUtil.current(frame)
    if (pane) {
      Css.remove(pane.w, 'current')
      pane.view.nestedViews?.forEach(nv => Css.remove(nv.ele.parentElement, 'current'))
      if (skipEd) {
        // prevents recurse
      }
      else if (pane.ed)
        pane.ed.blur()
    }
    Css.add(p.w, 'current')

    if (skipEle) {
    }
    else
      p.view?.elPane?.focus()

    p.frame.tab.name = b?.name || 'Empty'
    p.frame.tab.icon = b?.icon

    if (skipEd) {
      // prevents recurse
    }
    else if (p.view?.ed)
      p.view.ed.focus()

    if (View.onFocuss)
      View.onFocuss.forEach(cb => cb(view))
  }

  function next
  () {
    let i, pane

    if (p.frame.panes.length == 1)
      return 0

    i = p.frame.panes.findIndex(p2 => p.id == p2.id)
    if (i == p.frame.panes.length - 1)
      pane = p.frame.panes[0]
    else
      pane = p.frame.panes[i + 1]
    return pane
  }

  // TODO if this is called twice in succession there can be timing issues.
  // eg prompt.ask used to call Tab.add and let it pick the buf (which calls setBuf)
  // and then call setBuf itself, but the setBuf callbacks would sometimes
  // run out of order and the prompt would freeze.
  function setBuf
  (b2,
   sbSpec, // { lineNum, bury }
   whenReady) { // (view)

    function onReady
    (v) {
      PaneOn.onSetBufs.forEach(cb => cb(v))
      if (whenReady)
        whenReady(v)
    }

    sbSpec = sbSpec || {}

    if (b2) {
      setBufInternal(b2, sbSpec, onReady)
      return
    }

    onReady(view)
  }

  function setBufInternal
  (b2,
   sbSpec, // { lineNum, bury }
   whenReady) { // (view)
    let isNewView

    d('PANE ✨ setBuf ' + (b2.name || '??'))

    // Determine if we're creating a new view
    isNewView = 1
    if (view?.buf == b2)
      isNewView = 0

    // Set flag for new views only
    if (isNewView) {
      p.initializing = true
      p.clearInput()
    }

    if (view?.buf == b2) {
      d('setBuf to same buf')
      b = b2
      if (Number.isFinite(parseInt(sbSpec.lineNum)))
        Ed.Backend.vgotoLine(p.view, sbSpec.lineNum)
      b.reconf()
      p.flushInput()
      if (whenReady)
        whenReady(view)
      return
    }
    if (b) {
      Buf.queue(b)
      // this was done in the cb in the Bury cmd, but then if you do Bury in dataset.run and eg Options in dataset.after
      // then Options runs before the Bury cb because it's async.
      if (sbSpec.bury)
        b.bury()
    }
    b = b2
    b.reconf()
    if (view)
      view.close()
    if (b)
      view = Buf.view(b,
                      { ele,
                        elePoint,
                        lineNum: sbSpec.lineNum },
                      v => {
                        d('PANE view ready ' + (v.buf?.id || '??') + ' ' + (v.buf?.name || '???'))
                        view = v
                        if (view.ed)
                          Css.add(ele?.parentNode, 'ed')
                        else
                          Css.remove(ele?.parentNode, 'ed')

                        Mess.log('nest-PANE view ready, buf.views.length=' + view.buf.views.length)
                        // View is ready - clear flag and flush any buffered input
                        p.flushInput()

                        if (whenReady) {
                          Mess.log('nest-PANE calling whenReady')
                          whenReady(view)
                          Mess.log('nest-PANE after whenReady, buf.views.length=' + view.buf.views.length)
                        }
                      })
    else
      p.flushInput()
    p.frame.tab.name = b?.name || 'Empty'
    p.frame.tab.icon = b?.icon
  }

  function openFile
  (path, num, whenReady) { // (view)
    path = Loc.make(path)
    path.expand()
    Ed.make(p,
            { name: path.filename,
              dir: path.dirname,
              file: path.filename,
              lineNum: num },
            whenReady)
  }

  function openDir
  (path) {
    Dir.add(p, path)
  }

  // open file/dir in the pane
  function open
  (path,
   lineNumber, // only used if path is a file
   whenReady) { // (view) only runs if path is a file
    Tron.cmd('file.stat', Loc.make(path).expand(), (err, data) => {
      let name

      if (err) {
        Mess.yell('Pane.open: ' + err.message)
        return
      }
      name = data.link ? data.dest : path
      if (data.data.mode & (1 << 15))
        openFile(name, lineNumber, whenReady)
      else
        openDir(name)
    })
  }

  function showLintMarker
  (count) {
    if (count && b.opt('core.lint.enabled'))
      Css.show(eleLint)
    else
      Css.hide(eleLint)
  }

  spec = spec || {}
  inputQueue = []
  frame = frame || Frame.current()

  b = b || Buf.top() || getBootBuf()

  ele = divCl('pane',
              [],
              { 'data-id': frame.panes.length })

  elePoint = divCl('bred-point')
  elePointLine = divCl('bred-point-line')
  eleLint = divCl('bred-head-ed bred-head-lint hidden',
                  divCl('bred-lint-marker',
                        [],
                        { 'data-run': 'first diagnostic' }))

  eleHead = divCl('bred-head-w',
                  [ divCl('bred-head bred-head-mid',
                          [ eleLint ]),

                    divCl('bred-head bred-head-end',
                          [ divCl('bred-head-ed bred-head-col',
                                  'C1') ]) ])

  paneW = divCl('paneW',
                [ ele,
                  divCl('bred-overlay-w',
                        divCl('bred-overlay',
                              [ elePoint,
                                elePointLine,
                                eleHead ])) ])

  paneW.onscroll = () => {
    if (p.view.ed)
      return
    if (p.view.scroll?.manual)
      return
    p.view.point.ensureInView()
  }

  p = { w: divCl('paneWW',
                 [ divCl('bred-close',
                         img('img/x.svg', 'Close', 'filter-clr-text'),
                         { 'data-run': 'close buffer' }),
                   paneW ]),
        elePoint,
        ele,
        id,
        //
        // Input buffering state
        initializing: false,
        enqueueInput
        (we) {
          d('PANE enqueue')
          d({ we })
          d('PANE we.name ' + we.name)
          inputQueue.push(we)
        },
        flushInput
        () {
          let wes

          d('PANE flushInput')
          p.initializing = false
          wes = inputQueue.splice(0) // Clear and get all events
          if (wes.length) {
            d('PANE flush ' + wes.length)
            d({ wes })
          }
          wes.forEach(we => {
            // test comment for vc eq
            we.buf = view?.buf
            Em.handle(we, view)
          })
        },
        clearInput
        () {
          d('PANE clearInput')
          inputQueue.length = 0
        },
        //
        get buf
        () {
          return view?.buf
        },
        get cols
        () {
          return cols()
        },
        get dir
        () {
          return view?.buf ? view.buf.dir : Loc.home()
        },
        get head
        () {
          return eleHead
        },
        get isSupport
        () {
          if (Css.has(frame?.tab?.area?.el, 'bred-main'))
            return 0
          return 1
        },
        get frame
        () {
          return frame
        },
        get next
        () {
          return next()
        },
        get view
        () {
          return view
        },
        get win
        () {
          return frame?.tab?.area?.win
        },
        get currentNestedView
        () {
          let el

          el = view?.ele?.querySelector('.pane.bred-nested.current')
          if (el)
            return view.nestedViews?.find(nv => nv.ele.parentElement == el)
          return null
        },
        //
        //set buf(b2) {... see setBuf below
        //
        close,
        focusViewAt,
        goXY,
        line,
        open,
        openDir,
        openFile,
        pos,
        // always use this to set the buf, because it's nb to use a cb if you want to access the view after.
        setBuf,
        showLintMarker,
        focus,
        text }
  id++

  b || Mess.toss('buffer required')
  p.setBuf(b, { lineNum }, spec.setBufCb)

  curr = PaneUtil.current(frame)
  if (curr && curr.w) {
    let i

    curr.w.after(p.w)
    i = frame.panes.indexOf(curr)
    frame.panes.splice(i + 1, 0, p)
    frame.panes.forEach(p2 => p2.view.ensurePointVisible())
  }
  else {
    frame.startMarker.after(p.w)
    frame.panes.push(p)
  }

  p.focus()

  return p
}

id = 1
