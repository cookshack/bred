import { append, button, divCl, img, span } from '../../js/dom.mjs'

import * as Buf from '../../js/buf.mjs'
import * as Cmd from '../../js/cmd.mjs'
import * as Css from '../../js/css.mjs'
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
import { v4 as uuidv4 } from '../../lib/uuid/index.js'
import * as CMState from '../../lib/@codemirror/state.js'
import * as CMView from '../../lib/@codemirror/view.js'
import { diff } from '../../lib/codemirror-lang-diff.js'
import { markdown } from '../../lib/@codemirror/lang-markdown.js'
import { themeExtension, langs, modeFor } from '../../js/wodemirror.mjs'

import * as OpenCode from './lib/opencode.js'

export
function init
() {
  let hist, chatHist, mo, stopTimeout

  async function ensureClient
  (buf) {
    let client, ret

    client = buf.vars('code').client
    if (client)
      return client

    ret = await Tron.acmd('code.spawn', [ buf.id, buf.dir ])

    if (ret.err)
      throw new Error(ret.err.message)

    client = OpenCode.createOpencodeClient({ baseUrl: ret.url, directory: buf.dir })
    buf.vars('code').client = client
    buf.vars('code').serverUrl = ret.url
    return client
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
                                                       diff(),
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
      if (view.ele) {
        let w

        w = view.ele.querySelector('.code-w')
        appendX(w,
                divCl('code-msg code-msg-assistant',
                      [ divCl('code-msg-role', model),
                        divCl('code-msg-text code-msg-hidden') ]))
      }
    })
  }

  function appendMsg
  (buf, role, text, partID) {
    buf.views.forEach(view => {
      if (view.ele) {
        let w

        w = view.ele.querySelector('.code-w')
        if (role == 'user') {
        }
        else {
          let el

          el = w.querySelector('.code-msg-assistant[data-partid="' + partID + '"]')
          if (el) {
            let mdEd

            mdEd = makeMarkdownEd(text)
            withScroll(w, () => el.firstElementChild.nextElementSibling.replaceWith(mdEd.el))
            view.vars('code').eds = view.vars('code').eds || []
            view.vars('code').eds.push(mdEd.ed)
            return
          }
        }
        appendX(w,
                divCl('code-msg code-msg-' + (role == 'user' ? 'user' : 'assistant'),
                      [ divCl('code-msg-role' + (role ? '' : ' code-msg-hidden'),
                              role == 'user' ? 'You' : (role || '')),
                        (role == 'user')
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
  (buf, text) {
    buf.views.forEach(view => {
      if (view.ele) {
        let w, el, msgs, lastIsUser

        w = view.ele.querySelector('.code-w')
        msgs = w.querySelectorAll('.code-msg')
        if (msgs.length > 0) {
          let last

          last = msgs[msgs.length - 1]
          if (Css.has(last, 'code-msg-tool'))
            lastIsUser = 1
          else {
            let role

            role = msgs[msgs.length - 1].querySelector('.code-msg-role')
            if (role?.innerText == 'You')
              lastIsUser = 1
          }
        }
        if (lastIsUser)
          el = 0
        else {
          let all

          all = w.querySelectorAll('.code-msg-thinking')
          if (all.length)
            el = all[all.length - 1]
        }
        if (el) {
          let current

          current = el.querySelector('.code-msg-text').innerText
          setText(w, el.querySelector('.code-msg-text'), current + text)
        }
        else
          appendX(w,
                  divCl('code-msg code-msg-thinking',
                        [ divCl('code-msg-role', 'Thinking...'),
                          divCl('code-msg-text', text) ]))
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
    return [ '➔ ' + tool + ' file ',
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
      if (view.ele) {
        let w, els, underEl

        w = view.ele.querySelector('.code-w')
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
                      [ divCl('code-msg-text', label),
                        underEl ],
                      { 'data-callid': callID }))
      }
    })
  }

  function appendPermission
  (buf, id) {
    buf.views.forEach(view => {
      if (view.ele) {
        let w

        w = view.ele.querySelector('.code-w')
        appendX(w,
                divCl('code-msg code-msg-permission',
                      [ divCl('code-msg-text',
                              [ '▣ Allow?',
                                button([ span('y', 'key'), 'es' ], '', { 'data-run': 'yes' }),
                                button([ span('n', 'key'), 'o' ], '', { 'data-run': 'no' }) ]) ],
                      { 'data-permissionid': id }))
      }
    })
  }

  function ynRespond
  (buf, id, yes) {
    let sessionID, response

    sessionID = buf.vars('code')?.sessionID
    response = yes ? 'once' : 'reject'

    d('CO permission reply: ' + response)
    ensureClient(buf).then(async c => {
      try {
        await c.permission.respond({ sessionID,
                                     permissionID: id,
                                     response })
        buf.views.forEach(view => {
          if (view.ele) {
            let w, el

            w = view.ele.querySelector('.code-w')
            el = w.querySelector('.code-msg-permission[data-permissionid="' + id + '"]')
            el?.remove()
          }
        })
      }
      catch (err) {
        d('CO permission respond error: ' + err.message)
      }
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
    id = perms?.length && perms[0]
    if (id)
      ynRespond(buf, id, yes)
  }

  function updateBufStatus
  (buf, co, tokenInfo) {
    buf.views.forEach(view => {
      if (view.ele) {
        let underW, statusEl, tokenEl

        underW = view.ele.querySelector('.code-under-w')
        if (underW) {
          statusEl = underW.querySelector('.code-under-status')
          tokenEl = underW.querySelector('.code-under-tokens')
          if (statusEl)
            statusEl.innerHTML = co
          if (tokenEl)
            if (tokenInfo)
              tokenEl.innerText = tokenInfo
            else
              tokenEl.innerText = ''
        }
      }
    })
  }

  function updateIdle
  (buf, tokenInfo) {
    updateBufStatus(buf, 'IDLE', tokenInfo)
    if (buf.vars('code').agentStopped) {
      buf.vars('code').agentStopped = 0
      appendMsg(buf, 0, '...stopped')
      buf.vars('code').stepActive = 0
    }
  }

  function updateStatus
  (buf, req, tokenInfo) {

    d('CO updateStatus')
    d({ tokenInfo })

    if (req.status?.type == 'busy')
      updateBufStatus(buf, 'BUSY', tokenInfo)
    else if (req.status?.type == 'idle')
      updateIdle(buf, tokenInfo)
    else if (req.status?.type == 'retry')
      updateBufStatus(buf, 'BUSY retry' + (req.status.message ? ': ' + req.status.message : ''), tokenInfo)
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
    let lastProviderID, lastModelID, c, providers, model

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
      c = await ensureClient(buf)
      providers = await c.config.providers({})
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
    buf.vars('code').permissions.push(req.id)
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
        if (view.ele) {
          let titleEl

          titleEl = view.ele.querySelector('.code-session-title')
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
      d('CO step-start')
      buf.vars('code').stepActive = 1
    }
    else if (part.type == 'step-finish') {
      d('CO step-finish')
      buf.vars('code').stepActive = 0
    }
    else if (buf.vars('code').agentStopped)
      d('CO agent stopped, skipping: ' + part.type)
    else if (part.type == 'text') {
      d('CO text part' + part.id)
      if (buf.vars('code').stepActive) {
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
        appendThinking(buf, buffered)
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
          appendToolMsg(buf, part.callID, '➔ Glob "' + pattern)
        }
      }
      else if (part.tool == 'glob' && status == 'completed') {
        let count

        count = part.state.metadata?.count
        if (1) {
          d('CO glob completed with ' + count + ' matches')
          appendToolMsg(buf,
                        part.callID,
                        '➔ Glob "' + part.state.input.pattern + ' (' + count + ' matches)',
                        part.state.output)
        }
      }
      else if (part.tool == 'grep' && status == 'running') {
        let pattern, path

        pattern = part.state.input.pattern
        path = part.state.input.path
        if (pattern) {
          d('CO grep: ' + pattern + ' in ' + path)
          appendToolMsg(buf, part.callID, '➔ Grep "' + pattern + '" in ' + (path || '.'))
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
                        '➔ Grep "' + part.state.input.pattern + '" in ' + (path || '.') + ' (' + matches + ' matches)',
                        part.state.output)
        }
      }
      else if (part.tool == 'bash' && status == 'running') {
        let command

        command = part.state.input.command
        if (command) {
          d('CO bash: ' + command)
          appendToolMsg(buf, part.callID, '➔ bash: ' + command)
        }
      }
      else if (part.tool == 'bash' && status == 'completed') {
        let command, exitCode

        command = part.state.input.command
        exitCode = part.state.metadata?.exit
        if (command) {
          d('CO bash completed: ' + command + ' (exit ' + exitCode + ')')
          appendToolMsg(buf, part.callID, '➔ bash: $ ' + command + ' (exit ' + exitCode + ')', part.state.output)
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
                                                    { input: part.state.input }),
                        '- ' + part.state?.input?.oldString + '\n+ ' + part.state?.input?.newString)
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
          appendToolMsg(buf, part.callID, '➔ Web search: ' + query)
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
                        '➔ Web search: ' + query + ' (' + results + ' results)',
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
                        '➔ Web search: ' + query,
                        part.state.error)
        }
      }
      else if (part.tool == 'webfetch' && status == 'running') {
        let url

        url = part.state.input.url
        if (url) {
          d('CO webfetch: ' + url)
          appendToolMsg(buf, part.callID, '➔ Fetch ' + url)
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
                        '➔ Fetch ' + url + (size ? ' (' + size + ' bytes)' : ''))
        }
      }
      else if (part.tool == 'webfetch' && status == 'error') {
        let url

        url = part.state.input.url
        if (url) {
          d('CO webfetch error')
          appendToolMsg(buf,
                        part.callID,
                        '➔ Fetch ' + url,
                        part.state.error)
        }
      }
      else
        appendToolMsg(buf,
                      part.callID,
                      'Tool call: ' + part.tool + (status ? (' (' + status + ')') : ''))
    }
  }

  function handleEvent
  (buf, event) {
    let sessionID

    d('CO ' + event.type)
    d({ event })

    sessionID = buf && buf.vars('code')?.sessionID

    // Already done by session.status. Maybe planned replacement.
    if ((event.type == 'session.idle')
        && (event.properties.sessionID == sessionID)) {
      updateIdle(buf, calculateTokenPercentage(buf))
      return
    }

    if ((event.type == 'session.status')
        && (event.properties.sessionID == sessionID)) {
      updateStatus(buf, event.properties, calculateTokenPercentage(buf))
      return
    }

    if ((event.type == 'permission.asked')
        && (event.properties.sessionID == sessionID)) {
      handlePermissionAsked(buf, event)
      return
    }

    if ((event.type == 'permission.updated')
        && (event.properties.sessionID == sessionID)) {
      handlePermissionUpdated(buf, event)
      return
    }

    if ((event.type == 'session.updated')
        && (event.properties.info.id == sessionID)) {
      handleSessionUpdated(buf, event)
      return
    }

    if ((event.type == 'message.updated')
        && (event.properties.info.sessionID == sessionID)) {
      handleMessageUpdated(buf, event)
      return
    }

    if ((event.type == 'message.part.updated')
        && (event.properties.part.sessionID == sessionID)) {
      handlePart(buf, event)
      return
    }

    if (event.type == 'server.connected') {
      updateBufStatus(buf, 'IDLE', '') // clears the CONNECTED after reconnect
      return
    }

    if (event.type == 'server.heartbeat')
      return

    d('🌱 TODO handle ' + event.type)
  }

  function startEventSub
  (buf) {
    let abortController

    if (buf.vars('code').eventSub)
      return
    buf.vars('code').eventSub = 1
    buf.vars('code').reconnectAttempt = 0

    abortController = new AbortController()
    buf.vars('code').eventAbort = abortController
    buf.vars('code').lastEventTime = Date.now()

    updateBufStatus(buf, 'CONNECTING', '')

    // Outer IFFE
    ;(async () => {
      while (buf.vars('code').eventSub) {
        let c, events

        if (abortController.signal.aborted)
          break

        try {
          c = await ensureClient(buf)
        }
        catch (err) {
          d('CO ensureClient error: ' + err.message)
          await new Promise(r => setTimeout(r, 1000))
          continue
        }

        d('CO starting event subscription')
        try {
          events = await c.event.subscribe({}, { signal: abortController.signal })
          d('CO stream obtained')
          updateBufStatus(buf, 'CONNECTED', '')
        }
        catch (err) {
          if (err.name == 'AbortError')
            return
          d('CO event subscribe error: ' + err.message)
          await new Promise(r => setTimeout(r, 1000))
          continue
        }

        // Inner IFFE
        ;(async () => {
          try {
            for await (let event of events.stream) {
              buf.vars('code').lastEventTime = Date.now()
              handleEvent(buf, event)
            }
          }
          catch (err) {
            if (err.name == 'AbortError')
              return
            d('CO event stream error: ' + err.message)
          }
        })()

        await new Promise(r => {
          buf.vars('code').eventStreamResolve = r
        })
        buf.vars('code').eventStreamResolve = 0
        buf.vars('code').client = 0
        buf.vars('code').reconnectAttempt++
        if (buf.vars('code').eventAbort)
          buf.vars('code').eventAbort.abort()
        // Need a new abortController, otherwise the outer IFFE will also exit
        abortController = new AbortController()
        buf.vars('code').eventAbort = abortController
        updateBufStatus(buf, 'RECONNECTING...', '')
      }
    })()

    buf.vars('code').eventCheckInterval = setInterval(() => {
      if (buf.vars('code').eventSub) {
        let elapsed, last

        last = buf.vars('code').lastEventTime
        elapsed = Date.now() - last
        if (elapsed > 35000) { // heartbeat is sent every 30s
          d('CO server quiet for ' + elapsed + 'ms, restarting stream')
          buf.vars('code').lastEventTime = Date.now()
          if (buf.vars('code').eventStreamResolve)
            buf.vars('code').eventStreamResolve()
        }
      }
    }, 5000)
  }

  function divW
  (dir) {
    return divCl('code-ww',
                 [ divCl('code-h',
                         [ divCl('code-icon',
                                 img(Icon.path('assist'), 'Code', 'filter-clr-text')),
                           divCl('code-title', dir) ]),
                   divCl('code-w bred-scroller',
                         [ divCl('code-session-title'),
                           divCl('code-under-w',
                                 [ divCl('code-under code-under-status', '...'),
                                   divCl('code-under code-under-tokens', '') ]) ]) ])
  }

  async function send
  (buf, text, provider, model) {
    let sessionID, c, res

    provider = provider || buf.vars('code').provider || 'opencode'
    model = model || buf.vars('code').model || 'minimax-m2.1-free'

    sessionID = buf.vars('code').sessionID
    c = await ensureClient(buf)

    buf.vars('code').agentStopped = 0

    appendMsg(buf, 'user', text)

    startEventSub(buf)

    try {
      d('CO SEND')

      res = await c.session.prompt({
        sessionID,
        providerID: provider,
        modelID: model,
        model: { providerID: provider, modelID: model },
        agent: 'build',
        parts: [ { id: uuidv4(), type: 'text', text } ]
      })

      d('CO SEND done')
      d({ res })

      appendModel(buf, res.data?.info?.modelID || '???')
    }
    catch (err) {
      d(err)
      appendMsg(buf, 'assistant', 'Error: ' + err.message)
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

    provider = Opt.get('code.provider.agent') || 'opencode'
    model = Opt.get('code.model.agent') || 'minimax-m2.1-free'
    Prompt.ask({ text: '🗩 ' + provider + '/' + model,
                 hist: chatHist },
               prompt => {
                 chatHist.add(prompt)
                 send(buf,
                      prompt,
                      buf.vars('code').provider,
                      buf.vars('code').model)
               })
  }

  function code
  (given) {
    let pane, buf, dir, name, provider, model

    async function run
    (prompt) {
      let c

      hist.add(prompt)

      try {
        let res

        buf = Buf.add(name, 'code', divW(dir), pane.dir)
        buf.vars('code').prompt = prompt
        buf.vars('code').provider = provider
        buf.vars('code').model = model
        buf.opt('core.lint.enabled', 1)

        c = await ensureClient(buf)
        res = await c.session.create({ title: prompt })

        buf.vars('code').sessionID = res.data.id

        pane.setBuf(buf, {}, () => {
          send(buf, prompt, provider, model)
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
        return
      }
    }

    provider = Opt.get('code.provider.agent') || 'opencode'
    model = Opt.get('code.model.agent') || 'minimax-m2.1-free'
    if (given)
      run(given)
    else
      Prompt.ask({ text: '🧩 ' + provider + '/' + model,
                   hist },
                 prompt => run(prompt))
  }

  function viewInit
  (view, spec, cb) {
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
          let statusEl, tokensEl

          statusEl = toUnderW.querySelector('.code-under-status')
          if (statusEl) {
            let fromStatus

            fromStatus = fromUnderW.querySelector('.code-under-status')
            if (fromStatus)
              statusEl.innerHTML = fromStatus.innerHTML
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
    }
    if (cb)
      cb(to)
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

  hist = Hist.ensure('code')
  chatHist = Hist.ensure('code.chat')
  Opt.declare('code.model.agent', 'str', 'minimax-m2.1-free')
  Opt.declare('code.provider.agent', 'str', 'opencode')
  mo = Mode.add('code',
                { viewInit,
                  viewCopy,
                  onRemove(buf) {
                    buf.vars('code').eventAbort?.abort()
                    buf.views?.forEach(view => {
                      view.vars('code').eds?.forEach(ed => ed.destroy())
                    })
                    Tron.acmd('code.close', [ buf.id ])
                  } })

  mo.bufEnd = bufEnd
  mo.bufStart = bufStart

  Cmd.add('code', () => code())

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

  Cmd.add('code buffer', () => {
    code(Pane.current().buf.text())
  })
}
