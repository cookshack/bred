import { append, divCl } from './dom.mjs'

import * as Css from './css.mjs'
import * as Mess from './mess.mjs'
import * as Tab from './tab.mjs'
import * as Pane from './pane.mjs'
import * as Tron from './tron.mjs'
import { d } from './mess.mjs'

export
function init
() {
}

export
function add
(tab, spec) {
  let f, sm, sep

  function focus
  () {
    let curr

    curr = current(f.tab)
    Css.remove(curr?.el, 'current')
    Css.add(f.el, 'current')
  }

  function handleUp
  (e) {
    e.preventDefault()
    globalThis.onmouseup = null
    globalThis.onmousemove = null
    Css.remove(f.sep, 'down')
  }

  function handleMove
  (e) {
    let rect, change, changeP, width

    function activeFramesRight
    () {
      return tab.framesRight.filter(f => Css.has(f.el, 'retracted') == 0).length
    }

    e.preventDefault()

    //d(e.clientX)
    rect = f.el.getBoundingClientRect()
    change = e.clientX - rect.right
    if (change == 0)
      return
    changeP = (change / globalThis.innerWidth) * 100
    0 && d(changeP + '%')
    width = parseFloat(f.el.dataset.width) + changeP

    if (f == tab.frame1) {
      // grow/shrink frame1
      f.el.dataset.width = width
      f.el.style.width = width + '%'
      // shrink/grow frames to the right
      if (tab.framesRight) {
        changeP = changeP / activeFramesRight()
        //d(changeP + '%')
        tab.framesRight.forEach(fr => {
          if (Css.has(fr.el, 'retracted'))
            return
          width = parseFloat(fr.el.dataset.width) - changeP
          fr.el.dataset.width = width
          fr.el.style.width = width + '%'
        })
      }
      return
    }
    if (f == tab.frameLeft) {
      // grow/shrink frameLeft
      f.el.dataset.width = width
      f.el.style.width = width + '%'
      // shrink/grow frame1
      if (tab.frame1) {
        width = parseFloat(tab.frame1.el.dataset.width) - changeP
        tab.frame1.el.dataset.width = width
        tab.frame1.el.style.width = width + '%'
      }
      return
    }
    if (tab.framesRight) {
      // grow/shrink frame
      f.el.dataset.width = width
      f.el.style.width = width + '%'
      // shrink/grow frames to the right
      if (tab.framesRight) {
        let count, i

        // skip to after frame
        for (i = 0; i < tab.framesRight.length; i++)
          if (tab.framesRight[i] == f)
            break
        // count active frames to the right of frame
        count = 0
        for (let j = i; j < tab.framesRight.length; j++) {
          if (Css.has(tab.framesRight[j].el, 'retracted'))
            return
          count++
        }
        if (count) {
          // shrink/grow them
          changeP = changeP / count
          //d(changeP + '%')
          for (let j = i; j < tab.framesRight.length; j++) {
            let fr

            fr = tab.framesRight[j]
            if (Css.has(fr.el, 'retracted'))
              return
            width = parseFloat(fr.el.dataset.width) - changeP
            fr.el.dataset.width = width
            fr.el.style.width = width + '%'
          }
        }
      }
    }
  }

  function handleDown
  (e) {
    if (e.button == 0) {
      e.preventDefault()
      globalThis.onmouseup = handleUp
      globalThis.onmousemove = handleMove
      Css.add(f.sep, 'down')
    }
  }

  function save
  () {
    if (f == tab.frameLeft)
      Tron.cmd1('profile.set', [ 'frame', 'frameLeft', Css.has(f.el, 'retracted') ? 0 : 1 ], err => {
        if (err)
          Mess.warn('Failed to save state of frameLeft')
      })
    else if (f == tab.frameRight)
      Tron.cmd1('profile.set', [ 'frame', 'frameRight', Css.has(f.el, 'retracted') ? 0 : 1 ], err => {
        if (err)
          Mess.warn('Failed to save state of frameRight')
      })
  }

  function retract
  () {
    if (f == tab.frame1)
      return

    Css.retract(f.el)
    f.el.style.width = '0%'
    save()
    if ((f == tab.frameLeft)
        || tab.framesRight?.includes(f)) {
      let frame1, width, ind

      // retract sep of previous frame
      ind = tab.framesRight?.indexOf(f)
      if (ind > 0)
        Css.retract(tab.framesRight[ind - 1].sep)

      // add to frame1
      frame1 = tab.frame1
      if (frame1) {
        width = parseFloat(frame1.el.dataset.width) + parseFloat(f.el.dataset.width)
        frame1.el.dataset.width = width
        frame1.el.style.width = width + '%'
      }
    }
    else
      d('adj for mid')
  }

  function expand
  () {
    let width

    if (f == tab.frame1)
      return

    Css.expand(f.el)
    width = f.el.dataset.width
    f.el.style.width = parseFloat(width) + '%'
    save()
    if ((f == tab.frameLeft)
        || tab.framesRight?.includes(f)) {
      let frame1, width, ind

      // retract sep of previous frame
      ind = tab.framesRight?.indexOf(f)
      if (ind > 0)
        Css.expand(tab.framesRight[ind - 1].sep)

      // remove from frame1
      frame1 = tab.frame1
      if (frame1) {
        width = parseFloat(frame1.el.dataset.width) - parseFloat(f.el.dataset.width)
        frame1.el.dataset.width = width
        frame1.el.style.width = width + '%'
      }
    }
    else
      d('adj for mid')
  }

  spec = spec || {}
  spec.width = spec.width || 25
  sm = divCl('startMarker')
  sep = divCl('framesep', [], { draggable: 'false' })

  f = { panes: [],
        el: divCl('frame',
                  [ sep, sm ],
                  { style: 'width: ' + spec.width + '%;',
                    'data-width': spec.width }),
        sep: sep,
        startMarker: sm,
        //
        get pane() {
          return Pane.current(f)
        },
        get tab() {
          return tab
        },
        //
        expand,
        focus,
        retract,
        save }

  f.sep.onmousedown = handleDown
  f.sep.onmouseup = handleUp

  append(tab.el, f.el)
  tab.frames.push(f)
  Pane.add(f)
  f.focus()

  return f
}

export
function current
(tab) {
  tab = tab || Tab.current()
  if (tab)
    return tab.frames.find(f => Css.has(f.el, 'current'))
  return 0
}

export
function find
(cb) { // (f,i)
  let tab

  tab = Tab.current()
  if (tab)
    return tab.frames.find(cb)
  return 0
}

export
function forEach
(cb) { // (f,i)
  let tab

  tab = Tab.current()
  if (tab)
    tab.frames.forEach(cb)
}
