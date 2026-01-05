import { append, divCl, img } from '../../js/dom.mjs'

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

import * as OpenCode from './lib/opencode.js'

let client, eventSub

export
function init
() {
  let hist, mo, textBuffer

  async function ensureClient
  () {
    if (client)
      return client

    try {
      client = OpenCode.createOpencodeClient({ baseUrl: 'http://127.0.0.1:4096' })
      d('OC client started')
      return client
    }
    catch (err) {
      Mess.yell('Failed to start opencode client: ' + err.message)
      throw err
    }
  }

  function appendMsg
  (buf, role, text) {
    buf.views.forEach(view => {
      if (view.ele) {
        let w

        w = view.ele.querySelector('.opencode-w')
        append(w, divCl('opencode-msg opencode-msg-' + (role == 'user' ? 'user' : 'assistant'),
                        [ divCl('opencode-msg-role', role == 'user' ? 'You' : role),
                          divCl('opencode-msg-text', text) ]))
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
          append(w, divCl('opencode-msg opencode-msg-thinking',
                          [ divCl('opencode-msg-role', 'Thinking...'),
                            divCl('opencode-msg-text', text) ]))
        w.scrollTop = w.scrollHeight
      }
    })
  }

  function appendToolMsg
  (buf, part, tool, info, under) {
    let label

    if (tool == 'read')
      label = '➔ Read file ' + info
    else if (tool == 'write')
      label = '➔ Write file ' + info
    else if (tool == 'edit')
      label = '➔ Edit file ' + info
    else if (tool == 'grep-running')
      label = '➔ Grep ' + info
    else if (tool == 'grep-done')
      label = '➔ Grep ' + info
    else if (tool == 'bash-running')
      label = '➔ bash: ' + info
    else if (tool == 'bash-done')
      label = '➔ bash: ' + info
    else
      label = 'Tool call: ' + tool + (info ? (' ' + info) : '')

    buf.views.forEach(view => {
      if (view.ele) {
        let w

        w = view.ele.querySelector('.opencode-w')
        append(w, divCl('opencode-msg opencode-msg-tool',
                        [ divCl('opencode-msg-text', label),
                          under && divCl('opencode-msg-text', under) ],
                        { 'data-callid': part.callID }))
        w.scrollTop = w.scrollHeight
      }
    })
  }

  function appendPermission
  (buf, type, info) {
    let label

    if (type == 'bash')
      label = 'Run "' + (info || 'command') + '"? [y/n]'
    else if (type == 'write')
      label = 'Write "' + info + '"? [y/n]'
    else if (type == 'edit')
      label = 'Edit "' + info + '"? [y/n]'
    else
      label = 'Permission: ' + type + ' [y/n]'

    buf.views.forEach(view => {
      if (view.ele) {
        let w

        w = view.ele.querySelector('.opencode-w')
        append(w, divCl('opencode-msg opencode-msg-permission',
                        [ divCl('opencode-msg-text', label) ]))
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
    ensureClient().then(async c => {
      try {
        await c.postSessionIdPermissionsPermissionId({ path: { id: sessionID, permissionID: id },
                                                       body: { response } })
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

  function startEventSub
  (buf) {
    if (eventSub)
      return
    eventSub = true

    ensureClient().then(async c => {
      let events

      d('OC starting event subscription')
      events = await c.event.subscribe({})
      d('OC stream obtained')
      ;(async () => {
        for await (let event of events.stream) {
          let sessionID

          d(event.type)
          d({ event })

          sessionID = buf && buf.vars('opencode')?.sessionID

          if ((event.type == 'permission.updated')
              && (event.properties.sessionID == sessionID)) {
            let req

            req = event.properties
            d('OC permission asked: ' + req.type)
            if (req.type == 'bash') {
              let description, command

              description = req.metadata?.description
              command = req.metadata?.command || req.metadata?.pattern
              if (command) {
                d('OC bash permission: ' + command)
                appendPermission(buf, req.type, description || command)
                buf.vars('opencode').permissionID = req.id
              }
            }
            else if (req.type == 'edit') {
              let filePath

              filePath = req.metadata?.filePath
              if (filePath) {
                d('OC edit permission: ' + filePath)
                appendPermission(buf, req.type, filePath)
                buf.vars('opencode').permissionID = req.id
              }
            }
            else if (req.type == 'write') {
              let filePath

              filePath = req.metadata?.filePath
              if (filePath) {
                d('OC write permission: ' + filePath)
                appendPermission(buf, req.type, filePath)
                buf.vars('opencode').permissionID = req.id
              }
            }
          }

          if ((event.type == 'message.part.updated')
              && (event.properties.part.sessionID == sessionID)) {
            let part

            part = event.properties.part
            if (part.type == 'text') {
              d('OC text part' + part.id)
              d('OC update text: ' + part.text)
              textBuffer.set(part.id, part.text)
            }
            else if (part.type == 'reasoning') {
              let buffered

              d('OC reasoning part ' + part.id)

              buffered = textBuffer.get(part.id) || ''
              buffered += (event.properties.delta || '')
              if (buffered) {
                d('OC reasoning append: ' + buffered)
                appendThinking(buf, buffered)
              }
              textBuffer.delete(part.id)
            }
            else if (part.type == 'tool') {
              d('OC tool: ' + part.tool)
              if (part.tool == 'read' && part.state?.status == 'running') {
                let path

                path = part.state.input.filePath
                if (path) {
                  d('OC read file: ' + path)
                  appendToolMsg(buf, part, 'read', path)
                }
              }
              else if (part.tool == 'grep' && part.state?.status == 'running') {
                let pattern, path

                pattern = part.state.input.pattern
                path = part.state.input.path
                if (pattern) {
                  d('OC grep: ' + pattern + ' in ' + path)
                  appendToolMsg(buf, part, 'grep-running', '"' + pattern + '" in ' + (path || '.'))
                }
              }
              else if (part.tool == 'grep' && part.state?.status == 'completed') {
                let matches, path

                matches = part.state.metadata?.matches
                path = part.state.input.path
                if (matches) {
                  d('OC grep completed with ' + matches + ' matches')
                  appendToolMsg(buf, part, 'grep-done', '"' + part.state.input.pattern + '" in ' + (path || '.') + ' (' + matches + ' matches)')
                }
              }
              else if (part.tool == 'bash' && part.state?.status == 'running') {
                let command

                command = part.state.input.command
                if (command) {
                  d('OC bash: ' + command)
                  appendToolMsg(buf, part, 'bash-running', command)
                }
              }
              else if (part.tool == 'bash' && part.state?.status == 'completed') {
                let command, exitCode

                command = part.state.input.command
                exitCode = part.state.metadata?.exit
                if (command) {
                  d('OC bash completed: ' + command + ' (exit ' + exitCode + ')')
                  appendToolMsg(buf, part, 'bash-done', '$ ' + command + ' (exit ' + exitCode + ')', part.state.output)
                }
              }
              else if (part.tool == 'write' && part.state?.status == 'running') {
                let path

                path = part.state.input.filePath
                if (path) {
                  d('OC write file: ' + path)
                  appendToolMsg(buf, part, 'write', path)
                }
              }
              else if (part.tool == 'edit' && part.state?.status == 'running') {
                let path

                path = part.state.input.filePath
                if (path) {
                  d('OC edit file: ' + path)
                  appendToolMsg(buf, part, 'edit', path)
                }
              }
              else
                appendToolMsg(buf, part, part.tool, part.state?.status && ('(' + part.state?.status + ')'))
            }
          }
        }
      })()
    })
  }

  function divW
  (sessionID, prompt) {
    return divCl('opencode-ww',
                 [ divCl('opencode-h',
                         [ divCl('opencode-icon',
                                 img(Icon.path('chat'), 'Chat', 'filter-clr-text')),
                           divCl('opencode-title', prompt) ]),
                   divCl('opencode-w') ])
  }

  async function send
  (buf, text) {
    let sessionID, c, res, content

    sessionID = buf.vars('opencode').sessionID
    c = await ensureClient()

    appendMsg(buf, 'user', text)

    startEventSub(buf)

    try {
      let buffered

      res = await c.session.prompt({
        path: { id: sessionID },
        body: {
          model: { providerID: 'opencode', modelID: 'minimax-m2.1-free' },
          parts: [ { type: 'text', text } ]
        }
      })

      d({ res })

      buffered = textBuffer.get(sessionID)
      if (buffered) {
        d('found buffered text on prompt return, len: ' + buffered.length)
        appendThinking(buf, buffered)
        textBuffer.delete(sessionID)
      }

      content = res.data.parts?.filter(p => p.type == 'text').map(p => p.text).join('') || '(no response)'
      appendMsg(buf, res.data.info.modelID || 'Assistant', content)
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

                   c = await ensureClient()
                   res = await c.session.create({ body: { title: prompt } })

                   buf = Buf.add('Opencode: ' + prompt, 'opencode', divW(res.data.id, prompt), p.dir)
                   buf.vars('opencode').sessionID = res.data.id
                   buf.vars('opencode').prompt = prompt

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

  textBuffer = new Map()
  hist = Hist.ensure('opencode')
  mo = Mode.add('opencode', { viewInitSpec })

  Cmd.add('opencode', opencode)
  Cmd.add('code', opencode)

  Cmd.add('respond', () => next(), mo)

  Cmd.add('opencode models', async () => {
    let c, res

    try {
      let models

      models = ''
      c = await ensureClient()
      res = await c.config.providers({})
      res.data.providers.forEach(p => {
        models += ('provider: ' + p.id + ' - ' + p.name + '\n')
        d('provider: ' + p.id + ' - ' + p.name)
        Object.keys(p.models).forEach(m => {
          models += '  model: ' + m + '\n'
          d('  model: ' + m)
        })
      })
      Mess.say(models)
    }
    catch (err) {
      Mess.yell('Failed: ' + err.message)
    }
  })

  Cmd.add('yes', () => yn(1), mo)
  Cmd.add('no', () => yn(), mo)

  Em.on('y', 'yes', mo)
  Em.on('n', 'no', mo)
  Em.on('+', 'respond', mo)
}
