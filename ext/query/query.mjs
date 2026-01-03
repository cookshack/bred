import { append, button, div, divCl, img, span } from '../../js/dom.mjs'

import * as Buf from '../../js/buf.mjs'
import * as Bred from '../../js/bred.mjs'
import * as Browse from '../../js/browse.mjs'
import * as Css from '../../js/css.mjs'
import * as Cmd from '../../js/cmd.mjs'
import * as Ed from '../../js/ed.mjs'
import * as Em from '../../js/em.mjs'
import * as Hist from '../../js/hist.mjs'
import * as Icon from '../../js/icon.mjs'
import * as Loc from '../../js/loc.mjs'
import * as Mess from '../../js/mess.mjs'
import * as Mode from '../../js/mode.mjs'
import * as Opt from '../../js/opt.mjs'
import * as Pane from '../../js/pane.mjs'
import * as Panel from '../../js/panel.mjs'
import * as Prompt from '../../js/prompt.mjs'
import * as Shell from '../../js/shell.mjs'
import * as Tron from '../../js/tron.mjs'
import { d } from '../../js/mess.mjs'

import Ollama from './lib/ollama.js'
import * as CMState from '../../lib/@codemirror/state.js'

let emo, emoAgent, premo, premoAgent, icons

function snippet
(item) {
  let split, date

  split = item.snippet?.split(' ', 3)
  if (split && (split.length > 2) && /[0-9][0-9][0-9][0-9]/.test(split[2]))
    date = split.join(' ')
  if (date)
    return [ divCl('query-item-date', date),
             item.snippet.slice(date.length) ]
  return item.snippet
}

function title
(item) {
  let favi

  try {
    let url

    url = new URL(item.link)
    favi = url.protocol + '//' + url.host + '/favicon.ico'
  }
  catch (err) {
    Ed.use(err)
  }

  if (favi)
    return [ divCl('query-item-icon',
                   img(favi, 'Icon', '', { crossorigin: 'anonymous' })),
             item.title ]
  return item.title
}

function srch
(dir, buf, query) {
  function add
  (buf, str) {
    buf?.views.forEach(view => {
      let l

      l = view.ele.querySelector('.query-llm')
      l.innerText = l.innerText + str
    })
  }

  Tron.acmd('profile.hist.add', [ query, { type: 'search' } ])
  fetch('https://www.googleapis.com/customsearch/v1'
        + '?cx=' + Opt.get('query.google.cx')
        + '&key=' + Opt.get('query.google.key')
        + '&q=' + query,
        { credentials: 'omit',
          redirect: 'error' })
    .then(response => {
      response.ok || Mess.toss(response.statusText)
      return response.json()
    })
    .then(data => {
      d(data)

      if (query.endsWith('?')) {
        let que, model

        model = buf?.opt('query.model.search') || buf?.opt('query.model.chat') || buf?.opt('query.model.agent')
        add(buf, model + ' says:\n\n')

        que = 'You are an expert. Based on the following search results, please provide a summary or answer to my question:\n\n'
        que += 'Search Results:\n'

        for (let i = 0; (i < 3) && (i < data.items.length); i++)
          que += String(i + 1) + '. ' + data.items[i].title + ' (' + data.items[i].snippet + ')\n'
        que += '\nQuestion:\n' + query + '\n'

        d(que)

        Shell.run(dir, 'llm', [ model, que ],
                  { onStdout: str => add(buf, str),
                    onStderr: str => add(buf, str) })
      }

      buf?.views.forEach(view => {
        if (view.ele) {
          let w

          w = view.ele.querySelector('.query-w')
          w.innerHTML = ''
          append(w,
                 data.items.map(item => divCl('query-item',
                                              [ divCl('query-item-t',
                                                      title(item),
                                                      { 'data-run': 'open link',
                                                        'data-path': item.link }),
                                                divCl('query-item-url',
                                                      item.formattedUrl),
                                                divCl('query-item-snippet',
                                                      snippet(item)) ])))
        }
      })
    })
    .catch(error => {
      Mess.yell(error.message)
    })
}

function url
(query) {
  return Opt.get('query.search.url.prefix') + globalThis.encodeURIComponent(query)
}

function divW
(query) {
  return divCl('query-ww',
               [ divCl('query-h', 'Query: ' + query),
                 divCl('query-links',
                       [ divCl('query-link',
                               img(Icon.path('browse'),
                                   'Browse',
                                   'filter-clr-text'),
                               { 'data-run': 'open link',
                                 'data-path': url(query) }),
                         divCl('query-link',
                               img(Icon.path('external'),
                                   'External',
                                   'filter-clr-text'),
                               { 'data-run': 'open externally',
                                 'data-url': url(query) }) ]),
                 divCl('query-llm'),
                 divCl('query-w', 'Fetching...') ])
}

export
function search
(query, spec) { // { hist }
  let p, buf

  spec = spec || {}
  p = Pane.current()
  buf = Buf.add('Query', 'Query', divW(query), p.dir)
  spec.hist?.add(query)
  p.setBuf(buf, {}, () => srch(p.dir, buf, query))
}

function appendWithEnd
(buf, text) {
  buf.vars('query').appending = 1
  buf.append(text)
  buf.vars('query').appending = 0
  buf.vars('query').promptEnd = buf.bepEnd
}

function readFileOrDirAppendStart
(buf, call) {
  appendWithEnd(buf, '\n\n' + call.subtool.schema.properties.subtool.const + ': ' + call.args.path + '...')
}

function readFileOrDir
(buf, args, cb) { // (json)
  let path, abs

  path = args.path || ''

  path = path.trim()
  if (path == '.')
    path = ''
  if (path == './')
    path = ''

  if (path.startsWith('.')
      || path.startsWith('/')) {
    cb({ error: 'Error: path must be relative',
         success: false,
         subtool: 'readFileOrDir',
         message: 'Failed to read.' })
    return
  }

  abs = Loc.make(buf.dir).join(path)

  Tron.cmd('file.stat', abs, (err, stat) => {
    if (err) {
      d('ERR file.stat')
      d(err.message)
      cb({ error: err.message,
           success: false,
           subtool: 'readFileOrDir',
           message: 'Failed to read.' })
      return
    }

    if (stat.data.mode & (1 << 15)) {
      Tron.cmd('file.get', abs, (err, data) => {
        if (err) {
          d('ERR file.get')
          d(err.message)
          cb({ error: err.message,
               success: false,
               subtool: 'readFileOrDir',
               message: 'Failed to read file.' })
          return
        }

        d('READ data')
        d(data.data)
        cb({ success: true,
             subtool: 'readFileOrDir',
             message: 'Successfully read file.',
             type: 'file',
             contents: data.data })
      })
      return
    }

    Tron.cmd('dir.get', abs, (err, data) => {
      if (err) {
        d('ERR dir.get')
        d(err.message)
        cb({ error: err.message,
             success: false,
             subtool: 'readFileOrDir',
             message: 'Failed to read directory.' })
        return
      }

      d('READ data')
      d(data.data)
      cb({ success: true,
           subtool: 'readFileOrDir',
           message: 'Successfully read directory.',
           type: 'dir',
           contents: data.data })
    })
  })
}

function readDir
(buf, args, cb) { // (json)
  let path, abs

  path = args.path || ''

  path = path.trim()
  if (path == '.')
    path = ''
  if (path == './')
    path = ''

  if (path.startsWith('.')
      || path.startsWith('/')) {
    cb({ error: 'Error: path must be the empty string, or a relative subdirectory',
         success: false,
         subtool: 'readDir',
         message: 'Failed to read directory.' })
    return
  }

  abs = Loc.make(buf.dir).join(path)

  Tron.cmd('file.stat', abs, (err, stat) => {
    if (err) {
      d('ERR file.stat')
      d(err.message)
      cb({ error: err.message,
           success: false,
           subtool: 'readDir',
           message: 'Failed to read directory.' })
      return
    }

    if (stat.data.mode & (1 << 15)) {
      cb({ error: 'Error: path is a file',
           success: false,
           subtool: 'readDir',
           message: 'Failed to read directory.' })
      return
    }

    Tron.cmd('dir.get', abs, (err, data) => {
      if (err) {
        d('ERR dir.get')
        d(err.message)
        cb({ error: err.message,
             success: false,
             subtool: 'readDir',
             message: 'Failed to read directory.' })
        return
      }

      d('READDIR data')
      d(data.data)
      cb({ success: true,
           subtool: 'readDir',
           message: 'Successfully read directory.',
           contents: data.data })
    })
  })
}

function createDir
(buf, args, cb) { // (json)
  let path, abs

  path = args.path
  if (path) {
    if (path.startsWith('.')
        || path.startsWith('/')) {
      cb({ error: 'Error: argument path must be a relative subdirectory (e.g. src/)',
           success: false,
           subtool: 'createDir',
           message: 'Failed to create directory.' })
      return
    }
  }
  else {
    cb({ error: 'Error: missing argument path',
         success: false,
         subtool: 'createDir',
         message: 'Failed to create directory.' })
    return
  }

  abs = Loc.make(buf.dir).join(path)
  d('CREATEDIR abs ' + abs)
  Tron.cmd('dir.make', abs, err => {
    if (err) {
      d('ERR createDir')
      d(err.message)
      cb({ error: err.message,
           success: false,
           subtool: 'createDir',
           message: 'Failed to create directory.' })
      return
    }
    Mess.say('Added dir ' + abs)
    cb({ success: true,
         subtool: 'createDir',
         message: 'Successfully created directory.' })
  })
}

function createFile
(buf, args, cb) { // (json)
  let path, abs

  path = args.path
  if (path) {
    if (path.startsWith('.')
        || path.startsWith('/')) {
      cb({ error: 'Error: argument path must be in the current dir or a relative subdirectory (e.g. src/eg.txt)',
           success: false,
           subtool: 'createFile',
           message: 'Failed to create file.' })
      return
    }
  }
  else {
    cb({ error: 'Error: missing argument path',
         success: false,
         subtool: 'createFile',
         message: 'Failed to create file.' })
    return
  }

  abs = Loc.make(buf.dir).join(path)
  d('CREATEFILE abs ' + abs)
  Tron.cmd('file.save', [ abs, '' ], err => {
    if (err) {
      d('ERR createFile')
      d(err.message)
      cb({ error: err.message,
           success: false,
           subtool: 'createFile',
           message: 'Failed to create file.' })
      return
    }
    Mess.say('Added dir ' + abs)
    cb({ success: true,
         subtool: 'createFile',
         message: 'Successfully created file.' })
  })
}

function createFileWithContent
(buf, args, cb) { // (json)
  let path, abs

  path = args.path
  if (path) {
    if (path.startsWith('.')
        || path.startsWith('/')) {
      cb({ error: 'Error: argument path must be in the current dir or a relative subdirectory (e.g. src/eg.txt)',
           success: false,
           subtool: 'createFile',
           message: 'Failed to create file.' })
      return
    }
  }
  else {
    cb({ error: 'Error: missing argument path',
         success: false,
         subtool: 'createFile',
         message: 'Failed to create file.' })
    return
  }

  abs = Loc.make(buf.dir).join(path)
  d('CREATEFILE abs ' + abs)
  Tron.cmd('file.save', [ abs, args.text || '' ], err => {
    if (err) {
      d('ERR createFile')
      d(err.message)
      cb({ error: err.message,
           success: false,
           subtool: 'createFile',
           message: 'Failed to create file.' })
      return
    }
    Mess.say('Added dir ' + abs)
    cb({ success: true,
         subtool: 'createFile',
         message: 'Successfully created file.' })
  })
}

function insertText
(buf, args, cb) { // (json)
  let path, abs, pos

  if (args.path)
    path = args.path
  else {
    cb({ error: 'Error: missing or empty argument path',
         success: false,
         subtool: 'insertText',
         message: 'Failed to insert text.' })
    return
  }

  if (path.startsWith('.')
      || path.startsWith('/')) {
    cb({ error: 'Error: path must be in the current directory or a subdirectory',
         success: false,
         subtool: 'insertText',
         message: 'Failed to insert text.' })
    return
  }

  abs = Loc.make(buf.dir).join(path)
  d('INSERTTEXT abs ' + abs)

  if (typeof args.position == 'undefined') {
    cb({ error: 'Error: missing argument: position',
         success: false,
         subtool: 'insertText',
         message: 'Failed to insert text.' })
    return
  }
  pos = args.position

  d({ pos })
  Tron.cmd('file.modify', [ abs, [ { type: 'insert', position: pos, text: args.text || '' } ] ], (err, data) => {
    if (err) {
      d('ERR file.modify')
      d(err.message)
      cb({ error: err.message,
           success: false,
           subtool: 'insertText',
           message: 'Failed to insert text.' })
      return
    }

    d('INSERTTEXT data')
    d(data.data)
    cb({ success: true,
         subtool: 'insertText',
         message: 'Successfully inserted text.' })
  })
}

function modifyFile
(buf, args, cb) { // (json)
  let path, abs, edit

  if (args.path)
    path = args.path
  else {
    cb({ error: 'Error: missing or empty argument path',
         success: false,
         subtool: 'modifyFile',
         message: 'Failed to modify file.' })
    return
  }

  if (path.startsWith('.')
      || path.startsWith('/')) {
    cb({ error: 'Error: path must be in the current directory or a subdirectory',
         success: false,
         subtool: 'modifyFile',
         message: 'Failed to modify file.' })
    return
  }

  abs = Loc.make(buf.dir).join(path)
  d('MODIFYFILE abs ' + abs)

  if (args.edit)
    edit = args.edit
  else {
    cb({ error: 'Error: missing or empty argument edit',
         success: false,
         subtool: 'modifyFile',
         message: 'Failed to modify file.' })
    return
  }

  d({ edit })
  Tron.cmd('file.modify', [ abs, [ edit ] ], (err, data) => {
    if (err) {
      d('ERR file.modify')
      d(err.message)
      cb({ error: err.message,
           success: false,
           subtool: 'modifiedFile',
           message: 'Failed to modified file.' })
      return
    }

    d('MODIFYFILE data')
    d(data.data)
    cb({ success: true,
         subtool: 'modifyFile',
         message: 'Successfully modified file.' })
  })
}

function moveFile
(buf, args, cb) { // (json)
  let from, to, abs_from, abs_to

  if (args.from)
    from = args.from
  else {
    cb({ error: 'Error: missing or empty argument from',
         success: false,
         subtool: 'moveFile',
         message: 'Failed to move file.' })
    return
  }

  if (args.to)
    to = args.to
  else {
    cb({ error: 'Error: missing or empty argument to',
         success: false,
         subtool: 'moveFile',
         message: 'Failed to move file.' })
    return
  }

  if (from.startsWith('.')
      || from.startsWith('/')) {
    cb({ error: 'Error: from must be in the current directory or a subdirectory',
         success: false,
         subtool: 'moveFile',
         message: 'Failed to move file.' })
    return
  }

  if (to.startsWith('.')
      || to.startsWith('/')) {
    cb({ error: 'Error: to must be in the current directory or a subdirectory',
         success: false,
         subtool: 'moveFile',
         message: 'Failed to move file.' })
    return
  }

  abs_from = Loc.make(buf.dir).join(from)
  abs_to = Loc.make(buf.dir).join(to)
  d('MOVEFILE abs ' + abs_from + ' to ' + abs_to)

  Tron.cmd('file.mv', [ abs_from, abs_to ], err => {
    if (err) {
      d('ERR file.mv')
      d(err.message)
      cb({ error: err.message,
           success: false,
           subtool: 'moveFile',
           message: 'Failed to move file.' })
      return
    }

    cb({ success: true,
         subtool: 'moveFile',
         message: 'Successfully moved file.' })
  })
}

function patchFile
(buf, args, cb) { // (json)
  let path, abs, patch

  if (args.path)
    path = args.path
  else {
    cb({ error: 'Error: missing or empty argument path',
         success: false,
         subtool: 'patchFile',
         message: 'Failed to patch file.' })
    return
  }

  if (path.startsWith('.')
      || path.startsWith('/')) {
    cb({ error: 'Error: path must be in the current directory or a subdirectory',
         success: false,
         subtool: 'patchFile',
         message: 'Failed to patch file.' })
    return
  }

  abs = Loc.make(buf.dir).join(path)
  d('PATCHFILE abs ' + abs)
  patch = args.patch || ''
  d({ patch })

  Tron.cmd('file.patch', [ abs, patch ], (err, data) => {
    if (err) {
      d('ERR file.save')
      d(err.message)
      cb({ error: err.message,
           success: false,
           subtool: 'patchFile',
           message: 'Failed to patch file.' })
      return
    }

    d('PATCHFILE data')
    d(data.data)
    cb({ success: true,
         subtool: 'patchFile',
         message: 'Successfully patched file.' })
  })
}

function readFile
(buf, args, cb) { // (json)
  let path, abs

  if (args.path)
    path = args.path
  else {
    cb({ error: 'Error: missing or empty argument path',
         success: false,
         subtool: 'readFile',
         message: 'Failed to read file.' })
    return
  }

  if (path.startsWith('.')
      || path.startsWith('/')) {
    cb({ error: 'Error: path must be in the current directory or a subdirectory',
         success: false,
         subtool: 'readFile',
         message: 'Failed to read file.' })
    return
  }

  abs = Loc.make(buf.dir).join(path)
  d('READFILE abs ' + abs)

  Tron.cmd('file.get', abs, (err, data) => {
    if (err) {
      d('ERR file.get')
      d(err.message)
      cb({ error: err.message,
           success: false,
           subtool: 'readFile',
           message: 'Failed to read file.' })
      return
    }

    d('READFILE data')
    d(data.data)
    cb({ success: true,
         subtool: 'readFile',
         message: 'Successfully read file.',
         contents: data.data })
  })
}

function removeFile
(buf, args, cb) { // (json)
  let path, abs

  if (args.path)
    path = args.path
  else {
    cb({ error: 'Error: missing or empty argument path',
         success: false,
         subtool: 'removeFile',
         message: 'Failed to remove file.' })
    return
  }

  if (path.startsWith('.')
      || path.startsWith('/')) {
    cb({ error: 'Error: path must be in the current directory or a subdirectory',
         success: false,
         subtool: 'removeFile',
         message: 'Failed to remove file.' })
    return
  }

  abs = Loc.make(buf.dir).join(path)
  d('REMOVEFILE abs ' + abs)

  Tron.cmd('file.rm', [ abs ], (err, data) => {
    if (err) {
      d('ERR file.rm')
      d(err.message)
      cb({ error: err.message,
           success: false,
           subtool: 'removeFile',
           message: 'Failed to remove file.' })
      return
    }

    d('REMOVEFILE data')
    d(data.data)
    cb({ success: true,
         subtool: 'removeFile',
         message: 'Successfully removed file.' })
  })
}

function execute
(buf, args, cb) { // (json)
  let name

  if (args.name)
    name = args.name
  else {
    cb({ error: 'Error: missing or empty argument: name',
         success: false,
         subtool: 'execute',
         message: 'Failed to run executable.' })
    return
  }

  d('EXECUTE ' + name)
  buf.dir || Mess.toss('Missing dir')
  Shell.runToString(buf.dir, name, args.args, 0, (str, code) => {
    d('EXECUTE code')
    d(code)
    cb({ success: true,
         subtool: 'execute',
         message: 'Successfully ran executable.',
         output: str,
         exitCode: code })
  })
}

function removeText
(buf, args, cb) { // (json)
  let path, abs, position, length

  if (args.path)
    path = args.path
  else {
    cb({ error: 'Error: missing or empty argument path',
         success: false,
         subtool: 'removeText',
         message: 'Failed to remove text.' })
    return
  }

  if (path.startsWith('.')
      || path.startsWith('/')) {
    cb({ error: 'Error: path must be in the current directory or a subdirectory',
         success: false,
         subtool: 'removeText',
         message: 'Failed to remove text.' })
    return
  }

  abs = Loc.make(buf.dir).join(path)
  d('REMOVETEXT abs ' + abs)

  if (typeof args.position == 'undefined') {
    cb({ error: 'Error: missing argument: position',
         success: false,
         subtool: 'removeText',
         message: 'Failed to remove text.' })
    return
  }
  position = args.position

  if (typeof args.length == 'undefined') {
    cb({ error: 'Error: missing argument: length',
         success: false,
         subtool: 'removeText',
         message: 'Failed to remove text.' })
    return
  }
  length = parseInt(args.length)

  d({ position })
  d({ length })
  Tron.cmd('file.modify', [ abs, [ { type: 'remove', position, length } ] ], (err, data) => {
    if (err) {
      d('ERR file.modify')
      d(err.message)
      cb({ error: err.message,
           success: false,
           subtool: 'removeText',
           message: 'Failed to remove text.' })
      return
    }

    d('REMOVETEXT data')
    d(data.data)
    cb({ success: true,
         subtool: 'removeText',
         message: 'Successfully inserted text.' })
  })
}

function writeFile
(buf, args, cb) { // (json)
  let path, abs

  if (args.path)
    path = args.path
  else {
    cb({ error: 'Error: missing or empty argument path',
         success: false,
         subtool: 'writeFile',
         message: 'Failed to write file.' })
    return
  }

  if (path.startsWith('.')
      || path.startsWith('/')) {
    cb({ error: 'Error: path must be in the current directory or a subdirectory',
         success: false,
         subtool: 'writeFile',
         message: 'Failed to write file.' })
    return
  }

  abs = Loc.make(buf.dir).join(path)
  d('WRITEFILE abs ' + abs)

  Tron.cmd('file.save', [ abs, args.text || '' ], (err, data) => {
    if (err) {
      d('ERR file.save')
      d(err.message)
      cb({ error: err.message,
           success: false,
           subtool: 'writeFile',
           message: 'Failed to write file.' })
      return
    }

    d('WRITEFILE data')
    d(data.data)
    cb({ success: true,
         subtool: 'writeFile',
         message: 'Successfully wrote file.' })
  })
}

function stamp
() {
  return new Date().toISOString()
}

export
function init
() {
  let hist, mo, chMo, chToolMo, extRo, allSubs, models

  function updateCredits
  (buf, key) {
    fetch('https://openrouter.ai/api/v1/auth/key',
          { method: 'GET',
            headers: { Authorization: 'Bearer ' + key,
                       'Content-Type': 'application/json' } })
      .then(response => {
        if (response.ok) {
          response.json().then(data => {
            d({ data })
            d(data.data.limit_remaining)
            buf.views.forEach(view => {
              if (view.ele) {
                let el

                el = view.ele.querySelector('.query-ml-credits')
                if (el) {
                  let dol

                  dol = parseFloat(data.data.limit_remaining)
                  if (isNaN(dol))
                    el.innerText = '$'
                  else
                    el.innerText = '$' + dol.toFixed(2)
                }
              }
            })
          })
            .catch(err => {
              d('ERR .json: ' + err.message)
            })
          return
        }
        d('Error fetching credit info')
      })
      .catch(err => {
        d('ERR fetch:')
        d(err.message)
      })
  }

  function busy
  (buf) {
    buf.vars('query').busy = 1
    buf.views.forEach(view => {
      if (view.ele) {
        let el

        el = view.ele.querySelector('.query-ml-stop')
        if (el)
          Css.show(el)
      }
    })
  }

  function done
  (buf) {
    buf.vars('query').cancel = 0
    buf.vars('query').busy = 0
    buf.views.forEach(view => {
      if (view.ele) {
        let el

        el = view.ele.querySelector('.query-ml-stop')
        if (el)
          Css.hide(el)
      }
    })
  }

  function appendRunning
  (buf, call) {
    appendWithEnd(buf, '\n\n' + 'Running ' + call.args.subtool + '...')
  }

  function appendCall
  (buf, call) {
    buf.vars('query').call = call
    if (call.autoAccept) {
      if (call.subtool.appendStart)
        call.subtool.appendStart(buf, call)
      else
        appendRunning(buf, call)
      call.yes(buf)
      return
    }
    buf.views.forEach(view => {
      if (view.ele) {
        let toolW, toolName, toolArgs, copy

        toolW = view.ele.querySelector('.query-tool-w')
        toolName = toolW.querySelector('.query-tool-name')
        toolName.innerText = call.args.subtool
        toolArgs = toolW.querySelector('.query-tool-args')
        copy = { ...call.args }
        delete copy.answer
        delete copy.subtool
        toolArgs.innerText = JSON.stringify(copy, 0, 2)
        Css.expand(toolW)
        d(call)
      }
    })
    buf.addMode('chat tool')
  }

  function makeExtRo
  () {
    extRo = CMState.EditorState.transactionFilter.of(tr => {
      if (tr.docChanged) {
        let view

        if (tr.annotation(CMState.Transaction.remote))
          return tr

        view = Ed.Backend.viewFromState(tr.state)
        if (view) {
          let end, skip

          if (view.buf?.vars('query').appending)
            return tr
          if (view.buf?.vars('query').busy)
            return []

          end = view.buf?.vars('query').promptEnd
          if (end == null)
            return tr
          tr.changes.iterChangedRanges((from, to) => {
            if (Ed.bepLt(Math.min(from, to), end))
              skip = 1
          })
          if (skip)
            return []
        }
      }
      return tr
    })
  }

  function chat
  (buf, key, msgs, prompt, cb, cbEnd) { // (msg), ()
    let model

    function stream
    (response) {
      let buffer, reader, decoder, cancelled

      d('CHAT stream')

      function cancel
      () {
        cancelled = 1
        reader.cancel()
      }

      function read
      () {
        reader.read().then(({ done, value }) => {

          if (cancelled)
            return

          if (done) {
            d('CHAT done')
            reader.cancel()
            cbEnd && cbEnd()
            return
          }

          buffer += decoder.decode(value, { stream: true })
          //d('CHAT buffer: ' + buffer)

          // Process complete lines from buffer

          while (true) {
            let lineEnd, line

            lineEnd = buffer.indexOf('\n')

            if (lineEnd === -1)
              break

            line = buffer.slice(0, lineEnd).trim()

            buffer = buffer.slice(lineEnd + 1)

            if (line.startsWith('data: ')) {
              let data, delta, json

              data = line.slice(6)

              if (data === '[DONE]')
                break

              json = JSON.parse(data)
              delta = json.choices[0].delta
              d(delta)
              if (delta.content?.length) {
                // sometimes the response is formatted entirely into a very narrow column, hoping this helps
                // if msg starts w/ nl then strip nl
                if (delta.content.startsWith('\n'))
                  delta.content = delta.content.slice(1)
                cb && cb(delta)
                buf.vars('query').msgs.push(delta)
              }
              if (delta.tool_calls?.length)
                d('ERR tool call')
            }
          }

          read()
        })
      }

      reader = response.body?.getReader() || Mess.toss('Error reading response body')

      decoder = new TextDecoder()

      buffer = ''

      read()

      buf.vars('query').cancel = cancel
    }

    function go
    () {
      d({ msgs })
      d('---- ' + emo + ' FETCH for chat from ' + model + ' ----')
      msgs.forEach(msg => d(msg))
      fetch('https://openrouter.ai/api/v1/chat/completions',
            { method: 'POST',
              headers: {
                Authorization: 'Bearer ' + key,
                'Content-Type': 'application/json'
              },

              body: JSON.stringify({
                model,
                messages: [ { role: 'system',
                              content: 'You are a helpful assistant embedded in an Electron-based code editor.' },
                            ...msgs ],
                stream: true }) })
        .then(response => {
          updateCredits(buf, key)
          if (response.ok)
            return stream(response)
          cb && cb({ content: 'fetch failed' })
          cbEnd && cbEnd()
        })
        .catch(err => {
          d('ERR fetch:')
          d(err.message)
          cb && cb({ content: 'fetch failed: ' + err.message })
          cbEnd && cbEnd()
        })
    }

    d('==== ' + emo + ' chat ====')

    prompt.length || Mess.toss('empty prompt')

    model = buf.opt('query.model.chat') || Mess.toss('Missing query.model.chat')

    msgs.push({ role: 'user',
                content: JSON.stringify({ message: prompt,
                                          date: stamp() }) })

    go()
  }

  function chatAgent
  (buf, key, msgs, prompt, cb, cbEnd, cbCall) { // (msg), (), (tool)
    let sys, model

    function handle
    (response) {
      let buffer, reader, decoder, cancelled, calls, reminds

      d('AGENT handle')

      function cancel
      () {
        cancelled = 1
        reader.cancel()
      }

      function remind
      () {
        if (reminds == 10)
          throw 'Too many reminds in a row, giving up'
        reminds++
        buf.vars('query').msgs.push({ role: 'user',
                                      content: JSON.stringify({ success: false,
                                                                date: stamp(),
                                                                message: '⚠️ Oops—you need to send a valid JSON response.' }) })

      }

      function wait
      () {
        buf.vars('query').msgs.push({ role: 'user',
                                      content: JSON.stringify({ success: false,
                                                                date: stamp(),
                                                                message: '⚠️ Waiting for your response.' }) })
      }

      function push
      (msg) {
        reminds = 0
        buf.vars('query').msgs.push(msg)
      }

      function no
      () {
        d('n')
        cancel()
        cbEnd && cbEnd()
      }

      function yes
      () {
        let call

        function end
        () {
          appendWithEnd(buf, ' done.\n\n')
        }

        d('YES')
        d(calls)
        call = calls?.at(0)
        calls = 0
        if (call)
          call.cb(res => {
            d('CALL result for ' + call.name)
            d(res)
            end()
            push({ role: 'user',
                   content: JSON.stringify(res) })
            go()
          })
        else
          end()
      }

      function read
      () {
        function addCall
        (args, subtool, call) {
          calls[0] = { args,
                       subtool,
                       autoAccept: subtool.autoAccept,
                       cb(then) { // (response)
                         d('CALL 0 running ' + args.subtool)
                         if (subtool) {
                           subtool.cb(buf, args, then)
                           return
                         }
                         d({ args })
                         d('Error: missing subtool')
                       },
                       id: call?.id,
                       index: call?.index,
                       name: call?.function.name,
                       //
                       no,
                       yes }
        }

        reader.read().then(({ done, value }) => {
          if (cancelled)
            return

          if (done) {
            let json, message

            d('AGENT done')

            calls = []
            reader.cancel()

            // parse the buffer

            json = JSON.parse(buffer)
            d({ json })
            if (json.error) {
              d('ERR from llm: ' + json.error.message)
              if (json.error.metadata)
                try {
                  let raw

                  raw = JSON.parse(json.error.metadata.raw)
                  d({ raw })
                }
                catch {
                }
              return
            }
            message = json.choices[0].message
            d(message)
            if (message.content?.length) {
              let args

              delete message.refusal
              delete message.reasoning
              push(message)

              try {
                args = JSON.parse(message.content.trim())
              }
              catch (err) {
                d('ERR failed to parse it as json: ' + err.message)
              }

              if (args?.answer?.length) {
                cb && cb({ content: args.answer })
                if (args?.subtool) {
                  // below
                }
                else {
                  cbEnd && cbEnd()
                  return
                }
              }

              if (args?.subtool) {
                let subtool

                d('  SUBTOOL ' + args.subtool)

                subtool = sys.subs.find(s => s.schema.properties.subtool.const == args.subtool)
                if (subtool) {
                  addCall(args, subtool)
                  // run the tool
                  calls[0] && cbCall(calls[0]) // will call go with response, to fetch again
                  return
                }
                d('ERR map missing subtool: ' + args.subtool)
              }
              else if (args?.answer.length == 0)
                d('ERR empty answer')
              else
                d('ERR answer and subtool missing')
              d(message.content)
              remind()
              go()
              return
            }

            d('ERR model sent empty content (happens eg when spinning up)')
            wait()
            go()
            return
          }

          buffer += decoder.decode(value, { stream: true })
          //d('AGENT buffer: ' + buffer)

          read()
        })
      }

      reminds = 0
      reader = response.body?.getReader() || Mess.toss('Error reading response body')

      decoder = new TextDecoder()

      buffer = ''

      read()

      buf.vars('query').cancel = cancel
    }

    function go
    () {
      let messages

      d('---- ' + emoAgent + ' FETCH for agent for ' + model + ' ----')

      messages = [ { role: 'system',
                     content: sys.prompt },
                   ...msgs ]

      messages.forEach(m => d(m))

      fetch('https://openrouter.ai/api/v1/chat/completions',
            { method: 'POST',
              headers: { Authorization: 'Bearer ' + key,
                         'Content-Type': 'application/json' },

              body: JSON.stringify({ model,
                                     temperature: 0,
                                     messages,
                                     ...((model.startsWith('anthropic/')
                                          || model.startsWith('mistral/'))
                                         ? {}
                                         // Only use providers that support all parameters in this request
                                         : { provider: { require_parameters: true } }),
                                     response_format: { type: 'json_schema',
                                                        json_schema: { name: 'runSubtool',
                                                                       strict: true,
                                                                       schema: { type: 'object',
                                                                                 oneOf: sys.schema,
                                                                                 additionalProperties: false } } } }) })
        .then(response => {
          updateCredits(buf, key)
          if (response.ok)
            return handle(response)
          cb && cb({ content: 'fetch failed' })
          cbEnd && cbEnd()
        })
        .catch(err => {
          d('ERR fetch:')
          d(err.message)
          cb && cb({ content: 'fetch failed: ' + err.message })
          cbEnd && cbEnd()
        })
    }

    d('==== ' + emoAgent + ' chatAgent ====')

    sys = getSys()

    prompt.length || Mess.toss('empty prompt')

    model = buf.opt('query.model.agent') || Mess.toss('Missing query.model.agent')

    msgs.push({ role: 'user',
                content: JSON.stringify({ message: prompt,
                                          date: stamp() }) })

    go()
  }

  function viewInitSpec
  (view, spec, cb) {
    let w, co

    if (0) {
      w = view.ele.querySelector('.query-w')
      //w.innerHTML = 'xx'

      append(w, co)
    }

    if (cb)
      cb(view)
  }

  function first
  (v) {
    v.point.put(v.ele.querySelector('.query-item'))
  }

  function next
  (nth) {
    let h, el, v

    v = Pane.current().view
    h = v.ele.querySelector('.query-h')
    if (v.point.over(h)) {
      first(v)
      return
    }
    el = v.point.over()
    if (el) {
      let item

      if (Css.has(el, 'query-item'))
        item = el
      else
        item = el.closest('.query-item')

      if (nth == -1)
        el = item.previousElementSibling
      else
        el = item.nextElementSibling
      if (Css.has(el, 'query-item')) {
        v.point.put(el)
        return
      }
    }
    else
      first(v)
  }

  function insert
  (dir, view, prompt) {
    let que, text, off, bep, buf

    function add
    (str) {
      d(str)
      buf.insert(str, bep)
      bep += str.length // for won,wace need something like vbepIncr(str.length) OR insert could return new bep?
    }

    text = view.buf.text()
    off = view.offset
    que = 'Provide text that matches the DESCRIPTION below, that I can insert at the specified position in the FILE below.'
    que += ' Respond only with the text that should be inserted.\n\n'
    que += '1. DESCRIPTION:\n' + prompt + '\n\n'
    que += '2. FILE:\n' + text.slice(0, off) + '[SPECIFIED POSITION]' + text.slice(off) + '\n'

    d(que)
    buf = view.buf // in case view changes, still issues if eg buf removed
    bep = view.bep
    Shell.run(dir, 'llm', [ view.buf?.opt('query.model.agent'), que ],
              { onStdout: add,
                onStderr: add })
  }

  function fim
  (dir, view, prompt) {
    let text, off, bep, buf, gen, suffix

    function add
    (str) {
      d(str)
      buf.insert(str, bep)
      bep += str.length // for won,wace need something like vbepIncr(str.length) OR insert could return new bep?
    }

    gen = async spec => {
      let response

      response = await Ollama.generate(spec)
      for await (let part of response)
        add(part.response)
      add('\n')
    }

    text = view.buf.text()
    off = view.offset
    buf = view.buf // in case view changes, still issues if eg buf removed
    bep = view.bep

    prompt = text.slice(0, off) + '\n// please insert the following: ' + prompt + '\n'
    suffix = text.slice(off)
    d({ prompt })
    d({ suffix })
    gen({ model: view.buf?.opt('query.model.agent') || view.buf?.opt('query.model.chat'),
          prompt,
          suffix,
          stream: true,
          raw: true,
          // https://github.com/ollama/ollama/blob/main/docs/modelfile.md#valid-parameters-and-values
          options: {
            //temperature: 1 // 0..1 higher is more creative
          } })
  }

  Cmd.add('llm', (u, we, model) => {
    model = model || Opt.get('query.model.local')
    Prompt.ask({ text: 'Prompt',
                 hist },
               prompt => {
                 hist.add(prompt)
                 Shell.spawn1('llm', [ model, prompt ], { end: 1 }, buf => {
                   buf.append(premo + ' ' + prompt + '\n\n')
                   buf.opts.set('core.line.wrap.enabled', 1)
                   buf.opts.set('core.lint.enabled', 0)
                   buf.mode = 'richdown'
                 })
               })
  })

  function lineStart
  () {
    let p, end

    p = Pane.current()
    end = p.view.buf?.vars('query').promptEnd
    if (end == null) {
      Cmd.run('line start')
      return
    }
    if (end < p.view.bep) {
      p.view.bep = end
      return
    }
    Cmd.run('line start')
  }

  function prevHist
  (nth) {
    let p, prev, hist

    p = Pane.current()
    hist = p.buf.vars('query').hist
    if (hist) {
      prev = nth < 0 ? hist.next() : hist.prev()
      if (prev) {
        let r

        r = promptRange(p)
        d(r)
        Ed.Backend.remove(p.view.ed, r)
        d(prev)
        p.buf.append(prev)
      }
    }
  }

  function promptRange
  (p) {
    let r, end

    p.view.bufEnd()
    end = p.view.bep
    r = Ed.vfind(p.view,
                 p.buf.vars('query').emo,
                 0,
                 { skipCurrent: 0,
                   backwards: 1,
                   stayInPlace: 1,
                   wrap: 0,
                   caseSensitive: 0,
                   wholeWord: 0,
                   regExp: 0,
                   reveal: 2 })
    r || Mess.toss('Failed to find last prompt')
    Ed.Backend.rangeEmpty(r) && Mess.toss('Failed to find last prompt')
    r.to = end
    r.from += p.buf.vars('query').emo.length
    if (r.to < r.from)
      // something went wrong
      r.to = r.from
    if (r.from < r.to)
      // skip the space. Handy for prevHist that wants to rm range
      r.from++

    return r
  }

  function expandFiles
  (buf, prompt, cb) {
    let regex, files, match, index

    function processNext
    () {
      let path

      path = files[index]
      readFileOrDir(buf, { path }, result => {
        buf.vars('query').msgs.push({ role: 'assistant',
                                      content: JSON.stringify({ answer: 'I will read the contents of ' + path,
                                                                subtool: 'readFileOrDir',
                                                                path }) })
        result = result || {}
        result.success || Mess.yell('@file:' + path + ': ' + (result.error || 'Failed to read file'))
        buf.vars('query').msgs.push({ role: 'user',
                                      content: JSON.stringify(result) })
        // Move to the next file
        index++
        if (index < files.length)
          processNext()
        else
          // All files processed. Return the cleaned prompt via callback.
          cb(prompt.replace(regex, '').trim())
      })
    }

    regex = /@file:([^\s]+)/g
    files = []

    // Find all @file:PATH occurrences in the prompt
    while ((match = regex.exec(prompt)))
      files.push(match[1])

    if (files.length == 0) {
      cb(prompt)
      return
    }

    buf.vars('query').msgs = buf.vars('query').msgs || []

    index = 0
    processNext()
  }

  function enter
  () {
    let r, p, buf, prompt, cb

    p = Pane.current()

    // parse prompt

    r = promptRange(p)

    prompt = Ed.Backend.vrangeText(p.view, r)
    prompt = prompt.trim()
    if (prompt.length == 0) {
      Mess.yell('Empty prompt')
      return
    }
    d({ prompt })

    buf = p.buf
    if (buf.vars('query').busy) {
      d('busy')
      return
    }

    // run chat

    buf.vars('query').hist.add(prompt)

    busy(buf)
    appendWithEnd(buf, '\n┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n\n')
    cb = chat
    if (p.buf.vars('query').type == 'Agent')
      cb = chatAgent
    cb(buf, Opt.get('query.key'), buf.vars('query').msgs, prompt,
       msg => {
         d('CHAT enter append: ' + msg.content)
         appendWithEnd(buf, msg.content)
       },
       () => {
         d('cbEnd')
         appendWithEnd(buf, '\n─────────────────────────────\n\n' + buf.vars('query').premo + ' ')
         done(buf)
       },
       call => {
         d('cbCall')
         appendCall(buf, call)
         //done(buf)
       })
  }

  function suggest
  (under, query, placeholder) {
    Tron.acmd('profile.hist.suggest', [ query ])
      .then(data => {
        let frag

        d(data)
        frag = new globalThis.DocumentFragment()
        append(frag,
               divCl('bred-prompt-sug0',
                     [ divCl('bred-prompt-sug0-type',
                             img(Icon.path('search'), '🔍', 'filter-clr-text')),
                       divCl('bred-prompt-sug0-text', query || placeholder) ]))
        data.urls?.forEach(url => {
          append(frag,
                 divCl('bred-prompt-sug',
                       url.item.href,
                       { 'data-run': 'close demand',
                         'data-after': 'open link',
                         'data-path': url.item.href }))
        })
        under.innerHTML = ''
        append(under, frag)
        Css.enable(under)
      })
  }

  function divMl
  (model, type, query) {
    let question

    query = query.trim()
    if (query.endsWith('?'))
      question = query
    question = query + '?'
    return divCl('ml edMl',
                 [ divCl('query-ml-icon',
                         img(Icon.path('chat'), 'Chat', 'filter-clr-text'),
                         { 'data-run': 'describe buffer' }),
                   divCl('query-ml-type', type == 'Agent' ? emoAgent : emo),
                   divCl('query-ml-model',
                         model,
                         { 'data-run': 'set buffer model',
                           'data-name': model }),
                   divCl('query-ml-credits', '$'),
                   divCl('query-ml-new',
                         button('New',
                                'bred-ml-button',
                                { 'data-run': 'chat' })),
                   divCl('query-ml-stop',
                         button([ img(Icon.path('stop'), 'Stop', 'query-ml-icon filter-clr-text'),
                                  'Stop' ],
                                'bred-ml-button',
                                { 'data-run': 'stop response' })),
                   divCl('query-ml-brow query-link',
                         img(Icon.path('browse'), 'Browse', 'filter-clr-text'),
                         { 'data-run': 'open link',
                           'data-path': url(question) }),
                   divCl('query-ml-ext query-link',
                         img(Icon.path('external'), 'External', 'filter-clr-text'),
                         { 'data-run': 'open externally',
                           'data-url': url(question) }),
                   divCl('ml-close') ])
  }

  function accept
  () {
    let p, call

    p = Pane.current()
    call = p.buf.vars('query').call
    p.buf.rmMode('chat tool')
    p.buf.views.forEach(view => {
      if (view.ele) {
        let toolW

        toolW = view.ele.querySelector('.query-tool-w')
        Css.retract(toolW)
      }
    })
    appendRunning(p.buf, call)
    call?.yes(p.buf)
  }

  function reject
  () {
    let p, call

    p = Pane.current()
    call = p.buf.vars('query').call
    p.buf.rmMode('chat tool')
    p.buf.views.forEach(view => {
      if (view.ele) {
        let toolW

        toolW = view.ele.querySelector('.query-tool-w')
        Css.retract(toolW)
      }
    })
    appendWithEnd(p.buf, '\n\n' + 'Declined to run ' + call.args.subtool)
    call?.no()
  }

  Cmd.add('stop response', () => {
    let p

    p = Pane.current()
    if (p.buf.vars('query').busy)
      if (p.buf.vars('query').cancel) {
        p.buf.vars('query').cancel()
        appendWithEnd(p.buf, ' ...stopped.\n\n' + p.buf.vars('query').premo + ' ')
        done(p.buf)
      }
      else
        Mess.toss('cancel function missing')
  })

  function runPrompt
  (prompt, type, model) {
    let name, buf, p, cb

    cb = chat
    if (type == 'Agent')
      cb = chatAgent

    name = type + ': ' + prompt
    p = Pane.current()
    buf = Buf.find(b2 => b2.name == name)

    if (buf)
      buf.dir = p.dir
    else {
      let w, toolW, toolName

      toolName = divCl('query-tool-name')
      toolW = divCl('query-tool-w retracted',
                    [ divCl('query-tool-q',
                            [ divCl('query-tool-text',
                                    [ 'Run ', toolName, '?' ]),
                              divCl('query-tool-y',
                                    button([ span('Y', 'key'), 'es' ],
                                           'query-tool-button',
                                           { 'data-run': 'accept tool' })),
                              divCl('query-tool-n',
                                    button([ span('N', 'key'), 'o' ],
                                           'query-tool-button',
                                           { 'data-run': 'reject tool' })) ]),
                      divCl('query-tool-args') ])
      w = Ed.divW(0, 0,
                  { ml: divMl(model, type, prompt),
                    extraCo: toolW })
      buf = Buf.add(name, 'richdown', w, p.dir)
      buf.vars('query').type = type
      buf.vars('query').emo = (type == 'Agent' ? emoAgent : emo)
      buf.vars('query').premo = (type == 'Agent' ? premoAgent : premo)
      buf.vars('ed').fillParent = 0
      buf.addMode('chat')
      //buf.addMode('view')
      buf.icon = 'chat'
    }
    busy(buf)
    buf.vars('query').msgs = []

    hist.add(prompt)
    buf.vars('query').hist = Hist.ensure(name)
    if (buf.vars('query').hist.length == 0)
      buf.vars('query').hist.add(prompt)

    buf.clear()
    p.setBuf(buf, {}, () => {
      appendWithEnd(buf, buf.vars('query').premo + ' ' + prompt + '\n┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n\n')
      buf.opts.set('core.line.wrap.enabled', 1)
      buf.opts.set('core.lint.enabled', 0)
      prompt = expandFiles(buf, prompt, prompt => {
        d({ prompt })
        cb(buf, Opt.get('query.key'), buf.vars('query').msgs, prompt,
           msg => {
             //d('CHAT append: ' + msg.content)
             appendWithEnd(buf, msg.content)
           },
           () => {
             d('cbEnd')
             appendWithEnd(buf, '\n─────────────────────────────\n\n' + buf.vars('query').premo + ' ')
             done(buf)
           },
           // only used by chatAgent
           call => {
             d('cbCall ' + call.name)
             appendCall(buf, call)
             //done(buf)
           })
      })
    })
  }

  function prompt
  (type, model) {
    Prompt.ask({ text: (type == 'Agent' ? emoAgent : emo) + ' ' + model,
                 hist },
               prompt => runPrompt(prompt, type, model))
  }

  Cmd.add('agent', () => {
    prompt('Agent', Opt.get('query.model.agent'))
  })

  Cmd.add('chat', () => {
    prompt('Chat', Opt.get('query.model.chat'))
  })

  Cmd.add('agent buffer', () => {
    runPrompt(Pane.current().buf.text(), 'Agent', Opt.get('query.model.agent'))
  })

  Cmd.add('chat buffer', () => {
    runPrompt(Pane.current().buf.text(), 'Chat', Opt.get('query.model.chat'))
  })

  function setModel
  (type) {
    Prompt.choose('Set ' + type + ' model', models.map(m => m.name), {}, choice => {
      if (choice) {
        Opt.set('query.model.' + type, choice)
        return
      }
      Mess.throw('ERR: choice: ' + choice)
    })
  }

  function setBufModel
  () {
    let buf

    buf = Pane.current().buf
    Prompt.choose('Buffer model', models.map(m => m.name), {}, choice => {
      if (choice) {
        if (buf.vars('query').type == 'Agent')
          buf.opts.set('query.model.agent', choice)
        else
          buf.opts.set('query.model.chat', choice)
        buf.views.forEach(view => {
          if (view.ready && view.ele) {
            let el

            el = view.ele.querySelector('.query-ml-model')
            el.innerText = choice
            el.dataset.name = choice
          }
        })
        return
      }
    })
  }

  Cmd.add('llm insert', () => {
    Prompt.ask({ text: 'Describe what should be inserted',
                 hist },
               prompt => {
                 let p

                 p = Pane.current()

                 hist.add(prompt)
                 prompt = prompt.trim()
                 insert(p.dir, p.view, prompt)
               })
  })

  Cmd.add('fim', () => {
    Prompt.ask({ text: 'Describe what should be inserted',
                 hist },
               prompt => {
                 let p

                 p = Pane.current()

                 hist.add(prompt)
                 prompt = prompt.trim()
                 fim(p.dir, p.view, prompt)
               })
  })

  Cmd.add('go', (u, we) => {
    Prompt.ask({ text: 'Go',
                 placeholder: we?.e.target.dataset.url,
                 hist,
                 suggest },
               query => {
                 query = query.trim()
                 if (query.startsWith('http://')
                     || query.startsWith('https://')) {
                   Browse.browse(query)
                   return
                 }
                 if (query.startsWith('file://')) {
                   Pane.open(query)
                   return
                 }
                 search(query, { hist })
               })
  })

  Cmd.add('google', () => {
    Prompt.ask({ text: 'Query',
                 hist },
               query => {
                 query = query.trim()
                 search(query, { hist })
               })
  })

  function getSys
  () {
    let on, subs

    function getArgs
    (props) {
      let out

      out = ''
      Object.keys(props).forEach((key, i) => {
        if (i)
          out += ', '
        out += (key + ': ')
        if (key == 'subtool')
          out += ('"' + props[key].const + '"')
        else
          out += props[key].type
      })
      return out
    }

    function getPromptSubDescr
    () {
      let out

      out = ''
      // - insertText({ path: string, position: integer, text: string })
      subs.forEach(sub => out += ('\n - ' + sub.schema.properties.subtool.const + '({ ' + getArgs(sub.schema.properties) + ' })' ))
      return out
    }

    on = [ 'createDir',
           'createFileWithContent',
           'moveFile',
           'readFileOrDir',
           'removeFile',
           'writeFile' ]

    subs = allSubs.filter(s => on.includes(s.key))

    return { subs,
             schema: [ ...subs.map(s => s.schema),
                       { type: 'object',
                         description: 'Send freeform text',
                         properties: { answer: { type: 'string',
                                                 description: 'Human readable freeform text.' } },
                         required: [ 'answer' ] } ],
             prompt: 'You are a helpful assistant inside an Electron code editor on a ' + Bred.os() + ` system.
Your goal is to complete a task by using a sequence of responses.
You respond with valid JSON that may include a call to a subtool:

  {
    "answer": string,
    "subtool": string, // optional
    // plus any subtool-specific args
  }

and then you wait for the user's response.  The user's response is also valid JSON:

  {
    success: boolean,
    subtool: string, // optional
    message: string // optional
    // plus any subtool-specific fields
  }

Available subtools:` + getPromptSubDescr() + `

When you want to ask the user something or deliver commentary, use the "answer" field.

Current Date: ${stamp()}

EXAMPLE 1:

User →
{
  "message": "Create a file ‘notes/todo.txt’ with the text ‘Buy milk’, then show me its contents.",
  "date": "2025-07-29T13:00:37.938Z"
}

Assistant →
{
  "answer": "I will create the dir first."
  "subtool": "createDir",
  "path": "notes"
}

User →
{ "success": true }

Assistant →
{
  "answer": "",
  "subtool": "createFile",
  "path": "notes/todo.txt"
}

User →
{ "success": true }

Assistant →
{
  "answer": "",
  "subtool": "insertText",
  "path": "notes/todo.txt",
  "position": 0,
  "text": "Buy milk" }
}

User →
{ "success": true }

Assistant →
{
  "answer": "",
  "subtool": "readFileOrDir",
  "path": "notes/todo.txt"
}

User →
{ "success": true, type: "file", "contents": "Buy milk" }

Assistant →
{
  "answer": "Here is notes/todo.txt:\n\nBuy milk"
}

EXAMPLE 2:

User →
{
  "message": "Revert the changes to file abc.js",
  "date": "2025-07-29T15:34:08.082Z"
}

Assistant →
{
  "answer": "I will execute the a command to revert the file."
  "subtool": "execute",
  "name": "git",
  "args": [ "checkout", "HEAD", "--", "abc.js" ]
}

User →
{
  "success": true,
  "code": "0",
  "output": ""
}` }
  }

  allSubs = [ { key: 'createDir',
                cb: createDir,
                schema: { type: 'object',
                          description: 'Create a new directory, returning a JSON object with a success message.',
                          properties: { answer: { type: 'string',
                                                  description: 'Human readable freeform text.' },
                                        subtool: { const: 'createDir' },
                                        path: { type: 'string',
                                                description: "Path to the directory to create (e.g. 'src/newDir'). Must be a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." } },
                          required: [ 'answer', 'subtool', 'path' ] } },
              { key: 'createFileWithContent',
                cb: createFileWithContent,
                schema: { type: 'object',
                          description: 'Create a new file.',
                          properties: { answer: { type: 'string',
                                                  description: 'Human readable freeform text.' },
                                        subtool: { const: 'createFile' },
                                        path: { type: 'string',
                                                description: "Path to the file to create (e.g. 'src/new.txt'). Must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." },
                                        text: { type: 'string',
                                                description: 'Contents of the new file.' } },
                          required: [ 'answer', 'subtool', 'path' ] } },
              { key: 'createFile',
                cb: createFile,
                schema: { type: 'object',
                          description: 'Create a new empty file.',
                          properties: { answer: { type: 'string',
                                                  description: 'Human readable freeform text.' },
                                        subtool: { const: 'createFile' },
                                        path: { type: 'string',
                                                description: "Path to the file to create (e.g. 'src/new.txt'). Must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." } },
                          required: [ 'answer', 'subtool', 'path' ] } },
              { key: 'patchFile',
                cb: patchFile,
                schema: { type: 'object',
                          description: 'Apply a unified diff to a file, returning a JSON object with a success message.',
                          properties: { answer: { type: 'string',
                                                  description: 'Human readable freeform text.' },
                                        subtool: { const: 'patchFile' },
                                        path: { type: 'string',
                                                description: "Path to the file to patch (e.g. 'src/eg.js'). Must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." },
                                        patch: { type: 'string',
                                                 description: 'A patch to apply to the file, in unified diff format.' } },
                          required: [ 'answer', 'subtool', 'path', 'patch' ] } },
              { key: 'insertText',
                cb: insertText,
                schema: { type: 'object',
                          description: 'Insert text into an existing file.',
                          properties: { answer: { type: 'string',
                                                  description: 'Human readable freeform text.' },
                                        subtool: { const: 'insertText' },
                                        path: { type: 'string',
                                                description: "Path to the file that must be modified. The file must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." },
                                        position: { type: 'integer',
                                                    description: 'The position from where the text should be insert. This is counted in number of characters (including newlines) from the start of the file (starting from 0).' },
                                        text: { type: 'string',
                                                description: 'The text to insert.' } },
                          required: [ 'answer', 'subtool', 'path', 'position', 'text' ] } },
              { key: 'modifyFile',
                cb: modifyFile,
                schema: { type: 'object',
                          description: 'Replace a portion of an existing file.',
                          properties: { answer: { type: 'string',
                                                  description: 'Human readable freeform text.' },
                                        subtool: { const: 'modifyFile' },
                                        path: { type: 'string',
                                                description: "Path to the file that must be modified. The file must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." },
                                        edit: { type: 'object',
                                                properties: { type: { const: 'replace' },
                                                              from: { type: 'integer',
                                                                      description: 'The position from where the text should be replaced, in number of characters (including newlines) from the start of the file (starting from 0).' },
                                                              to: { type: 'integer',
                                                                    description: 'The end position of where the replacement should happen, in number of characters (including newlines) from the start of the file (starting from 0).' },
                                                              with: { type: 'string',
                                                                      description: 'The new text that will go between from and to.' } },
                                                required: [ 'type', 'from', 'to', 'text' ] } },
                          required: [ 'answer', 'subtool', 'path', 'edit' ] } },
              { key: 'moveFile',
                cb: moveFile,
                schema: { type: 'object',
                          description: 'Move or rename a file.',
                          properties: { answer: { type: 'string',
                                                  description: 'Human readable freeform text.' },
                                        subtool: { const: 'moveFile' },
                                        from: { type: 'string',
                                                description: "Path to the file that must be moved. The file must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." },
                                        to: { type: 'string',
                                              description: "New location and name for the file. This path must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." } },
                          required: [ 'answer', 'subtool', 'from', 'to' ] } },
              { key: 'readFileOrDir',
                cb: readFileOrDir,
                autoAccept: 1,
                schema: { type: 'object',
                          description: 'Read a file or a directory. Returns a JSON object that includes a success message and, if successful, the directory/file contents.',
                          properties: { answer: { type: 'string',
                                                  description: 'Human readable freeform text.' },
                                        subtool: { const: 'readFileOrDir' },
                                        path: { type: 'string',
                                                description: 'Path to the file or directory to read (e.g. "src" or "src/eg.js"). Use "" for the current directory.' } },
                          required: [ 'subtool', 'path' ] },
                appendStart: readFileOrDirAppendStart },
              { key: 'readDir',
                cb: readDir,
                autoAccept: 1,
                schema: { type: 'object',
                          description: 'List all entries (files and directories) in either the current directory or a specified subdirectory. Use "" for the current directory. Returns a JSON object that includes a success message and, if successful, the directory contents.',
                          properties: { answer: { type: 'string',
                                                  description: 'Human readable freeform text.' },
                                        subtool: { const: 'readDir' },
                                        path: { type: 'string',
                                                description: 'Path to the directory from which to list files (e.g. "src"). Use "" for the current directory.' } },
                          required: [ 'subtool', 'path' ] } },
              { key: 'readFile',
                cb: readFile,
                autoAccept: 1,
                schema: { type: 'object',
                          description: 'Read a file, returning a JSON object that includes a success message and the file contents.',
                          properties: { answer: { type: 'string',
                                                  description: 'Human readable freeform text.' },
                                        subtool: { const: 'readFile' },
                                        path: { type: 'string',
                                                description: "Path to the file to create (e.g. 'src/eg.js'). Must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." } },
                          required: [ 'answer', 'subtool', 'path' ] } },
              { key: 'removeText',
                cb: removeText,
                schema: { type: 'object',
                          description: 'Remove text from a file.',
                          properties: { answer: { type: 'string',
                                                  description: 'Human readable freeform text.' },
                                        subtool: { const: 'removeText' },
                                        path: { type: 'string',
                                                description: "Path to the file that must be modified. The file must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." },
                                        position: { type: 'integer',
                                                    description: 'The position from where the text should be removed. This is counted in number of characters (including newlines) from the start of the file (starting from 0).' },
                                        length: { type: 'integer',
                                                  description: 'The number of characters to remove, including newlines.' } },
                          required: [ 'answer', 'subtool', 'path', 'position', 'length' ] } },
              { key: 'removeFile',
                cb: removeFile,
                schema: { type: 'object',
                          description: 'Remove a file, returning a JSON object that contains a success message.',
                          properties: { answer: { type: 'string',
                                                  description: 'Human readable freeform text.' },
                                        subtool: { const: 'removeFile' },
                                        path: { type: 'string',
                                                description: "Path to the file to remove (e.g. 'src/eg.js'). Must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." } },
                          required: [ 'answer', 'subtool', 'path' ] } },
              { key: 'execute',
                cb: execute,
                schema: { type: 'object',
                          description: `Run an command in the current directory, returning a JSON object that contains a success message and the output.

### Examples

\`\`\`json
{ "answer": "I will now run the command ls -l -a",
  "subtool": "execute",
  "name": "ls",
  "args": [ "-l", "-a", "subdir/" ] }

{ "answer": "",
  "subtool": "execute",
  "name": "echo",
  "args": [ "Hello, world!" ] }

{ "answer": "",
  "subtool": "execute",
  "name": "cp",
  "args": [ "source.txt", "destination.txt" ] }

\`\`\`
`,
                          properties: { answer: { type: 'string',
                                                  description: 'Human readable freeform text.' },
                                        subtool: { const: 'execute' },
                                        name: { type: 'string',
                                                description: "The name of the executable to run (e.g. 'ls', 'echo', 'git', 'pwd')." },
                                        args: { type: 'array',
                                                items: { type: 'string' },
                                                description: 'The arguments to pass to the command. (e.g. for `ls`, you might pass `-l` or `-a` in `args`' } },
                          required: [ 'answer', 'subtool', 'name', 'args' ] } },
              { key: 'writeFile',
                cb: writeFile,
                schema: { type: 'object',
                          description: 'Writes the provided `text` to the file at `path`, overwriting any existing contents. Be sure to include any existing content that should be preserved.',
                          properties: { answer: { type: 'string',
                                                  description: 'Human readable freeform text.' },
                                        subtool: { const: 'writeFile' },
                                        path: { type: 'string',
                                                description: "Path to the file to write (e.g. 'src/eg.js'). Must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." },
                                        text: { type: 'string',
                                                description: 'New contents for the file.' } },
                          required: [ 'answer', 'subtool', 'path', 'text' ] } } ]

  models = [ { name: 'deepseek/deepseek-chat-v3.1' },
             { name: 'deepseek/deepseek-chat-v3.1:free' },
             { name: 'deepseek/deepseek-chat-v3-0324' },
             { name: 'deepseek/deepseek-chat-v3-0324:free' },
             { name: 'deepseek/deepseek-v3.2' },
             { name: 'deepseek/deepseek-v3.2-exp' },
             { name: 'deepseek/deepseek-v3.1-terminus' },
             { name: 'inclusionai/ling-1t' },
             { name: 'meta-llama/llama-4-maverick' },
             { name: 'meta-llama/llama-4-scout' },
             { name: 'meta-llama/llama-4-scout:free' },
             { name: 'minimax/minimax-m2' },
             { name: 'minimax/minimax-m2:free' },
             { name: 'minimax/minimax-m2.1' },
             { name: 'mistralai/devstral-small' },
             { name: 'mistralai/devstral-small-2505:free' },
             { name: 'openai/gpt-oss-120b' },
             { name: 'qwen/qwen3-235b-a22b-thinking-2507' },
             { name: 'qwen/qwen3-coder' },
             { name: 'qwen/qwen3-coder:free' },
             { name: 'qwen/qwen3-coder-30b-a3b-instruct' },
             { name: 'qwen/qwen3-v1-235b-a22b-instruct' },
             { name: 'z-ai/glm-4.7' },
             { name: 'z-ai/glm-4-32b' }, // chat only
             { name: 'z-ai/glm-4-32b:free' },
             //
             { name: 'moonshotai/kimi-k2' },
             { name: 'moonshotai/kimi-k2:free' },
             { name: 'anthropic/claude-sonnet-4' } ]

  emo = '🔮' // 🗨️
  premo = '#### ' + emo
  emoAgent = '🤖' // ✨
  premoAgent = '#### ' + emoAgent
  hist = Hist.ensure('llm')

  Opt.declare('query.model.agent', 'str', 'meta-llama/llama-4-maverick')
  Opt.declare('query.model.chat', 'str', 'deepseek/deepseek-chat-v3-0324')
  Opt.declare('query.model.local', 'str', 'mistral')

  Opt.declare('query.search.url.prefix', 'str', 'https://google.com/search?q=')
  Opt.declare('query.google.cx', 'str', '')
  Opt.declare('query.google.key', 'str', '')

  makeExtRo()

  Cmd.add('set agent model', () => setModel('agent'))
  Cmd.add('set chat model', () => setModel('chat'))

  chMo = Mode.add('Chat', { minor: 1,
                            wexts: [ { backend: 'cm',
                                       make: () => extRo,
                                       part: new CMState.Compartment } ] })

  Cmd.add('enter', () => enter(), chMo)
  Cmd.add('line start', () => lineStart(), chMo)
  Cmd.add('next history item', () => prevHist(-1), chMo)
  Cmd.add('previous history item', () => prevHist(), chMo)

  Em.on('Enter', 'enter', chMo)
  Em.on('A-p', 'previous history item', chMo)
  Em.on('A-n', 'next history item', chMo)
  // override richdown
  Em.on('e', 'self insert', chMo)
  Em.on('n', 'self insert', chMo)
  Em.on('p', 'self insert', chMo)
  Em.on('q', 'self insert', chMo)
  Em.on('Backspace', 'delete previous char', chMo)
  Em.on(' ', 'self insert', chMo)

  chToolMo = Mode.add('Chat Tool', { minor: 1 })

  Cmd.add('accept tool', () => accept(), chToolMo)
  Cmd.add('reject tool', () => reject(), chToolMo)
  Cmd.add('set buffer model', () => setBufModel(), chToolMo)

  Em.on('y', 'accept tool', chToolMo)
  Em.on('n', 'reject tool', chToolMo)
  Em.on('C-g', 'reject tool', chToolMo)

  mo = Mode.add('Query', { viewInitSpec })

  Cmd.add('next', () => next(), mo)
  Cmd.add('previous', () => next(-1), mo)

  Em.on('n', 'Next', mo)
  Em.on('p', 'Previous', mo)
  // should use view mode
  Em.on('q', 'bury', mo)
  Em.on('Backspace', 'scroll up', mo)
  Em.on(' ', 'scroll down', mo)
  Em.on('Enter', 'select', mo)

  Em.on('C-x i', 'llm insert', 'ed')

  icons = [ div(divCl('mini-icon',
                      img(Icon.path('search'), 'Web Search', 'filter-clr-text')),
                'mini-web-search mini-icon onfill mini-em',
                { 'data-run': 'go' }),
            div(divCl('mini-icon',
                      img(Icon.path('chat'), 'Chat', 'filter-clr-text')),
                'mini-chat mini-icon onfill mini-em',
                { 'data-run': 'chat' }) ]
  Panel.start('mini-panel', icons[1])
  Panel.start('mini-panel', icons[0])
}

export
function free
() {
  Cmd.remove('go')
  Cmd.remove('google')
  Cmd.remove('llm')
  Mode.remove('Query')
  icons.forEach(i => i.remove())
}
