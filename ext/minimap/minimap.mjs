import { div } from '../../dom.mjs'

import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Opt from '../../opt.mjs'
//import { d } from '../../mess.mjs'

import { showMinimap } from './lib/@replit/codemirror-minimap.js'
import * as CMState from '../../lib/@codemirror/state.js'

let brexts

export
function init
() {
  function make
  (view) {
    if (view.buf.opt('minimap.enabled'))
      return showMinimap.compute([ 'doc' ], () => {
        return {
          create: () => {
            return { dom: div() }
          },
          //create,
          displayText: 'blocks',
          showOverlay: 'always',
          gutters: [ { 1: '#00FF00', 2: '#00FF00' } ],
        }
      })

    return []
  }

  brexts = []
  Opt.declare('minimap.enabled', 'bool', 1)

  brexts.push(Ed.register({ backend: 'cm',
                            make,
                            part: new CMState.Compartment,
                            reconfOpts: [ 'minimap.enabled' ] }))

  Cmd.add('enable minimap', u => Ed.enable(u, 'minimap.enabled'))
  Cmd.add('buffer enable minimap', u => Ed.enableBuf(u, 'minimap.enabled'))
}

export
function free
() {
  Cmd.remove('enable minimap')
  Cmd.remove('buffer enable minimap')
  brexts.forEach(b => b?.free())
}
