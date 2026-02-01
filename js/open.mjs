import * as Browse from './browse.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Ext from './ext.mjs'
import * as Hist from './hist.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Pane from './pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Shell from './shell.mjs'
import * as Tab from './tab.mjs'
import * as Tron from './tron.mjs'
import * as U from './util.mjs'
import { d } from './mess.mjs'

export
function link
(path, line, newTab) {
  let ext, mtype

  function open
  (path, mtype) {
    let rich

    rich = Ext.get('rich')
    if (rich?.supports(mtype)) {
      rich.open(path, line)
      return
    }

    Pane.open(path, line)
  }

  function shell
  (path) {
    d('open externally: ' + path)
    Tron.cmd('shell.open', [ path ], err => {
      if (err) {
        Mess.yell('shell.open: ' + err.message)
        return
      }
      d('opened OK')
    })
  }

  if (newTab) {
    let tab, buf, p

    p = Pane.current()
    buf = p.buf
    tab = Tab.add(p.win.main)
    Css.expand(p.win.main.tabbar)
    p = tab.pane()
    p.setBuf(buf)
  }

  if (path.startsWith('/'))
    path = 'file://' + path
  if (path.startsWith('file://')) {
    let real

    if (path.endsWith('/')) {
      // dir
      // check needed because dir name may include dots
      Pane.open(path, line)
      return
    }

    real = U.stripCompressedExt(path)
    d({ real })
    if (real.includes('.')) {
      // file with ext
      ext = real.slice(real.lastIndexOf('.') + 1)
      d({ ext })
      mtype = Ed.mtypeFromExt(ext)
      // check ext first because mime-db missing eg.py
      if (ext && Ed.supportsExt(ext))
        // file with supported ext: eg.js (or eg.js.gz)
        open(path, mtype)
      else if (mtype && Ed.supports(mtype))
        // file with supported mime type (via ext)
        open(path, mtype)
      else
        Shell.runToString(Pane.current().dir,
                          'file',
                          [ '-b', '--mime-type', U.stripFilePrefix(path) ],
                          0,
                          mtype => {
                            mtype = mtype && mtype.trim()
                            d('MIME type: ' + mtype)
                            if (mtype == 'inode/x-empty')
                              // empty file
                              Pane.open(path)
                            else if (mtype == 'application/octet-stream')
                              // arbitrary binary data (try anyway because often text, like eg.bak)
                              Pane.open(path)
                            else if (mtype == 'inode/directory')
                              // directory (path was missing trailing /)
                              Pane.open(path)
                            else if (mtype && Ed.supports(mtype))
                              // file with supported mime type: eg.xxx
                              open(path, mtype)
                            else
                              shell(path)
                          })
      return
    }
    // bare file
    Pane.open(path, line)
    return
  }

  // http
  if (path.startsWith('http://')
      || path.startsWith('https://')) {
    Browse.browse(path)
    return
  }

  // search
  if (path.startsWith('search://')) {
    let query

    query = Ext.get('query')
    if (query) {
      query.search(path.slice('search://'.length))
      return
    }
  }

  // https://, mailto:// etc
  shell(path)
}

function initMakeDir
() {
  function makeDir
  () {
    let pane

    function make
    (name, dir) {
      let abs

      if (name.startsWith('/'))
        abs = name
      else
        abs = Loc.make(dir).join(name)
      Tron.cmd('dir.make', abs, err => {
        if (err) {
          Mess.yell('dir.make: ' + err.message)
          return
        }
        Mess.say('Added dir ' + abs)
      })
    }

    pane = Pane.current()
    Prompt.ask({ text: 'Make Dir:' },
               name => make(name, pane.dir))
  }

  Cmd.add('make dir', () => makeDir())
}

export
function init
() {
  let hist

  function create
  (p, text) {
    Ed.make(p,
            { name: text, dir: p.dir },
            () => {
              // delayed otherwise Ed tries to open file
              p.buf.file = text
              p.buf.addToRecents()
            })
  }

  function open
  (path) {
    Pane.open(path)
  }

  function openFile
  (u) {
    Prompt.file({ atPoint: u == 4,
                  create,
                  hist,
                  open })
  }

  function openDir
  () {
    Prompt.dir({ create,
                 hist,
                 open })
  }

  hist = Hist.ensure('open')

  Cmd.add('open file', openFile)

  Cmd.add('open directory', () => openDir())
  Cmd.add('dir', () => openDir())

  Em.on('C-x C-f', 'open file')
  Em.on('C-x d', 'open directory')
  Em.on('C-x C-d', 'open directory')

  initMakeDir()
}
