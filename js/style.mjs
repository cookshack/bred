import * as Loc from './loc.mjs'
import { d } from './mess.mjs'

function importCss
(file) {
  return import(file, { with: { type: 'css' } })
}

export
function initCss1
(file, yell) {
  d('initCss1: ' + file)
  importCss(file)
    .then(m => {
      d('initCss1: ' + file + ': done')
      globalThis.document.adoptedStyleSheets = [ ...globalThis.document.adoptedStyleSheets, m.default ]
    },
          err => yell('Failed to load ' + file + ': ' + err.message))
}

export
function initCss
(yell) {
  let files

  files = [ 'bred.css',
            'browse.css',
            'dir.css',
            'describe-cmd.css',
            'describe-key.css',
            'ed.css',
            'exts.css',
            'lang.css',
            'langs.css',
            'mess.css',
            'buffers.css',
            'switch.css',
            'cut.css',
            'exec.css',
            'test-buffer.css',
            'manpage.css',
            'options.css',
            'recent.css',
            'vc.css',
            'web.css' ]
  files.forEach(f => initCss1(Loc.appDir().join('css/' + f), yell))
}
