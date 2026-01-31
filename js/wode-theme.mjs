import * as Buf from './buf.mjs'
import * as Ed from './ed.mjs'
import * as Tron from './tron.mjs'
import * as Opt from './opt.mjs'
import * as Win from './win.mjs'
import * as Wode from './wode.mjs'

import * as CMTheme from '../lib/@uiw/codemirror-themes/index.js'
import * as CMState from '../lib/@codemirror/state.js'
import { theme as ThemeLight } from './theme-solarized-light.mjs'
import { theme as ThemeDark } from './theme-solarized-dark.mjs'
import * as LZHighlight from '../lib/@lezer/highlight.js'

import * as CMLang from '../lib/@codemirror/language.js'

export let themeExtension, themeExtensionPart, Theme
export let themeHighlightingCode, themeExtensionCode

let theme, themeTags, themeHighlighting

export
function handleCustomTags
(m) {
  if (m.customTags) {
    let highlightStyle

    for (let t in m.customTags)
      themeTags[t] = m.customTags[t]
    highlightStyle = CMLang.HighlightStyle.define(themeStyles(themeTags))
    themeExtension = CMLang.syntaxHighlighting(highlightStyle)
    Buf.forEach(buf => buf.views.forEach(view => {
      if (view.ed && (view.win == Win.current()))
        if (buf.opt('core.highlight.syntax.enabled'))
          view.ed.dispatch({ effects: themeExtensionPart.reconfigure([ themeExtension,
                                                                       themeHighlighting ]) })
    }))
  }
}

function themeStyles
(tags) {
  let styles

  styles = [ { tag: tags.attributeName, color: Theme.fg('attribute.name') },
             { tag: tags.angleBracket, color: Theme.fg('delimiter.angle') },
             { tag: tags.annotation, backgroundColor: Theme.meanings.fill }, // eg kcl @setting
             { tag: tags.bool, color: Theme.fg('variable.name') },
             { tag: tags.comment, color: Theme.fg('comment') },
             { tag: tags.className, color: Theme.fg('class.identifier') },
             { tag: tags.definition(tags.variableName), color: Theme.fg('variable.name.def') },
             { tag: tags.definition(tags.propertyName), color: Theme.fg('variable.name.def') },
             { tag: tags.function(tags.definition(tags.variableName)), color: Theme.fg('function.name.def') },
             { tag: tags.deleted, color: Theme.fg('minus') },
             { tag: tags.emphasis, color: Theme.fg('bold') },
             { tag: tags.heading, color: Theme.fg('bold') },
             { tag: tags.heading1, color: Theme.fg('bold'), fontSize: '2rem' },
             { tag: tags.heading2, color: Theme.fg('bold'), fontSize: '1.75rem' },
             { tag: tags.heading3, color: Theme.fg('bold'), fontSize: '1.5rem' },
             { tag: tags.heading4, color: Theme.fg('bold'), fontSize: '1.25rem' },
             { tag: tags.inserted, color: Theme.fg('plus') },
             { tag: tags.invalid, color: Theme.fg('invalid') },
             { tag: tags.special(tags.invalid), backgroundColor: Theme.meanings.fill, color: Theme.meanings.nb3, fontWeight: 'bold' },
             { tag: tags.keyword, color: Theme.fg('keyword') },
             { tag: tags.link, color: Theme.fg(''), textDecoration: 'underline' },
             { tag: tags.meta, backgroundColor: Theme.meanings.fill }, // eg patch @@ line
             { tag: tags.null, color: Theme.fg('variable.name') },
             { tag: tags.number, color: Theme.fg('number') },
             { tag: tags.operator, color: Theme.fg('operators') },
             { tag: tags.regexp, color: Theme.fg('regexp') },
             { tag: tags.standard(tags.variableName), color: Theme.fg('variable.name.std') },
             { tag: tags.strikethrough, textDecoration: 'line-through' },
             { tag: [ tags.string, tags.special(tags.brace) ], color: Theme.fg('string') },
             { tag: tags.strong, color: Theme.fg('bold') },
             { tag: tags.tagName, color: Theme.fg('tag') },
             { tag: tags.typeName, color: Theme.fg('type.identifier') },
             { tag: tags.variableName, color: Theme.fg('text') } ]

  if (tags.diffNewfile)
    styles.unshift({ tag: tags.diffNewfile, // patch +++ line
                     fontWeight: 'bold',
                     backgroundColor: Theme.meanings.fill,
                     color: Theme.fg('plus') })
  if (tags.diffOldfile)
    styles.unshift({ tag: tags.diffOldfile, // patch --- line
                     fontWeight: 'bold',
                     backgroundColor: Theme.meanings.fill,
                     color: Theme.fg('minus') })
  if (tags.diffFilename)
    styles.unshift({ tag: tags.diffFilename,
                     backgroundColor: Theme.meanings.fill,
                     color: Theme.fg('bold') })

  if (tags.gitHash)
    styles.unshift({ tag: tags.gitHash,
                     cursor: 'pointer',
                     color: Theme.fg('comment') })

  return styles
}

export
function init
() {
  let themeCode

  function init
  () {
    let themeSettings

    themeTags = LZHighlight.tags
    themeSettings = { backgroundImage: '',
                      foreground: Theme.meanings.text,
                      caret: Theme.meanings.pointCurrent,
                      //selection: 'rgb(38 139 210 / 20%)', //'rgb(238 232 213 / 45%)', //Theme.clrs.yellow,
                      selection: Theme.meanings.nb0Light,
                      selectionMatch: 'var(--clr-fill-aux)',
                      lineHighlight: Theme.meanings.nb0VeryLight, //'rgb(238 232 213 / 60%)', //Theme.meanings.fill,
                      gutterBorder: '1px solid #ffffff10',
                      gutterBackground: Theme.meanings.fill,
                      gutterForeground: Theme.meanings.text }
    theme = CMTheme.createTheme({ theme: 'light',
                                  settings: { background: Theme.meanings.bg,
                                              ...themeSettings },
                                  styles: themeStyles(themeTags) })
    themeHighlighting = theme[0]
    themeExtension = theme[1]

    // theme for Ed.code, used eg by ext/rich
    themeCode = CMTheme.createTheme({ theme: 'code-light',
                                      settings: { background: Theme.meanings.fill,
                                                  ...themeSettings },
                                      styles: themeStyles(themeTags) })
    themeHighlightingCode = themeCode[0]
    themeExtensionCode = themeCode[1]
    Tron.acmd('hover.css', [ Theme.meanings.text, Theme.meanings.fill ])
  }

  function makeTheme
  () {
    return [ themeExtension, themeHighlighting ]
  }

  if (Opt.get('core.theme.mode') == 'light')
    Theme = ThemeLight
  else
    Theme = ThemeDark
  Ed.initTheme(Theme)
  init()

  themeExtensionPart = new CMState.Compartment

  Wode.register({ backend: 'cm',
                  part: themeExtensionPart,
                  make: makeTheme,
                  reconfOpts: [ 'core.theme.mode' ] })
}
