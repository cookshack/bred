import { LRLanguage, LanguageSupport } from '../lib/@codemirror/language.js'
import { Tag, styleTags, tags } from '../lib/@lezer/highlight.js'

let lang

export let customTags

customTags = { diffNewfile: Tag.define(), diffOldfile: Tag.define(), diffFilename: Tag.define() }

export
function patch
() {
  return lang
}

export
function makeFromParser
(parser) {
  let props, configuredParser, lrLang

  props = [ styleTags({ OldFile: [ tags.meta, customTags.diffOldfile ],
                        NewFile: [ tags.meta, customTags.diffNewfile ],
                        HunkHeader: tags.meta,
                        GitDiff: tags.meta,
                        IndexLine: tags.meta,
                        MetaLine: tags.meta,
                        Inserted: tags.inserted,
                        Deleted: tags.deleted }) ]
  configuredParser = parser.configure({ props })
  lrLang = LRLanguage.define({ name: 'patch',
                               parser: configuredParser,
                               languageData: {} })
  lang = new LanguageSupport(lrLang)

  return lang
}
