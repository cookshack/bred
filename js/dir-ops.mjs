import { divCl } from './dom.mjs'
import * as Cmd from './cmd.mjs'
import * as DirCommon from './dir-common.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Hist from './hist.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Pane from './pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Shell from './shell.mjs'
import * as Tron from './tron.mjs'
import { d } from './mess.mjs'

function chmodMarked
(dir, marked) {
  let hist, list

  hist = Hist.ensure('dir.chmod')
  list = DirCommon.under(dir, marked)

  Prompt.ask({ text: 'Update mode of these files',
               hist,
               under: divCl('float-files', list.divs) },
             mode => {
               hist.add(mode)
               list.paths.forEach(item => {
                 let absPath

                 absPath = Loc.make(dir).join(item.name)
                 Tron.cmd('file.chmod', [ mode, absPath ], err => {
                   if (err)
                     Mess.yell('file.chmod: ' + err.message)
                 })
               })
             })
}

function chmod
() {
  let p, el, path, marked, hist

  hist = Hist.ensure('dir.chmod')
  p = Pane.current()

  marked = p.buf.vars('dir')?.marked
  if (marked?.length) {
    chmodMarked(Loc.make(p.dir).ensureSlash(), marked)
    return
  }

  el = p.view.ele.querySelector('.dir-name[data-path]')
  if (el && el.dataset.path)
    path = el.dataset.name ?? el.dataset.path
  else {
    Mess.say('Move to a file first')
    return
  }

  Prompt.ask({ text: 'Update mode of ' + path,
               hist },
             mode => {
               let absPath

               absPath = Loc.make(p.dir).join(path)
               hist.add(mode)
               Tron.cmd('file.chmod', [ mode, absPath ], err => {
                 if (err)
                   Mess.yell('file.chmod: ' + err.message)
                 else
                   Mess.say('Mode changed')
               })
             })
}

function link
() {
  let p, el, target

  function run
  (from, target, dir) {
    let absTarget

    absTarget = DirCommon.abs(target, dir)
    Tron.cmd('file.ln', [ absTarget, from ], (err, data) => {
      Mess.log('file.ln:  ' + data.from + ' ⎘ ' + data.target + ' in ' + data.cwd)
      Mess.log('file.ln: (' + data.absFrom + ' ⎘ ' + data.absTarget + ')')
      if (err) {
        Mess.yell('file.ln: ' + err.message)
        return
      }
      Mess.say(from + ' ⮜⮞ ' + target)
    })
  }

  p = Pane.current()
  if (DirCommon.getMarked(p.buf).length) {
    Mess.yell('Clear marks first')
    return
  }

  el = DirCommon.current(p)
  if (el && el.dataset.path)
    target = el.dataset.name ?? el.dataset.path
  else {
    Mess.say('Move to a file first')
    return
  }

  Prompt.ask({ text: 'Link from:' },
             name => run(name, target, p.dir))
}

function equal
() {
  let p, el, marked, one, two

  function finish
  (b) {
    b.mode = Ed.patchModeKey()
    b.opts.set('core.lint.enabled', 0)
    b.addMode('equal')
    b.addMode('view')
  }

  function run
  () {
    d('one: ' + one)
    d('two: ' + two)
    Shell.spawn1('diff',
                 [ '-u', one, two ],
                 { end: 1, afterEndPoint: 1 },
                 finish)
  }

  function create
  () {
    Mess.yell('File must exist')
  }

  function open
  (path) {
    two = path
    run()
  }

  p = Pane.current()

  marked = DirCommon.getMarked(p.buf)
  if (marked.length) {
    if (marked.length == 2) {
      one = Loc.make(p.dir).join(marked.at(0).name)
      two = Loc.make(p.dir).join(marked.at(1).name)
      run()
      return
    }
    else if (marked.length > 2) {
      Mess.say('Too many marked files')
      return
    }
    one = Loc.make(p.dir).join(marked.at(0).name)
  }
  el = DirCommon.current(p)
  if (el && el.dataset.path) {
    let dir

    dir = el.dataset.type == 'd'
    if (dir) {
      Mess.say("That's a directory")
      return
    }
    one = one || el.dataset.path
    Prompt.file({ create, open })
  }
  else
    Mess.say('Move to a file first')
}

export
function init
(m) {
  Cmd.add('chmod', chmod, m)
  Cmd.add('equal', equal, m)
  Cmd.add('link', link, m)
  Em.on('M', 'chmod', 'Dir')
  Em.on('=', 'equal', 'Dir')
  Em.on('l', 'link', 'Dir')
}
