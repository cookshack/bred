import * as Cmd from './cmd.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Hist from './hist.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Pane from './pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Tron from './tron.mjs'
//import { d } from './mess.mjs'

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
