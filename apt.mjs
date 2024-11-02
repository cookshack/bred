import { divCl } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Hist from './hist.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import * as Shell from './shell.mjs'
//import { d } from './mess.mjs'

function apt
(cmd, mode, minors) {
  // these use shell1 instead of spawn1 so that .bashrc is loaded (needed eg for nvm init)
  Shell.shell1(cmd, 1, 0, 0, 0, 0, 0,
               b => {
                 if (mode)
                   b.mode = mode
                 minors?.forEach(minor => b.addMode(minor))
                 b.addMode('view')
               })
}

export
function initSearch
() {
  let mo, buf, hist, reLine

  function next
  () {
    let b

    b = Pane.current().buf
    b.vars('apt search').hist.next(b)
  }

  function prev
  () {
    let b

    b = Pane.current().buf
    b.vars('apt search').hist.prev(b)
  }

  function runApt
  () {
    let p, term

    p = Pane.current()
    term = p.text()?.trim()
    if (term == null)
      Mess.toss('Missing search term')
    else {
      let h, b64

      h = p.buf.vars('apt search').hist
      b64 = globalThis.btoa(term)
      Shell.shell1(Loc.appDir().join('bin/apt-search-64') + ' ' + b64,
                   1, 1, [], 0, 0, 0,
                   rbuf => rbuf.mode = 'apt search result')
      h.add(term)
    }
  }

  function divW
  () {
    return Ed.divW(0, 0, { extraWWCss: 'apt-search-ww',
                           extraWCss: 'apt-search-w',
                           extraCo: divCl('bred-filler') })
  }

  function search
  () {
    let p, w, ml

    p = Pane.current()

    w = divW()
    ml = w.querySelector('.edMl')
    if (ml)
      ml.innerText = 'Package:'

    if (buf) {
      buf.vars('apt search').hist.reset()
      buf.dir = p.dir
    }
    else {
      buf = Buf.make('Apt Search', 'apt search', w, p.dir)
      hist.reset()
      buf.vars('apt search').hist = hist
    }

    buf.vars('ed').fillParent = 0
    buf.opts.set('core.autocomplete.enabled', 0)
    buf.opts.set('core.folding.enabled', 0)
    buf.opts.set('core.line.numbers.show', 0)
    buf.opts.set('core.lint.enabled', 0)
    buf.opts.set('core.minimap.enabled', 0)
    p.setBuf(buf, null, 0, () => buf.clear())
  }

  function contents
  () {
    let p, psn, text, name

    p = Pane.current()
    psn = p.view.psn
    psn.lineStart()

    text = psn.text
    name = text.split(' ')[0]
    apt('dpkg --listfiles ' + name, 'apt contents')
  }

  function info
  () {
    let p, psn, text, name

    p = Pane.current()
    psn = p.view.psn
    psn.lineStart()

    text = psn.text
    name = text.split(' ')[0]
    apt('apt-cache show ' + name, 'apt info')
  }

  function install
  () {
    let p, psn, text, name

    p = Pane.current()
    psn = p.view.psn
    psn.lineStart()

    text = psn.text
    name = text.split(' ')[0]
    apt('sudo apt-get install --yes ' + name, 'apt install')
  }

  function remove
  () {
    let p, psn, text, name

    p = Pane.current()
    psn = p.view.psn
    psn.lineStart()

    text = psn.text
    name = text.split(' ')[0]
    apt('sudo apt-get remove --yes ' + name)
  }

  function open
  (u, we) {
    let p, path

    p = Pane.current()
    if (we?.e && (we.e.button == 0))
      path = we.e.target.innerText
    else
      path = p.view.line
    if (path.length)
      Pane.open(path)
  }

  mo = Mode.add('apt search', { viewInit: Ed.viewInit,
                                viewCopy: Ed.viewCopy,
                                initFns: Ed.initModeFns,
                                parentsForEm: 'ed' })

  Cmd.add('next', () => next(), mo)
  Cmd.add('previous', () => prev(), mo)
  Cmd.add('run', () => runApt(), mo)

  Em.on('Enter', 'run', mo)

  Em.on('A-n', 'Next', mo)
  Em.on('A-p', 'Previous', mo)

  Em.on('C-g', 'Close Buffer', mo)
  Em.on('Escape', 'Close Buffer', mo)

  Em.on('C-c C-c', 'run', mo)

  hist = Hist.ensure('apt search')

  Cmd.add('apt search', () => search())

  //

  reLine = /^([^ ]+) - .*$/d

  mo = Mode.add('Apt Search Result', { viewInit: Ed.viewInit,
                                       viewCopy: Ed.viewCopy,
                                       initFns: Ed.initModeFns,
                                       parentsForEm: 'ed',
                                       decorators: [ { regex: reLine,
                                                       decor: [ { attr: { style: 'color: var(--rule-clr-comment);',
                                                                          'data-run': 'info' } } ] } ] })

  Cmd.add('contents', () => contents(), mo)
  Cmd.add('info', () => info(), mo)
  Cmd.add('install', () => install(), mo)
  Cmd.add('remove', () => remove(), mo)

  Em.on('Enter', 'info', mo)
  Em.on('c', 'contents', mo)
  Em.on('e', 'info', mo)
  Em.on('i', 'install', mo)
  Em.on('l', 'contents', mo)
  Em.on('r', 'remove', mo)

  // should use view mode
  Em.on('n', 'next line', mo)
  Em.on('p', 'previous line', mo)
  Em.on('q', 'bury', mo)
  Em.on('Backspace', 'scroll up', mo)
  Em.on(' ', 'scroll down', mo)

  Mode.add('Apt Info', { viewInit: Ed.viewInit,
                         viewCopy: Ed.viewCopy,
                         initFns: Ed.initModeFns,
                         parentsForEm: 'ed',
                         decorators: [ { regex: /^([^ ]+:) .*$/d,
                                         decor: [ { attr: { style: 'color: var(--clr-emph-light); background-color: var(--clr-fill);' } } ] } ] })

  Mode.add('Apt Install', { viewInit: Ed.viewInit,
                            viewCopy: Ed.viewCopy,
                            initFns: Ed.initModeFns,
                            parentsForEm: 'ed' })

  mo = Mode.add('Apt Contents',
                { viewInit: Ed.viewInit,
                  viewCopy: Ed.viewCopy,
                  initFns: Ed.initModeFns,
                  parentsForEm: 'ed',
                  decorators: [ { regex: /^(.*)$/d,
                                  decor: [ { attr: { 'data-run': 'open' } } ] } ] })
  Cmd.add('open', open, mo)
  Em.on('Enter', 'open', mo)
}

export
function init
() {
  initSearch()
}
