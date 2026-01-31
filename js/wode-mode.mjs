import * as Cmd from './cmd.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Icon from './icon.mjs'
import * as Loc from './loc.mjs'
import Mk from './mk.mjs'
import * as Mode from './mode.mjs'
import * as U from './util.mjs'
import * as Win from './win.mjs'
import * as Wode from './wodemirror.mjs'
import * as WodeDecor from './wode-decor.mjs'
import { d } from './mess.mjs'

export let wexts

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

export
function makeExtsMode
(view) {
  if (view.wode.wextsMode)
    return view.wode.wextsMode.filter(b => b.make).map(b => b.make(view))
  return []
}

// Make cm extensions for the wexts of every minor mode.
//
export
function makeExtsMinors
(view) {
  let exts

  exts = []
  view.buf?.minors.forEach(mode => mode.wexts?.filter(w => w.make).forEach(w => exts.push(w.make(view))))
  return exts
}

function seize
(b, mode) {
  d('ed seizing ' + b.name + ' for ' + mode.name)
  b.views.forEach(v => {
    let effects, exts

    // remove old mode specific extensions, add new ones
    v.wode.wextsMode = v.buf.mode.wexts
    exts = makeExtsMode(v)
    effects = v.wode.comp.extsMode.reconfigure(exts)
    v.ed.dispatch({ effects })

    if (v.ed && (v.win == Win.current()))
      WodeDecor.decorate(v, b.mode)
  })
}

function cTopLevelStart
() {
  Wode.topLevelStart([ '#if', '#end' ])
}

function cTopLevelEnd
() {
  Wode.topLevelEnd([ '#if', '#end' ])
}

export
function addMode
(lang, spec) {
  let mode, exts, mime, key

  function seizeLang
  (b) {
    d('WODE ' + lang.id + ' seizing ' + b.name)
    seize(b, mode)
    b.opts.set('core.lang', lang.id)
  }

  function minfo
  (exts) {
    if (exts)
      return exts.map(e => Ed.mimeByExt[e]).filter(mi => mi)

    return []
  }

  spec = spec || {}
  exts = lang.extensions?.map(e => e.slice(1))
  mime = minfo(exts)
  key = modeFromLang(lang.id)
  d('adding mode for ' + lang.id + ' with exts: ' + exts)
  mode = Mode.add(key,
                  { assist: spec.assist,
                    name: key,
                    viewInit: Wode.viewInit,
                    viewCopy: Wode.viewCopy,
                    initFns: Ed.initModeFns,
                    parentsForEm: 'ed',
                    exts,
                    wexts: spec.wexts,
                    mime,
                    //
                    onRemove: Wode.onBufRemove,
                    seize: seizeLang })
  lang.mode = mode

  if (lang.id == 'css') {
    //Cmd.add('insert }', (u,we) => insertClose(u, we, mode), mode)
    //Em.on('}', 'insert }', mode)
  }
  else if (lang.id == 'richdown') {
    Em.on('e', 'markdown mode', 'richdown')
    Em.on('C-c C-c', 'markdown mode', 'richdown')
    // should use view mode
    Em.on('n', 'next line', 'richdown')
    Em.on('p', 'previous line', 'richdown')
    Em.on('q', 'bury', 'richdown')
    Em.on('Backspace', 'scroll up', 'richdown')
    Em.on(' ', 'scroll down', 'richdown')
  }
  else if (lang.id == 'markdown')
    Em.on('C-c C-c', 'rich', 'markdown')
  else if (lang.id == 'c') {
    Cmd.add('top level start', () => cTopLevelStart(), mode)
    Cmd.add('top level end', () => cTopLevelEnd(), mode)
  }

  if ([ 'javascript', 'css', 'cpp' ].includes(lang.id))
    Em.on('}', 'self insert and indent', mode)
  mode.icon = Icon.mode(mode.key)

  if (spec?.onAddMode)
    spec.onAddMode(mode)
}

export
function init
() {
  wexts = Mk.array
}
