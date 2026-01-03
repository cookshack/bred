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

let client

export
function init
() {
  let hist

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
                        [ divCl('opencode-msg-role', role === 'user' ? 'You' : 'Assistant'),
                          divCl('opencode-msg-text', text) ]))
        w.scrollTop = w.scrollHeight
      }
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
    let sessionId, c, res, msg, content

    sessionId = buf.vars('opencode').sessionId
    c = await ensureClient()

    appendMsg(buf, 'user', text)

    try {
      res = await c.session.prompt({
        path: { id: sessionId },
        body: { parts: [ { type: 'text', text } ] }
      })

      d(res)
      msg = res.data
      content = msg.parts?.map(p => p.text).join('') || '(no response)'
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

  function viewInitSpec
  (view, spec, cb) {
    if (cb)
      cb(view)
  }

  hist = Hist.ensure('opencode')
  Mode.add('opencode', { viewInitSpec })

  Cmd.add('opencode', () => {
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
  })

  Em.on('+', 'opencode', () => {
    next()
  })
}
