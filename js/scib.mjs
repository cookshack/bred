import * as Cmd from './cmd.mjs'
import * as Hist from './hist.mjs'
import * as Mess from './mess.mjs'
import * as Pane from './Pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Shell from './shell.mjs'
import * as Win from './win.mjs'
import * as Wode from './wode.mjs'
import { d } from './mess.mjs'

let hist

export
function runText
(sc,
 spec) { // { end, afterEndPoint, hist, onClose, shellHist }
  spec = spec || {}
  if (sc && sc.length) {
    let modes

    modes = spec.modes

    Shell.shell1(sc,
                 { end: spec.end ?? 1,
                   afterEndPoint: spec.afterEndPoint ?? 0,
                   echo: spec.echo,
                   hist: spec.hist, // sc is added to this
                   onClose: spec.onClose },
                 buf => {
                   buf.mode = 'shell'
                   // commands entered in buf are added to this
                   buf.vars('Shell').hist = spec.shellHist
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
  else if (typeof sc == 'string')
    Mess.say('Empty')
  else
    Mess.say('Error')
}

export
function scib
(cb) { // (pane)
  let p

  p = Pane.current()
  Prompt.ask({ nest: 1,
               text: '❯▁ Shell Command in ' + p.dir,
               hist,
               onReady: cb },
             sc => {
               runText(sc, { echo: 1,
                             hist,
                             shellHist: Hist.ensure('scib: ' + sc).reset() })
             })
}

function initRTL
() {
  function runThisLine
  (u, we) {
    let l, p, win, x, y

    p = Pane.current()
    win = Win.current()

    // Only a mouse run (from the context menu) has a click point. A key-bound
    // run must use the cursor, else a stale earlier click decides the line.
    if (we?.mouse) {
      x = win.lastContextClick?.x
      y = win.lastContextClick?.y
    }

    // codemirror editors (eg code blocks in agent messages) aren't bred views
    l = Wode.lineAtCoords(win, x, y)

    if (l == null) {
      if (we?.mouse && (we.e.button == 0))
        p.goXY(x ?? 0, y ?? 0)
      l = p.line()
    }

    if (l && l.length)
      Shell.shell1(l,
                   { echo: 1, end: 1, hist },
                   buf => {
                     buf.mode = 'shell'
                     buf.opts.set('ansi.enabled', 1)
                     buf.opts.set('core.highlight.specials.enabled', 0)
                   })
    else if (typeof l == 'string')
      Mess.say('Line empty')
    else
      Mess.say('Line missing')
  }

  function runThisCode
  (u, we) {
    let code, win, x, y

    win = Win.current()
    // As with runThisLine, only a mouse run has a real click point.
    if (we?.mouse) {
      x = win.lastContextClick?.x
      y = win.lastContextClick?.y
    }

    code = Wode.codeAtCoords(win, x, y)

    if (code == null)
      Mess.say('No code at point')
    else if (code.length)
      Shell.shell1(code,
                   { echo: 1, end: 1, hist },
                   buf => {
                     buf.mode = 'shell'
                     buf.opts.set('ansi.enabled', 1)
                     buf.opts.set('core.highlight.specials.enabled', 0)
                   })
    else
      Mess.say('Code empty')
  }

  Cmd.add('run this line', runThisLine)
  Cmd.add('run this code in shell', runThisCode)
}

export
function init
() {
  Cmd.add('shell command in buffer', () => scib())

  hist = Hist.ensure('scib')
  initRTL()
}
