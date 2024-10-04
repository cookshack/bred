import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Opt from '../../opt.mjs'
//import { d } from '../../mess.mjs'

import * as Ruler from './lib/@cookshack/codemirror-ruler.js'
import * as CMState from '../../lib/@codemirror/state.js'

let brexts

export
function init
() {
  function make
  (view) {
    if (view.buf.opt('ruler.enabled')) {
      let ruler

      ruler = Ruler.make({ col: view.buf.opt('ruler.col') })
      if (ruler)
        return ruler.exts
    }
    return []
  }

  brexts = []
  Opt.declare('ruler.enabled', 'bool', 1)
  Opt.declare('ruler.col', 'int', 100)

  brexts.push(Ed.register({ backend: 'cm',
                            make,
                            part: new CMState.Compartment,
                            reconfOpts: [ 'ruler.enabled', 'ruler.col' ] }))

  Cmd.add('enable ruler', u => Ed.enable(u, 'ruler.enabled'))
  Cmd.add('buffer enable ruler', u => Ed.enableBuf(u, 'ruler.enabled'))
}

export
function free
() {
  Cmd.remove('enable ruler')
  Cmd.remove('buffer enable ruler')
  brexts.forEach(b => b?.free())
}
