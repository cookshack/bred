import { append, button, create, divCl } from '../../js/dom.mjs'

import * as Buf from '../../js/buf.mjs'
import * as Cmd from '../../js/cmd.mjs'
import * as Em from '../../js/em.mjs'
import * as Mode from '../../js/mode.mjs'
import * as Pane from '../../js/pane.mjs'
import { d } from '../../js/mess.mjs'

import './lib/minesweeper-for-web.js'

function divW
() {
  return divCl('minesweeper-outer', divCl('minesweeper-w bred-surface'))
}

export
function init
() {
  let mo, restartB, sweeper

  function make
  (p) {
    let b, restart

    b = Buf.add('Minesweeper', 'minesweeper', divW(), p.dir)
    p.setBuf(b, {}, () => {
      sweeper = globalThis.document.getElementById('minesweeper')

      restart = globalThis.document.getElementById('minesweeper-restart')

      sweeper.addEventListener('minesweeper:game-won', () => {
        d('won')
        restart.innerHTML = '😎'
      })

      sweeper.addEventListener('minesweeper:game-lost', () => {
        d('bomb')
        restart.innerHTML = '😑'
      })
    })
  }

  function smile
  () {
    restartB.innerHTML = '🙂'
  }

  function easy
  () {
    sweeper.setGameModeConfiguration({ columns: 9,
                                       rows: 9,
                                       bombs: 10 })
    smile()
  }

  function normal
  () {
    sweeper.setGameModeConfiguration({ columns: 16,
                                       rows: 16,
                                       bombs: 40 })
    smile()
  }

  function hard
  () {
    sweeper.setGameModeConfiguration({ columns: 30,
                                       rows: 16,
                                       bombs: 99 })
    smile()
  }

  function viewInitSpec
  (view, spec, cb) { // (view)
    let w

    restartB = button('🙂', '', { id: 'minesweeper-restart',
                                  'data-run': 'Smile' })
    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''
    append(w,
           divCl('minesweeper-head', 'Minesweeper'),
           divCl('minesweeper-top', restartB),
           create('minesweeper-game',
                  [],
                  { id: 'minesweeper',
                    'restart-selector': '#minesweeper-restart' }),
           divCl('minesweeper-under',
                 [ button('Easy', '', { 'data-run': 'easy' }),
                   button('Normal', '', { 'data-run': 'normal' }),
                   button('Hard', '', { 'data-run': 'hard' }) ]))
    if (cb)
      cb(view)
  }

  function mines
  () {
    let found, p

    p = Pane.current()
    found = Buf.find(b => b.mode.name == 'minesweeper')
    if (found)
      p.setBuf(found)
    else
      make(p)
  }

  mo = Mode.add('Minesweeper', { viewInitSpec })

  Cmd.add('smile', () => smile(), mo)
  Cmd.add('easy', () => easy(), mo)
  Cmd.add('normal', () => normal(), mo)
  Cmd.add('hard', () => hard(), mo)

  Em.on('q', 'bury', mo)

  Cmd.add('minesweeper', () => mines())
}

export
function free
() {
  Mode.remove('Minesweeper')
  Cmd.remove('minesweeper')
}
