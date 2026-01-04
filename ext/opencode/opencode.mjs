import { append, divCl, img } from '../../js/dom.mjs'

import * as Buf from '../../js/buf.mjs'
import * as Cmd from '../../js/cmd.mjs'
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

const textBuffer = new Map()

export
function init
() {
  let hist, mo

  async function ensureClient
  () {
    if (client)
      return client

    try {
      client = OpenCode.createOpencodeClient({ baseUrl: 'http://127.0.0.1:4096' })
      d('OPENCODE client started')
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
        append(w, divCl('opencode-msg opencode-msg-' + role,
                        [ divCl('opencode-msg-role', role == 'user' ? 'You' : 'Assistant'),
                          divCl('opencode-msg-text', text) ]))
        w.scrollTop = w.scrollHeight
      }
    })
  }

  function appendThinking
  (buf, text) {
    buf.views.forEach(view => {
      if (view.ele) {
        let w, el, current

        w = view.ele.querySelector('.opencode-w')
        el = view.ele.querySelector('.opencode-msg-thinking')
        if (el) {
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

  function startEventSub
  (buf) {
    if (eventSub)
      return
    eventSub = true

    ensureClient().then(async c => {
      d('Starting event subscription')
      const events = await c.event.subscribe({})
      const { stream } = events
      d('stream obtained')
      ;(async () => {
        for await (const event of stream) {
          d({ event })
          if (event.type == 'message.part.updated') {
            const part = event.properties.part
            const sessionID = part.sessionID || part.messageID
            if (part.type == 'text') {
              const existing = textBuffer.get(sessionID) || ''
              textBuffer.set(sessionID, existing + part.text)
            }
            else if (part.type == 'reasoning') {
              const buffered = textBuffer.get(sessionID) || ''
              if (buffered) {
                d('reasoning update with buffered text len: ' + buffered.length)
                if (buf && buf.vars('opencode')?.sessionID == sessionID)
                  appendThinking(buf, buffered)
              }
              textBuffer.delete(sessionID)
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
      res = await c.session.prompt({
        path: { id: sessionID },
        body: { parts: [ { type: 'text', text } ] }
      })

      d({ res })

      const buffered = textBuffer.get(sessionID)
      if (buffered) {
        d('found buffered text on prompt return, len: ' + buffered.length)
        appendThinking(buf, buffered)
        textBuffer.delete(sessionID)
      }

      content = res.data.parts?.filter(p => p.type == 'text').map(p => p.text).join('') || '(no response)'
      appendMsg(buf, 'assistant', content)
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

  hist = Hist.ensure('opencode')
  mo = Mode.add('opencode', { viewInitSpec })

  Cmd.add('opencode', opencode)
  Cmd.add('code', opencode)

  Cmd.add('opencode chat', () => {
    next()
  }, mo)

  Em.on('+', 'opencode chat', mo)
}
