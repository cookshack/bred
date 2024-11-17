import * as Cmd from '../../cmd.mjs'
import * as Em from '../../em.mjs'
import * as Mess from '../../mess.mjs'
import * as Pane from '../../pane.mjs'
import * as Prompt from '../../prompt.mjs'
//import { d } from '../../mess.mjs'

import './lib/spellchecker-wasm.js'

let Checker

Checker = globalThis['spellchecker-wasm'].SpellcheckerWasm

function handle
(results) {
  if (results?.length)
    Mess.say('Correction: ' + results[0].term)
  else
    Mess.say('OK')
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
    if (checker)
      checker.checkSpelling(word)
    else
      Mess.yell('Spell checker still loading')
  }

  initSpell().then(c => checker = c)

  Cmd.add('spell check word', () => {
    Prompt.ask({ text: 'Check spelling of' },
               text => check(text))
  })

  Cmd.add('spell check word at point', () => {
    let p, l, pos, word

    p = Pane.current()
    l = p.line()
    pos = p.pos()
    pos = pos.col
    word = wordAt(l, pos)
    if (word)
      check(word)
    else
      Mess.yell('Move to a word first')
  })

  Em.on('A-$', 'spell check word at point')
}

export
function free
() {
  Cmd.remove('spell check word')
  Cmd.remove('spell check word at point')
}
