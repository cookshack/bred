import * as Cmd from '../../js/cmd.mjs'
import * as Ed from '../../js/ed.mjs'
import * as Em from '../../js/em.mjs'
import * as Mode from '../../js/mode.mjs'
import * as Opt from '../../js/opt.mjs'
import * as Pane from '../../js/pane.mjs'
//import { d } from '../../js/mess.mjs'

import * as Ruler from './lib/@cookshack/codemirror-ruler.js'
import * as CMState from '../../lib/@codemirror/state.js'

let wexts

export
function init
() {
  let ed

  function fill
  () {
    let p

    p = Pane.current()
    Ed.fill(p.view, p.buf.opt('ruler.col'))
  }

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

  wexts = []
  Opt.declare('ruler.enabled', 'bool', 1)
  Opt.declare('ruler.col', 'int', 100)

  wexts.push(Ed.register({ backend: 'cm',
                           make,
                           part: new CMState.Compartment,
                           reconfOpts: [ 'ruler.enabled', 'ruler.col' ] }))

  Cmd.add('enable ruler', u => Ed.enable(u, 'ruler.enabled'))
  Cmd.add('buffer enable ruler', u => Ed.enableBuf(u, 'ruler.enabled'))

  ed = Mode.get('ed')
  Cmd.add('Fill to ruler', () => fill(), ed)
  Em.on('A-q', 'fill to ruler', ed)
}

export
function free
() {
  Cmd.remove('enable ruler')
  Cmd.remove('buffer enable ruler')
  wexts.forEach(b => b?.free())
}
