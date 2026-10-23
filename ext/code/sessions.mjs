import { append, divCl, span } from '../../js/dom.mjs'
import * as Buf from '../../js/Buf.mjs'
import * as Cmd from '../../js/cmd.mjs'
import * as Css from '../../js/css.mjs'
import * as Ed from '../../js/ed.mjs'
import * as Em from '../../js/Em.mjs'
import * as Hist from '../../js/hist.mjs'
import * as Icon from '../../js/icon.mjs'
import * as Mess from '../../js/mess.mjs'
import * as Mode from '../../js/mode.mjs'
import * as Opt from '../../js/opt.mjs'
import * as Pane from '../../js/Pane.mjs'
import * as Tron from '../../js/tron.mjs'
import * as View from '../../js/view.mjs'
import { ask } from '../../js/prompt.mjs'
import { d } from '../../js/mess.mjs'

import * as Comm from './comm.mjs'
import * as Ev from './event.mjs'
import * as Prompt from './prompt.mjs'
import * as Ui from './ui.mjs'
import * as Util from './util.mjs'

function toolText
(state) {
  let i, out

  if (state?.output)
    return state.output
  if (state?.error)
    return state.error.message || JSON.stringify(state.error)
  out = []
  for (i = 0; i < (state?.content || []).length; i++)
    if (state.content[i].type == 'text')
      out.push(state.content[i].text)
  return out.join('\n')
}

// v2 paginates messages (default 50, newest first), so walk the cursor to load
// the whole transcript oldest-first.
export
async function fetchMessages
(c, sessionID) {
  let cursor, data, guard

  data = []
  guard = 0
  while (1) {
    let params, res

    params = { sessionID, limit: 200 }
    if (cursor)
      params.cursor = cursor
    else
      params.order = 'asc'
    res = await c.message.list(params)
    if ((res.data || []).length == 0)
      break
    data = data.concat(res.data)
    cursor = res.cursor?.next
    guard++
    if (cursor == null || guard >= 1000)
      break
  }
  return { data }
}

// Sessions reopened from history store subagent calls as `task` (live events
// call the tool `subagent`). Return { callID, sessionID } for each child
// session so its transcript can be loaded too.
export
function subagentCalls
(messages) {
  let calls, seen

  calls = []
  seen = new Set()
  for (let msg of (messages || []))
    if (msg.type == 'assistant')
      for (let content of (msg.content || []))
        if ((content.type == 'tool')
            && ((content.name == 'subagent') || (content.name == 'task'))) {
          let id

          id = Util.subagentChildId(content)
          if (id && (seen.has(id) == 0)) {
            seen.add(id)
            calls.push({ callID: content.id, sessionID: id })
          }
        }
  return calls
}

// Load the transcripts of every child session a stored subagent call started.
export
async function fetchSubagentMessages
(c, messages) {
  let children, calls

  children = new Map()
  calls = subagentCalls(messages)
  for (let call of calls)
    try {
      children.set(call.sessionID, (await fetchMessages(c, call.sessionID)).data)
    }
    catch (err) {
      d('CO subagent fetch failed: ' + err.message)
    }
  return children
}

function toolLabel
(buf, content) {
  let input, label

  input = content.state?.input || {}
  label = content.name
  if (content.name == 'shell' && input.command)
    label += ': ' + input.command
  else if (input.path)
    label = [ content.name + ' ', span(Util.makeRelative(buf, input.path), 'code-file', { 'data-run': 'open link', 'data-runaux': 'open link in other pane', 'data-path': input.path }) ]
  else if (input.pattern)
    label += ' "' + input.pattern + '"'
  else if (input.query)
    label += ': ' + input.query
  else if (input.url)
    label = [ content.name + ' ', span(input.url, 'code-file', { 'data-run': 'open link', 'data-runaux': 'open link in other pane', 'data-path': input.url }) ]
  return label
}

// The title cell of a session row. Child sessions (started by a subagent call)
// are marked with their agent so they are readable while subagents are shown.
export
function sessionTitle
(child, agent, title) {
  let kids

  kids = []
  if (child)
    kids.push(span('@' + (agent || 'subagent'), 'code-sessions-agent'))
  if (title)
    kids.push(title)
  return divCl('code-sessions-title' + (child ? ' code-sessions-child' : ''), kids)
}

// Render a stored transcript into a code buffer. `children` maps child session
// IDs to their messages so subagent output can be replayed where it happened.
export
function renderHistory
(buf, messages, children, done) {
  let pendingModel

  function flushModel
  () {
    if (pendingModel) {
      pendingModel.model && Ui.appendModel(buf, pendingModel.model, Util.fmtCost(pendingModel.cost), pendingModel.at, pendingModel.messageID)
      pendingModel = 0
    }
  }

  function renderChild
  (childID) {
    let msgs, cur

    msgs = children.get(childID)
    if (msgs == null)
      return
    cur = buf.vars('code').curMessageID
    for (let msg of msgs)
      if (msg.type == 'assistant') {
        buf.vars('code').curMessageID = msg.id
        for (let content of (msg.content || []))
          if (content.type == 'reasoning' && content.text)
            Ui.appendThinking(buf, content.text, msg.id)
          else if (content.type == 'text' && content.text)
            Ui.appendMsg(buf, 0, content.text, msg.id, 0, { subagent: 1 })
          else if (content.type == 'tool')
            renderTool(content)
      }
    buf.vars('code').curMessageID = cur
  }

  function renderTool
  (content) {
    if ((content.name == 'subagent') || (content.name == 'task')) {
      Ui.appendToolMsg(buf, content.id,
                       Ui.subagentLabel(content),
                       Util.subagentResult(content),
                       { always: Util.subagentPrompt(content) })
      renderChild(Util.subagentChildId(content))
      return
    }
    Ui.appendToolMsg(buf, content.id, toolLabel(buf, content), toolText(content.state))
  }

  function processBatch
  (i) {
    let end

    end = Math.min(i + 10, messages.length)
    for (; i < end; i++) {
      let msg, role

      msg = messages[i]
      role = msg.type
      buf.vars('code').curMessageID = msg.id
      if (role == 'user') {
        flushModel()
        if (msg.text)
          Ui.appendMsg(buf, 'user', msg.text, msg.id, msg.time?.created, { agent: msg.agents?.[0]?.name })
      }
      else if (role == 'assistant') {
        for (let content of (msg.content || []))
          if (content.type == 'reasoning' && content.text)
            Ui.appendThinking(buf, content.text, msg.id)
          else if (content.type == 'text' && content.text)
            Ui.appendMsg(buf, 0, content.text, msg.id)
          else if (content.type == 'tool')
            renderTool(content)
        pendingModel = { model: Util.modelName(msg.model?.modelID, msg.model?.variant),
                         cost: msg.cost,
                         at: msg.time?.created,
                         messageID: msg.id }
      }
    }
    Ui.updateStatus(buf, '🔃 Loading... ' + end + '/' + messages.length, '', '', '')

    if (end < messages.length)
      globalThis.requestAnimationFrame(() => processBatch(end))
    else {
      flushModel()
      if (done)
        done()
    }
  }

  messages = messages || []
  children = children || new Map()

  if (messages.length == 0) {
    if (done)
      done()
    return
  }

  Ui.updateStatus(buf, '🔃 Loading... 0/' + messages.length, '', '', '')
  processBatch(0)
}

export
function init
(events) {
  let mo, searchHist

  function updateCount
  (view, n) {
    let el

    el = view.eleOrReserved?.querySelector('.edMl-file')
    if (el)
      el.innerText = 'Code Sessions: ' + n
  }

  function viewInit
  (view, spec, cb) { // (view)
    let w, showSubagents, subEl, h

    w = view.eleOrReserved.querySelector('.code-sessions-w')
    if (w == null) {
      if (cb)
        cb(view)
      return
    }

    h = view.eleOrReserved.querySelector('.code-sessions-h')
    if (h && h.querySelector('.code-sessions-search') == null) {
      h.appendChild(divCl('code-sessions-search', '🔍',
                          { 'data-run': 'search sessions',
                            title: 'Search sessions' }))
      h.appendChild(divCl('code-sessions-subagents', '⊞',
                          { 'data-run': 'toggle subagents',
                            title: 'Show/hide subagent sessions' }))
    }

    view.buf.vars('Code Sessions').searchActive = 0

    {
      let searchEl

      searchEl = view.eleOrReserved.querySelector('.code-sessions-search')
      if (searchEl)
        searchEl.innerText = '🔍'
    }

    showSubagents = view.buf.vars('Code Sessions').showSubagents ? 1 : 0
    subEl = view.eleOrReserved.querySelector('.code-sessions-subagents')
    if (subEl)
      subEl.innerText = showSubagents ? '⊟' : '⊞'

    w.innerHTML = 'Fetching...'

    Comm.ensureClient(view.buf)
      .then(c => {
              let opts

              opts = { directory: Util.apiDir(view.buf) }
              return c.session.list(opts)
            })
      .then(sessions => {
              let filtered

              w.innerHTML = ''
              d({ sessions })
              filtered = sessions.data || []
              if (showSubagents == 0)
                filtered = filtered.filter(s => s.parentID == null)
              updateCount(view, filtered.length)
              append(w,
                     filtered.map(s => {
                                    return [ divCl('code-sessions-del', '✗',
                                                   { 'data-run': 'delete session',
                                                     'data-session-id': s.id,
                                                     'data-session-dir': view.buf.dir }),
                                             divCl('code-sessions-id', (s.id || '').replace(/^ses_/, ''),
                                                   { 'data-run': 'open code session',
                                                     'data-session-id': s.id,
                                                     'data-session-dir': view.buf.dir,
                                                     'data-session-agent': s.agent || '',
                                                     'data-session-time': s.time?.created }),
                                             sessionTitle(s.parentID, s.agent, (s.title || ('New session - ' + new Date(s.time?.created || Date.now()).toISOString())).split('\n')[0]) ]
                                  }))
            })

    if (cb)
      cb(view)
  }

  function toggleSubagents
  () {
    let buf, showSubagents

    buf = View.current().buf
    showSubagents = buf.vars('Code Sessions').showSubagents ? 1 : 0
    buf.vars('Code Sessions').showSubagents = showSubagents ? 0 : 1
    viewInit(View.current())
  }

  function quitSearchOrBury
  () {
    let buf

    buf = View.current().buf
    if (buf.vars('Code Sessions').searchActive)
      viewInit(View.current())
    else
      Cmd.run('bury', buf)
  }

  function searchSessions
  () {
    let buf, view

    view = View.current()
    buf = view.buf
    if (buf.vars('Code Sessions').searchActive) {
      viewInit(view)
      return
    }
    ask({ text: 'Search sessions:',
          hist: searchHist },
        phrase => {
          if (phrase == null || phrase.length == 0)
            return
          searchHist.add(phrase)
          showSearchResults(buf, phrase)
        })
  }

  function extractSnippet
  (data, phrase) {
    let idx

    if (data == null)
      return ''
    idx = data.toLowerCase().indexOf(phrase.toLowerCase())
    if (idx < 0)
      return ''
    return (idx > 40 ? '…' : '') + data.slice(Math.max(0, idx - 40), idx + phrase.length + 40).trim() + (idx + phrase.length + 40 < data.length ? '…' : '')
  }

  function showSearchResults
  (buf, phrase) {
    let w

    w = buf.anyView(1)?.eleOrReserved?.querySelector('.code-sessions-w')
    if (w == null)
      return

    w.innerHTML = 'Searching...'
    buf.vars('Code Sessions').searchActive = phrase

    {
      let searchEl

      searchEl = buf.anyView(1)?.eleOrReserved?.querySelector('.code-sessions-search')
      if (searchEl)
        searchEl.innerText = '✕'
    }

    Tron.acmd('code.searchSessions', [ buf.dir, phrase ])
      .then(rows => {
              let el

              w.innerHTML = ''
              el = buf.anyView(1)?.eleOrReserved?.querySelector('.edMl-file')
              if (el)
                el.innerText = 'Search: ' + rows.length + ' results'

              append(w,
                     rows.map(s => {
                                let snippet, isTitle

                                snippet = s.snippet_source ? extractSnippet(s.snippet_source, phrase) : ''
                                if (snippet.length == 0 && s.title) {
                                  snippet = extractSnippet(s.title, phrase)
                                  isTitle = 1
                                }
                                if (snippet.length == 0)
                                  return [ divCl('code-sessions-del', '✗',
                                                 { 'data-run': 'delete session',
                                                   'data-session-id': s.id,
                                                   'data-session-dir': s.directory }),
                                           divCl('code-sessions-id', (s.id || '').replace(/^ses_/, ''),
                                                 { 'data-run': 'open code session',
                                                   'data-session-id': s.id,
                                                   'data-session-dir': s.directory,
                                                   'data-session-agent': s.agent || '',
                                                   'data-session-time': s.time_created }),
                                           sessionTitle(s.parent_id, s.agent, (s.title || '').split('\n')[0]) ]
                                snippet = isTitle ? 'Title: ' + snippet : snippet
                                return [ divCl('code-sessions-del', '✗',
                                               { 'data-run': 'delete session',
                                                 'data-session-id': s.id,
                                                 'data-session-dir': s.directory }),
                                         divCl('code-sessions-id', (s.id || '').replace(/^ses_/, ''),
                                               { 'data-run': 'open code session',
                                                 'data-session-id': s.id,
                                                 'data-session-dir': s.directory,
                                                 'data-session-agent': s.agent || '',
                                                 'data-session-time': s.time_created }),
                                         sessionTitle(s.parent_id, s.agent, (s.title || '').split('\n')[0]),
                                         divCl('code-sessions-snippet', snippet) ]
                              }))
            })
  }

  function openCodeSession
  (u, we) {
    let sessionID, sessionDir, sessionAgent, ts

    function open
    () {
      let pane, name, buf, provider, model, variant, agent

      function onMessages
      (c, res) {
        function afterHistory
        () {
          Ev.startSub(buf, events)
          buf.vars('code').busy = 0
          globalThis.requestAnimationFrame(() => Ui.updateStatus(buf, 'OK', '', '', ''))
        }

        function afterChildren
        (children) {
          renderHistory(buf, res.data, children, afterHistory)
        }

        fetchSubagentMessages(c, res.data).then(afterChildren)
      }

      pane = Pane.current()
      name = 'CO ' + (sessionDir || '').replace(/\/?$/, '/')

      buf = Buf.find(b => b.name == name)
      if (buf) {
        pane.setBuf(buf)
        return
      }

      provider = Util.getProvider()
      model = Util.getModel()
      variant = Util.getVariant()
      // The agent the session was started with (a subagent's own agent, for a
      // child session), so the header and further prompts match the session.
      agent = sessionAgent || Opt.get('code.agent')

      buf = Buf.add(name, 'code', Ui.divW(sessionDir, agent), sessionDir)
      buf.opts.set('code.agent', agent)
      buf.vars('code').provider = provider
      buf.vars('code').model = model
      buf.vars('code').variant = variant
      buf.vars('code').sessionID = sessionID
      if (ts)
        buf.vars('code').sessionStart = ts
      buf.vars('code').thinkingHidden = 1
      buf.opt('core.lint.enabled', 1)

      Comm.ensureClient(buf).then(c => {
                                    pane.setBuf(buf,
                                                {},
                                                () => {
                                                  function onFetched
                                                  (res) {
                                                    onMessages(c, res)
                                                  }

                                                  buf.vars('code').busy = 1
                                                  Ui.updateStatus(buf, '🔃 Loading session...', '', '', '')
                                                  fetchMessages(c, sessionID).then(onFetched)

                                                  buf.vars('code').firstPromptSent = 1
                                                  Prompt.nestBuf(buf)
                                                  buf.views.forEach(view => {
                                                                      if (view.eleOrReserved) {
                                                                        let w

                                                                        w = view.eleOrReserved.querySelector('.code-w')
                                                                        if (w) {
                                                                          let h

                                                                          Css.add(w, 'code-thinking-hidden')
                                                                          h = view.eleOrReserved.querySelector('.code-h')
                                                                          if (h) {
                                                                            let img

                                                                            img = h.querySelector('.code-thought img')
                                                                            if (img)
                                                                              img.src = Icon.path('thinking.zen')
                                                                          }
                                                                        }
                                                                      }
                                                                    })
                                                })
                                  }).catch(err => {
                                             buf.vars('code').busy = 0
                                             Ui.updateStatus(buf, '☠ Error', '', '', '')
                                             Mess.yell('Failed: ' + err.message)
                                           })
    }

    sessionID = we.e.target.dataset.sessionId
    sessionDir = we.e.target.dataset.sessionDir
    sessionAgent = we.e.target.dataset.sessionAgent
    ts = we.e.target.dataset.sessionTime
    if (ts)
      ts = Number(ts)

    open()
  }

  function deleteSession
  (u, we) {
    let sessionID

    sessionID = we.e.target.dataset.sessionId

    Prompt.yn('Delete session ' + sessionID.replace(/^sess_/, '') + '?',
              { icon: 'trash' },
              yes => {
                if (yes)
                  Comm.ensureClient(View.current().buf)
                    .then(c => c.session.remove({ sessionID }))
                    .then(() => {
                            View.current().buf.views.forEach(view => {
                                                               let w, el

                                                               w = view.eleOrReserved?.querySelector('.code-sessions-w')
                                                               el = w?.querySelector('[data-session-id="' + sessionID + '"]')
                                                               if (el) {
                                                                 let i, n

                                                                 i = [ ...w.children ].indexOf(el)
                                                                 w.children[i + 2]?.remove()
                                                                 w.children[i + 1]?.remove()
                                                                 w.children[i].remove()
                                                                 n = w.querySelectorAll('.code-sessions-id').length
                                                                 updateCount(view, n)
                                                               }
                                                             })
                          })
              })
  }

  searchHist = Hist.ensure('code.sessions.search')

  mo = Mode.add('Code Sessions', { viewInit })

  Cmd.add('refresh', () => viewInit(View.current()), mo)

  Cmd.add('code sessions', () => {
                             let p, name, buf

                             p = Pane.current()
                             name = 'Code Sessions: ' + p.dir
                             buf = Buf.find(b => b.name == name)
                             if (buf)
                               p.setBuf(buf, {}, view => viewInit(view))
                             else {
                               buf = Buf.add(name, 'Code Sessions',
                                             divCl('code-sessions-ww',
                                                   [ divCl('code-sessions-h',
                                                           Ed.divMl(p.dir, 'Code Sessions',
                                                                    { icon: 'list' })),
                                                     divCl('code-sessions-w bred-surface', '') ]),
                                             p.dir)
                               buf.icon = 'list'
                               p.setBuf(buf)
                             }
                           })

  Cmd.add('open code session', openCodeSession, mo)

  Cmd.add('delete session', deleteSession, mo)

  Cmd.add('toggle subagents', toggleSubagents, mo)

  Cmd.add('search sessions', searchSessions, mo)

  Cmd.add('quit search or bury', quitSearchOrBury, mo)

  Em.on('g', 'refresh', mo)
  Em.on('q', 'quit search or bury', mo)
  Em.on('s', 'search sessions', mo)
  Em.on('n', 'next line', mo)
  Em.on('p', 'previous line', mo)
  Em.on('Backspace', 'scroll up', mo)
  Em.on(' ', 'scroll down', mo)
  Em.on('ArrowUp', 'previous line', mo)
  Em.on('ArrowDown', 'next line', mo)
  Em.on('ArrowRight', 'forward character', mo)
  Em.on('ArrowLeft', 'backward character', mo)
  Em.on('PageUp', 'scroll up', mo)
  Em.on('PageDown', 'scroll down', mo)
  Em.on('Home', 'buffer start', mo)
  Em.on('End', 'buffer end', mo)
}
