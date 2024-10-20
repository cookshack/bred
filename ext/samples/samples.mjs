import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Loc from '../../loc.mjs'
import * as Opt from '../../opt.mjs'
import * as Menu from '../../menu.mjs'
import * as Pane from '../../pane.mjs'
//import { d } from '../../mess.mjs'

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
