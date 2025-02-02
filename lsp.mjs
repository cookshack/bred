import * as Ed from './ed.mjs'
import * as Mess from './mess.mjs'
import * as Tron from './tron.mjs'
import { d } from './mess.mjs'

let id, cbs

function call
(lang, path, // absolute
 method, params, cb) {
  id = ++id
  if (cb)
    cbs[id] = cb
  Tron.cmd1('lsp.req', [ lang, path, method, id, params || {} ], err => {
    if (err) {
      Mess.yell('lsp.req: ', err.message)
      delete cbs[id]
      return
    }
  })
}

function avail
(lang) {
  return [ 'javascript', 'typescript', 'c' ].includes(lang)
}

export
function callers
(lang,
 file, // absolute
 word, // { view, from, to, text }
 cb, // ({ callers, def })
 cbSig) { // ({ sig })
  d('LSP callers')

  if (avail(lang))
    call(lang,
         file,
         'textDocument/prepareCallHierarchy',
         { textDocument: { uri: 'file://' + file },
           // 0 based
           position: { line: word.row,
                       character: word.col } },
         response => {
           if (response.error)
             console.warn('LSP callers prep: ' + response.error.message)

           d({ response })
           if (response?.result?.length) {
             let result

             result = response?.result[0]
             call(lang,
                  file,
                  'callHierarchy/incomingCalls',
                  { item: result },
                  r2 => {
                    if (r2.error)
                      console.warn('LSP callers incoming: ' + r2.error.message)

                    d({ r2 })
                    cb({ callers: r2.result, def: result })
                  })

             call(lang,
                  file,
                  'textDocument/signatureHelp',
                  { textDocument: { uri: 'file://' + file },
                    position: { line: word.row,
                                character: word.col } },
                  r3 => {
                    if (r3.error)
                      console.warn('LSP callers sig: ' + r3.error.message)

                    d({ r3 })
                    cbSig({ sig: r3.result })
                  })
           }
           else {
             cb()
             if (cbSig)
               cbSig()
           }
         })
}

function kindName
(kind) {
  if (kind == 1)
    return 'text'
  if (kind == 2)
    return 'method'
  if (kind == 3)
    return 'function'
  if (kind == 4)
    return 'constructor'
  if (kind == 5)
    return 'field'
  if (kind == 6)
    return 'variable'
  if (kind == 7)
    return 'class'
  if (kind == 8)
    return 'interface'
  if (kind == 9)
    return 'module'
  if (kind == 10)
    return 'property'
  if (kind == 11)
    return 'unit'
  if (kind == 12)
    return 'value'
  if (kind == 13)
    return 'enum'
  if (kind == 14)
    return 'keyword'
  if (kind == 15)
    return 'snippet'
  if (kind == 16)
    return 'color'
  if (kind == 17)
    return 'file'
  if (kind == 18)
    return 'reference'
  if (kind == 19)
    return 'folder'
  if (kind == 20)
    return 'enummember'
  if (kind == 21)
    return 'constant'
  if (kind == 22)
    return 'struct'
  if (kind == 23)
    return 'event'
  if (kind == 24)
    return 'operator'
  if (kind == 25)
    return 'typeparameter'
  return 'ERR'
}

export
function complete
(lang,
 file, // absolute
 word, // { view, from, to, text }
 cb) { // (words)
  //d('LSP complete')

  function clean
  (name) {
    // clangd prefixes with bullet or space, for some reason.
    if (name.startsWith('•'))
      name = name.slice(1)
    return name.trim()
  }
  call(lang,
       file,
       'textDocument/completion',
       { textDocument: { uri: 'file://' + file },
         // 0 based
         position: { line: Ed.bepRow(word.view, word.to),
                     character: Ed.bepCol(word.view, word.to) },
         context: { triggerKind: 1 } },
       response => {
         let words

         if (response.error)
           console.warn('LSP complete: ' + response.error.message)

         //d({ response })
         words = []
         if (response?.result?.items)
           for (let i = 0; i < Math.min(response.result.items.length, 100); i++) {
             let item

             item = response.result.items[i]
             words.push({ name: clean(item.label), kind: kindName(item.kind) })
           }
         cb(words)
       })

  //setTimeout(e => cb([{ name: 'a1', kind: 'function' }, { name: 'a2', kind: 'function' }]))
}

export
function init
() {
  function handleReqResponse
  (response) {
    let id, cb

    d('HANDLE')
    id = parseInt(response.id)
    cb = cbs[id]
    if (cb) {
      delete cbs[id]
      cb(response)
    }
  }

  cbs = []
  id = 1

  Tron.on('lsp', (err, data) => {
    d('LSP')
    if (data.log)
      Mess.log(data.log)
    if (data.response) {
      if (data.response.id === '1')
        // initialize
        return
      if (data.response.id)
        handleReqResponse(data.response)
      else {
        data.response.BRED = 'Random message from LSP'
        Mess.log(data.response)
      }
    }
  })
}
