import { append, button, div, divCl, img, span } from '../../js/dom.mjs'

import * as Buf from '../../js/buf.mjs'
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

let emo, emoAgent, premo, premoAgent, icons, subtoolMap

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
        let que

        add(buf, buf?.opt('query.model') + ' says:\n\n')

        que = 'You are an expert. Based on the following search results, please provide a summary or answer to my question:\n\n'
        que += 'Search Results:\n'

        for (let i = 0; (i < 3) && (i < data.items.length); i++)
          que += String(i + 1) + '. ' + data.items[i].title + ' (' + data.items[i].snippet + ')\n'
        que += '\nQuestion:\n' + query + '\n'

        d(que)

        Shell.run(dir, 'llm', [ buf?.opt('query.model'), que ],
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

function sendAnswer
(buf, args, cb) { // (json)
  let text

  text = args.text || ''

  cb({ success: true,
       subtool: 'sendAnswer',
       text })
}

function readDir
(buf, args, cb) { // (json)
  let path, abs

  path = args.path || ''

  if (path.startsWith('.')
      || path.startsWith('/')) {
    cb({ error: 'Error: path must be the empty string, or a relative subdirectory',
         success: false,
         subtool: 'readDir',
         message: 'Failed to read directory.' })
    return
  }

  path = path || buf.path

  abs = Loc.make(buf.path).join(path)
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
}

function createDir
(buf, args, cb) { // (json)
  let path, abs

  path = args.path
  if (path) {
    if (path.startsWith('.')
        || path.startsWith('/')) {
      cb({ error: 'Error: argument path must be or a relative subdirectory (e.g. src/)',
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

  abs = Loc.make(buf.path).join(path)
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

  abs_from = Loc.make(buf.path).join(from)
  abs_to = Loc.make(buf.path).join(to)
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

  abs = Loc.make(buf.path).join(path)
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

  abs = Loc.make(buf.path).join(path)
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

  abs = Loc.make(buf.path).join(path)
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

export
function init
() {
  let hist, mo, chMo, chToolMo, extRo, tools, subs, systemPrompt

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

  function appendWithEnd
  (buf, text) {
    buf.vars('query').appending = 1
    buf.append(text)
    buf.vars('query').appending = 0
    buf.vars('query').promptEnd = buf.bepEnd
  }

  function appendCall
  (buf, call) {
    buf.vars('query').call = call
    if (call.autoAccept) {
      call.yes()
      return
    }
    buf.views.forEach(view => {
      if (view.ele) {
        let toolW, toolName, toolArgs

        toolW = view.ele.querySelector('.query-tool-w')
        toolName = toolW.querySelector('.query-tool-name')
        toolName.innerText = call.args.subtool
        toolArgs = toolW.querySelector('.query-tool-args')
        toolArgs.innerText = JSON.stringify(call.args, 0, 2)
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
  (buf, model, key, msgs, prompt, cb, cbEnd) { // (msg), ()
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
      d('---- ' + emo + ' FETCH for chat ----')
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
          response.ok || Mess.toss('fetch failed')
          return stream(response)
        })
        .catch(err => {
          Mess.yell('fetch: ' + err.message)
        })
    }

    d('==== ' + emo + ' chat ====')

    prompt.length || Mess.toss('empty prompt')

    model = model || 'meta-llama/llama-3.3-70b-instruct:free'

    msgs.push({ role: 'user', content: prompt })

    go()
  }

  function chatAgent
  (buf, model, key, msgs, prompt, cb, cbEnd, cbCall) { // (msg), (), (tool)
    function handle
    (response) {
      let buffer, reader, decoder, cancelled, calls, reminds

      d('CHAT handle')

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
        buf.vars('query').msgs.push({ 'role': 'assistant',
                                      'name': 'runSubtool',
                                      'content': JSON.stringify({ 'subtool': 'sendAnswer',
                                                                  'text': '⚠️ Oops—I need to send exactly one JSON runSubtool call.' }) })

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

        d('YES')
        d(calls)
        call = calls?.at(0)
        calls = 0
        if (call)
          call.cb(res => {
            d('CALL result for ' + call.name)
            d(res)
            push({ role: 'tool',
                   toolCallId: call.id,
                   tool_call_id: call.id,
                   name: call.name,
                   content: JSON.stringify(res) })
            if ((call.args.subtool == 'sendAnswer')
                && res.success) {
              cb && cb({ content: res.text })
              cbEnd && cbEnd()
              return
            }
            go()
          })
      }

      function read
      () {
        reader.read().then(({ done, value }) => {
          if (cancelled)
            return

          if (done) {
            let json, message

            d('CHAT done')

            reader.cancel()

            // parse the buffer

            json = JSON.parse(buffer)
            d({ json })
            message = json.choices[0].message
            d(message)
            if (message.content?.length) {
              d('ERR model sent plain text:')
              d(message.content)
              remind()
              go()
              return
            }

            // setup tool call

            if (message.tool_calls?.length == 1) {
              let call

              // tool call
              calls = []

              push(message)

              d('TOOL 0 parsing')
              call = message.tool_calls[0]
              if ((call.type == 'function')
                  && (call.function?.name == 'runSubtool')) {
                let args, subtool

                args = {}
                if (call.function.arguments?.trim())
                  try {
                    args = JSON.parse(call.function.arguments?.trim())
                  }
                  catch (err) {
                    d('ARGS:')
                    d(call.function.arguments)
                    d('Error parsing tool args (maybe model tried to combine two calls in one?): ' + err.message)
                  }
                if (args.subtool) {
                  d('  SUBTOOL ' + args.subtool)
                  subtool = subtoolMap[args.subtool]
                  calls[0] = { args,
                               subtool,
                               autoAccept: subtool.autoAccept,
                               cb(then) { // (response)
                                 d('CALL 0 running ' + call.function.name)
                                 if (subtool) {
                                   subtool.cb(buf, args, then)
                                   return
                                 }
                                 d({ args })
                                 d('Error: missing subtool')
                               },
                               id: call.id,
                               index: call.index,
                               name: call.function.name,
                               //
                               no,
                               yes }
                }
                else {
                  d('ERR subtool missing')
                  remind()
                  go()
                  return
                }
              }
              else {
                d('ERR tool/type missing')
                remind()
                go()
                return
              }

              // run the tool

              calls.forEach(call => call && cbCall(call))

              return
            }

            // model sent 0 or more than one call
            d('ERR 0 or > 1 tool calls')
            remind()
            go()
            return
          }

          buffer += decoder.decode(value, { stream: true })
          //d('CHAT buffer: ' + buffer)

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
      let messages, tool_choice

      d('---- ' + emoAgent + ' FETCH for agent ----')

      tool_choice = tools.map(t => ({ type: 'function',
                                      function: { name: t.function.name } }))
      messages = [ { role: 'system',
                     content: systemPrompt },
                   ...msgs ]

      d({ tool_choice })
      messages.forEach(m => d(m))

      fetch('https://openrouter.ai/api/v1/chat/completions',
            { method: 'POST',
              headers: { Authorization: 'Bearer ' + key,
                         'Content-Type': 'application/json' },

              body: JSON.stringify({ model,
                                     temperature: 0,
                                     messages,
                                     tools,
                                     tool_choice }) })
        .then(response => {
          response.ok || Mess.toss('fetch failed')
          return handle(response)
        })
        .catch(err => {
          Mess.yell('fetch: ' + err.message)
        })
    }

    d('==== ' + emoAgent + ' chatAgent ====')

    prompt.length || Mess.toss('empty prompt')

    model = model || 'meta-llama/llama-3.3-70b-instruct:free'

    msgs.push({ role: 'user', content: prompt })

    go()
  }

  function refresh
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
    Shell.run(dir, 'llm', [ view.buf?.opt('query.model.code') || view.buf?.opt('query.model'), que ],
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
    gen({ model: view.buf?.opt('query.model.code') || view.buf?.opt('query.model'),
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
    model = model || Opt.get('query.model')
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
        p.buf.append(' ' + prev)
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

    return r
  }

  function enter
  () {
    let r, p, buf, model, prompt, cb

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

    model = buf.vars('query').model || Opt.get('query.model')
    buf.vars('query').hist.add(prompt)

    busy(buf)
    appendWithEnd(buf, '\n\n')
    cb = chat
    if (p.buf.vars('query').type == 'Agent')
      cb = chatAgent
    cb(buf, model, Opt.get('query.key'), buf.vars('query').msgs, prompt,
       msg => {
         d('CHAT enter append: ' + msg.content)
         appendWithEnd(buf, msg.content)
       },
       () => {
         appendWithEnd(buf, '\n\n' + buf.vars('query').premo + ' ')
         done(buf)
       },
       call => {
         d('cb CALL')
         appendCall(buf, call)
         //done(buf)
       })
  }

  function chatMore
  () {
    let p, buf, model

    p = Pane.current()
    buf = p.buf
    if (buf.vars('query').busy) {
      d('busy')
      return
    }
    model = buf.vars('query').model || Opt.get('query.model')
    Prompt.ask({ text: buf.vars('query').emo + ' ' + model,
                 hist },
               prompt => {
                 let cb

                 buf.vars('query').hist.add(prompt)

                 busy(buf)
                 appendWithEnd(buf, prompt + '\n\n')
                 cb = chat
                 if (buf.vars('query').type == 'Agent')
                   cb = chatAgent
                 cb(buf, model, Opt.get('query.key'), buf.vars('query').msgs, prompt,
                    msg => {
                      d('CHAT more append: ' + msg.content)
                      appendWithEnd(buf, msg.content)
                    },
                    () => {
                      appendWithEnd(buf, '\n\n' + buf.vars('query').premo + ' ')
                      done(buf)
                    },
                    call => {
                      d('cb CALL')
                      appendCall(buf, call)
                      //done(buf)
                    })
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
                   divCl('query-ml-model', model),
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
    appendWithEnd(p.buf, '\n\n' + 'Running ' + call.args.subtool + '...\n\n')
    call?.yes()
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

  function prompt
  (model, type) {
    let cb

    cb = chat
    if (type == 'Agent')
      cb = chatAgent
    model = model || Opt.get('query.model')
    Prompt.ask({ text: (type == 'Agent' ? emoAgent : emo) + ' ' + model,
                 hist },
               prompt => {
                 let name, buf, p

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
                                         [ div([ 'Run ', toolName, '?' ]),
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
                 buf.vars('query').model = model
                 buf.vars('query').msgs = []

                 hist.add(prompt)
                 buf.vars('query').hist = Hist.ensure(name)
                 if (buf.vars('query').hist.length == 0)
                   buf.vars('query').hist.add(prompt)

                 buf.clear()
                 p.setBuf(buf, {}, () => {
                   appendWithEnd(buf, buf.vars('query').premo + ' ' + prompt + '\n\n')
                   buf.opts.set('core.line.wrap.enabled', 1)
                   buf.opts.set('core.lint.enabled', 0)
                   cb(buf, model, Opt.get('query.key'), buf.vars('query').msgs, prompt,
                      msg => {
                        //d('CHAT append: ' + msg.content)
                        appendWithEnd(buf, msg.content)
                      },
                      () => {
                        d('cb END')
                        appendWithEnd(buf, '\n\n' + buf.vars('query').premo + ' ')
                        done(buf)
                      },
                      // only used by chatAgent
                      call => {
                        d('cb CALL ' + call.name)
                        appendCall(buf, call)
                        //done(buf)
                      })
                 })
               })
  }

  Cmd.add('chat', (u, we, model) => {
    prompt(model, 'Chat')
  })

  Cmd.add('agent', (u, we, model) => {
    prompt(model, 'Agent')
  })

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

  systemPrompt = `You are BredAssist, an AI helper inside an Electron code editor.
You only respond by calling runSubtool, formatted as valid JSON:

  {
    "name": "runSubtool",
    "arguments": {
      "subtool": string,
      // plus any subtool-specific args
    }
  }

Available subtools:
- createDir({ path: string })
- readDir({ path: string })
- readFile({ path: string })
- writeFile({ path: string, text: string })
- moveFile({ from: string, to: string })
- removeFile({ path: string })
- sendAnswer({ text: string })

When you want to ask the user something or deliver a final answer, call sendAnswer.

EXAMPLE:

User: “Create a file ‘notes/todo.txt’ with the text ‘Buy milk’, then show me its contents.”

Assistant → runSubtool
{
  "subtool": "createDir",
  "path": "notes"
}

…(tool_response: { "success": true })…

Assistant → runSubtool
{
  "subtool": "writeFile",
  "path": "notes/todo.txt",
  "text": "Buy milk"
}

…(tool_response: { "success": true })…

Assistant → runSubtool
{
  "subtool": "readFile",
  "path": "notes/todo.txt"
}

…(tool_response: { "success": true, "data": "Buy milk" })…

Assistant → runSubtool
{
  "subtool": "sendAnswer",
  "text": "Here is notes/todo.txt:\n\nBuy milk"
}
`
  subs = [ { type: 'object',
             description: 'Create a new directory.',
             properties: { subtool: { const: 'createDir' },
                           path: { type: 'string' } },
             required: [ 'subtool', 'path' ] },
           { type: 'object',
             description: 'Move or rename a file.',
             properties: { subtool: { const: 'moveFile' },
                           from: { type: 'string',
                                   description: "Path to the file that must be moved. The file must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." },
                           to: { type: 'string',
                                 description: "New location and name for the file. This path must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." } },
             required: [ 'subtool', 'from', 'to' ] },
           { type: 'object',
             description: 'Send freeform text',
             properties: { subtool: { const: 'sendAnswer' },
                           text: { type: 'string',
                                   description: 'Human readable freeform text.' } },
             required: [ 'subtool', 'text' ] },
           { type: 'object',
             description: 'List all entries (files and directories) in either the current directory or a specified subdirectory. Use "" for the current directory. Returns a JSON object that includes a success message and, if successful, the directory contents.',
             properties: { subtool: { const: 'readDir' },
                           path: { type: 'string',
                                   description: 'Path to the directory from which to list files (e.g. "src"). Use "" for the current directory.' } },
             required: [ 'subtool', 'path' ] },
           { type: 'object',
             description: 'Create a new directory, returning a JSON object with a success message.',
             properties: { subtool: { const: 'createDir' },
                           path: { type: 'string',
                                   description: "Path to the directory to create (e.g. 'src/newDir'). Must be a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." } },
             required: [ 'subtool', 'path' ] },
           { type: 'object',
             description: 'Read a file, returning a JSON object that includes a success message and the file contents.',
             properties: { subtool: { const: 'readFile' },
                           path: { type: 'string',
                                   description: "Path to the file to create (e.g. 'src/eg.js'). Must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." } },
             required: [ 'subtool', 'path' ] },
           { type: 'object',
             description: 'Remove a file, returning a JSON object that contains a success message.',
             properties: { subtool: { const: 'removeFile' },
                           path: { type: 'string',
                                   description: "Path to the file to remove (e.g. 'src/eg.js'). Must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." } },
             required: [ 'subtool', 'path' ] },
           { type: 'object',
             description: 'Write a file, returning a JSON object with a success message.',
             properties: { subtool: { const: 'writeFile' },
                           path: { type: 'string',
                                   description: "Path to the file to write (e.g. 'src/eg.js'). Must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." },
                           text: { type: 'string',
                                   description: 'New contents for the file.' } },
             required: [ 'subtool', 'path', 'text' ] } ]

  tools = [ { type: 'function',
              function: { name: 'runSubtool',
                          description: 'Run a subtool.',
                          parameters: { type: 'object',
                                        properties: { oneOf: subs } } } } ]
  d(tools)

  subtoolMap = { sendAnswer: { cb: sendAnswer,
                               autoAccept: 1 },
                 //
                 createDir: { cb: createDir },
                 moveFile: { cb: moveFile },
                 readDir: { cb: readDir },
                 readFile: { cb: readFile },
                 removeFile: { cb: removeFile },
                 writeFile: { cb: writeFile } }
  d(subtoolMap)
  emo = '🔮' // 🗨️
  premo = '#### ' + emo
  emoAgent = '🤖' // ✨
  premoAgent = '#### ' + emoAgent
  hist = Hist.ensure('llm')

  Opt.declare('query.model', 'str', 'mistral')
  Opt.declare('query.search.url.prefix', 'str', 'https://google.com/search?q=')
  Opt.declare('query.google.cx', 'str', '')
  Opt.declare('query.google.key', 'str', '')

  makeExtRo()

  chMo = Mode.add('Chat', { minor: 1,
                            wexts: [ { backend: 'cm',
                                       make: () => extRo,
                                       part: new CMState.Compartment } ] })

  Cmd.add('accept tool', () => accept(), mo)
  Cmd.add('chat more', () => chatMore(), chMo)
  Cmd.add('enter', () => enter(), chMo)
  Cmd.add('next history item', () => prevHist(-1), mo)
  Cmd.add('previous history item', () => prevHist(), mo)
  Cmd.add('reject tool', () => reject(), mo)

  Em.on('+', 'chat more', chMo)
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

  Em.on('y', 'accept tool', chToolMo)
  Em.on('n', 'reject tool', chToolMo)
  Em.on('C-g', 'reject tool', chToolMo)

  mo = Mode.add('Query', { viewInitSpec: refresh })

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
