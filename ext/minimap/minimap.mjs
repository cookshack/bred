import { div } from '../../js/dom.mjs'

import * as Cmd from '../../js/cmd.mjs'
import * as Ed from '../../js/ed.mjs'
import * as Opt from '../../js/opt.mjs'
//import { d } from '../../js/mess.mjs'

import { showMinimap } from './lib/@replit/codemirror-minimap.js'
import * as CMState from '../../lib/@codemirror/state.js'

let wexts

// The lib keeps a line per doc line and re-parses/rewalks the whole doc on
// every change, so a big buffer (eg vc equal with a huge diff in it, or just a
// big log opened directly) pins the editor. Past these the minimap is off:
// 20k lines is already more than the panel can show usefully, and the byte cap
// catches one enormous minified line.
export
function overCap
(buf, doc) {
  return (doc.lines > buf.opt('minimap.maxLines')) || (doc.length > buf.opt('minimap.maxBytes'))
}

export
function make
(view) {
  if (view.buf.opt('minimap.enabled'))
    return showMinimap.compute([ 'doc' ], state => {
                                            // null = no minimap
                                            if (overCap(view.buf, state.doc))
                                              return null
                                            return { create
                                                     () {
                                                         return { dom: div() }
                                                       },
                                                     displayText: view.buf.opt('minimap.text.type') == 'characters' ? 'characters' : 'blocks',
                                                     showOverlay: 'always',
                                                     gutters: [ { 1: '#00FF00', 2: '#00FF00' } ] }
                                          })

  return []
}

export
function init
() {
  wexts = []
  Opt.declare('minimap.enabled', 'bool', 1)
  // 'blocks' or 'characters' (slower)
  Opt.declare('minimap.text.type', 'str', 'blocks')
  Opt.declare('minimap.maxLines', 'int', 20000)
  Opt.declare('minimap.maxBytes', 'int', 2097152)

  wexts.push(Ed.register({ backend: 'cm',
                           make,
                           part: new CMState.Compartment,
                           reconfOpts: [ 'minimap.enabled', 'minimap.text.type', 'minimap.maxLines', 'minimap.maxBytes' ] }))

  Cmd.add('enable minimap', u => Ed.enable(u, 'minimap.enabled'))
  Cmd.add('buffer enable minimap', u => Ed.enableBuf(u, 'minimap.enabled'))
}

export
function free
() {
  Cmd.remove('enable minimap')
  Cmd.remove('buffer enable minimap')
  wexts.forEach(b => b?.free())
}
