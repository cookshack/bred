import { d, log } from './main-log.mjs'
import { fork, spawn } from 'node:child_process'
import Path from 'node:path'
import * as Peer from './main-peer.mjs'
import * as Project from './main-project.mjs'

let win

export
function setWin
(w) {
  win = w
}

export
function onEdit
(e, ch, onArgs) {
  let [ lang, path, bufId ] = onArgs

  function send
  (msg) {
    if (win)
      win.webContents.send('lsp', { log: 'MAIN LSP edit: ' + msg })
  }

  d('LSP onEdit ' + lang + ', ' + path)

  if (path && lang) {
    let p

    send(lang + ', ' + path)
    p = Project.get(lang, path, bufId)
    send('project dir: ' + p.dir)
  }
  e.sender.send(ch, {})
}

export
function onReq
(e, ch, onArgs) {
  let [ lang, path, bufId, method, id, params ] = onArgs
  let lsp, p

  d('LSP onReq ' + lang + ', ' + path)

  p = Project.get(lang, path, bufId)
  lsp = p?.lsps[lang]
  if (lsp)
    setTimeout(() => lsp.req(lang,
                             path,
                             { method: method,
                               ...(id ? { id: id } : {}),
                               params: params }))

  return {}
}

export
function make
(lang, dir) {
  let lsp, initialized, buffer // u8
  let clen // in bytes
  let capabilities, valueSet
  let files, tsproc, encoder, decoder, bcl, crnlLen, codeCr, codeNl

  function dbg
  (msg) {
    if (0)
      log(msg)
  }

  function bconcat
  (b1, b2) {
    let b3

    b3 = new (b1.constructor)(b1.length + b2.length)
    b3.set(b1, 0)
    b3.set(b2, b1.length)
    return b3
  }

  function bstartsWith
  (b1, b2) {
    if (b1.length >= b2.length) {
      for (let i = 0; i < b2.length; i++) {
        if (b1.at(i) == b2.at(i))
          continue
        return 0
      }
      return 1
    }
    return 0
  }

  function _req
  (json) {
    let str, full

    str = JSON.stringify({ jsonrpc: '2.0',
                           ...json })

    full = 'Content-Length: ' + str.length + '\r\n\r\n' + str

    if (1) {
      d('REQUEST: [' + full + ']')
      tsproc.stdin.write(full)
    }
  }

  function initialize
  () {
    _req({ method: 'initialize',
           id: 1,
           params: { processId: -1,
                     capabilities: capabilities,
                     rootPath: '.',
                     rootUri: null,
                     workspaceFolders: dir ? [ { name: dir, url: 'file://' + dir } ] : [],
                     initializationOptions: { tsserver: { logDirectory: '/tmp/',
                                                          logVerbosity: 'verbose',
                                                          trace: 'off' } }, // off/messages/verbose delivered through LSP messages
                     trace: 'verbose' } })
  }

  function req
  (language, file, json) {
    if (initialized && files.includes(file))
      _req(json)
  }

  function doOpen
  (language, file, text) {
    if (initialized)
      _req({ method: 'textDocument/didOpen',
             params: { textDocument: { uri: 'file://' + file,
                                       // ids listed under interface here
                                       // https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocumentItem
                                       languageId: language,
                                       version: 0,
                                       text: text } } })
  }

  function open
  (language, file, // absolute
   bufId) {
    if (initialized) {
      let buf

      d('LSP OPEN')
      if (files.includes(file))
        return
      files.push(file)
      if (win)
        win.webContents.send('lsp',
                             { log: 'MAIN LSP ' + language + ': open file ' + file /*+ ': [' + text + ']'*/ })

      d('LSP peer get ' + bufId)
      buf = Peer.get(bufId)
      if (buf)
        if (buf.text)
          doOpen(language, file, buf.text.toString())
        else
          d('LSP buf missing text')
      else
        d('LSP buf missing')
    }
    else
      d('LSP OPEN before init')
  }

  function parse
  () {
    dbg('LSP PARSE')
    while (1) {
      if (bstartsWith(buffer, bcl)) {
        let crI

        // Content-Length: ...\r\n
        dbg('LSP STARTSWITH: cl')
        crI = buffer.indexOf(codeCr)
        if (crI > 0) {
          let nlI

          dbg('LSP FOUND: cr')
          nlI = buffer.indexOf(codeNl)
          if (nlI == crI + 1) {
            let bnum

            dbg('LSP FOUND: nl')
            bnum = buffer.slice(bcl.length, crI)
            //d(sl)
            if (bnum.length) {
              clen = parseInt(decoder.decode(bnum))
              dbg('LSP CLEN: ' + clen + ' bytes')
              buffer = buffer.slice(nlI + 1)
            }
          }
        }
      }

      if ((buffer.length >= 2)
          && (buffer.at(0) == codeCr)
          && (buffer.at(1) == codeNl)) {
        // empty line between Content-Length: and content.
        buffer = buffer.slice(crnlLen)
        if (0)
          dbg('LSP BETWEEN: ' + buffer)
      }

      if (clen && buffer.length && (buffer.length >= clen)) {
        let str, json

        //d(clen)
        //d('[' + decoder.decode(buffer) + ']')
        str = decoder.decode(buffer.slice(0, clen))
        //d('JSON.parse: ' + str)
        try {
          json = JSON.parse(str)
        }
        catch (err) {
          console.error('JSON.parse: ' + err.message)
        }
        dbg('LSP RESPONSE:')
        //d('  id: ' + json.id)
        // if id call any handler
        dbg(JSON.stringify(json, null, 2))
        d(JSON.stringify(json, null, 2).substring(0, 1000))
        if (json.id == 1) {
          if (json.error) {
            console.error('LSP: initialize FAILED: ' + json.error.message)
            return
          }
          d('LSP INITIALIZED')
          d(JSON.stringify(json))
          initialized = 1
        }
        else if (win)
          win.webContents.send('lsp', { response: json })
        else
          console.error('LSP MISSING: win')
        buffer = buffer.slice(clen)
        clen = undefined
      }
      else
        break
    }
  }

  files = []

  valueSet = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25 ]

  capabilities = { textDocument: { synchronization: { dynamicRegistration: true },
                                   completion: { completionItem: { commitCharactersSupport: false,
                                                                   documentationFormat: [ 'markdown', 'plaintext' ],
                                                                   snippetSupport: false },
                                                 completionItemKind: { valueSet: valueSet },
                                                 contextSupport: true,
                                                 dynamicRegistration: false } } }

  if (lang == 'javascript')
    tsproc = fork(Path.join(import.meta.dirname,
                            'lib/typescript-language-server/lib/cli.mjs'),
                  [ '--stdio', '--log-level', '4' ],
                  { cwd: import.meta.dirname,
                    stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ] })
  else if (lang == 'c')
    tsproc = spawn('clangd',
                   [ '--log', 'verbose' ],
                   { cwd: import.meta.dirname,
                     stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ] })
  else
    throw new Error('Missing LSP support for lang: ' + lang)
  d('LSP started ' + lang)

  lsp = { open,
          req }

  tsproc.on('exit', code => log('LSP EXIT ' + code))
  tsproc.on('error', code => log('LSP ERROR ' + code))
  tsproc.stdout && tsproc.stdout.setEncoding('utf-8')

  tsproc.stdout.on('data',
                   data => {
                     dbg('LSP DATA: [' + data + ']')
                     buffer = bconcat(buffer, encoder.encode(data))
                     dbg('LSP BUFFER: [' + decoder.decode(buffer) + ']')

                     parse()
                   })

  tsproc.stderr.on('data',
                   data => {
                     log('LSP STDERR: ')
                     d(String(data)?.substring(1, 1000))
                     process.stderr.write(data)
                   })

  encoder = new TextEncoder()
  decoder = new TextDecoder()

  buffer = encoder.encode('')
  bcl = encoder.encode('Content-Length: ')
  crnlLen = encoder.encode('\r\n').length
  codeCr = '\r'.charCodeAt(0)
  codeNl = '\n'.charCodeAt(0)

  initialize()

  return lsp
}
