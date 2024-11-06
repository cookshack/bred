import * as Cmd from './cmd.mjs'
import * as Hist from './hist.mjs'
import * as Mess from './mess.mjs'
import * as Pane from './pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Shell from './shell.mjs'
import { d } from './mess.mjs'

let hist

export
function runText
(sc, spec) {
  spec = spec || {}
  if (sc && sc.length) {
    let modes

    modes = spec.modes

    Shell.shell1(sc,
                 spec.end ?? 1,
                 spec.afterEndPoint ?? 0,
                 0,
                 spec.hist,
                 0,
                 spec.onClose,
                 buf => {
                   buf.opts.set('ansi.enabled', 1)
                   buf.opts.set('core.highlight.specials.enabled', 0)
                   d({ modes })
                   if (modes && modes.length) {
                     buf.mode = modes[0]
                     if (modes.length > 1)
                       for (let i = 1; i < modes.length; i++)
                         buf.addMode(modes[i])
                   }
                 })
  }
  else if (typeof sc === 'string')
    Mess.say('Empty')
  else
    Mess.say('Error')
}

export
function scib
(cb) { // (pane)
  let p

  p = Pane.current()
  Prompt.ask({ text: 'Shell Command in ' + p.dir,
               hist: hist,
               onReady: cb },
             sc => runText(sc, { hist: hist }))
}

function initRTL
() {
  function runThisLine
  () {
    let p, l

    p = Pane.current()
    l = p.line()
    if (l && l.length)
      Shell.shell1(l, 1, 0, 0, hist, 0, 0, buf => {
        buf.opts.set('ansi.enabled', 1)
        buf.opts.set('core.highlight.specials.enabled', 0)
      })
    else if (typeof l === 'string')
      Mess.say('Line empty')
    else
      Mess.say('Line missing')
  }

  Cmd.add('run this line', () => runThisLine())
}

export
function init
() {
  Cmd.add('shell command in buffer', () => scib())

  hist = Hist.ensure('shell')
  initRTL()
}
