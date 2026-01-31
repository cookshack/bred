import * as Loc from './loc.mjs'
import * as U from './util.mjs'
import * as Wode from './wodemirror.mjs'
import { d } from './mess.mjs'

export
function modeFromLang
(id) {
  if (id == 'shell')
    return 'sh'
  if (id == 'plaintext')
    return 'text'
  return id
}

export
function modeLang
(id) {
  if (id == 'sh')
    return 'shell'
  return id
}

export
function modeFor
(path) {
  if (path) {
    let lang, filename

    d('modeFor path: ' + path)
    path = U.stripCompressedExt(path)
    d('modeFor real: ' + path)
    filename = Loc.make(path).filename
    lang = Wode.langs.find(l => l.path && l.path.test(path))
      || Wode.langs.find(l => l.filename && l.filename.test(filename))
      || Wode.langs.find(l => l.filenames?.some(fn => filename == fn))
      || Wode.langs.find(l => l.extensions?.some(e => path.toLowerCase().endsWith(e.toLowerCase())))
    d('modeFor lang: ' + lang?.id)
    return modeFromLang(lang?.id)
  }
  return 'Ed'
}

export
function patchModeKey
() {
  return 'diff'
}
