import { append, button, divCl, img, span } from '../../js/dom.mjs'

import * as Buf from '../../js/buf.mjs'
import * as Cmd from '../../js/cmd.mjs'
import * as Css from '../../js/css.mjs'
import * as Ed from '../../js/ed.mjs'
import * as Em from '../../js/em.mjs'
import * as Hist from '../../js/hist.mjs'
import * as Icon from '../../js/icon.mjs'
import * as Mess from '../../js/mess.mjs'
import * as Mode from '../../js/mode.mjs'
import * as Opt from '../../js/opt.mjs'
import * as Pane from '../../js/pane.mjs'
import * as Prompt from '../../js/prompt.mjs'
import { d } from '../../js/mess.mjs'
import * as Tron from '../../js/tron.mjs'
import * as U from '../../js/util.mjs'
import * as View from '../../js/view.mjs'
import { v4 as uuidv4 } from '../../lib/uuid/index.js'
import * as CMState from '../../lib/@codemirror/state.js'
import * as CMView from '../../lib/@codemirror/view.js'
import { patch } from '../../lib/codemirror-lang-diff.js'
import { markdown } from '../../lib/@codemirror/lang-markdown.js'
import { langs } from '../../js/wode-lang.mjs'
import { modeFor } from '../../js/wode-mode.mjs'
import { themeExtension } from '../../js/wode-theme.mjs'

import * as OpenCode from './lib/opencode/v2/client.js'
import VopenCode from './lib/opencode/version.json' with { type: 'json' }
import { makeMlDir } from '../../js/ed.mjs'

function agentIcon
() {
  return '⚡'
}

function getSubagentIds
(buf) {
  return buf.vars('code').subagentIds || (buf.vars('code').subagentIds = new Map())
}

function getSubagentCallIds
(buf) {
  return buf.vars('code').subagentCallIds || (buf.vars('code').subagentCallIds = new Map())
}

export
function init
() {
  let hist, chatHist, mo, moCodePrompt, stopTimeout, mostRecentAgent

  function initSessions
  () {
    let mo

    function viewInit
    (view, spec, cb) { // (view)
      let w

      w = view.eleOrReserved.querySelector('.code-sessions-w')
      if (w) {

        w.innerHTML = ''
        ensureClient(view.buf).then(c => c.session.list().then(sessions => {
          d({ sessions })
          append(w,
                 sessions.data.filter(s => s.directory == view.buf.dir).map(s => {
                   return [ divCl('code-sessions-del', '✗',
                                  { 'data-run': 'delete session',
                                    'data-session-id': s.id,
                                    'data-session-dir': s.directory }),
                            divCl('code-sessions-id', (s.id || '').replace(/^ses_/, ''),
                                  { 'data-run': 'open code session',
                                    'data-session-id': s.id,
                                    'data-session-dir': s.directory }),
                            divCl('code-sessions-title', (s.title || '').split('\n')[0]) ]
                 }))
        }))
      }

      if (cb)
        cb(view)
    }

    function openCodeSession
    (u, we) {
      let sessionID, sessionDir

      async function open
      () {
        let c, pane, name, buf, provider, model

        pane = Pane.current()
        name = 'CO ' + sessionDir

        buf = Buf.find(b => b.name == name)
        if (buf) {
          pane.setBuf(buf)
          return
        }

        provider = Opt.get('code.provider.agent') || 'opencode-go'
        model = Opt.get('code.model.agent') || 'deepseek-v4-pro'

        buf = Buf.add(name, 'code', divW(sessionDir), sessionDir)
        buf.vars('code').provider = provider
        buf.vars('code').model = model
        buf.vars('code').sessionID = sessionID
        buf.opt('core.lint.enabled', 1)

        try {
          c = await ensureClient(buf)
        }
        catch (err) {
          Mess.yell('Failed: ' + err.message)
          return
        }

        pane.setBuf(buf, {}, () => {
          c.session.messages({ sessionID, directory: sessionDir }).then(r => {
            d({ r })
            for (let msg of r.data)
              for (let part of msg.parts)
                if (part.type == 'text')
                  appendMsg(buf, msg.info.role == 'user' ? 'user' : 0, part.text, part.id)
                else if (part.type == 'reasoning' && part.text)
                  appendThinking(buf, part.text, part.id)
                else if (part.type == 'tool') {
                  let label

                  label = part.tool
                  if (part.tool == 'bash' && part.state?.input?.command)
                    label += ': ' + part.state.input.command
                  else if (part.state?.input?.filePath)
                    label += ' ' + makeRelative(buf, part.state.input.filePath)
                  else if (part.state?.input?.pattern)
                    label += ' "' + part.state.input.pattern + '"'
                  else if (part.state?.input?.query)
                    label += ': ' + part.state.input.query
                  else if (part.state?.input?.url)
                    label += ' ' + part.state.input.url
                  appendToolMsg(buf, part.callID, label,
                                part.state?.output || part.state?.error)
                }
          })

          buf.vars('code').firstPromptSent = 1
          nestPromptBuf(buf)
          startEventSub(buf)
        })
      }

      sessionID = we.e.target.dataset.sessionId
      sessionDir = we.e.target.dataset.sessionDir

      open()
    }

    function deleteSession
    (u, we) {
      let sessionID, sessionDir

      sessionID = we.e.target.dataset.sessionId
      sessionDir = we.e.target.dataset.sessionDir

      Prompt.yn('Delete session ' + sessionID.replace(/^sess_/, '') + '?',
                { icon: 'trash' },
                yes => {
                  if (yes)
                    ensureClient(View.current().buf)
                      .then(c => c.session.delete({ sessionID, directory: sessionDir }))
                      .then(() => {
                        View.current().buf.views.forEach(view => {
                          let w, el

                          w = view.eleOrReserved?.querySelector('.code-sessions-w')
                          el = w?.querySelector('[data-session-id="' + sessionID + '"]')
                          if (el) {
                            let i

                            i = [ ...w.children ].indexOf(el)
                            w.children[i + 2]?.remove()
                            w.children[i + 1]?.remove()
                            w.children[i].remove()
                          }
                        })
                      })
                })
    }

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
        buf.addMode('view')
        p.setBuf(buf)
      }
    })

    Cmd.add('open code session', openCodeSession, mo)

    Cmd.add('delete session', deleteSession, mo)

    Em.on('g', 'refresh', mo)
  }

  async function ensureClient
  (buf) {
    let client, ret, spawnPromise

    client = buf.vars('code').client
    if (client)
      return client

    if (buf.vars('code').spawnPromise)
      return buf.vars('code').spawnPromise

    spawnPromise = Tron.acmd('code.spawn', [ buf.id, buf.dir ])
    buf.vars('code').spawnPromise = spawnPromise

    ret = await spawnPromise

    if (ret.err) {
      buf.vars('code').spawnPromise = 0
      throw new Error(ret.err.message)
    }

    client = OpenCode.createOpencodeClient({ baseUrl: ret.url, directory: buf.dir })
    buf.vars('code').client = client
    buf.vars('code').serverUrl = ret.url
    buf.vars('code').spawnedBufferID = buf.id
    buf.vars('code').spawnPromise = 0
    return client
  }

  function updateCredits
  (buf) {
    let key

    key = Opt.get('code.key')
    if (key.length == 0)
      key = Opt.get('query.key')
    if (key.length == 0)
      return

    fetch('https://openrouter.ai/api/v1/auth/key',
          { method: 'GET',
            headers: { Authorization: 'Bearer ' + key,
                       'Content-Type': 'application/json' } })
      .then(response => {
        if (response.ok) {
          response.json().then(data => {
            d({ data })
            d(data.data.limit_remaining)
            buf.views.forEach(view => {
              if (view.eleOrReserved) {
                let el

                el = view.eleOrReserved.querySelector('.code-under-credits')
                if (el) {
                  let dol

                  dol = parseFloat(data.data.limit_remaining)
                  if (isNaN(dol))
                    el.innerText = '$'
                  else
                    el.innerText = '$' + dol.toFixed(2)
                }
              }
            })
          })
            .catch(err => {
              d('ERR .json: ' + err.message)
            })
          return
        }
        d('Error fetching credit info')
      })
      .catch(err => {
        d('ERR fetch:')
        d(err.message)
      })
  }

  function scroll
  (underW) {
    d('CO SCROLL')
    underW.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'instant' })
  }

  function underVisible
  (w, underW) {
    if (underW) {
      let rU, rW

      rU = underW.getBoundingClientRect()
      rW = w.getBoundingClientRect()
      //d('CO ' + rU.bottom + ' < ' + rW.bottom + '?')
      return rU.top < rW.bottom
    }
    return 0
  }

  function withScroll
  (w, cb) { // (underW)
    let underW, wasVisible

    underW = w.querySelector('.code-under-w') || d('CO underW missing')

    wasVisible = underVisible(w, underW)
    d({ wasVisible })

    if (cb)
      cb(underW)

    if (wasVisible && underW)
      scroll(underW)
  }

  function appendX
  (w, el) {
    withScroll(w, underW => {
      if (underW) {
        let prev

        prev = underW.previousElementSibling
        if (prev && Css.has(prev, 'code-msg-permission'))
          // keep the permission check at the end
          prev.before(el)
        else
          underW.before(el)
      }
      else
        append(w, el)
    })
  }

  function setText
  (w, el, text) {
    withScroll(w, () => {
      el.innerText = text
    })
  }

  function makePatchEd
  (text) {
    let el, state, ed

    el = divCl('code-patch-ed')
    state = CMState.EditorState.create({ doc: text,
                                         extensions: [ CMView.EditorView.editable.of(false),
                                                       CMView.EditorView.lineWrapping,
                                                       patch(),
                                                       themeExtension ] })
    ed = new CMView.EditorView({ state, parent: el })
    return { el, ed }
  }

  function makeMarkdownEd
  (text) {
    let el, state, ed

    el = divCl('code-markdown-ed')
    state = CMState.EditorState.create({ doc: text,
                                         extensions: [ CMView.EditorView.editable.of(false),
                                                       CMView.EditorView.lineWrapping,
                                                       markdown({ codeLanguages: langs }),
                                                       themeExtension ] })
    ed = new CMView.EditorView({ state, parent: el })
    return { el, ed }
  }

  function makeCodeEd
  (path, text) {
    let el, state, ed, lang, exts

    el = divCl('code-code-ed')
    lang = langs.find(l => l.id == modeFor(path))
    exts = [ CMView.EditorView.editable.of(false),
             CMView.EditorView.lineWrapping,
             themeExtension ]
    if (lang?.language)
      exts.unshift(lang.language)
    state = CMState.EditorState.create({ doc: text, extensions: exts })
    ed = new CMView.EditorView({ state, parent: el })
    return { el, ed }
  }

  function appendModel
  (buf, model) {
    buf.views.forEach(view => {
      if (view.eleOrReserved) {
        let w

        w = view.eleOrReserved.querySelector('.code-w')
        appendX(w, divCl('code-msg code-msg-role', model))
      }
    })
  }

  function appendMsg
  (buf, role, text, partID) {
    buf.views.forEach(view => {
      if (view.eleOrReserved) {
        let w

        w = view.eleOrReserved.querySelector('.code-w')
        if (role == 'user') {
        }
        else {
          let el

          el = w.querySelector('.code-msg-assistant[data-partid="' + partID + '"]')
          if (el) {
            let oldMdEl

            oldMdEl = el.querySelector('.code-markdown-ed')
            if (oldMdEl) {
              let mdEd

              mdEd = makeMarkdownEd(text)
              withScroll(w, () => oldMdEl.replaceWith(mdEd.el))
              view.vars('code').eds = view.vars('code').eds || []
              view.vars('code').eds.push(mdEd.ed)
            }
            return
          }
        }
        appendX(w,
                divCl('code-msg code-msg-' + (role == 'user' ? 'user' : 'assistant'),
                      [ (role == 'user')
                          ? divCl('code-msg-text' + (text ? '' : ' code-msg-hidden'), text)
                          : makeMarkdownEd(text || '').el ],
                      { 'data-partid': partID || 0 }))
        if (role == 'user') {
          let underW

          underW = w.querySelector('.code-under-w')
          scroll(underW)
        }
      }
    })
  }

  function appendThinking
  (buf, text, partID) {
    buf.views.forEach(view => {
      if (view.eleOrReserved) {
        let w, el

        w = view.eleOrReserved.querySelector('.code-w')
        el = w.querySelector('.code-msg-thinking[data-partid="' + partID + '"]')
        if (el) {
          let current

          current = el.querySelector('.code-msg-text').innerText
          setText(w, el.querySelector('.code-msg-text'), current + text)
        }
        else
          appendX(w,
                  divCl('code-msg code-msg-thinking',
                        [ divCl('code-msg-text', text) ],
                        { 'data-partid': partID || 0 }))
      }
    })
  }

  function makeRelative
  (buf, path) {
    if (path?.startsWith(buf.dir))
      return path.slice(buf.dir.length)
    return path
  }

  function fileLabel
  (buf, tool, path, status, spec) {
    function bounds
    () {
      if (spec.input?.offset)
        return ' ' + spec.input.offset + '-' + (spec.input.offset + (spec.input?.limit || 0))
      return ''
    }

    spec = spec || {}
    return [ tool + ' file ',
             divCl('code-file',
                   makeRelative(buf, path),
                   { 'data-run': 'open link', 'data-path': path }),
             bounds(),
             status || '' ]
  }

  function appendToolMsg
  (buf, callID, label, under, spec) {
    spec = spec || {}
    buf.views.forEach(view => {
      if (view.eleOrReserved) {
        let w, els, underEl

        w = view.eleOrReserved.querySelector('.code-w')
        els = w.querySelectorAll('.code-msg-tool[data-callid="' + callID + '"]')
        els?.forEach(el => el.remove())
        if (under && (spec.format == 'code')) {
          let codeResult

          codeResult = makeCodeEd(spec.path, under)
          underEl = codeResult.el
          view.vars('code').eds = view.vars('code').eds || []
          view.vars('code').eds.push(codeResult.ed)
        }
        else if (under && (spec.format == 'patch')) {
          let patchResult

          patchResult = makePatchEd(under)
          underEl = patchResult.el
          view.vars('code').eds = view.vars('code').eds || []
          view.vars('code').eds.push(patchResult.ed)
        }
        else if (under)
          underEl = divCl('code-msg-text code-msg-under', under)
        appendX(w,
                divCl('code-msg code-msg-tool',
                      [ divCl('code-msg-text',
                              [ (underEl ? divCl('code-msg-arrow', '', { 'data-run': 'toggle details' }) : '➔'),
                                ' ',
                                label ]),
                        underEl ],
                      { 'data-callid': callID }))
      }
    })
  }

  function appendPermission
  (buf, id) {
    buf.views.forEach(view => {
      if (view.eleOrReserved) {
        let w

        w = view.eleOrReserved.querySelector('.code-w')
        appendX(w,
                divCl('code-msg code-msg-permission',
                      [ divCl('code-msg-text',
                              [ '▣ Allow?',
                                button([ span('y', 'key'), 'es' ], 'onfill', { 'data-run': 'yes' }),
                                button([ span('n', 'key'), 'o' ], 'onfill', { 'data-run': 'no' }) ]) ],
                      { 'data-permissionid': id }))
      }
    })
  }

  function ynRespond
  (buf, id, yes) {
    let perm, sessionID, response

    perm = buf.vars('code').permissions.find(p => p.id == id)
    sessionID = perm?.sessionID || buf.vars('code')?.sessionID
    response = yes ? 'once' : 'reject'

    d('CO permission reply: ' + response)
    ensureClient(buf).then(async c => {
      try {
        d('CO calling permission.respond, dir=' + buf.dir)

        // Seems they often move args and things break, so if you're stuck:
        // Check the SDK method parameters against the OpenAPI spec in
        // `http://127.0.0.1:PORT/doc` to verify all required params
        // (especially query params like `directory`) are being passed.
        await c.permission.respond({ sessionID,
                                     permissionID: id,
                                     response,
                                     directory: buf.dir })
        buf.views.forEach(view => {
          if (view.eleOrReserved) {
            let w, el

            w = view.eleOrReserved.querySelector('.code-w')
            el = w.querySelector('.code-msg-permission[data-permissionid="' + id + '"]')
            el?.remove()
          }
        })
      }
      catch (err) {
        d('CO permission respond error: ' + err.message)
      }
    }).catch(err => {
      d('CO permission ensureClient error: ' + err.message)
    })

    buf.vars('code').permissions = buf.vars('code').permissions.slice(1)
    if (buf.vars('code').permissions.length)
      // Ask about the next one.
      appendPermission(buf, buf.vars('code').permissions[0])
  }

  function yn
  (yes) {
    let buf, id, perms

    buf = Pane.current()?.buf
    perms = buf?.vars('code')?.permissions
    id = perms?.length && perms[0]?.id
    if (id)
      ynRespond(buf, id, yes)
  }

  function updateBufStatus
  (buf, status, model, tokenInfo, versionInfo) {
    buf.views.forEach(view => {
      if (view.eleOrReserved) {
        let underW

        underW = view.eleOrReserved.querySelector('.code-under-w')
        if (underW) {
          let statusEl, modelEl, versionEl, tokenEl

          statusEl = underW.querySelector('.code-under-status')
          modelEl = underW.querySelector('.code-under-model')
          versionEl = underW.querySelector('.code-under-version')
          tokenEl = underW.querySelector('.code-under-tokens')
          if (statusEl)
            statusEl.innerText = status
          if (modelEl)
            modelEl.innerText = model
          if (versionEl)
            if (versionInfo)
              versionEl.innerText = versionInfo
            else
              versionEl.innerText = ''
          if (tokenEl)
            if (tokenInfo)
              tokenEl.innerText = tokenInfo
            else
              tokenEl.innerText = ''
        }
      }
    })
  }

  function updateBufAgent
  (buf, agent) {
    buf.views.forEach(view => {
      if (view.eleOrReserved) {
        let h

        h = view.eleOrReserved.querySelector('.code-h')
        if (h) {
          let agentEl

          agentEl = h.querySelector('.code-agent')
          if (agentEl)
            agentEl.innerText = agentIcon() + agent
        }
      }
    })
  }

  function updateIdle
  (buf, tokenInfo) {
    updateBufStatus(buf, 'OK', '', tokenInfo, VopenCode.version)
    if (buf.vars('code').agentStopped) {
      buf.vars('code').agentStopped = 0
      appendMsg(buf, 0, '...stopped')
      buf.vars('code').stepActiveSessions = new Set()
    }
  }

  function updateStatus
  (buf, req, tokenInfo) {

    d('CO updateStatus')
    d({ tokenInfo })

    if (req.status?.type == 'busy')
      updateBufStatus(buf, '🌊', buf.vars('code').model, tokenInfo, VopenCode.version)
    else if (req.status?.type == 'idle')
      updateIdle(buf, tokenInfo)
    else if (req.status?.type == 'retry')
      updateBufStatus(buf, '🔁 retry' + (req.status.message ? ': ' + req.status.message : ''), buf.vars('code').model, tokenInfo, VopenCode.version)
    else if (req.status?.type)
      d('🌱 TODO status: ' + req.status?.type)
  }

  function calculateTokenPercentage
  (buf) {
    let tokens, modelLimit, ret

    ret = ''
    tokens = buf.vars('code').lastTokens
    modelLimit = buf.vars('code').modelContextLimit
    if (tokens) {
      ret += ('T:' + tokens)
      if (modelLimit)
        ret += (' ' + Math.round((tokens / modelLimit) * 100) + '%')
    }
    return ret
  }

  async function updateModelContextLimit
  (buf, providerID, modelID) {
    let lastProviderID, lastModelID

    lastProviderID = buf.vars('code').lastProviderID
    lastModelID = buf.vars('code').lastModelID
    if (providerID
        && modelID
        && (providerID == lastProviderID)
        && (modelID == lastModelID))
      return

    buf.vars('code').lastProviderID = providerID
    buf.vars('code').lastModelID = modelID
    try {
      let c, providers, model

      c = await ensureClient(buf)
      providers = await c.config.providers({ directory: buf.dir })
      providers.data.providers?.some(p => {
        if (p.id == providerID) {
          model = p.models?.[modelID]
          return true
        }
      })
      if (model?.limit?.context) {
        d('CO modelContextLimit ' + model.limit.context)
        buf.vars('code').modelContextLimit = model.limit.context
      }
      else {
        d('CO modelContextLimit missing')
        d({ providers })
      }
    }
    catch (err) {
      d('CO failed to get providers: ' + err.message)
    }
  }

  function checkForPatch
  (buf, req) {
    if ((req.permission == 'edit') || (req.type == 'edit')) {
      let path

      path = (req.metadata?.filepath || req.metadata?.filePath)
      if (path) {
        d('CO permission file: ' + path)
        buf.vars('code').patch = req.metadata?.diff
        appendToolMsg(buf, (req.callID || req.tool.callID), fileLabel(buf, 'Edit', path), req.metadata?.diff, { format: 'patch' })
      }
    }
  }

  function handlePermission
  (buf, req) {
    checkForPatch(buf, req)
    buf.vars('code').permissions = buf.vars('code').permissions || []
    buf.vars('code').permissions.push({ id: req.id, sessionID: req.sessionID })
    if (buf.vars('code').permissions.length == 1)
      // Free to ask.
      appendPermission(buf, req.id)
  }

  function handlePermissionAsked
  (buf, event) {
    let req

    req = event.properties
    d('CO permission asked: ' + req.permission)
    handlePermission(buf, req)
  }

  function handlePermissionUpdated
  (buf, event) {
    let req

    req = event.properties
    d('CO permission updated: ' + req.type)
    handlePermission(buf, req)
  }

  function handleSessionUpdated
  (buf, event) {
    let title

    title = event.properties.info?.title
    if (title)
      buf.views.forEach(view => {
        if (view.eleOrReserved) {
          let titleEl

          titleEl = view.eleOrReserved.querySelector('.code-session-title')
          if (titleEl)
            titleEl.innerText = title
        }
      })
  }

  function handleMessageUpdated
  (buf, event) {
    let info

    info = event.properties.info
    if (info.tokens) {
      let total

      total = (info.tokens.input || 0)
        + (info.tokens.output || 0)
        + (info.tokens.reasoning || 0)
        + (info.tokens.cache?.read || 0)
        + (info.tokens.cache?.write || 0)
      if (total > 0)
        buf.vars('code').lastTokens = total
    }
    if (info.model)
      updateModelContextLimit(buf, info.model.providerID, info.model.modelID)
  }

  function icon
  (tool) {
    if (tool == 'edit')
      return '💾 '
    if (tool == 'read')
      return '💾 '
    if (tool == 'write')
      return '💾 '
    return '▶️ '
  }

  function handlePart
  (buf, event) {
    let part

    part = event.properties.part

    if (part.tokens) {
      let total

      total = (part.tokens.input || 0)
        + (part.tokens.output || 0)
        + (part.tokens.reasoning || 0)
        + (part.tokens.cache?.read || 0)
        + (part.tokens.cache?.write || 0)
      if (total > 0)
        buf.vars('code').lastTokens = total
    }

    if (part.type == 'step-start') {
      let steps

      d('CO step-start')
      steps = buf.vars('code').stepActiveSessions
      if (steps == null) {
        steps = new Set()
        buf.vars('code').stepActiveSessions = steps
      }
      steps.add(part.sessionID)
    }
    else if (part.type == 'step-finish') {
      let steps

      d('CO step-finish')
      steps = buf.vars('code').stepActiveSessions
      if (steps)
        steps.delete(part.sessionID)
    }
    else if (buf.vars('code').agentStopped)
      d('CO agent stopped, skipping: ' + part.type)
    else if (part.type == 'text') {
      d('CO text part' + part.id)
      if (buf.vars('code').stepActiveSessions?.size) {
        d('CO update text: ' + part.text)
        appendMsg(buf, 0, part.text, part.id)
      }
      else
        d('CO text outside step: ' + part.text)
    }
    else if (part.type == 'reasoning') {
      let buffered

      //d('CO reasoning part ' + part.id)

      buffered = (event.properties.delta || '')
      if (buffered) {
        d('CO reasoning append: ' + buffered)
        appendThinking(buf, buffered, part.id)
      }
    }
    else if (part.type == 'tool') {
      let status

      status = part.state?.status
      d('CO tool: ' + icon(part.tool) + part.tool + ' ' + status)
      if (part.tool == 'read' && status == 'running') {
        let path

        path = part.state.input.filePath
        if (path) {
          d('CO read file: ' + path)
          appendToolMsg(buf, part.callID, fileLabel(buf, 'Read', path, 0,
                                                    { input: part.state.input }))
        }
      }
      else if (part.tool == 'read' && status == 'completed') {
        let path

        path = part.state.input.filePath
        if (path) {
          d('CO read file completed: ' + path)
          appendToolMsg(buf, part.callID, fileLabel(buf, 'Read', path, ' ✔️',
                                                    { input: part.state.input }))
        }
      }
      else if (part.tool == 'glob' && status == 'running') {
        let pattern

        pattern = part.state.input.pattern
        if (pattern) {
          d('CO glob: ' + pattern)
          appendToolMsg(buf, part.callID, 'Glob "' + pattern)
        }
      }
      else if (part.tool == 'glob' && status == 'completed') {
        let count

        count = part.state.metadata?.count
        if (1) {
          d('CO glob completed with ' + count + ' matches')
          appendToolMsg(buf,
                        part.callID,
                        'Glob "' + part.state.input.pattern + ' (' + count + ' matches)',
                        part.state.output)
        }
      }
      else if (part.tool == 'grep' && status == 'running') {
        let pattern, path

        pattern = part.state.input.pattern
        path = part.state.input.path
        if (pattern) {
          d('CO grep: ' + pattern + ' in ' + path)
          appendToolMsg(buf, part.callID, 'Grep "' + pattern + '" in ' + (path || '.'))
        }
      }
      else if (part.tool == 'grep' && status == 'completed') {
        let matches, path

        matches = part.state.metadata?.matches
        path = part.state.input.path
        if (matches) {
          d('CO grep completed with ' + matches + ' matches')
          appendToolMsg(buf,
                        part.callID,
                        'Grep "' + part.state.input.pattern + '" in ' + (path || '.') + ' (' + matches + ' matches)',
                        part.state.output)
        }
      }
      else if (part.tool == 'bash' && status == 'running') {
        let command

        command = part.state.input.command
        if (command) {
          d('CO bash: ' + command)
          appendToolMsg(buf, part.callID, 'bash: ' + command)
        }
      }
      else if (part.tool == 'bash' && status == 'completed') {
        let command, exitCode

        command = part.state.input.command
        exitCode = part.state.metadata?.exit
        if (command) {
          d('CO bash completed: ' + command + ' (exit ' + exitCode + ')')
          appendToolMsg(buf, part.callID, 'bash: $ ' + command + ' (exit ' + exitCode + ')', part.state.output)
        }
      }
      else if (part.tool == 'write' && status == 'running') {
        let path

        path = part.state.input.filePath
        if (path) {
          d('CO write file: ' + path)
          appendToolMsg(buf, part.callID, fileLabel(buf, 'Write', path, 0,
                                                    { input: part.state.input }),
                        part.state?.input?.content,
                        { format: 'code', path })
        }
      }
      else if (part.tool == 'write' && status == 'completed') {
        let path

        path = part.state.input.filePath
        if (path) {
          d('CO write file: ' + path)
          appendToolMsg(buf, part.callID, fileLabel(buf, 'Write', path, ' ✔️',
                                                    { input: part.state.input }),
                        part.state?.input?.content,
                        { format: 'code', path })
        }
      }
      else if (part.tool == 'edit' && status == 'running') {
        let path

        path = part.state.input.filePath
        if (path) {
          d('CO edit file: ' + path)
          appendToolMsg(buf, part.callID, fileLabel(buf, 'Edit', path, 0,
                                                    { input: part.state.input }))
        }
      }
      else if (part.tool == 'edit' && status == 'completed') {
        let path

        path = part.state.input.filePath
        if (path) {
          let under

          d('CO edit completed: ' + path)
          under = '- ' + part.state?.input?.oldString + '\n+ ' + part.state?.input?.newString
          under = part.state?.metadata?.diff || buf.vars('code').patch || under
          appendToolMsg(buf, part.callID, fileLabel(buf, 'Edit', path, ' ✔️',
                                                    { input: part.state.input }),
                        under , { format: 'patch' })
        }
      }
      else if (part.tool == 'edit' && status == 'error') {
        let path

        path = part.state.input.filePath
        if (path) {
          let under

          d('CO edit error: ' + path)
          under = '- ' + part.state?.input?.oldString + '\n+ ' + part.state?.input?.newString
          under = buf.vars('code').patch || under
          appendToolMsg(buf, part.callID, fileLabel(buf, 'Edit', path, ' ✘',
                                                    { input: part.state.input }),
                        under)
          appendMsg(buf, 0, part.state?.error, part.id)
        }
      }
      else if (part.tool == 'websearch' && status == 'running') {
        let query

        query = part.state.input.query
        if (query) {
          d('CO websearch: ' + query)
          appendToolMsg(buf, part.callID, 'Web search: ' + query)
        }
      }
      else if (part.tool == 'websearch' && status == 'completed') {
        let query, results

        query = part.state.input.query
        results = part.state.metadata?.results
        if (query) {
          d('CO websearch completed with ' + results + ' results')
          appendToolMsg(buf,
                        part.callID,
                        'Web search: ' + query + ' (' + results + ' results)',
                        part.state.output)
        }
      }
      else if (part.tool == 'websearch' && status == 'error') {
        let query

        query = part.state.input.query
        if (query) {
          d('CO websearch error')
          appendToolMsg(buf,
                        part.callID,
                        'Web search: ' + query,
                        part.state.error)
        }
      }
      else if (part.tool == 'webfetch' && status == 'running') {
        let url

        url = part.state.input.url
        if (url) {
          d('CO webfetch: ' + url)
          appendToolMsg(buf, part.callID, 'Fetch ' + url)
        }
      }
      else if (part.tool == 'webfetch' && status == 'completed') {
        let url, size

        url = part.state.input.url
        size = part.state.output?.length
        if (url) {
          d('CO webfetch completed, size: ' + size)
          appendToolMsg(buf,
                        part.callID,
                        'Fetch ' + url + (size ? ' (' + size + ' bytes)' : ''))
        }
      }
      else if (part.tool == 'webfetch' && status == 'error') {
        let url

        url = part.state.input.url
        if (url) {
          d('CO webfetch error')
          appendToolMsg(buf,
                        part.callID,
                        'Fetch ' + url,
                        part.state.error)
        }
      }
      else if (part.tool == 'task' && status == 'running') {
        let desc, agent, sessionId

        desc = part.state.input.description
        agent = part.state.input.subagent_type
        sessionId = part.state.metadata?.sessionId
        if (sessionId) {
          getSubagentIds(buf).set(sessionId, 1)
          getSubagentCallIds(buf).set(sessionId, part.callID)
        }
        desc = desc ? ('Task: ' + desc + ' (' + agent + ' agent)') : ('Task (' + agent + ' agent)')
        appendToolMsg(buf, part.callID, desc)
      }
      else if (part.tool == 'task' && status == 'completed') {
        let desc, agent, sessionId

        desc = part.state.input.description
        agent = part.state.input.subagent_type
        sessionId = part.state.metadata?.sessionId
        if (sessionId) {
          let ids

          ids = buf.vars('code').subagentIds
          if (ids)
            ids.delete(sessionId)
        }
        desc = desc ? ('Task: ' + desc + ' (' + agent + ' agent) ✔️') : ('Task (' + agent + ' agent) ✔️')
        appendToolMsg(buf, part.callID, desc, part.state.output)
      }
      else if (part.tool == 'task' && status == 'error') {
        let desc, agent, sessionId

        desc = part.state.input.description
        agent = part.state.input.subagent_type
        sessionId = part.state.metadata?.sessionId
        if (sessionId) {
          let ids

          ids = buf.vars('code').subagentIds
          if (ids)
            ids.delete(sessionId)
        }
        desc = desc ? ('Task: ' + desc + ' (' + agent + ' agent) ✘') : ('Task (' + agent + ' agent) ✘')
        appendToolMsg(buf, part.callID, desc, part.state.error)
      }
      else
        appendToolMsg(buf,
                      part.callID,
                      'Tool call: ' + part.tool + (status ? (' (' + status + ')') : ''))
    }
  }

  function handlePartDelta
  (buf, event) {
    let delta, field

    delta = event.properties.delta
    field = event.properties.field
    buf.views.forEach(view => {
      if (view.eleOrReserved) {
        let msgEl, thinkingEl, textEl, w

        w = view.eleOrReserved.querySelector('.code-w')
        msgEl = w.querySelector('.code-msg-assistant[data-partid="' + event.properties.partID + '"]')
        if (msgEl) {
          textEl = msgEl.querySelector('.code-msg-text')
          if (textEl && field == 'text')
            textEl.innerText = (textEl.innerText || '') + delta
        }
        thinkingEl = w.querySelector('.code-msg-thinking[data-partid="' + event.properties.partID + '"]')
        if (thinkingEl && field == 'text') {
          textEl = thinkingEl.querySelector('.code-msg-text')
          if (textEl)
            textEl.innerText = (textEl.innerText || '') + delta
        }
      }
    })
  }

  function handleSubagentIdle
  (buf, event) {
    let callId

    callId = buf.vars('code').subagentCallIds?.get(event.properties.sessionID)
    if (callId)
      buf.views.forEach(view => {
        if (view.eleOrReserved) {
          let w, els

          w = view.eleOrReserved.querySelector('.code-w')
          els = w.querySelectorAll('.code-msg-tool[data-callid="' + callId + '"]')
          els?.forEach(el => {
            let textEl

            textEl = el.querySelector('.code-msg-text')
            if (textEl && textEl.innerText.indexOf('◉') < 0)
              textEl.innerText = textEl.innerText + ' ◉'
          })
        }
      })
  }

  function handleEvent
  (buf, event) {
    let sessionID

    function isSubagentId
    (id) {
      return buf?.vars('code')?.subagentIds?.has(id)
    }

    d('CO ' + event.type)
    d({ event })

    sessionID = buf && buf.vars('code')?.sessionID

    // Already done by session.status. Maybe planned replacement.
    if ((event.type == 'session.idle')
        && (event.properties.sessionID == sessionID
            || isSubagentId(event.properties.sessionID))) {
      if (event.properties.sessionID == sessionID)
        updateIdle(buf, calculateTokenPercentage(buf))
      else
        handleSubagentIdle(buf, event)
      return
    }

    if ((event.type == 'session.status')
        && (event.properties.sessionID == sessionID
            || isSubagentId(event.properties.sessionID))) {
      if (event.properties.sessionID == sessionID)
        updateStatus(buf, event.properties, calculateTokenPercentage(buf))
      return
    }

    if ((event.type == 'permission.asked')
        && (event.properties.sessionID == sessionID
            || isSubagentId(event.properties.sessionID))) {
      handlePermissionAsked(buf, event)
      return
    }

    if ((event.type == 'permission.updated')
        && (event.properties.sessionID == sessionID
            || isSubagentId(event.properties.sessionID))) {
      handlePermissionUpdated(buf, event)
      return
    }

    if ((event.type == 'session.error')
        && (event.properties?.sessionID == sessionID)) {
      let error

      error = event.properties.error
      d({ error })
      if (error)
        Mess.yell('🚨 session.error: ' + (error.name || '??') + ' ' + (error.data?.message || '????'))
      else
        Mess.yell('🚨 session.error: error missing')
      return
    }

    if ((event.type == 'session.updated')
        && (event.properties.info.id == sessionID
            || isSubagentId(event.properties.info.id))) {
      if (event.properties.info.id == sessionID)
        handleSessionUpdated(buf, event)
      return
    }

    if ((event.type == 'message.updated')
        && (event.properties.info.sessionID == sessionID)) {
      handleMessageUpdated(buf, event)
      return
    }

    if ((event.type == 'message.part.updated')
        && (event.properties.part.sessionID == sessionID
            || isSubagentId(event.properties.part.sessionID))) {
      handlePart(buf, event)
      return
    }

    if ((event.type == 'message.part.delta')
        && (event.properties.sessionID == sessionID
            || isSubagentId(event.properties.sessionID))) {
      handlePartDelta(buf, event)
      return
    }

    if (event.type == 'server.connected') {
      updateBufStatus(buf, 'OK', '', '', VopenCode.version) // clears the CONNECTED after reconnect
      return
    }

    if (event.type == 'server.heartbeat')
      return

    {
      let evSessionID, subagent

      evSessionID = event.properties.sessionID
        || event.properties.part?.sessionID
        || event.properties.info?.id
      subagent = isSubagentId(evSessionID)
      d('🌱 TODO handle ' + event.type + (subagent ? ' (subagent)' : ''))
    }
  }

  function startEventSub
  (buf) {
    let state

    async function runStream
    (client) {
      let iter

      try {
        let events

        events = await client.event.subscribe()
        iter = events.stream[Symbol.asyncIterator]()
      }
      catch (err) {
        if (err.name == 'AbortError') return
        d('CO subscribe error: ' + err.message)
        state.client = 0
        setTimeout(() => tryReconnect(), 1000)
        return
      }

      updateBufStatus(buf, '🔁 CONNECTED', '', '', VopenCode.version)

      while (state.streamActive) {
        let timeoutMs, timeoutPromise

        timeoutMs = 35000
        timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('heartbeat-timeout')), timeoutMs)
        })

        try {
          let result

          result = await Promise.race([ iter.next(), timeoutPromise ])

          state.lastEventTime = Date.now()
          if (result.done) {
            state.client = 0
            tryReconnect()
            return
          }

          // give event loop a chance, in case flurry of events is freezing ui
          await U.cede()
          handleEvent(buf, result.value)
        }
        catch (err) {
          if (err.message == 'heartbeat-timeout') {
            d('CO heartbeat timeout, reconnecting')
            state.client = 0
            tryReconnect()
            return
          }
          if (err.name == 'AbortError') return
          d('CO stream error: ' + err.message)
          state.client = 0
          tryReconnect()
          return
        }
      }
    }

    async function tryReconnect
    () {
      if (state.streamActive == 0) return
      if (state.spawnedBufferID) {
        await Tron.acmd('code.close', [ state.spawnedBufferID ])
        state.spawnedBufferID = 0
      }
      state.client = 0
      state.lastEventTime = Date.now()
      updateBufStatus(buf, '🔁 RECONNECTING', '', '')
      ensureClient(buf).then(runStream).catch(() => {
        d('CO reconnect spawn failed')
        setTimeout(tryReconnect, 1000)
      })
    }

    state = buf.vars('code')
    if (state.streamActive) return
    state.streamActive = 1
    state.lastEventTime = Date.now()
    updateBufStatus(buf, '🔁 CONNECTING', '', '')

    ensureClient(buf).then(runStream).catch(() => {
      d('CO spawn failed, retrying')
      setTimeout(() => startEventSub(buf), 1000)
    })
  }

  function divW
  (dir) {
    return divCl('code-ww',
                 [ divCl('code-h',
                         [ divCl('code-icon',
                                 img(Icon.path('assist'), 'Code', 'filter-clr-text')),
                           divCl('code-title', makeMlDir(dir)),
                           divCl('code-h-right',
                                 [ divCl('code-agent', '', { 'data-run': 'Set Agent' }),
                                   divCl('code-thought code-icon',
                                         img(Icon.path('thinking.active'), 'Thinking', 'filter-clr-text'),
                                         { 'data-run': 'toggle thinking' }) ]) ]),
                   divCl('code-w bred-scroller',
                         [ divCl('code-session-title'),
                           divCl('code-under-w',
                                 [ divCl('code-under code-under-status', '...'),
                                   divCl('code-under code-under-model', '...'),
                                   divCl('code-under-end',
                                         [ divCl('code-under code-under-credits', ''),
                                           divCl('code-under code-under-version', ''),
                                           divCl('code-under code-under-tokens', '') ]) ]) ]),
                   divCl('code-prompt-w retracted',
                         [ divCl('code-prompt-ml',
                                 [ divCl('code-prompt-model', '') ]),
                           divCl('bred-nested-pane-w') ]) ])
  }

  async function send
  (buf, text, provider, model) {
    let sessionID, c, res

    provider = provider || buf.vars('code').provider || 'opencode'
    model = model || buf.vars('code').model || 'minimax-m2.1-free'

    sessionID = buf.vars('code').sessionID

    try {
      c = await ensureClient(buf)
    }
    catch (err) {
      d(err)
      appendMsg(buf, 'assistant', 'Error: ' + err.message)
      return
    }

    buf.vars('code').agentStopped = 0

    appendMsg(buf, 'user', text)

    startEventSub(buf)

    try {
      let agent

      agent = buf.opts.get('code.agent') || Opt.get('code.agent')

      updateBufAgent(buf, agent)

      d('CO SEND (' + agent + ')')

      res = await c.session.prompt({ sessionID,
                                     directory: buf.dir,
                                     model: { providerID: provider, modelID: model },
                                     agent,
                                     parts: [ { id: uuidv4(), type: 'text', text } ] })

      d('CO SEND done')
      d({ res })

      appendModel(buf, res.data?.info?.modelID || '???')
      if (provider == 'openrouter')
        updateCredits(buf)
    }
    catch (err) {
      d(err)
      appendMsg(buf, 'assistant', 'Error: ' + err.message)
      buf.vars('code').client = 0
      buf.vars('code').streamActive = 0
      startEventSub(buf)
    }

    if (res?.error) {
      d({ resError: res.error })
      appendMsg(buf, 'assistant', 'Error: ' + res.error.message)
      buf.vars('code').client = 0
      buf.vars('code').streamActive = 0
      startEventSub(buf)
    }
  }

  function stopAgent
  (buf, sessionID) {
    buf.vars('code').agentStopped = 1
    ensureClient(buf).then(async client => {
      try {
        await client.session.abort({ sessionID, directory: buf.dir })
        d('CO stop done')
        Mess.yell('Stopped agent')
      }
      catch (err) {
        d('CO stop error: ' + err.message)
      }
    }).catch(err => {
      d('CO stop ensureClient error: ' + err.message)
    })
  }

  function stop
  () {
    let p, sessionID

    p = Pane.current()
    sessionID = p.buf.vars('code')?.sessionID

    if (sessionID)
      stopAgent(p.buf, sessionID)
    else
      Mess.yell('missing sessionID')
  }

  function stopWithCaution
  () {
    let p, sessionID

    p = Pane.current()
    sessionID = p.buf.vars('code')?.sessionID

    if (sessionID)
      if (stopTimeout) {
        clearTimeout(stopTimeout)
        stopTimeout = 0
        stopAgent(p.buf, sessionID)
      }
      else {
        Mess.yell('Again to stop agent')
        stopTimeout = setTimeout(() => {
          stopTimeout = 0
          Mess.yell('stop timed out')
        }, 5000)
      }
    else
      Mess.yell('missing sessionID')
  }

  function toggleThinking
  () {
    let p

    p = Pane.current()
    p.buf.views.forEach(view => {
      if (view.eleOrReserved) {
        let w

        w = view.eleOrReserved.querySelector('.code-w')
        if (w) {
          let img, h

          h = view.eleOrReserved.querySelector('.code-h')
          img = h.querySelector('.code-thought img')
          if (Css.has(w, 'code-thinking-hidden')) {
            w.classList.remove('code-thinking-hidden')
            if (img)
              img.src = Icon.path('thinking.active')
          }
          else {
            w.classList.add('code-thinking-hidden')
            if (img)
              img.src = Icon.path('thinking.zen')
          }
        }
      }
    })
  }

  function toggleDetails
  (u, we) {
    let el

    el = we.e.target.closest('.code-msg-tool')
    Css.toggle(el, 'code-closed')
  }

  function setAgent
  (buf, agent) {
    buf.opts.set('code.agent', agent)
    Hist.ensure('code.agent').add(agent)
    updateBufAgent(buf, agent)
  }

  function promptAgent
  () {
    let buf

    buf = Pane.current().buf
    Prompt.choose(agentIcon() + ' Agent',
                  [ 'build', 'plan' ],
                  {},
                  agent => {
                    if (agent) {
                      agent = agent.trim()
                      setAgent(buf, agent)
                      return
                    }
                    Mess.throw('ERR: agent: ' + agent)
                  })
  }

  function openPrompt
  (buf, pane, provider, model) {
    let wh

    wh = whichHistFromBuf(buf)
    buf.vars('code').promptBuf.placeholder = wh?.nth(0)?.toString()

    buf.views.forEach(view => {
      let container

      container = view.ele.querySelector('.code-prompt-w')
      if (container) {
        let mlModel

        Css.expand(container)
        mlModel = container.querySelector('.code-prompt-model')
        if (mlModel)
          mlModel.innerText = '🗩 ' + provider + '/' + model
      }
    })

    if (pane.view?.nestedViews) {
      let nestedView

      nestedView = pane.view.nestedViews.find(nv => nv.buf == buf.vars('code').promptBuf)
      if (nestedView?.ele)
        pane.focusViewAt(nestedView.ele)
    }
  }

  function next
  () {
    let p, buf, provider, model

    p = Pane.current()
    buf = p.buf

    if (buf.vars('code').permissions?.length)
      return

    if (buf?.vars('code')?.sessionID) {
      // OK
    }
    else
      return

    if (buf.vars('code').busy) {
      d('busy')
      return
    }

    provider = buf.vars('code').provider || Opt.get('code.provider.agent') || 'opencode'
    model = buf.vars('code').model || Opt.get('code.model.agent') || 'minimax-m2.1-free'

    openPrompt(buf, p, provider, model)
  }

  function nestPromptBuf
  (buf) {
    let promptBuf

    function addPromptBuf
    () {
      let b, placeholder

      placeholder = hist?.nth(0)?.toString()

      b = Buf.make({ name: 'Code Prompt',
                     modeKey: 'markdown',
                     content: Ed.divW(buf.dir, 'Code Prompt', { hideMl: 1 }),
                     dir: buf.dir,
                     placeholder,
                     single: 1 })
      b.opts.set('blankLines.enabled', 0)
      b.opts.set('core.autocomplete.enabled', 0)
      b.opts.set('core.brackets.close.enabled', 0)
      b.opts.set('core.folding.enabled', 0)
      b.opts.set('core.highlight.activeLine.enabled', 0)
      b.opts.set('core.head.enabled', 0)
      b.opts.set('core.line.numbers.show', 0)
      b.opts.set('core.lint.enabled', 0)
      b.opts.set('minimap.enabled', 0)
      b.opts.set('ruler.enabled', 0)
      b.icon = 'prompt'

      buf.vars('code').promptBuf = b
      return b
    }

    promptBuf = buf.vars('code').promptBuf || addPromptBuf()
    promptBuf.addMode('Code Prompt')

    buf.views.forEach(view => {
      let container

      container = view.ele.querySelector('.code-prompt-w .bred-nested-pane-w')
      append(container, divCl('bred-nested-pane-w', [], { 'data-bred-nested-buf-id': promptBuf.id }))
    })

    buf.nest(promptBuf)
  }

  function code
  (given) {
    let pane, dir, name, provider, model

    async function run
    (prompt) {
      if (prompt)
        hist.add(prompt)

      try {
        let c, buf, res

        buf = Buf.add(name, 'code', divW(dir), pane.dir)
        buf.vars('code').prompt = prompt
        buf.vars('code').provider = provider
        buf.vars('code').model = model
        buf.opt('core.lint.enabled', 1)

        c = await ensureClient(buf)

        res = await c.session.create({ directory: buf.dir, title: prompt || '' })

        buf.vars('code').sessionID = res.data.id

        pane.setBuf(buf, {}, () => {
          nestPromptBuf(buf)
          if (prompt)
            send(buf, prompt, provider, model)
          else
            openPrompt(buf, pane, provider, model)
        })
      }
      catch (err) {
        Mess.yell('Failed: ' + err.message)
      }
    }

    pane = Pane.current()
    dir = pane.dir
    name = 'CO ' + dir
    {
      let buf

      buf = Buf.find(b => b.name == name)
      if (buf) {
        pane.setBuf(buf)
        if (provider == 'openrouter')
          updateCredits(buf)
        return
      }
    }

    provider = Opt.get('code.provider.agent') || 'opencode'
    model = Opt.get('code.model.agent') || 'minimax-m2.1-free'
    if (given)
      run(given)
    else
      run()
  }

  function viewInit
  (view, spec, cb) { // (view)
    if (cb)
      cb(view)
  }

  function viewCopy
  (to, from, lineNum, cb) {
    let fromW, toW

    fromW = from.ele.querySelector('.code-w')
    toW = to.ele.querySelector('.code-w')
    if (fromW && toW) {
      let fromTitle, toTitle, toUnderW

      fromTitle = fromW.querySelector('.code-session-title')
      toTitle = toW.querySelector('.code-session-title')
      if (fromTitle && toTitle)
        toTitle.innerText = fromTitle.innerText
      toUnderW = toW.querySelector('.code-under-w')
      if (toUnderW) {
        let fromUnderW

        fromUnderW = fromW.querySelector('.code-under-w')
        if (fromUnderW) {
          let statusEl, modelEl, versionEl, tokensEl

          statusEl = toUnderW.querySelector('.code-under-status')
          if (statusEl) {
            let fromStatus

            fromStatus = fromUnderW.querySelector('.code-under-status')
            if (fromStatus)
              statusEl.innerHTML = fromStatus.innerHTML
          }
          modelEl = toUnderW.querySelector('.code-under-model')
          if (modelEl) {
            let fromModel

            fromModel = fromUnderW.querySelector('.code-under-model')
            if (fromModel)
              modelEl.innerHTML = fromModel.innerHTML
          }
          versionEl = toUnderW.querySelector('.code-under-version')
          if (versionEl) {
            let fromVersion

            fromVersion = fromUnderW.querySelector('.code-under-version')
            if (fromVersion)
              versionEl.innerText = fromVersion.innerText
          }
          tokensEl = toUnderW.querySelector('.code-under-tokens')
          if (tokensEl) {
            let fromTokens

            fromTokens = fromUnderW.querySelector('.code-under-tokens')
            if (fromTokens)
              tokensEl.innerText = fromTokens.innerText
          }
        }
      }
      ;[ ...fromW.children ].forEach(child => {
        if (Css.has(child, 'code-session-title'))
          return
        if (Css.has(child, 'code-under-w'))
          return
        toW.insertBefore(child.cloneNode(1), toUnderW)
      })
      {
        let fromH, toH

        fromH = fromW.querySelector('.code-h')
        toH = toW.querySelector('.code-h')
        if (toH) {
          let agentEl

          agentEl = toH.querySelector('.code-agent')
          if (agentEl) {
            let fromAgent

            fromAgent = fromH?.querySelector('.code-agent')
            if (fromAgent)
              agentEl.innerText = fromAgent.innerText
          }
        }
      }
    }
    if (cb)
      cb(to)
  }

  function viewReopen
  (view, lineNum, whenReady) {
    d('================== code viewReopen')

    if (view.ele)
      // timeout so behaves like viewInit
      setTimeout(() => {
        bufEnd(view)
        if (whenReady)
          whenReady(view)
      })
    else
      // probably buf was switched out before init happened.
      viewInit(view,
               { lineNum },
               whenReady)
  }

  function bufEnd
  (v) {
    let w

    w = v.ele.querySelector('.code-w')
    if (w)
      w.scrollTop = w.scrollHeight
  }

  function bufStart
  (v) {
    let w

    w = v.ele.querySelector('.code-w')
    if (w)
      w.scrollTop = 0
  }

  function submitPrompt
  () {
    let buf, p, text, codeBuf, whichHist

    p = Pane.current()
    buf = p.buf
    codeBuf = buf.parent || buf
    text = buf.vars('code').promptBuf.text()
    if (text.length)
      text = text.trim()
    else
      text = buf.vars('code').promptBuf.placeholder || ''

    if (text.length == 0) {
      Mess.yell('Empty prompt')
      return
    }

    if (codeBuf.vars('code').firstPromptSent)
      whichHist = chatHist
    else {
      whichHist = hist
      codeBuf.vars('code').firstPromptSent = 1
    }
    cancelPrompt(p)
    whichHist.add(text)
    buf.vars('code').promptBuf.clear()
    send(buf, text, buf.vars('code').provider, buf.vars('code').model)
  }

  function cancelPrompt
  (p) {
    let buf, codeBuf

    p = p || Pane.current()
    buf = p.buf
    codeBuf = buf.parent || buf
    if (codeBuf.vars('code').firstPromptSent) {
      buf.views.forEach(view => {
        let container

        container = view.ele.querySelector('.code-prompt-w')
        if (container)
          Css.retract(container)
      })

      p.focus()
    }
  }

  function whichHistFromBuf
  (buf) {
    let codeBuf

    codeBuf = buf.parent || buf
    if (codeBuf.vars('code').firstPromptSent)
      return chatHist
    return hist
  }

  function prevHist
  () {
    let view, text, wh

    view = View.current()
    wh = whichHistFromBuf(view.buf)
    text = wh.prev()
    if (text) {
      view.buf.clear()
      view.buf.insert(text)
    }
    else
      Mess.say('End of history')
  }

  function nextHist
  () {
    let view, text, wh

    view = View.current()
    wh = whichHistFromBuf(view.buf)
    text = wh.next()
    if (text) {
      view.buf.clear()
      view.buf.insert(text)
    }
  }

  hist = Hist.ensure('code')
  chatHist = Hist.ensure('code.chat')
  Opt.declare('code.agent', 'str', 'plan')
  Opt.declare('code.model.agent', 'str', 'minimax-m2.1-free')
  Opt.declare('code.provider.agent', 'str', 'opencode')
  Opt.declare('code.key', 'str', '')
  mo = Mode.add('code',
                { viewInit,
                  viewCopy,
                  viewReopen,
                  onRemove
                  (buf) {
                    buf.vars('code').streamActive = 0
                    buf.views?.forEach(view => {
                      view.vars('code').eds?.forEach(ed => ed.destroy())
                    })
                    Tron.acmd('code.close', [ buf.id ])
                  } })

  mo.bufEnd = bufEnd
  mo.bufStart = bufStart

  Cmd.add('code', (u, we, prompt) => code(prompt))

  Cmd.add('respond', () => next(), mo)

  Cmd.add('stop', stop, mo)
  Cmd.add('stop with caution', stopWithCaution, mo)

  Cmd.add('yes', () => yn(1), mo)
  Cmd.add('no', () => yn(), mo)

  Em.on('y', 'yes', mo)
  Em.on('n', 'no', mo)
  Em.on('+', 'respond', mo)
  Em.on('Enter', 'respond', mo)

  Em.on('q', 'bury', mo)
  Em.on('Backspace', 'scroll up', mo)
  Em.on(' ', 'scroll down', mo)
  Em.on('s', 'stop with caution', mo)
  Em.on('p', 'set agent plan', mo)
  Em.on('b', 'set agent build', mo)

  Cmd.add('toggle thinking', toggleThinking, mo)
  Cmd.add('toggle details', toggleDetails, mo)

  Cmd.add('set agent', () => promptAgent(), mo)
  Cmd.add('set agent plan', () => setAgent(Pane.current().buf, 'plan'), mo)
  Cmd.add('set agent build', () => setAgent(Pane.current().buf, 'build'), mo)

  Cmd.add('code buffer', () => {
    code(Pane.current().buf.text())
  })

  Cmd.add('most recent agent', () => {
    if (mostRecentAgent)
      Pane.current().setBuf(mostRecentAgent)
    else
      Cmd.run('code')
  })

  Pane.onSetBuf(view => {
    if (view.buf.mode.key == 'code')
      mostRecentAgent = view.buf
  })

  moCodePrompt = Mode.add('Code Prompt', { minor: 1 })

  Cmd.add('submit prompt', () => submitPrompt(), moCodePrompt)
  Cmd.add('cancel prompt', () => cancelPrompt(), moCodePrompt)
  Cmd.add('previous history item', () => prevHist(), moCodePrompt)
  Cmd.add('next history item', () => nextHist(), moCodePrompt)

  Em.on('Enter', 'submit prompt', moCodePrompt)
  Em.on('C-g', 'cancel prompt', moCodePrompt)
  Em.on('A-p', 'previous history item', moCodePrompt)
  Em.on('A-n', 'next history item', moCodePrompt)

  initSessions()
}
