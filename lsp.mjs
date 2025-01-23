import * as Ed from './ed.mjs'
import * as Mess from './mess.mjs'
import * as Tron from './tron.mjs'
import { d, log } from './mess.mjs'

let id, cbs

export
function call
(lang, method, params, cb) {
  id = ++id
  if (cb)
    cbs[id] = cb
  Tron.cmd1('lsp.req', [ lang, method, id, params || {} ], err => {
    if (err) {
      Mess.yell('lsp.req: ', err.message)
      delete cbs[id]
      return
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
      log(data.log)
    if (data.response) {
      if (data.response.id === '1')
        // initialize
        return
      if (data.response.id)
        handleReqResponse(data.response)
      else
        Mess.log(JSON.stringify(data.response, null, 1))
    }
  })
}
