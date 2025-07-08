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

let emo, premo, icons, toolMap

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

function finalAnswer
(buf, args, cb) { // (json)
  let answer

  answer = args.answer || ''

  cb({ success: true,
       answer })
}

function readDir
(buf, args, cb) { // (json)
  let path

  path = args.path || ''

  if (path.startsWith('.')
      || path.startsWith('/')) {
    cb({ error: 'Error: path must be the empty string, or a relative subdirectory',
         success: false,
         message: 'Failed to read directory.' })
    return
  }

  path = path || buf.path

  Tron.cmd('dir.get', path, (err, data) => {
    if (err) {
      d('ERR dir.get')
      d(err.message)
      cb({ error: err.message,
           success: false,
           message: 'Failed to read directory.' })
      return
    }

    d('READDIR data')
    d(data.data)
    cb({ success: true,
         message: 'Successfully read directory.',
         contents: data.data })
  })
}

function createDir
(buf, args, cb) { // (json)
  let path, abs

  path = args.dir_path
  if (path) {
    if (path.startsWith('.')
        || path.startsWith('/')) {
      cb({ error: 'Error: argument dir_path must be or a relative subdirectory (e.g. src/)',
           success: false,
           message: 'Failed to create directory.' })
      return
    }
  }
  else {
    cb({ error: 'Error: missing argument dir_path',
         success: false,
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
           message: 'Failed to create directory.' })
      return
    }
    Mess.say('Added dir ' + abs)
    cb({ success: true,
         message: 'Successfully created directory.' })
  })
}

function moveFile
(buf, args, cb) { // (json)
  let path_from, path_to, abs_from, abs_to

  if (args.path_from)
    path_from = args.path_from
  else {
    cb({ error: 'Error: missing or empty argument path_from',
         success: false,
         message: 'Failed to move file.' })
    return
  }

  if (args.path_to)
    path_to = args.path_to
  else {
    cb({ error: 'Error: missing or empty argument path_to',
         success: false,
         message: 'Failed to move file.' })
    return
  }

  if (path_from.startsWith('.')
      || path_from.startsWith('/')) {
    cb({ error: 'Error: path_from must be in the current directory or a subdirectory',
         success: false,
         message: 'Failed to move file.' })
    return
  }

  if (path_to.startsWith('.')
      || path_to.startsWith('/')) {
    cb({ error: 'Error: path_to must be in the current directory or a subdirectory',
         success: false,
         message: 'Failed to move file.' })
    return
  }

  abs_from = Loc.make(buf.path).join(path_from)
  abs_to = Loc.make(buf.path).join(path_to)
  d('MOVEFILE abs ' + abs_from + ' to ' + abs_to)

  Tron.cmd('file.mv', [ abs_from, abs_to ], err => {
    if (err) {
      d('ERR file.mv')
      d(err.message)
      cb({ error: err.message,
           success: false,
           message: 'Failed to move file.' })
      return
    }

    cb({ success: true,
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
         message: 'Failed to read file.' })
    return
  }

  if (path.startsWith('.')
      || path.startsWith('/')) {
    cb({ error: 'Error: path must be in the current directory or a subdirectory',
         success: false,
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
           message: 'Failed to read file.' })
      return
    }

    d('READFILE data')
    d(data.data)
    cb({ success: true,
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
         message: 'Failed to remove file.' })
    return
  }

  if (path.startsWith('.')
      || path.startsWith('/')) {
    cb({ error: 'Error: path must be in the current directory or a subdirectory',
         success: false,
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
           message: 'Failed to remove file.' })
      return
    }

    d('REMOVEFILE data')
    d(data.data)
    cb({ success: true,
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
         message: 'Failed to write file.' })
    return
  }

  if (path.startsWith('.')
      || path.startsWith('/')) {
    cb({ error: 'Error: path must be in the current directory or a subdirectory',
         success: false,
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
           message: 'Failed to write file.' })
      return
    }

    d('WRITEFILE data')
    d(data.data)
    cb({ success: true,
         message: 'Successfully wrote file.' })
  })
}

export
function init
() {
  let hist, mo, chMo, chToolMo, extRo, tools, systemPrompt

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

  function appendTool
  (buf, tool) {
    buf.vars('query').tool = tool
    if (tool.autoAccept) {
      tool.yes()
      return
    }
    buf.views.forEach(view => {
      if (view.ele) {
        let toolW, toolName

        toolW = view.ele.querySelector('.query-tool-w')
        toolName = toolW.querySelector('.query-tool-name')
        toolName.innerText = tool.name
        Css.expand(toolW)
        d(tool)
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
  (buf, model, key, msgs, prompt, cb, cbEnd, cbTool) { // (msg), (), (tool)
    function stream
    (response) {
      let buffer, reader, decoder, cancelled, calls

      d('CHAT stream')

      function cancel
      () {
        cancelled = 1
        reader.cancel()
      }

      function no
      () {
        d('n')
        cancel()
        cbEnd && cbEnd()
      }

      function yes
      () {
        let busy, final

        d('YES')
        d(calls)
        busy = 0
        calls?.forEach(tool => tool && busy++)
        calls?.forEach(tool => tool && tool.cb(res => {
          d('TOOL result for ' + tool.name)
          d(res)
          if (final) {
            d('Error: skipping because already saw finalAnswer')
            return
          }
          if (tool.name == 'finalAnswer') {
            cb && cb({ content: res.answer })
            cbEnd && cbEnd()
            final = 1
            return
          }
          buf.vars('query').msgs.push({ role: 'tool',
                                        toolCallId: tool.id,
                                        name: tool.name,
                                        content: JSON.stringify(res) })
          busy--
          if (busy == 0)
            go()
        }))
        calls = 0
        if (final)
          return
        if (busy == 0)
          go()
      }

      function read
      () {
        reader.read().then(({ done, value }) => {

          if (cancelled)
            return

          if (done) {
            d('CHAT done')
            reader.cancel()
            if (cbTool && calls) {
              let delta

              delta = { role: 'assistant',
                        content: '',
                        tool_calls: [] }
              calls.forEach(tool => {
                delta.tool_calls.push({ type: 'function',
                                        function: { arguments: tool.args,
                                                    name: tool.name },
                                        id: tool.id,
                                        index: tool.index })
              })
              buf.vars('query').msgs.push(delta)

              calls.forEach(tool => tool && cbTool(tool))
            }
            else
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
              if (delta.tool_calls?.length)
                // clean api shortcuts that some models take
                for (let i = 0; i < delta.tool_calls.length; i++)
                  if (calls?.at(i)) {
                    let call

                    call = delta.tool_calls[i]
                    call.type = 'function'
                    call.function.name = calls[i].name
                  }
              if (delta.content?.length)
                cb && cb(delta)
              if (delta.tool_calls?.length)
                // tool call
                for (let i = 0; i < delta.tool_calls.length; i++) {
                  let call

                  d('TOOL ' + i + ' parsing')
                  call = delta.tool_calls[i]
                  if (call.type == 'function') {
                    if (calls?.at(i))
                      calls[i].args += (call.function.arguments || '')
                    if (call.function.name)
                      if (toolMap[call.function.name])
                        if (calls?.at(i)) {
                          // already seen the first call to this function
                        }
                        else {
                          let index, tool

                          tool = toolMap[call.function.name]
                          index = i
                          calls = calls || []
                          calls[index] = { args: call.function.arguments || '',
                                           autoAccept: tool.autoAccept,
                                           cb(then) { // (response)
                                             let json

                                             d('TOOL ' + index + ' running')
                                             json = {}
                                             if (calls[index].args?.trim())
                                               try {
                                                 json = JSON.parse(calls[index].args)
                                               }
                                               catch (err) {
                                                 Mess.yell('Error parsing tool args (maybe model tried to combine two calls in one?): ' + err.message)
                                                 return

                                               }
                                             tool.cb(buf, json, then)
                                           },
                                           id: call.id,
                                           index: call.index,
                                           name: call.function.name,
                                           //
                                           no,
                                           yes }
                        }
                      else {
                        d('TOOL MISSING')
                        cb && cb({ content: 'ERROR: missing tool: ' + call.function.name + '\n' })
                        calls[i] = 0
                      }
                  }
                  else {
                    d('TYPE MISSING')
                    cb && cb({ content: 'ERROR: missing tool type: ' + call.type + '\n' })
                    calls[i] = 0
                  }
                }
              else if (delta.content.length)
                // just content
                buf.vars('query').msgs.push(delta)
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
      fetch('https://openrouter.ai/api/v1/chat/completions',
            { method: 'POST',
              headers: {
                Authorization: 'Bearer ' + key,
                'Content-Type': 'application/json'
              },

              body: JSON.stringify({
                model,
                messages: [ { role: 'system',
                              content: systemPrompt },
                            ...msgs ],
                stream: true,
                tools }) })
        .then(response => {
          response.ok || Mess.toss('fetch failed')
          return stream(response)
        })
        .catch(err => {
          Mess.yell('fetch: ' + err.message)
        })
    }

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
                 emo,
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
    r.from += emo.length
    if (r.to < r.from)
      // something went wrong
      r.to = r.from

    return r
  }

  function enter
  () {
    let r, p, buf, model, prompt

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
    chat(buf, model, Opt.get('query.key'), buf.vars('query').msgs, prompt,
         msg => {
           d('CHAT enter append: ' + msg.content)
           appendWithEnd(buf, msg.content)
         },
         () => {
           appendWithEnd(buf, '\n\n' + premo + ' ')
           done(buf)
         },
         tool => {
           d('cb TOOL')
           appendTool(buf, tool)
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
    Prompt.ask({ text: emo + ' ' + model,
                 hist },
               prompt => {
                 buf.vars('query').hist.add(prompt)

                 busy(buf)
                 appendWithEnd(buf, prompt + '\n\n')
                 chat(buf, model, Opt.get('query.key'), buf.vars('query').msgs, prompt,
                      msg => {
                        d('CHAT more append: ' + msg.content)
                        appendWithEnd(buf, msg.content)
                      },
                      () => {
                        appendWithEnd(buf, '\n\n' + premo + ' ')
                        done(buf)
                      },
                      tool => {
                        d('cb TOOL')
                        appendTool(buf, tool)
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
  (model, query) {
    let question

    query = query.trim()
    if (query.endsWith('?'))
      question = query
    question = query + '?'
    return divCl('ml edMl',
                 [ divCl('query-ml-icon',
                         img(Icon.path('chat'), 'Chat', 'filter-clr-text'),
                         { 'data-run': 'describe buffer' }),
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
    let p, tool

    p = Pane.current()
    tool = p.buf.vars('query').tool
    p.buf.rmMode('chat tool')
    p.buf.views.forEach(view => {
      if (view.ele) {
        let toolW

        toolW = view.ele.querySelector('.query-tool-w')
        Css.retract(toolW)
      }
    })
    appendWithEnd(p.buf, '\n\n' + 'Running ' + tool.name + '...\n\n')
    tool?.yes()
  }

  function reject
  () {
    let p, tool

    p = Pane.current()
    tool = p.buf.vars('query').tool
    p.buf.rmMode('chat tool')
    p.buf.views.forEach(view => {
      if (view.ele) {
        let toolW

        toolW = view.ele.querySelector('.query-tool-w')
        Css.retract(toolW)
      }
    })
    appendWithEnd(p.buf, '\n\n' + 'Declined to run ' + tool.name)
    tool?.no()
  }

  Cmd.add('stop response', () => {
    let p

    p = Pane.current()
    if (p.buf.vars('query').busy)
      if (p.buf.vars('query').cancel) {
        p.buf.vars('query').cancel()
        appendWithEnd(p.buf, ' ...stopped.\n\n' + premo + ' ')
        done(p.buf)
      }
      else
        Mess.toss('cancel function missing')
  })

  Cmd.add('chat', (u, we, model) => {
    model = model || Opt.get('query.model')
    Prompt.ask({ text: emo + ' ' + model,
                 hist },
               prompt => {
                 let name, buf, p

                 name = 'Chat: ' + prompt
                 p = Pane.current()
                 buf = Buf.find(b2 => b2.name == name)

                 if (buf)
                   buf.dir = p.dir
                 else {
                   let w, toolW, toolName

                   toolName = divCl('query-tool-name')
                   toolW = divCl('query-tool-w retracted',
                                 [ div([ 'Run ', toolName, '?' ]),
                                   divCl('query-tool-y',
                                         button([ span('Y', 'key'), 'es' ],
                                                'query-tool-button',
                                                { 'data-run': 'accept tool' })),
                                   divCl('query-tool-n',
                                         button([ span('N', 'key'), 'o' ],
                                                'query-tool-button',
                                                { 'data-run': 'reject tool' })) ])
                   w = Ed.divW(0, 0,
                               { ml: divMl(model, prompt),
                                 extraCo: toolW })
                   buf = Buf.add(name, 'richdown', w, p.dir)
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
                   appendWithEnd(buf, premo + ' ' + prompt + '\n\n')
                   buf.opts.set('core.line.wrap.enabled', 1)
                   buf.opts.set('core.lint.enabled', 0)
                   chat(buf, model, Opt.get('query.key'), buf.vars('query').msgs, prompt,
                        msg => {
                          //d('CHAT append: ' + msg.content)
                          appendWithEnd(buf, msg.content)
                        },
                        () => {
                          d('cb END')
                          appendWithEnd(buf, '\n\n' + premo + ' ')
                          done(buf)
                        },
                        tool => {
                          d('cb TOOL ' + tool.name)
                          appendTool(buf, tool)
                          //done(buf)
                        })
                 })
               })
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

  systemPrompt = `
You are BredAssist, a helpful assistant embedded in an Electron-based code editor.
You have access to a set of tools (functions) that you may call to perform actions or fetch information.

INSTRUCTIONS:
1. If the user’s request requires a tool, emit one and only one function call in this turn.
2. When a function call is required, always run the function call instead of printing out the JSON for the call.
2. After you emit a function call, wait for the tool’s response before calling another tool.
3. If the user’s request can be answered without any tools, respond in plain text (no function call).
4. When all required tool calls are complete, emit the \`finalAnswer\` function call to return a human-readable summary.
   Make sure to convert the tool output from JSON to human-readable form if the tool output is going into finalAnswer.
5. Do not output any text outside of function calls unless it is your final plain-text answer.

AVAILABLE TOOLS:
1) createDir
   • Purpose: Create a new directory at the given path.
   • Parameters: { dir_path: string }
   • Returns (as JSON):
     - On success: \`{ "success": true }\`
     - On error:   \`{ "success": false, "error": "…error message…" }\`

3) moveFile
   • Purpose: Move or rename the file at the given path.
   • Parameters: { path_from: string, path_to: string }
   • Returns (as JSON):
     - On success: \`{ "success": true }\`
     - On error:   \`{ "success": false, "error": "…error message…" }\`

2) readDir
   • Purpose: List entries in a directory.
   • Parameters: { path: string }
   • Returns (as JSON):
     - On success:
       {
         "success": true,
         "contents": [
           { "name": "file1.txt", … },
           { "name": "subdir", … },
           …
         ]
       }
     - On error:
       \`{ "success": false, "error": "…error message…" }\`

3) readFile
   • Purpose: Read a file at the given path.
   • Parameters: { path: string }
   • Returns (as JSON):
     - On success: \`{ "success": true, "data": "…file contents…", "stat": "…file stats…" }\`
     - On error:   \`{ "success": false, "error": "…error message…" }\`

3) removeFile
   • Purpose: Remove file at the given path.
   • Parameters: { path: string }
   • Returns (as JSON):
     - On success: \`{ "success": true }\`
     - On error:   \`{ "success": false, "error": "…error message…" }\`

4) writeFile
   • Purpose: Write a file at the given path.
   • Parameters: { path: string, text: string }
   • Returns (as JSON):
     - On success: \`{ "success": true }\`
     - On error:   \`{ "success": false, "error": "…error message…" }\`

5) finalAnswer
   • Purpose: Signal completion of any tool-based work and return a final summary.
   • Parameters: { answer: string }

EXAMPLES:

Example A – Multi-step tool usage
User: “Make a folder named foo and then list its contents.”
Assistant → (function call)
{"name":"createDir","arguments":{"dir_path":"foo"}}
…(tool_response arrives: {"success":true})…
Assistant → (function call)
{"name":"readDir","arguments":{"path":"foo"}}
…(tool_response arrives: {"success":true,"contents":[{"name":"foo"}]})…
Assistant → (function call)
{"name":"finalAnswer","arguments":{"answer":"Done! ‘foo’ now exists and contains: […]"}}

Example D - Error case
User: “Make a folder that already exists.”
Assistant → (function call))
{"name":"createDir","arguments":{"name":"foo"}}
…(tool_response arrives: {"success":false,"error":"EEXIST: file already exists"})…
Assistant → (function call))
{"name":"finalAnswer","arguments":{"answer":"Could not create ‘foo’: EEXIST: file already exists"}}

Example C – General question
User: “What is the precedence of && vs || in JavaScript?”
Assistant → (plain text answer, streaming via delta.content)
In JavaScript, the logical AND (\`&&\`) operator has higher precedence than the logical OR (\`||\`).
This means an expression like \`a && b || c\` is parsed as \`(a && b) || c\`, not \`a && (b || c)\`.

Now handle the user’s request:
`
  tools = [ { type: 'function',
              function: { name: 'finalAnswer',
                          description: 'Signal completion of any tool-based work and return a final summary.',
                          parameters: { type: 'object',
                                        properties: { answer: { type: 'string',
                                                                description: 'Human readable freeform answer.' } },
                                        required: [ 'answer' ] } } },
            //
            { type: 'function',
              function: { name: 'moveFile',
                          description: 'Move or rename a file, returning a JSON object with a success message.',
                          parameters: { type: 'object',
                                        properties: { path_from: { type: 'string',
                                                                   description: "Path to the file that must be moved. The file must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." },
                                                      path_to: { type: 'string',
                                                                 description: "New location and name for the file. This path must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." } },
                                        required: [ 'path' ] } } },
            { type: 'function',
              function: { name: 'readDir',
                          description: 'List all entries (files and directories) in either the current directory or a specified subdirectory. Use "" for the current directory. Returns a JSON object that includes a success message and, if successful, the directory contents.',
                          parameters: { type: 'object',
                                        properties: { path: { type: 'string',
                                                              description: 'Path to the directory from which to list files (e.g. "src"). Use "" for the current directory.' } },
                                        required: [ 'path' ] } } },
            { type: 'function',
              function: { name: 'createDir',
                          description: 'Create a new directory, returning a JSON object with a success message.',
                          parameters: { type: 'object',
                                        properties: { dir_path: { type: 'string',
                                                                  description: "Path to the directory to create (e.g. 'src/newDir'). Must be a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." } },
                                        required: [ 'dir_path' ] } } },
            { type: 'function',
              function: { name: 'readFile',
                          description: 'Read a file, returning a JSON object with a success message and the file contents.',
                          parameters: { type: 'object',
                                        properties: { path: { type: 'string',
                                                              description: "Path to the file to create (e.g. 'src/eg.js'). Must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." } },
                                        required: [ 'dir_path' ] } } },
            { type: 'function',
              function: { name: 'removeFile',
                          description: 'Remove a file, returning a JSON object with a success message.',
                          parameters: { type: 'object',
                                        properties: { path: { type: 'string',
                                                              description: "Path to the file to remove (e.g. 'src/eg.js'). Must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." } },
                                        required: [ 'path', 'text' ] } } },
            { type: 'function',
              function: { name: 'writeFile',
                          description: 'Write a file, returning a JSON object with a success message.',
                          parameters: { type: 'object',
                                        properties: { path: { type: 'string',
                                                              description: "Path to the file to write (e.g. 'src/eg.js'). Must be in the current directory or a subdirectory of the current directory, so absolute paths are forbidden, as are the files '.' and '..'." } },
                                        required: [ 'path', 'text' ] } } } ]
  d(tools)

  toolMap = { finalAnswer: { cb: finalAnswer,
                             autoAccept: 1 },
              //
              moveFile: { cb: moveFile },
              readDir: { cb: readDir },
              createDir: { cb: createDir },
              readFile: { cb: readFile },
              removeFile: { cb: removeFile },
              writeFile: { cb: writeFile } }
  d(toolMap)
  emo = '🗨️'
  premo = '#### ' + emo
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
