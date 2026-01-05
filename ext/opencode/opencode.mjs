import { append, button, divCl, img, span } from '../../js/dom.mjs'

import * as Buf from '../../js/buf.mjs'
import * as Cmd from '../../js/cmd.mjs'
import * as Css from '../../js/css.mjs'
import * as Em from '../../js/em.mjs'
import * as Hist from '../../js/hist.mjs'
import * as Icon from '../../js/icon.mjs'
import * as Mess from '../../js/mess.mjs'
import * as Mode from '../../js/mode.mjs'
import * as Pane from '../../js/pane.mjs'
import * as Prompt from '../../js/prompt.mjs'
import { d } from '../../js/mess.mjs'
import * as Tron from '../../js/tron.mjs'

import * as OpenCode from './lib/opencode.js'

export
function init
() {
  let hist, mo

  async function ensureClient
  (buf) {
    let client

    client = buf.vars('opencode').client
    if (client)
      return client

    return new Promise((resolve, reject) => {
      Tron.cmd('code.spawn', [ buf.id, buf.dir ], (err, ret) => {
        let url

        if (err) {
          reject(err)
          return
        }
        url = ret.url
        client = OpenCode.createOpencodeClient({ baseUrl: url })
        buf.vars('opencode').client = client
        buf.vars('opencode').serverUrl = url
        d('OC client started: ' + url)
        resolve(client)
      })
    })
  }

  function appendX
  (w, el) {
    let under

    under = w.querySelector('.opencode-under')
    if (under)
      under.before(el)
    else
      append(w, el)
  }

  function appendModel
  (buf, model) {
    buf.views.forEach(view => {
      if (view.ele) {
        let w

        w = view.ele.querySelector('.opencode-w')
        appendX(w,
                divCl('opencode-msg opencode-msg-assistant',
                      [ divCl('opencode-msg-role', model),
                        divCl('opencode-msg-text opencode-msg-hidden') ]))
        w.scrollTop = w.scrollHeight
      }
    })
  }

  function appendMsg
  (buf, role, text, partID) {
    buf.views.forEach(view => {
      if (view.ele) {
        let w

        w = view.ele.querySelector('.opencode-w')
        if (role == 'user') {
        }
        else {
          let el

          el = w.querySelector('.opencode-msg-assistant[data-partid="' + partID + '"]')
          if (el) {
            el.firstElementChild.nextElementSibling.innerText = text
            w.scrollTop = w.scrollHeight
            return
          }
        }
        appendX(w,
                divCl('opencode-msg opencode-msg-' + (role == 'user' ? 'user' : 'assistant'),
                      [ divCl('opencode-msg-role' + (role ? '' : ' opencode-msg-hidden'),
                              role == 'user' ? 'You' : (role || '')),
                        divCl('opencode-msg-text' + (text ? '' : ' opencode-msg-hidden'),
                              text) ],
                      { 'data-partid': partID }))
        w.scrollTop = w.scrollHeight
      }
    })
  }

  function appendThinking
  (buf, text) {
    buf.views.forEach(view => {
      if (view.ele) {
        let w, el, msgs, lastIsUser

        w = view.ele.querySelector('.opencode-w')
        msgs = w.querySelectorAll('.opencode-msg')
        if (msgs.length > 0) {
          let last

          last = msgs[msgs.length - 1]
          if (Css.has(last, 'opencode-msg-tool'))
            lastIsUser = 1
          else {
            let role

            role = msgs[msgs.length - 1].querySelector('.opencode-msg-role')
            if (role?.innerText == 'You')
              lastIsUser = 1
          }
        }
        if (lastIsUser)
          el = 0
        else {
          let all

          all = w.querySelectorAll('.opencode-msg-thinking')
          if (all.length)
            el = all[all.length - 1]
        }
        if (el) {
          let current

          current = el.querySelector('.opencode-msg-text').innerText
          el.querySelector('.opencode-msg-text').innerText = current + text
        }
        else
          appendX(w,
                  divCl('opencode-msg opencode-msg-thinking',
                        [ divCl('opencode-msg-role', 'Thinking...'),
                          divCl('opencode-msg-text', text) ]))
        w.scrollTop = w.scrollHeight
      }
    })
  }

  function appendToolMsg
  (buf, callID, tool, info, under) {
    let label

    if (tool == 'read')
      label = '➔ Read file ' + info
    else if (tool == 'write')
      label = '➔ Write file ' + info
    else if (tool == 'edit')
      label = '➔ Edit file ' + info
    else if (tool == 'grep')
      label = '➔ Grep ' + info
    else if (tool == 'grep-done')
      label = '➔ Grep ' + info
    else if (tool == 'glob')
      label = '➔ Glob ' + info
    else if (tool == 'glob-done')
      label = '➔ Glob ' + info
    else if (tool == 'bash-running')
      label = '➔ bash: ' + info
    else if (tool == 'bash-done')
      label = '➔ bash: ' + info
    else if (tool == 'websearch')
      label = '➔ ' + info
    else if (tool == 'webfetch')
      label = '➔ ' + info
    else
      label = 'Tool call: ' + tool + (info ? (' ' + info) : '')

    buf.views.forEach(view => {
      if (view.ele) {
        let w, els

        w = view.ele.querySelector('.opencode-w')
        els = w.querySelectorAll('.opencode-msg-tool[data-callid="' + callID + '"]')
        els?.forEach(el => el.remove())
        appendX(w,
                divCl('opencode-msg opencode-msg-tool',
                      [ divCl('opencode-msg-text', label),
                        under && divCl('opencode-msg-text opencode-msg-under', under) ],
                      { 'data-callid': callID }))
        w.scrollTop = w.scrollHeight
      }
    })
  }

  function appendPermission
  (buf, id) {
    buf.views.forEach(view => {
      if (view.ele) {
        let w

        w = view.ele.querySelector('.opencode-w')
        appendX(w,
                divCl('opencode-msg opencode-msg-permission',
                      [ divCl('opencode-msg-text',
                              [ '▣ Allow?',
                                button([ span('y', 'key'), 'es' ], '', { 'data-run': 'yes' }),
                                button([ span('n', 'key'), 'o' ], '', { 'data-run': 'no' }) ]) ],
                      { 'data-permissionid': id }))
        w.scrollTop = w.scrollHeight
      }
    })
  }

  function handlePermission
  (buf, id, yes) {
    let sessionID, response

    sessionID = buf.vars('opencode')?.sessionID
    response = yes ? 'once' : 'reject'

    d('OC permission reply: ' + response)
    ensureClient(buf).then(async c => {
      try {
        await c.postSessionIdPermissionsPermissionId({ path: { id: sessionID, permissionID: id },
                                                       body: { response } })
        buf.views.forEach(view => {
          if (view.ele) {
            let w, el

            w = view.ele.querySelector('.opencode-w')
            el = w.querySelector('.opencode-msg-permission[data-permissionid="' + id + '"]')
            el?.remove()
          }
        })
      }
      catch (err) {
        d('OC permission respond error: ' + err.message)
      }
    })

    buf.vars('opencode').permissionID = 0
  }

  function yn
  (yes) {
    let buf, id

    buf = Pane.current()?.buf
    id = buf?.vars('opencode')?.permissionID
    if (id)
      handlePermission(buf, id, yes)
  }

  function updateStatus
  (buf, req) {
    function update
    (co) {
      buf.views.forEach(view => {
        if (view.ele) {
          let el

          el = view.ele.querySelector('.opencode-w > .opencode-under')
          if (el) {
            el.innerHTML = ''
            append(el, co)
          }
        }
      })
    }

    if (req.status?.type == 'busy')
      update('BUSY')
    else if (req.status?.type == 'idle')
      update('IDLE')
    else if (req.status?.type == 'retry')
      update('BUSY retry' + (req.status.message ? ': ' + req.status.message : ''))
    else if (req.status?.type)
      d('FIX status: ' + req.status?.type)
  }

  function startEventSub
  (buf) {
    if (buf.vars('opencode').eventSub)
      return
    buf.vars('opencode').eventSub = 1

    ensureClient(buf).then(async c => {
      let events

      d('OC starting event subscription')
      events = await c.event.subscribe({})
      d('OC stream obtained')
      ;(async () => {
        try {
          for await (let event of events.stream) {
            let sessionID

            d(event.type)
            d({ event })

            sessionID = buf && buf.vars('opencode')?.sessionID

            if ((event.type == 'session.status')
                && (event.properties.sessionID == sessionID))
              updateStatus(buf, event.properties)

            if ((event.type == 'permission.asked')
                && (event.properties.sessionID == sessionID)) {
              let req

              req = event.properties
              d('OC permission asked: ' + req.permission)
              buf.vars('opencode').permissionID = req.id
              if (req.permission == 'edit') {
                let path

                path = req.metadata?.filepath
                if (path) {
                  d('OC permission file: ' + path)
                  buf.vars('opencode').patch = req.metadata?.diff
                  appendToolMsg(buf, req.tool.callID, 'edit', path,
                                req.metadata?.diff) // under
                }
              }
              appendPermission(buf, req.id)
            }

            if ((event.type == 'permission.updated')
                && (event.properties.sessionID == sessionID)) {
              let req

              req = event.properties
              d('OC permission updated: ' + req.type)
              buf.vars('opencode').permissionID = req.id
              appendPermission(buf, req.id)
            }

            if ((event.type == 'message.part.updated')
                && (event.properties.part.sessionID == sessionID)) {
              let part

              part = event.properties.part
              if (part.type == 'step-start') {
                d('OC step-start')
                buf.vars('opencode').stepActive = 1
              }
              else if (part.type == 'step-finish') {
                d('OC step-finish')
                buf.vars('opencode').stepActive = 0
              }
              else if (part.type == 'text') {
                d('OC text part' + part.id)
                if (buf.vars('opencode').stepActive) {
                  d('OC update text: ' + part.text)
                  appendMsg(buf, 0, part.text, part.id)
                }
                else
                  d('OD text outside step: ' + part.text)
              }
              else if (part.type == 'reasoning') {
                let buffered

                //d('OC reasoning part ' + part.id)

                buffered = (event.properties.delta || '')
                if (buffered) {
                  d('OC reasoning append: ' + buffered)
                  appendThinking(buf, buffered)
                }
              }
              else if (part.type == 'tool') {
                d('OC tool: ' + part.tool)
                if (part.tool == 'read' && part.state?.status == 'running') {
                  let path

                  path = part.state.input.filePath
                  if (path) {
                    d('OC read file: ' + path)
                    appendToolMsg(buf, part.callID, 'read', path)
                  }
                }
                else if (part.tool == 'read' && part.state?.status == 'completed') {
                  let path

                  path = part.state.input.filePath
                  if (path) {
                    d('OC read file completed: ' + path)
                    appendToolMsg(buf, part.callID, 'read', path + ' (done)')
                  }
                }
                else if (part.tool == 'glob' && part.state?.status == 'running') {
                  let pattern

                  pattern = part.state.input.pattern
                  if (pattern) {
                    d('OC glob: ' + pattern)
                    appendToolMsg(buf, part.callID, 'glob', '"' + pattern)
                  }
                }
                else if (part.tool == 'glob' && part.state?.status == 'completed') {
                  let count

                  count = part.state.metadata?.count
                  if (1) {
                    d('OC glob completed with ' + count + ' matches')
                    appendToolMsg(buf,
                                  part.callID,
                                  'glob-done',
                                  '"' + part.state.input.pattern + ' (' + count + ' matches)',
                                  part.state.output) // under
                  }
                }
                else if (part.tool == 'grep' && part.state?.status == 'running') {
                  let pattern, path

                  pattern = part.state.input.pattern
                  path = part.state.input.path
                  if (pattern) {
                    d('OC grep: ' + pattern + ' in ' + path)
                    appendToolMsg(buf, part.callID, 'grep', '"' + pattern + '" in ' + (path || '.'))
                  }
                }
                else if (part.tool == 'grep' && part.state?.status == 'completed') {
                  let matches, path

                  matches = part.state.metadata?.matches
                  path = part.state.input.path
                  if (matches) {
                    d('OC grep completed with ' + matches + ' matches')
                    appendToolMsg(buf,
                                  part.callID,
                                  'grep-done',
                                  '"' + part.state.input.pattern + '" in ' + (path || '.') + ' (' + matches + ' matches)',
                                  part.state.output) // under
                  }
                }
                else if (part.tool == 'bash' && part.state?.status == 'running') {
                  let command

                  command = part.state.input.command
                  if (command) {
                    d('OC bash: ' + command)
                    appendToolMsg(buf, part.callID, 'bash-running', command)
                  }
                }
                else if (part.tool == 'bash' && part.state?.status == 'completed') {
                  let command, exitCode

                  command = part.state.input.command
                  exitCode = part.state.metadata?.exit
                  if (command) {
                    d('OC bash completed: ' + command + ' (exit ' + exitCode + ')')
                    appendToolMsg(buf, part.callID, 'bash-done', '$ ' + command + ' (exit ' + exitCode + ')', part.state.output)
                  }
                }
                else if (part.tool == 'write' && part.state?.status == 'running') {
                  let path

                  path = part.state.input.filePath
                  if (path) {
                    d('OC write file: ' + path)
                    appendToolMsg(buf, part.callID, 'write', path,
                                  part.state?.input?.content) // under
                  }
                }
                else if (part.tool == 'write' && part.state?.status == 'completed') {
                  let path

                  path = part.state.input.filePath
                  if (path) {
                    d('OC write file: ' + path)
                    appendToolMsg(buf, part.callID, 'write', path + ' (done)',
                                  part.state?.input?.content) // under
                  }
                }
                else if (part.tool == 'edit' && part.state?.status == 'running') {
                  let path

                  path = part.state.input.filePath
                  if (path) {
                    d('OC edit file: ' + path)
                    appendToolMsg(buf, part.callID, 'edit', path,
                                  // under
                                  '- ' + part.state?.input?.oldString + '\n+ ' + part.state?.input?.newString)
                  }
                }
                else if (part.tool == 'edit' && part.state?.status == 'completed') {
                  let path

                  path = part.state.input.filePath
                  if (path) {
                    let under

                    d('OC edit completed: ' + path)
                    under = '- ' + part.state?.input?.oldString + '\n+ ' + part.state?.input?.newString
                    under = buf.vars('opencode').patch || under
                    appendToolMsg(buf, part.callID, 'edit', path + ' (done)',
                                  under)
                  }
                }
                else if (part.tool == 'websearch' && part.state?.status == 'running') {
                  let query

                  query = part.state.input.query
                  if (query) {
                    d('OC websearch: ' + query)
                    appendToolMsg(buf, part.callID, 'websearch', 'Web search: ' + query)
                  }
                }
                else if (part.tool == 'websearch' && part.state?.status == 'completed') {
                  let query, results

                  query = part.state.input.query
                  results = part.state.metadata?.results
                  if (query) {
                    d('OC websearch completed with ' + results + ' results')
                    appendToolMsg(buf,
                                  part.callID,
                                  'websearch',
                                  'Web search: ' + query + ' (' + results + ' results)',
                                  part.state.output) // under
                  }
                }
                else if (part.tool == 'websearch' && part.state?.status == 'error') {
                  let query

                  query = part.state.input.query
                  if (query) {
                    d('OC websearch error')
                    appendToolMsg(buf,
                                  part.callID,
                                  'websearch',
                                  'Web search: ' + query,
                                  part.state.error) // under
                  }
                }
                else if (part.tool == 'webfetch' && part.state?.status == 'running') {
                  let url

                  url = part.state.input.url
                  if (url) {
                    d('OC webfetch: ' + url)
                    appendToolMsg(buf, part.callID, 'webfetch', 'Fetch ' + url)
                  }
                }
                else if (part.tool == 'webfetch' && part.state?.status == 'completed') {
                  let url, size

                  url = part.state.input.url
                  size = part.state.output?.length
                  if (url) {
                    d('OC webfetch completed, size: ' + size)
                    appendToolMsg(buf,
                                  part.callID,
                                  'webfetch',
                                  'Fetch ' + url + (size ? ' (' + size + ' bytes)' : ''))
                  }
                }
                else if (part.tool == 'webfetch' && part.state?.status == 'error') {
                  let url

                  url = part.state.input.url
                  if (url) {
                    d('OC webfetch error')
                    appendToolMsg(buf,
                                  part.callID,
                                  'webfetch',
                                  'Fetch ' + url,
                                  part.state.error) // under
                  }
                }
                else
                  appendToolMsg(buf, part.callID, part.tool, part.state?.status && ('(' + part.state?.status + ')'))
              }
            }
          }
        }
        catch (err) {
          d('OC event stream error: ' + err.message)
          d(err.stack)
        }
      })()
    })
  }

  function divW
  (prompt) {
    return divCl('opencode-ww',
                 [ divCl('opencode-h',
                         [ divCl('opencode-icon',
                                 img(Icon.path('chat'), 'Chat', 'filter-clr-text')),
                           divCl('opencode-title', prompt) ]),
                   divCl('opencode-w', divCl('opencode-under', '...')) ])
  }

  async function send
  (buf, text) {
    let sessionID, c, res

    sessionID = buf.vars('opencode').sessionID
    c = await ensureClient(buf)

    appendMsg(buf, 'user', text)

    startEventSub(buf)

    try {
      d('SEND')

      res = await c.session.prompt({
        path: { id: sessionID },
        body: {
          model: { providerID: 'opencode', modelID: 'minimax-m2.1-free' },
          parts: [ { type: 'text', text } ]
        }
      })

      d('SEND done')
      d({ res })

      appendModel(buf, res.data.info.modelID || '???')
    }
    catch (err) {
      d(err)
      appendMsg(buf, 'assistant', 'Error: ' + err.message)
    }
  }

  function next
  () {
    let p, buf

    p = Pane.current()
    buf = p.buf

    if (buf.vars('opencode').permissionID)
      return

    if (buf?.vars('opencode')?.sessionID) {
      // OK
    }
    else
      return

    if (buf.vars('opencode').busy) {
      d('busy')
      return
    }

    Prompt.ask({ text: 'Message',
                 hist },
               prompt => {
                 hist.add(prompt)
                 send(buf, prompt)
               })
  }

  function opencode
  () {
    Prompt.ask({ text: 'Opencode',
                 hist },
               async prompt => {
                 let p, buf, c

                 p = Pane.current()
                 hist.add(prompt)

                 try {
                   let res

                   buf = Buf.add('Opencode: ' + prompt, 'opencode', divW(prompt), p.dir)
                   buf.vars('opencode').prompt = prompt

                   c = await ensureClient(buf)
                   res = await c.session.create({ body: { title: prompt } })

                   buf.vars('opencode').sessionID = res.data.id

                   p.setBuf(buf, {}, () => {
                     send(buf, prompt)
                   })
                 }
                 catch (err) {
                   Mess.yell('Failed: ' + err.message)
                 }
               })
  }

  function viewInitSpec
  (view, spec, cb) {
    if (cb)
      cb(view)
  }

  hist = Hist.ensure('opencode')
  mo = Mode.add('opencode',
                { viewInitSpec,
                  onRemove(buf) {
                    Tron.cmd('code.close', [ buf.id ])
                  } })

  Cmd.add('opencode', opencode)
  Cmd.add('code', opencode)

  Cmd.add('respond', () => next(), mo)

  Cmd.add('yes', () => yn(1), mo)
  Cmd.add('no', () => yn(), mo)

  Em.on('y', 'yes', mo)
  Em.on('n', 'no', mo)
  Em.on('+', 'respond', mo)
  Em.on('Enter', 'respond', mo)

  Em.on('q', 'bury', mo)
  Em.on('Backspace', 'scroll up', mo)
  Em.on(' ', 'scroll down', mo)
}
