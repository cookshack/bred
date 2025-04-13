import * as Cmd from '../../js/cmd.mjs'
import * as Em from '../../js/em.mjs'
import * as Mess from '../../js/mess.mjs'
import * as Pane from '../../js/pane.mjs'
import * as Prompt from '../../js/prompt.mjs'
import * as Win from '../../js/win.mjs'
//import { d } from '../../js/mess.mjs'

import './lib/spellchecker-wasm.js'

let Checker, term

Checker = globalThis['spellchecker-wasm'].SpellcheckerWasm

function handle
(results) {
  if (results?.length)
    if (results.find(r => r.term == term))
      Mess.say('OK')
    else {
      let corr

      corr = ''
      if (results.length > 1) {
        corr = ' (OR '
        for (let i = 1; i < 5 && i < results.length; i++)
          corr += ' ' + results[i].term
        if (results.length > 5)
          corr += '...)'
        else
          corr += ')'
      }
      Mess.yell(results[0].term + corr)
    }
  else
    Mess.yell('??')
}

async function initSpell
() {
  let wasm, dict, bigram, checker

  wasm = await fetch(new URL('./lib/spellchecker-wasm.wasm', import.meta.url))
  dict = await fetch(new URL('./lib/frequency_dictionary_en_82_765.txt', import.meta.url))
  bigram = await fetch(new URL('./lib/frequency_bigramdictionary_en_243_342.txt', import.meta.url)) // Optional

  checker = new Checker(handle)
  await checker.prepareSpellchecker(wasm, dict, bigram)
  return checker
}

export
function init
() {
  let checker

  function wordAt
  (l, pos) {
    if (l.length == 0)
      return 0
    if (l[pos] == ' ')
      return 0
    while (pos > 0) {
      if (l[pos] == ' ') {
        pos++
        break
      }
      pos--
    }
    l = l.slice(pos)
    return l.split(' ')[0]
  }

  function check
  (word) {
    term = 0
    if (checker) {
      term = word.toLowerCase()
      checker.checkSpelling(term,
                            { includeUnknown: false,
                              includeSelf: true,
                              maxEditDistance: 2, // all
                              verbosity: 2 }) // all
    }
    else
      Mess.yell('Spell checker still loading')
  }

  function checkAtPoint
  (p) {
    let l, pos, word

    l = p.line()
    pos = p.pos()
    pos = pos.col
    word = wordAt(l, pos)
    if (word)
      check(word)
    else
      Mess.yell('??')
  }

  initSpell().then(c => checker = c)

  Cmd.add('spell check word', () => {
    Prompt.ask({ text: 'Check spelling of' },
               text => check(text))
  })

  Cmd.add('spell check word at point', () => {
    let p

    p = Pane.current()
    checkAtPoint(p)
  })

  Cmd.add('spell check word at click', (u, we) => {
    if (we?.e && (we.e.button == 0)) {
      let p, x, y

      p = Pane.current()
      let win

      win = Win.current()
      x = win.lastContext?.x ?? 0
      y = win.lastContext?.y ?? 0
      p.goXY(x, y)
      checkAtPoint(p)
    }
  })

  Em.on('A-$', 'spell check word at point')
}

export
function free
() {
  Cmd.remove('spell check word')
  Cmd.remove('spell check word at point')
}
