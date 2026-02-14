import { div, divCl, span } from './dom.mjs'
import * as Browse from './browse.mjs'
import * as Cmd from './cmd.mjs'
import * as DirCommon from './dir-common.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Hist from './hist.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Pane from './pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Scib from './scib.mjs'
import * as Shell from './shell.mjs'
import * as Tron from './tron.mjs'
import { d } from './mess.mjs'

function placeholder
(p, from) {
  let next

  next = p.next
  if (next
      && (next.buf?.mode.key == 'dir'))
    return Loc.make(next.buf.path).join(Loc.make(from).filename)
}

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

function showInFolder
() {
  let el

  el = DirCommon.current()
  if (el && el.dataset.path)
    Tron.cmd('shell.show', [ 'file://' + el.dataset.path ], err => {
      if (err) {
        Mess.yell('shell.show: ' + err.message)
        return
      }
    })
  else
    Mess.say('Move to a file first')
}

function other
() {
  let el

  el = DirCommon.current()
  if (el && el.dataset.path)
    Pane.nextOrSplit().open(el.dataset.path)
  else
    Mess.say('Move to a file first')
}

function extern
() {
  let el

  el = DirCommon.current()
  if (el && el.dataset.path)
    Tron.cmd('shell.open', [ 'file://' + el.dataset.path ], err => err && Mess.yell('shell.open: ' + err.message))
  else
    Mess.say('Move to a file first')
}

function browse
() {
  let el

  el = DirCommon.current()
  if (el && el.dataset.path)
    Browse.browse('file://' + el.dataset.path)
  else
    Mess.say('Move to a file first')
}

function scof
() {
  let el

  el = DirCommon.current()
  if (el && el.dataset.path)
    Scib.scib(pane => {
      pane.view.buf.append(' ' + el.dataset.path)
      Cmd.runMo('buffer start', 'Ed', 1)
    })
  else
    Mess.say('Move to a file first')
}

export
function touch
() {
  let p, marked, files, dir

  p = Pane.current()
  marked = DirCommon.getMarked(p.buf)
  dir = Loc.make(p.dir).ensureSlash()
  if (marked.length)
    files = marked.map(m => Loc.make(dir).join(m.name))
  else {
    let el

    el = DirCommon.current(p)
    if (el && el.dataset.path)
      files = [ el.dataset.path ]
    else {
      Mess.say('Move to a file first')
      return
    }
  }
  Tron.cmd('file.touch', files, err => {
    if (err) {
      Mess.yell('Error touching: ' + err.message)
      return
    }
    if (files.length > 1)
      Mess.say('Touched files')
    else
      Mess.say('Touched file ' + files[0])
  })
}

export
function copy
() {
  let p, marked, hist

  p = Pane.current()
  hist = p.buf.vars('dir').hist

  function cpMarked
  (dir, marked) {
    let list

    list = DirCommon.under(dir, marked)
    Prompt.ask({ text: 'Copy these files to',
                 hist,
                 under: divCl('float-files', list.divs) },
               dest => {
                 let absDest

                 hist.add(dest)

                 absDest = DirCommon.abs(dest, dir)
                 Tron.cmd('file.cp', [ list.paths.map(p => p.path), absDest ], err => {
                   if (err) {
                     Mess.yell('file.cp: ' + err.message)
                     return
                   }
                 })
               })
  }

  function run
  (from, to, dir) {

    function ok
    () {
      hist.add(to)
      Tron.cmd('file.cp', [ from, to ], err => {
        if (err) {
          Mess.yell('file.cp: ' + err.message)
          return
        }
        Mess.say(from + ' ⧉⮞ ' + to)
      })
    }

    function confirm
    () {
      Prompt.yn('File exists. Overwrite?',
                { icon: 'warning' },
                yes => yes && ok())
    }

    to = DirCommon.abs(to, dir)
    from = DirCommon.abs(from, dir)
    Tron.cmd('file.stat', to, (err, data) => {
      if (err)
        if (err.code == 'ENOENT')
          // new file
          ok()
        else
          Mess.toss('file.stat: ' + err.message)
      else
        // dest exists
        if (data.data.mode & (1 << 15))
          // dest is file
          confirm()
        else {
          // dest is dir, cp file into that dir
          to = Loc.make(to).join(Loc.make(from).filename)
          Tron.cmd('file.stat', to, err => {
            if (err)
              if (err.code == 'ENOENT')
                // new file
                ok()
              else
                Mess.toss('file.stat: ' + err.message)
            else
              confirm()
          })
        }
    })
  }

  marked = DirCommon.getMarked(p.buf)
  if (marked.length) {
    cpMarked(Loc.make(p.dir).ensureSlash(), marked)
    return
  }
  else {
    let el, file

    el = DirCommon.current()
    if (el && el.dataset.path)
      file = el.dataset.path
    else {
      Mess.say('Move to a file first')
      return
    }

    Prompt.ask({ text: 'Copy to:',
                 placeholder: placeholder(p, file),
                 hist },
               name => run(file, name, p.dir))
  }
}

export
function rename
() {
  let p, marked, hist

  p = Pane.current()
  hist = p.buf.vars('dir').hist

  function renameMarked
  (dir, marked) {
    let list

    list = DirCommon.under(dir, marked)
    Prompt.ask({ text: 'Move these files to',
                 hist,
                 under: divCl('float-files', list.divs) },
               dest => {
                 let absDest

                 hist.add(dest)

                 absDest = DirCommon.abs(dest, dir)
                 Tron.cmd('file.mv', [ list.paths.map(p => p.path), absDest ], err => {
                   if (err) {
                     Mess.yell('file.mv: ' + err.message)
                     return
                   }
                 })
               })
  }

  function run
  (from, to, dir) {
    d('run from: ' + from)
    to = DirCommon.abs(to, dir)
    from = DirCommon.abs(from, dir)
    hist.add(to)
    Tron.cmd('file.mv', [ from, to ], err => {
      if (err?.exists) {
        Prompt.yn('File exists. Overwrite?',
                  { icon: 'warning' },
                  yes => {
                    if (yes)
                      Tron.cmd('file.mv', [ from, to, { overwrite: 1 } ], err => {
                        if (err) {
                          Mess.yell('file.mv: ' + err.message)
                          return
                        }
                        Mess.say(from + ' ⮞ ' + to)
                      })
                  })
        return
      }
      if (err) {
        Mess.yell('file.mv: ' + err.message)
        return
      }
      Mess.say(from + ' ⮞ ' + to)
    })
  }

  p = Pane.current()
  marked = DirCommon.getMarked(p.buf)
  if (marked.length) {
    renameMarked(Loc.make(p.dir).ensureSlash(), marked)
    return
  }
  else {
    let el, file

    el = DirCommon.current()
    if (el && el.dataset.path)
      file = el.dataset.path
    else {
      Mess.say('Move to a file first')
      return
    }

    d({ file })
    Prompt.ask({ text: 'Rename to:',
                 placeholder: placeholder(p, file),
                 hist },
               name => run(file, name, p.dir))
  }
}

export
function del
() {
  let p, el, marked

  p = Pane.current()

  marked = DirCommon.getMarked(p.buf)
  if (marked.length) {
    delMarked(Loc.make(p.dir).ensureSlash(), marked)
    return
  }
  el = DirCommon.current(p)
  if (el && el.dataset.path) {
    let msg, dir

    dir = el.dataset.type == 'd'
    msg = div([ 'Delete ' + (dir ? 'dir' : 'file') + ' ',
                span(el.dataset.path, 'bold'), '?' ])
    Prompt.yn(msg, { icon: 'trash' }, yes =>
      yes && Tron.cmd(dir ? 'dir.rm' : 'file.rm', [ el.dataset.path ], err => {
        if (err) {
          if (err.code == 'ENOTEMPTY') {
            msg = div([ 'RECURSIVELY delete ', span(el.dataset.path, 'bold'), '?' ])
            Prompt.yn(msg, { icon: 'trash' }, yes => {
              yes && Tron.cmd('dir.rm', [ el.dataset.path, { recurse: 1 } ], err => {
                if (err) {
                  Mess.yell('Error deleting: ' + err.message)
                  return
                }
                Mess.say('Deleted dir ' + el.dataset.path)
              })
            })
            return
          }
          else
            Mess.yell('Error deleting: ' + err.message)
          return
        }
        Mess.say('Deleted ' + (dir ? 'dir' : 'file') + ' ' + el.dataset.path)
      }))
  }
  else
    Mess.say('Move to a file first')
}

function delMarked
(dir, marked) {
  let list

  list = DirCommon.under(dir, marked)
  Prompt.yn('Delete these?',
            { icon: 'trash',
              under: divCl('float-files', list.divs) },
            yes => {
              if (yes)
                list.paths.forEach(item =>
                  Tron.cmd(item.isDir ? 'dir.rm' : 'file.rm',
                           [ item.path ],
                           err => {
                             if (err) {
                               Mess.yell('Error deleting: ' + err.message)
                               return
                             }
                             marked.rm(item.name)
                           }))
            })
}

export
function edit
() {
  let el

  el = DirCommon.current()
  if (el && el.dataset.path)
    Pane.open(el.dataset.path)
  else
    Mess.say('Move to a file first')
}

export
function editIfSupported
() {
  let el

  el = DirCommon.current()
  if (el && el.dataset.path) {
    if (el.dataset.type == 'd') {
      Pane.open(el.dataset.path)
      return
    }
    if (el.dataset.path.includes('.')) {
      let ext, mtype

      ext = el.dataset.path.slice(el.dataset.path.lastIndexOf('.') + 1)
      mtype = Ed.mtypeFromExt(ext)
      if (mtype && Ed.supports(mtype)) {
        Pane.open(el.dataset.path)
        return
      }
    }
    Tron.cmd('shell.open', [ 'file://' + el.dataset.path ], err => {
      if (err) {
        Mess.yell('shell.open: ' + err.message)
        return
      }
    })
  }
  else
    Mess.say('Move to a file first')
}

export
function init
(m) {
  Cmd.add('chmod', chmod, m)
  Cmd.add('copy file', copy, m)
  Cmd.add('delete', del, m)
  Cmd.add('edit if supported', editIfSupported, m)
  Cmd.add('edit', edit, m)
  Cmd.add('equal', equal, m)
  Cmd.add('link', link, m)
  Cmd.add('open in external web browser', () => extern(), m)
  Cmd.add('open in other pane', other, m)
  Cmd.add('open in web browser', () => browse(), m)
  Cmd.add('rename', rename, m)
  Cmd.add('shell command on file', () => scof(), m)
  Cmd.add('show in folder', showInFolder, m)
  Cmd.add('touch', touch, m)
  Em.on('!', 'shell command on file', 'Dir')
  Em.on('=', 'equal', 'Dir')
  Em.on('+', 'make dir', 'Dir')
  Em.on('c', 'copy file', 'Dir')
  Em.on('d', 'delete', 'Dir')
  Em.on('D', 'delete', 'Dir')
  Em.on('E', 'edit if supported', 'Dir')
  Em.on('e', 'edit', 'Dir')
  Em.on('f', 'show in folder', 'Dir')
  Em.on('l', 'link', 'Dir')
  Em.on('M', 'chmod', 'Dir')
  Em.on('o', 'open in other pane', 'Dir')
  Em.on('r', 'rename', 'Dir')
  Em.on('T', 'touch', 'Dir')
  Em.on('W', 'open in external web browser', 'Dir')
  Em.on('w', 'open in web browser', 'Dir')
}
