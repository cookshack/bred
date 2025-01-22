import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Lsp from '../../lsp.mjs'
import * as Mess from '../../mess.mjs'
import * as Opt from '../../opt.mjs'
import * as Pane from '../../pane.mjs'
import { d } from '../../mess.mjs'

import * as CMAuto from '../../lib/@codemirror/autocomplete.js'
import * as CMState from '../../lib/@codemirror/state.js'

let brexts, part

function makeAutocomplete
(view) {
  let autocomplete, lang

  function autocompleteTags
  (context) {
    let word, options, p

    d('AC tags')

    word = context.matchBefore(/\w*/)
    if (context.explicit ? 0 : (word.from == word.to))
      return null

    options = []

    p = Pane.current()
    word.view = p.view

    return new Promise(resolve => {
      for (let count = 0, i = 0; i < Ed.ctags.length; i++)
        if (Ed.ctags[i].name.startsWith(word.text)) {
          options.push({ label: Ed.ctags[i].name, type: Ed.ctags[i].kind })
          if (count++ > 10)
            break
        }
      resolve({ from: word.from,
                options: options || [] })
    })
  }

  function autocompleteLsp
  (lang, context) {
    let word, options, p

    d('AC lsp')

    word = context.matchBefore(/\w*/)
    if (context.explicit ? 0 : (word.from == word.to))
      return null

    options = []

    p = Pane.current()
    word.view = p.view

    return new Promise(resolve => {
      Lsp.complete(lang, p.buf.path, word, words => {
        d({ words })
        if (words.length)
          options = words.map(w => {
            return { label: w.name, type: w.kind }
          })
        else {
          if (0)
            for (let count = 0, i = 0; i < Ed.ctags.length; i++)
              if (Ed.ctags[i].name.startsWith(word.text)) {
                options.push({ label: Ed.ctags[i].name, type: Ed.ctags[i].kind })
                if (count++ > 10)
                  break
              }
          if (0)
            options = [ { label: 'match', type: 'keyword' },
                        { label: 'hello', type: 'variable', info: '(World)' },
                        { label: 'magic', type: 'text', apply: '⠁⭒*.✩.*⭒⠁', detail: 'macro' } ]
        }
        resolve({ from: word.from,
                  options: options || [] })
      })
    })
  }

  0 && (autocomplete = autocompleteTags)
  lang = view.buf.opt('core.lang')
  if ([ 'javascript', 'typescript' ].includes(lang))
    autocomplete = ctx => autocompleteLsp('javascript', ctx)
  if ([ 'c' ].includes(lang))
    autocomplete = ctx => autocompleteLsp('c', ctx)

  if (autocomplete)
    return CMAuto.autocompletion({ activateOnTyping: false, // would be overridden by bred handlers anyway
                                   ...(autocomplete ? { override: [ autocomplete ] } : {}),
                                   closeOnBlur: false,
                                   defaultKeymap: false })
  return []
}

function makeLang
(view) {
  let id, lang

  id = view.buf.opt('core.lang') || 'text'

  lang = Ed.findLang(id)
  if (lang?.language)
    return [ lang.language,
             ...(lang.support ? [ lang.support ] : []),
             ...(view.buf.opt('core.autocomplete.enabled') ? [ makeAutocomplete(view) ] : []) ]
  Mess.log('missing lang: ' + id)
  return []
}

export
function init
() {
  brexts = []
  part = new CMState.Compartment
  Opt.declare('core.autocomplete.enabled', 'bool', 1)
  Opt.declare('core.lang', 'str', undefined)

  brexts.push(Ed.register({ backend: 'cm',
                            part,
                            make: makeLang,
                            reconfOpts: [ 'core.lang', 'core.autocomplete.enabled' ] }))

  Cmd.add('enable autocomplete', u => Ed.enable(u, 'core.autocomplete.enabled'))
  Cmd.add('buffer enable autocomplete', u => Ed.enableBuf(u, 'core.autocomplete.enabled'))
}

export
function free
() {
  Cmd.remove('enable autocomplete')
  Cmd.remove('buffer enable autocomplete')
  brexts.forEach(b => b?.free())
}
