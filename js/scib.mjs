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
  // The line under the click point for a menu run, or the cursor line for a
  // key-bound run. A key-bound run must ignore a stale earlier click, else
  // that click decides the line.
  function lineUnderPoint
  (u, we) {
    let l, p, win, x, y

    p = Pane.current()
    win = Win.current()

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
    return l
  }

  // pane is the target, or undefined for the usual frame1 pane
  function runLine
  (l, pane) {
    if (l && l.length)
      Shell.shell1(l,
                   { echo: 1,
                     end: 1,
                     hist,
                     pane,
                     focus: pane ? 0 : 1 },
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

  function runThisLine
  (u, we) {
    runLine(lineUnderPoint(u, we))
  }

  function runThisLineInOtherPane
  (u, we) {
    let l

    // find the line before moving, since the click and point are in this pane
    l = lineUnderPoint(u, we)
    if (l && l.length) {
      let from, to

      from = Pane.current()
      to = Pane.nextOrSplit()
      runLine(l, to)
      // nextOrSplit focuses the other pane; the user is still working here
      from.focus()
    }
    else
      // nothing to run, so don't move or split
      runLine(l)
  }

  // The code under the click point for a menu run, or under the point of the
  // focused editor for a key-bound run.
  function codeUnderPoint
  (u, we) {
    let win, x, y

    win = Win.current()
    // As with lineUnderPoint, only a mouse run has a real click point.
    if (we?.mouse) {
      x = win.lastContextClick?.x
      y = win.lastContextClick?.y
    }
    return Wode.codeAtCoords(win, x, y)
  }

  // pane is the target, or undefined for the usual frame1 pane
  function runCode
  (code, pane) {
    if (code == null)
      Mess.say('No code at point')
    else if (code.length)
      Shell.shell1(code,
                   { echo: 1,
                     end: 1,
                     hist,
                     pane,
                     focus: pane ? 0 : 1 },
                   buf => {
                     buf.mode = 'shell'
                     buf.opts.set('ansi.enabled', 1)
                     buf.opts.set('core.highlight.specials.enabled', 0)
                   })
    else
      Mess.say('Code empty')
  }

  function runThisCode
  (u, we) {
    runCode(codeUnderPoint(u, we))
  }

  function runThisCodeInOtherPane
  (u, we) {
    let code

    // find the code before moving, since the click and point are in this pane
    code = codeUnderPoint(u, we)
    if (code && code.length) {
      let from, to

      from = Pane.current()
      to = Pane.nextOrSplit()
      runCode(code, to)
      // nextOrSplit focuses the other pane; the user is still working here
      from.focus()
    }
    else
      // nothing to run, so don't move or split
      runCode(code)
  }

  Cmd.add('run this line', runThisLine)
  Cmd.add('run this line in other pane', runThisLineInOtherPane)
  Cmd.add('run this code in shell', runThisCode)
  Cmd.add('run this code in other pane', runThisCodeInOtherPane)
}

export
function init
() {
  Cmd.add('shell command in buffer', () => scib())

  hist = Hist.ensure('scib')
  initRTL()
}
