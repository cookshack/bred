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

const Thinking = new Map()

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
        let w, el

        w = view.ele.querySelector('.opencode-w')
        el = view.ele.querySelector('.opencode-msg-thinking')
        if (el)
          el.querySelector('.opencode-msg-text').innerText = text
        else
          append(w, divCl('opencode-msg opencode-msg-thinking',
                          [ divCl('opencode-msg-role', 'Thinking...'),
                            divCl('opencode-msg-text', text) ]))
        w.scrollTop = w.scrollHeight
      }
    })
  }

  function updateThinking
  (messageId, text) {
    let buf

    for (let [ , val ] of Thinking)
      if (val.messageId == messageId) {
        buf = val.buf
        break
      }
    if (buf)
      appendThinking(buf, text)
  }

  function startEventSub
  () {
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
            if (part.type == 'reasoning') {
              d('reasoning update')
              updateThinking(part.messageId, part.text)
            }
          }
        }
      })()
    })
  }

  function divW
  (sessionId, prompt) {
    return divCl('opencode-ww',
                 [ divCl('opencode-h',
                         [ divCl('opencode-icon',
                                 img(Icon.path('chat'), 'Chat', 'filter-clr-text')),
                           divCl('opencode-title', prompt) ]),
                   divCl('opencode-w') ])
  }

  async function send
  (buf, text) {
    let sessionId, c, res, msg, content, reasoning

    sessionId = buf.vars('opencode').sessionId
    c = await ensureClient()

    appendMsg(buf, 'user', text)

    startEventSub()

    try {
      res = await c.session.prompt({
        path: { id: sessionId },
        body: { parts: [ { type: 'text', text } ] }
      })

      d(res)
      msg = res.data

      Thinking.set(buf, { buf, messageId: msg.id })

      reasoning = msg.parts?.filter(p => p.type == 'reasoning').map(p => p.text).join('\n') || ''
      if (reasoning)
        appendThinking(buf, reasoning)

      content = msg.parts?.filter(p => p.type == 'text').map(p => p.text).join('') || '(no response)'
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

    if (buf?.vars('opencode')?.sessionId) {
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
                   buf.vars('opencode').sessionId = res.data.id
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
