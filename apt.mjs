import * as Cmd from './cmd.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Hist from './hist.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import * as Prompt from './prompt.mjs'
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
function init
() {
  let mo, hist, reLine

  function runApt
  (term) {
    if (term == null)
      Mess.toss('Missing search term')
    else if (term.length == 0)
      Mess.toss('Empty search term')
    else {
      let b64

      b64 = globalThis.btoa(term)
      Shell.shell1(Loc.appDir().join('bin/apt-search-64') + ' ' + b64,
                   1, 1, [], 0, 0, 0,
                   rbuf => rbuf.mode = 'apt search result')
      hist.add(term)
    }
  }

  function search
  () {
    Prompt.ask({ text: 'Search Apt',
                 hist: hist },
               runApt)
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
  (other) {
    let p, psn, text, name

    p = Pane.current()
    if (other)
      Pane.nextOrSplit()

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
  (u, we, other) {
    let p, path

    p = Pane.current()
    if (other)
      Pane.nextOrSplit()

    if (we?.e && (we.e.button == 0))
      path = we.e.target.innerText
    else
      path = p.view.line
    if (path.length)
      Pane.open(path)
  }

  hist = Hist.ensure('apt search')

  Cmd.add('apt search', () => search())

  //

  reLine = /^([^ ]+) - .*$/d

  mo = Mode.add('Apt Search Result', { viewInit: Ed.viewInit,
                                       viewInitSpec: Ed.viewInitSpec,
                                       viewCopy: Ed.viewCopy,
                                       initFns: Ed.initModeFns,
                                       parentsForEm: 'ed',
                                       decorators: [ { regex: reLine,
                                                       decor: [ { attr: { style: 'color: var(--rule-clr-comment);',
                                                                          'data-run': 'info' } } ] } ] })

  Cmd.add('contents', () => contents(), mo)
  Cmd.add('info', () => info(), mo)
  Cmd.add('info in other pane', () => info(1), mo)
  Cmd.add('install', () => install(), mo)
  Cmd.add('remove', () => remove(), mo)

  Em.on('Enter', 'info', mo)
  Em.on('c', 'contents', mo)
  Em.on('e', 'info', mo)
  Em.on('i', 'install', mo)
  Em.on('l', 'contents', mo)
  Em.on('o', 'info in other pane', mo)
  Em.on('r', 'remove', mo)

  // should use view mode
  Em.on('n', 'next line', mo)
  Em.on('p', 'previous line', mo)
  Em.on('q', 'bury', mo)
  Em.on('Backspace', 'scroll up', mo)
  Em.on(' ', 'scroll down', mo)

  Mode.add('Apt Info', { viewInit: Ed.viewInit,
                         viewInitSpec: Ed.viewInitSpec,
                         viewCopy: Ed.viewCopy,
                         initFns: Ed.initModeFns,
                         parentsForEm: 'ed',
                         decorators: [ { regex: /^([^ ]+:) .*$/d,
                                         decor: [ { attr: { style: 'color: var(--clr-emph-light); background-color: var(--clr-fill);' } } ] } ] })

  Mode.add('Apt Install', { viewInit: Ed.viewInit,
                            viewInitSpec: Ed.viewInitSpec,
                            viewCopy: Ed.viewCopy,
                            initFns: Ed.initModeFns,
                            parentsForEm: 'ed' })

  mo = Mode.add('Apt Contents',
                { viewInit: Ed.viewInit,
                  viewInitSpec: Ed.viewInitSpec,
                  viewCopy: Ed.viewCopy,
                  initFns: Ed.initModeFns,
                  parentsForEm: 'ed',
                  decorators: [ { regex: /^(.*)$/d,
                                  decor: [ { attr: { 'data-run': 'open' } } ] } ] })
  Cmd.add('open', open, mo)
  Cmd.add('open in other pane', (u, we) => open(u, we, 1), mo)

  Em.on('Enter', 'open', mo)
  Em.on('o', 'open in other pane', mo)
}
