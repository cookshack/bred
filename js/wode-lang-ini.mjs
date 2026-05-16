import { LRLanguage, LanguageSupport } from '../lib/@codemirror/language.js'
import { styleTags, tags } from '../lib/@lezer/highlight.js'

let lang

export
function ini
() {
  return lang
}

export
function makeFromParser
(parser) {
  let props, configuredParser, lrLang

  props = [ styleTags({ Comment: tags.comment,
                        SectionHeader: tags.heading,
                        Property: tags.propertyName,
                        Context: tags.content }) ]
  configuredParser = parser.configure({ props })
  lrLang = LRLanguage.define({ name: 'ini',
                               parser: configuredParser,
                               languageData: {} })
  lang = new LanguageSupport(lrLang)

  return lang
}
