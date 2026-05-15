import { LRLanguage, LanguageSupport } from '../lib/@codemirror/language.js'
import { Tag, styleTags, tags } from '../lib/@lezer/highlight.js'

let lang

export let customTags

customTags = { patchNewfile: Tag.define(), patchOldfile: Tag.define(), patchFilename: Tag.define() }

export
function patch
() {
  return lang
}

export
function makeFromParser
(parser) {
  let props, configuredParser, lrLang

  props = [ styleTags({ OldFile: [ tags.meta, customTags.patchOldfile ],
                        NewFile: [ tags.meta, customTags.patchNewfile ],
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
