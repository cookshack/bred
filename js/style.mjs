import { importCss } from './json.mjs'
import { d } from './mess.mjs'

export
function initCss1
(file, yell) {
  d('initCss1: ' + file)
  importCss(file)
    .then(m => {
      d('initCss1: ' + file + ': done')
      globalThis.document.adoptedStyleSheets = [ ...globalThis.document.adoptedStyleSheets, m.default ]
    },
          err => yell('Failed to load  ' + file + ': ' + err.message))
}

export
function initCss
(yell) {
  let files, file

  files = [ '../css/bred.css',
            '../css/dir.css',
            '../css/describe-cmd.css',
            '../css/describe-key.css',
            '../css/ed.css',
            '../css/exts.css',
            '../css/lang.css',
            '../css/langs.css',
            '../css/mess.css',
            '../css/buffers.css',
            '../css/switch.css',
            '../css/cut.css',
            '../css/exec.css',
            '../css/test-buffer.css',
            '../css/manpage.css',
            '../css/options.css',
            '../css/recent.css',
            '../css/vc.css',
            '../css/web.css' ]
  files.forEach(f => initCss1(f, yell))

  file = '../lib/sheets.mjs'
  import(file)
    .then(m => {
      m.sheets.forEach(f => initCss1(f))
    },
          err => yell('Failed to load  ' + file + ': ' + err.message))
    .catch(err => yell('Failed to import  ' + file + ': ' + err.message))
}
