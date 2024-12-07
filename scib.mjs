import * as Cmd from './cmd.mjs'
import * as Hist from './hist.mjs'
import * as Mess from './mess.mjs'
import * as Pane from './pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Shell from './shell.mjs'
import * as Win from './win.mjs'
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
  function runClick
  (u, we) {
    if (we?.e && (we.e.button == 0)) {
      let p, x, y

      p = Pane.current()
      let win

      win = Win.current()
      x = win.lastContext?.x ?? 0
      y = win.lastContext?.y ?? 0
      p.goXY(x, y)
      runThisLine(p)
    }
  }

  function runThisLine
  (p) {
    let l

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

  Cmd.add('run this line', () => runThisLine(Pane.current()))
  Cmd.add('run line at click', runClick)
}

export
function init
() {
  Cmd.add('shell command in buffer', () => scib())

  hist = Hist.ensure('shell')
  initRTL()
}
