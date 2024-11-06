import * as Cmd from './cmd.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Hist from './hist.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Shell from './shell.mjs'
import { d } from './mess.mjs'

let hist

function next
() {
  let b

  b = Pane.current().buf
  b.vars('SC').hist.next(b)
}

function prev
() {
  let b

  b = Pane.current().buf
  b.vars('SC').hist.prev(b)
}

function runText
(sc) {
  let p

  p = Pane.current()
  if (sc && sc.length) {
    let modes

    modes = p.buf.vars('SC').modes

    Shell.shell1(sc,
                 p.buf.vars('SC').end ?? 1,
                 p.buf.vars('SC').afterEndPoint ?? 0,
                 0,
                 p.buf.vars('SC').hist,
                 0,
                 p.buf.vars('SC').onClose,
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
             runText)
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
  let mo

  mo = Mode.add('SC', { viewInit: Ed.viewInit,
                        viewInitSpec: Ed.viewInitSpec,
                        viewCopy: Ed.viewCopy,
                        initFns: Ed.initModeFns,
                        parentsForEm: 'ed' })

  Cmd.add('next', () => next(), mo)
  Cmd.add('previous', () => prev(), mo)

  Em.on('Enter', 'run', mo)

  Em.on('ArrowUp', 'Previous', mo)
  Em.on('ArrowDown', 'Next', mo)
  Em.on('A-p', 'Previous', mo)
  Em.on('A-n', 'Next', mo)

  Em.on('C-g', 'Close Buffer', mo)
  Em.on('Escape', 'Close Buffer', mo)

  Cmd.add('shell command in buffer', () => scib())

  hist = Hist.ensure('shell')
  initRTL()
}
