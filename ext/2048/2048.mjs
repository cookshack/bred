import { append, button, create, divCl } from '../../dom.mjs'

import * as Buf from '../../buf.mjs'
import * as Cmd from '../../cmd.mjs'
import * as Em from '../../em.mjs'
import * as Mode from '../../mode.mjs'
import * as Pane from '../../pane.mjs'
import { d } from '../../mess.mjs'

import './lib/2048-webcomponent.js'

function divW
() {
  return divCl('two048-outer', divCl('two048-w bred-surface'))
}

export
function init
() {
  let mo, restartB, game

  function make
  (p) {
    let b, restart

    b = Buf.add('2048', '2048', divW(), p.dir)
    p.setBuf(b)

    game = globalThis.document.getElementById('two048')

    restart = globalThis.document.getElementById('two048-restart')

    game.addEventListener('2048:game-won', () => {
      d('won')
      restart.innerHTML = '😎'
    })

    game.addEventListener('2048:game-lost', () => {
      d('bomb')
      restart.innerHTML = '😑'
    })
  }

  function smile
  () {
    restartB.innerHTML = '🙂'
  }

  function easy
  () {
    game.setGameModeConfiguration({ columns: 9,
                                    rows: 9,
                                    bombs: 10, })
    smile()
  }

  function normal
  () {
    game.setGameModeConfiguration({ columns: 16,
                                    rows: 16,
                                    bombs: 40, })
    smile()
  }

  function hard
  () {
    game.setGameModeConfiguration({ columns: 30,
                                    rows: 16,
                                    bombs: 99, })
    smile()
  }

  function refresh
  (view) {
    let w

    restartB = button('🙂', '', { id: 'two048-restart',
                                  'data-run': 'Smile' })
    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''
    append(w,
           divCl('two048-head', '2048'),
           divCl('two048-top', restartB),
           create('game-2048',
                  [],
                  { id: 'two048',
                    'restart-selector': '#two048-restart' }),
           divCl('two048-under retracted',
                 [ button('Easy', '', { 'data-run': 'easy' }),
                   button('Normal', '', { 'data-run': 'normal' }),
                   button('Hard', '', { 'data-run': 'hard' }) ]))
  }

  function start2048
  () {
    let found, p

    p = Pane.current()
    found = Buf.find(b => b.mode.name == '2048')
    if (found)
      p.setBuf(found)
    else
      make(p)
  }

  mo = Mode.add('2048', { viewInit: refresh })

  Cmd.add('smile', () => smile(), mo)
  Cmd.add('easy', () => easy(), mo)
  Cmd.add('normal', () => normal(), mo)
  Cmd.add('hard', () => hard(), mo)

  Em.on('q', 'bury', mo)

  Cmd.add('2048', () => start2048())
}

export
function free
() {
  Mode.remove('2048')
  Cmd.remove('2048')
}
