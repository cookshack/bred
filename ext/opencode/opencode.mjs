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
  (title, type) {
    return divCl('opencode-ww',
                 [ divCl('opencode-h', 'Opencode ' + type + ': ' + title),
                   divCl('opencode-results', 'Starting opencode...') ])
  }

  async function runSearch
  (buf, query, searchType) {
    try {
      let results

      await ensureClient()
      await ensureSession('Search: ' + query)

      buf.views.forEach(view => {
        if (view.ele) {
          let w

          w = view.ele.querySelector('.opencode-results')
          w.innerText = 'Searching...'
        }
      })

      if (searchType === 'code') {
        let res

        res = await client.find.text({ query: { pattern: query } })
        results = res.data.map(r => ({
          path: r.path,
          lines: r.lines,
          line_number: r.line_number
        }))
      }
      else {
        let res

        res = await client.find.files({ query: { query: searchType === 'web' ? query : '*' } })
        results = res.data
      }

      buf.views.forEach(view => {
        if (view.ele) {
          let w

          w = view.ele.querySelector('.opencode-results')
          w.innerHTML = ''
          if (results?.length)
            append(w, results.map(r => divCl('opencode-result',
                                             [ divCl('opencode-result-path', r.path || JSON.stringify(r)),
                                               divCl('opencode-result-snippet', r.lines || r.lines?.content || '') ])))
          else
            w.innerText = 'No results'
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

  async function runAgent
  (buf, query) {
    try {
      let sess

      await ensureClient()

      sess = await ensureSession('Agent: ' + query)

      buf.views.forEach(view => {
        if (view.ele) {
          let w

          w = view.ele.querySelector('.opencode-results')
          w.innerText = 'Running agent...'
        }
      })

      const res = await client.session.prompt({ path: { id: sess.id },
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

  function chooseAction
  (query) {
    let p, buf

    p = Pane.current()
    buf = Buf.add('Opencode: ' + query, 'opencode', divW(query, 'search'), p.dir)

    p.setBuf(buf, {}, () => {
      Prompt.choose('What would you like to do?',
                    [ 'Search code', 'Search web', 'Run as agent' ],
                    {},
                    async choice => {
                      let newBuf

                      newBuf = Buf.add('Opencode: ' + query, 'opencode', divW(query, choice), p.dir)
                      p.setBuf(newBuf, {}, async () => {
                        if (choice === 'Search code')
                          await runSearch(newBuf, query, 'code')
                        else if (choice === 'Search web')
                          await runSearch(newBuf, query, 'web')
                        else if (choice === 'Run as agent')
                          await runAgent(newBuf, query)
                      })
                    })
    })
  }

  hist = Hist.ensure('opencode')

  Cmd.add('opencode', () => {
    Prompt.ask({ text: 'Opencode query',
                 hist },
               query => {
                 hist.add(query)
                 chooseAction(query)
               })
  })
}
