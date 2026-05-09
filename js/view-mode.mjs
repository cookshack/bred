import * as Em from './Em.mjs'
import * as Cmd from './cmd.mjs'
import * as Mode from './mode.mjs'
import * as Mess from './mess.mjs'
import * as View from './view.mjs'
import * as U from './util.mjs'
//import { d } from './mess.mjs'

export
function init
() {
  let mode

  mode = Mode.add('View', { minor: 1 })

  Em.on('n', 'next line', mode)
  Em.on('p', 'previous line', mode)
  Em.on('q', 'bury', mode)
  Em.on('Backspace', 'scroll up', mode)
  Em.on(' ', 'scroll down', mode)
  Em.on('ArrowUp', 'previous line', mode)
  Em.on('ArrowDown', 'next line', mode)
  Em.on('ArrowRight', 'forward character', mode)
  Em.on('ArrowLeft', 'backward character', mode)
  Em.on('PageUp', 'scroll up', mode)
  Em.on('PageDown', 'scroll down', mode)
  Em.on('Home', 'buffer start', mode)
  Em.on('End', 'buffer end', mode)

  Cmd.add('view mode', () => {
    let view

    view = View.current()
    view?.buf.addMode(mode)
  })

  Cmd.add('self insert', () => Mess.say(U.shrug), mode)
}
