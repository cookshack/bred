import { append, divCl } from '../../js/dom.mjs'

import * as Buf from '../../js/buf.mjs'
import * as Cmd from '../../js/cmd.mjs'
import * as Hist from '../../js/hist.mjs'
import * as Mess from '../../js/mess.mjs'
import * as Pane from '../../js/pane.mjs'
import * as Prompt from '../../js/prompt.mjs'
import { d } from '../../js/mess.mjs'

import * as OpenCode from './lib/opencode.js'

let client, session

export
function init
() {
  let hist

  async function ensureClient
  () {
    if (client)
      return

    try {
      client = OpenCode.createOpencodeClient({ baseUrl: 'http://127.0.0.1:4096' })
      d('OPENCODE client started')
    }
    catch (err) {
      Mess.yell('Failed to start opencode client: ' + err.message)
      throw err
    }
  }

  async function ensureSession
  (title) {
    await ensureClient()

    if (session?.id)
      return session

    try {
      const res = await client.session.create({
        body: { title }
      })
      session = res.data
      d('Session created: ' + session.id)
      return session
    }
    catch (err) {
      Mess.yell('Failed to create session: ' + err.message)
      throw err
    }
  }

  function divW
  (title) {
    return divCl('opencode-ww',
                 [ divCl('opencode-h', 'Opencode: ' + title),
                   divCl('opencode-results', 'Starting opencode...') ])
  }

  async function runAgent
  (buf, query) {
    try {
      let sess, res

      await ensureClient()

      sess = await ensureSession('Agent: ' + query)

      buf.views.forEach(view => {
        if (view.ele) {
          let w

          w = view.ele.querySelector('.opencode-results')
          w.innerText = 'Running agent...'
        }
      })

      res = await client.session.prompt({ path: { id: sess.id },
                                          body: { parts: [ { type: 'text', text: query } ] } })

      buf.views.forEach(view => {
        if (view.ele) {
          let w

          w = view.ele.querySelector('.opencode-results')
          w.innerHTML = ''
          if (res.data.parts?.length)
            append(w, res.data.parts.map(p => divCl('opencode-agent-response', p.text || JSON.stringify(p))))
          else
            w.innerText = 'No response'
        }
      })
    }
    catch (err) {
      buf.views.forEach(view => {
        if (view.ele) {
          let w

          w = view.ele.querySelector('.opencode-results')
          w.innerText = 'Error: ' + err.message
        }
      })
    }
  }

  hist = Hist.ensure('opencode')

  Cmd.add('opencode', () => {
    Prompt.ask({ text: 'Opencode query',
                 hist },
               async query => {
                 let p, buf

                 p = Pane.current()
                 hist.add(query)
                 buf = Buf.add('Opencode: ' + query, 'opencode', divW(query), p.dir)
                 p.setBuf(buf, {}, async () => {
                   await runAgent(buf, query)
                 })
               })
  })
}
