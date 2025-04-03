import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Em from '../../em.mjs'
import * as Hist from '../../hist.mjs'
import * as Loc from '../../loc.mjs'
import * as Mess from '../../mess.mjs'
import * as Mode from '../../mode.mjs'
import * as Pane from '../../pane.mjs'
import * as Prompt from '../../prompt.mjs'
import * as Shell from '../../shell.mjs'
import * as U from '../../util.mjs'
//import { d } from '../../mess.mjs'

export
function init
() {
  let moSr
  let hist

  function follow
  (other) {
    let p, line

    p = Pane.current()
    if (other)
      Pane.nextOrSplit()

    line = p.line()
    if (line.length) {
      let s

      s = line.split(':', 3)
      if ((s.length > 2) && s[0].length)
        if ((s[0].length > 2) && (s[0].startsWith('./')))
          Pane.open(p.dir + s[0].slice(2), s[1])
        else
          Pane.open(p.dir + s[0], [ 1 ])
    }
  }

  function rerun
  () {
    let p, needle

    p = Pane.current()
    needle = p.buf.vars('srl').needle ?? Mess.throw('Missing needle')
    needle.length || Mess.throw('Empty needle')
    if (U.defined(p.buf.vars('shell').code)) {
      p.buf.clear()
      Shell.run(p.dir,
                Loc.appDir().join('bin/sr'),
                [ needle,
                  p.buf.vars('srl').recurse ? '1' : '0',
                  p.buf.vars('srl').regex ? '1' : '0' ],
                { buf: p.buf,
                  end: 1,
                  afterEndPoint: 1 })
      return
    }
    Mess.yell('Busy')
  }

  function searchFiles
  (recurse, regex, needle) {
    if (needle && needle.length) {
      hist.add(needle)
      Shell.spawn1(Loc.appDir().join('bin/sr'),
                   [ needle,
                     recurse ? '1' : '0',
                     regex ? '1' : '0' ],
                   { end: 1,
                     afterEndPoint: 1 },
                   b => {
                     b.mode = 'srl'
                     b.vars('srl').needle = needle
                     b.vars('srl').recurse = recurse
                     b.vars('srl').regex = regex
                     b.addMode('view')
                   })
    }
    else if (typeof needle === 'string')
      Mess.say('Empty')
    else
      Mess.say('Error')
  }

  function prompt
  (recurse, regex) {
    Prompt.ask({ text: 'Search files' + (recurse ? ' recursively' : ''),
                 hist: hist },
               needle => searchFiles(recurse, regex, needle))
  }

  function search
  (u, regex) {
    let p, recurse

    p = Pane.current()
    recurse = p.buf.opt('core.search.files.recurse')

    if (u == 4)
      recurse = false == recurse

    prompt(recurse, regex)
  }

  hist = Hist.ensure('search files')

  moSr = Mode.add('Srl',
                  { viewInit: Ed.viewInit,
                    viewInitSpec: Ed.viewInitSpec,
                    initFns: Ed.initModeFns,
                    parentsForEm: 'ed',
                    decorators: [ { regex: /^([^:]+:[0-9]+:).*$/d,
                                    decor: [ { attr: { style: 'color: var(--clr-emph-light); --background-color: var(--clr-fill);',
                                                       class: 'bred-bg',
                                                       'data-run': 'select' } } ] } ] })

  Cmd.add('rerun', () => rerun(), moSr)
  Cmd.add('select', () => follow(), moSr)
  Cmd.add('select in other pane', () => follow(1), moSr)

  Em.on('Enter', 'select', moSr)
  Em.on('g', 'rerun', moSr)
  Em.on('o', 'select in other pane', moSr)

  Cmd.add('search lines', search)
  Cmd.add('match lines', u => search(u, 1))
}

export
function free
() {
  Cmd.remove('search lines')
  Cmd.remove('match lines')
  Mode.remove('Srl')
}
