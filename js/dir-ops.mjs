import { divCl } from './dom.mjs'
import * as Cmd from './cmd.mjs'
import * as DirCommon from './dir-common.mjs'
import * as Em from './em.mjs'
import * as Hist from './hist.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Pane from './pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Tron from './tron.mjs'

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

export
function init
(m) {
  Cmd.add('chmod', chmod, m)
  Em.on('M', 'chmod', 'Dir')
}
