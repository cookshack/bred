import * as Cmd from '../../js/cmd.mjs'
import * as Ed from '../../js/ed.mjs'
import * as Loc from '../../js/loc.mjs'
import * as Opt from '../../js/opt.mjs'
import * as Menu from '../../js/menu.mjs'
import * as Pane from '../../js/pane.mjs'
//import { d } from '../../js/mess.mjs'

export
function init
() {
  Opt.declare('samples.enabled', 'bool', 1)

  Cmd.add('enable samples', u => Ed.enable(u, 'samples.enabled'))
  Cmd.add('samples', () => Pane.open(Loc.appDir().join('ext/samples/samples')))

  Menu.add('Help', { name: 'Language Samples',
                     cmd: 'samples' })
}

export
function free
() {
  Cmd.remove('enable samples')
  Cmd.remove('samples')
}
