import { d, log } from './main-log.mjs'
import { fork } from 'node:child_process'
import Path from 'node:path'

export
function make
() {
  let lsp, initialized, buffer // u8
  let clen // in bytes
  let capabilities, valueSet
  let files, tsproc, encoder, decoder, bcl, crnlLen, codeCr, codeNl

  function onReq
  (e, ch, onArgs) {
    let [ method, id, params ] = onArgs

    setTimeout(() => lsp.req({ method: method,
                               ...(id ? { id: id } : {}),
                               params: params }))

    return {}
  }

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
                     //rootUri: 'file://' + dir,
                     //workspaceFolders: workspaceFolders,
                     initializationOptions: { tsserver: { logDirectory: '/tmp/',
                                                          logVerbosity: 'verbose',
                                                          trace: 'off' } }, // off/messages/verbose delivered through LSP messages
                     trace: 'verbose' } })
  }

  function req
  (json) {
    if (initialized)
      _req(json)
  }

  function open
  (file, language, text) { // absolute
    if (initialized) {
      if (files.includes(file))
        return
      req({ method: 'textDocument/didOpen',
            params: { textDocument: { uri: 'file://' + file,
                                      // ids listed under interface here
                                      // https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocumentItem
                                      languageId: language,
                                      version: 0,
                                      text: text } } })
      files.push(file)
    }
  }

  function parse
  () {
    dbg('PARSE')
    while (1) {
      if (bstartsWith(buffer, bcl)) {
        let crI

        // Content-Length: ...\r\n
        dbg('STARTSWITH: cl')
        crI = buffer.indexOf(codeCr)
        if (crI > 0) {
          let nlI

          dbg('FOUND: cr')
          nlI = buffer.indexOf(codeNl)
          if (nlI == crI + 1) {
            let bnum

            dbg('FOUND: nl')
            bnum = buffer.slice(bcl.length, crI)
            //d(sl)
            if (bnum.length) {
              clen = parseInt(decoder.decode(bnum))
              dbg('CLEN: ' + clen + ' bytes')
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
          dbg('BETWEEN: ' + buffer)
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
        dbg('RESPONSE:')
        //d('  id: ' + json.id)
        // if id call any handler
        dbg(JSON.stringify(json, null, 2))
        if (json.id == 1) {
          if (json.error) {
            console.error('LSP: initialize FAILED: ' + json.error.message)
            return
          }
          dbg('INITIALIZED')
          initialized = 1
        }
        else if (lsp.win)
          lsp.win.webContents.send('lsp', { response: json })
        else
          console.error('MISSING: lsp.win')
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

  lsp = { onReq,
          open,
          req }

  tsproc = fork(Path.join(import.meta.dirname,
                          'lib/typescript-language-server/lib/cli.mjs'),
                [ '--stdio', '--log-level', '4' ],
                { cwd: import.meta.dirname,
                  stdio: [ 'pipe', 'pipe', 'pipe', 'ipc' ] })

  tsproc.on('exit', code => log('EXIT ' + code))
  tsproc.on('error', code => log('ERROR ' + code))
  tsproc.stdout && tsproc.stdout.setEncoding('utf-8')

  tsproc.stdout.on('data',
                   data => {
                     dbg('DATA: [' + data + ']')
                     buffer = bconcat(buffer, encoder.encode(data))
                     dbg('BUFFER: [' + decoder.decode(buffer) + ']')

                     parse()
                   })

  tsproc.stderr.on('data',
                   data => {
                     log('STDERR: ')
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
