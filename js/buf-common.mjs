import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import Mk from './mk.mjs'
import * as Mode from './mode.mjs'
import * as View from './view.mjs'

import { shared } from './buf.mjs'

export
let divExts

export
function prepDir
(dir) {
  if (dir) {
    dir = Loc.make(dir)

    if (dir.needsDotExpand())
      Mess.toss('. expansion is hard')

    dir.ensureSlash()
    dir.expand()

    if (dir.relative)
      Mess.toss('Absolute path required')

    if (dir.length)
      return dir.path

  }
  return Mess.toss('dir required')
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

// was inside buf (make), but then runs in globalThis of buf
export
function view
(buf,
 // { ele,        // pane element
 //   elePoint,
 //   lineNum }
 spec,
 whenReady) { // called when buf ready to use
  let mode, v

  buf.vid++
  mode = Mode.get(buf.mode?.key) // want the one in current globalThis
  v = View.make(buf,
                { vid: buf.vid,
                  mode,
                  views: buf.views,
                  ele: spec.ele,
                  elePoint: spec.elePoint,
                  lineNum: spec.lineNum },
                whenReady)
  console.log('buf.views.length: ' + buf.views.length + ' (' + (buf.name ? buf.name.slice(0, 20) : '') + ')')
  return v
}

export
function init
() {
  divExts = Mk.array
}
