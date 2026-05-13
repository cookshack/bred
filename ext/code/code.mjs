import { button, create, divCl, span } from '../../js/dom.mjs'

import * as Buf from '../../js/Buf.mjs'
import * as Cmd from '../../js/cmd.mjs'
import * as Css from '../../js/css.mjs'
import * as Em from '../../js/Em.mjs'
import * as Hist from '../../js/hist.mjs'
import * as Icon from '../../js/icon.mjs'
import * as Mess from '../../js/mess.mjs'
import * as Mode from '../../js/mode.mjs'
import * as Opt from '../../js/opt.mjs'
import * as Pane from '../../js/Pane.mjs'
import * as Tron from '../../js/tron.mjs'
import * as View from '../../js/view.mjs'
import { v4 as uuidv4 } from '../../lib/uuid/index.js'
import { d } from '../../js/mess.mjs'

import * as Comm from './comm.mjs'
import * as Ev from './event.mjs'
import * as Prompt from './prompt.mjs'
import * as Ui from './ui.mjs'
import * as Util from './util.mjs'
import * as Sessions from './sessions.mjs'

import VopenCode from './lib/opencode/version.json' with { type: 'json' }

let hist, chatHist, stopTimeout, mostRecentAgent, tools, events

function getSubagentIds
(buf) {
  return buf.vars('code').subagentIds || (buf.vars('code').subagentIds = new Map())
}

function getSubagentCallIds
(buf) {
  return buf.vars('code').subagentCallIds || (buf.vars('code').subagentCallIds = new Map())
}

function sumTokens
(tokens) {
  return (tokens.input || 0)
    + (tokens.output || 0)
    + (tokens.reasoning || 0)
    + (tokens.cache?.read || 0)
    + (tokens.cache?.write || 0)
}

function codeInit
() {
  let pane, dir, name, provider, model, existingBuf, buf

  provider = Util.getProvider()
  model = Util.getModel()
  pane = Pane.current()
  dir = pane.dir
  name = 'CO ' + dir

  existingBuf = Buf.find(b => b.name == name && b.mode.key == 'code')
  if (existingBuf && existingBuf.vars('code').sessionID) {
    if (existingBuf.vars('code').busy) {
      Mess.yell('Agent is busy')
      return
    }
    existingBuf.vars('code').busy = 1
    pane.setBuf(existingBuf)
    existingBuf.vars('code').agentStopped = 0
    Ui.appendMsg(existingBuf, 'user', '/init')
    updateBufAgent(existingBuf, 'build')
    Ev.startSub(existingBuf, events)
    Comm.ensureClient(existingBuf).then(c => {
      c.session.command({ sessionID: existingBuf.vars('code').sessionID,
                          directory: existingBuf.dir,
                          command: 'init',
                          arguments: '',
                          agent: 'build',
                          model: existingBuf.vars('code').provider + '/' + existingBuf.vars('code').model })
    })
    return
  }

  buf = Buf.add(name, 'code', Ui.divW(dir, 'build'), pane.dir)
  buf.vars('code').prompt = '/init'
  buf.vars('code').provider = provider
  buf.vars('code').model = model
  buf.opt('core.lint.enabled', 1)

  Comm.ensureClient(buf).then(c => {
    c.session.create({ directory: buf.dir, title: '/init' })
      .then(res => {
        buf.vars('code').sessionID = res.data.id

        pane.setBuf(buf, {}, () => {
          Prompt.nestBuf(buf, hist)
          buf.vars('code').firstPromptSent = 1
          buf.vars('code').busy = 1
          Ui.appendMsg(buf, 'user', '/init')
          updateBufAgent(buf, 'build')
          Ui.updateDocker(buf)
          Ev.startSub(buf, events)

          c.session.command({ sessionID: res.data.id,
                              directory: buf.dir,
                              command: 'init',
                              arguments: '',
                              agent: 'build',
                              model: provider + '/' + model })
        })
      })
      .catch(err => {
        Mess.yell('Failed: ' + err.message)
      })
  })
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
                  el.innerText = 'OR:$'
                else
                  el.innerText = 'OR:$' + dol.toFixed(2)
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

function appendModel
(buf, model) {
  Util.eachCodeW(buf, (view, w) => {
    Ui.appendX(w, divCl('code-msg code-msg-role', model))
  })
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
                 Util.makeRelative(buf, path),
                 { 'data-run': 'open link', 'data-path': path }),
           bounds(),
           status || '' ]
}

function appendPermission
(buf, perm) {
  let id, label, callID

  function pattern
  () {
    let action, patterns

    action = perm.req.permission || perm.req.type || '?'
    patterns = perm.req.patterns || perm.req.pattern || []
    if (typeof patterns == 'string')
      patterns = [ patterns ]
    return '🗝 ' + action + (patterns.length ? ': ' + patterns[0] : '')
  }

  id = perm.id
  callID = perm.req.callID || perm.req.tool?.callID
  if (callID)
    label = buf.vars('code').callLabels?.[callID]
  buf.views.forEach(view => {
    if (view.eleOrReserved) {
      let w

      w = view.eleOrReserved.querySelector('.code-w')
      Ui.appendX(w,
                 divCl('code-msg code-msg-permission',
                       [ divCl('code-msg-text',
                               [ '▣ Allow?',
                                 button([ span('y', 'key'), 'es' ], 'onfill', { 'data-run': 'yes' }),
                                 button([ span('n', 'key'), 'o' ], 'onfill', { 'data-run': 'no' }) ]),
                         label && divCl('code-msg-label', label),
                         divCl('code-msg-pattern', pattern()) ],
                       { 'data-permissionid': id,
                         'data-permission-callid': callID || '??' }))
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
  Comm.ensureClient(buf).then(async c => {
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
      Util.eachCodeW(buf, (view, w) => {
        let el

        el = w.querySelector('.code-msg-permission[data-permissionid="' + id + '"]')
        el?.remove()
      })
    }
    catch (err) {
      d('CO permission respond error: ' + err.message)
    }
  }).catch(err => {
    d('CO permission Comm.ensureClient error: ' + err.message)
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
          agentEl.innerText = Util.iconAgent() + agent
      }
    }
  })
}

function updateIdle
(buf, tokenInfo) {
  Ui.updateStatus(buf, 'OK', '', tokenInfo, VopenCode.version)
  buf.vars('code').busy = 0
  if (buf.vars('code').agentStopped) {
    buf.vars('code').agentStopped = 0
    Ui.appendMsg(buf, 0, '...stopped')
    buf.vars('code').stepActiveSessions = new Set()
  }
}

function updateStatus
(buf, req, tokenInfo) {

  d('CO updateStatus')
  d({ tokenInfo })

  if (req.status?.type == 'busy')
    Ui.updateStatus(buf, '🌊', Util.modelName(buf.vars('code').model, buf.vars('code').variant), tokenInfo, VopenCode.version)
  else if (req.status?.type == 'idle')
    updateIdle(buf, tokenInfo)
  else if (req.status?.type == 'retry')
    Ui.updateStatus(buf, '🔁 retry' + (req.status.message ? ': ' + req.status.message : ''), Util.modelName(buf.vars('code').model, buf.vars('code').variant), tokenInfo, VopenCode.version)
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

    c = await Comm.ensureClient(buf)
    providers = await c.config.providers({ directory: buf.dir })
    d({ providers })
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
      Ui.appendToolMsg(buf, (req.callID || req.tool.callID), fileLabel(buf, 'Edit', path), req.metadata?.diff, { format: 'patch' })
    }
  }
}

function handlePermission
(buf, req) {
  checkForPatch(buf, req)
  buf.vars('code').permissions = buf.vars('code').permissions || []
  buf.vars('code').permissions.push({ id: req.id, sessionID: req.sessionID, req })
  if (buf.vars('code').permissions.length == 1)
    // Free to ask.
    appendPermission(buf, buf.vars('code').permissions[0])
}

function handleQuestionAsked
(buf, event) {
  let req

  req = event.properties
  d('CO question asked: ' + (req.questions?.length || '?') + ' questions')
  buf.vars('code').questions = buf.vars('code').questions || []
  buf.vars('code').questions.push({ id: req.id, sessionID: req.sessionID, questions: req.questions, tool: req.tool })
  if (req.tool?.callID) {
    buf.vars('code').callLabels = buf.vars('code').callLabels || {}
    buf.vars('code').callLabels[req.tool.callID] = 'Questions (' + req.questions.length + ')'
  }
  if (buf.vars('code').questions.length == 1)
    appendQuestion(buf, buf.vars('code').questions[0])
}

function appendQuestion
(buf, req) {
  Util.eachCodeW(buf, (view, w) => {
    Ui.appendX(w,
               divCl('code-msg code-msg-question',
                     [ divCl('code-msg-text', [ '▣ Questions' ]),
                       ...req.questions.map((q, qi) => divCl('code-question-item',
                                                             [ divCl('code-question-header', q.header),
                                                               divCl('code-question-text', q.question),
                                                               ...(q.options || []).map(opt => divCl('code-question-option',
                                                                                                     [ span(opt.label + ':', 'code-option-label'), ' ', span(opt.description) ],
                                                                                                     { 'data-run': 'toggle question option',
                                                                                                       'data-qid': req.id,
                                                                                                       'data-qi': qi,
                                                                                                       'data-opt': opt.label })),
                                                               q.custom && create('input', [],
                                                                                  'code-question-custom',
                                                                                  { 'data-qid': req.id,
                                                                                    'data-qi': qi,
                                                                                    placeholder: 'Your answer...' }) ],
                                                             { 'data-multiple': (q.multiple || q.multiSelect) ? '1' : '0' })),
                       divCl('code-msg-text',
                             [ button([ span('a', 'key'), 'nswer' ], 'onfill', { 'data-run': 'answer question' }),
                               button([ span('s', 'key'), 'kip' ], 'onfill', { 'data-run': 'skip question' }) ]) ],
                     { 'data-requestid': req.id }))
  })
}

function questionRespond
(buf, requestID, answers) {
  d('CO question ' + (answers ? 'reply' : 'reject'))
  Comm.ensureClient(buf).then(async c => {
    try {
      if (answers)
        await c.question.reply({ requestID, answers, directory: buf.dir })
      else
        await c.question.reject({ requestID, directory: buf.dir })
      Util.eachCodeW(buf, (view, w) => {
        let el

        el = w.querySelector('.code-msg-question[data-requestid="' + requestID + '"]')
        el?.remove()
      })
    }
    catch (err) {
      d('CO question respond error: ' + err.message)
    }
  })
  buf.vars('code').questions = buf.vars('code').questions.slice(1)
  if (buf.vars('code').questions.length)
    appendQuestion(buf, buf.vars('code').questions[0])
}

function toggleQuestionOption
(u, we) {
  let opt, item, multiple

  opt = we.e.target.closest('.code-question-option')
  item = opt.closest('.code-question-item')
  multiple = item.dataset.multiple == '1'
  if (Css.has(opt, 'code-option-selected'))
    Css.remove(opt, 'code-option-selected')
  else {
    if (multiple == 0) {
      let allOpts

      allOpts = item.querySelectorAll('.code-question-option')
      allOpts.forEach(o => Css.remove(o, 'code-option-selected'))
    }
    Css.add(opt, 'code-option-selected')
  }
}

function answerQuestion
(u, we) {
  let buf, el, requestID, items, answers

  buf = Pane.current().buf
  el = we.e.target.closest('.code-msg-question')
  requestID = el.dataset.requestid
  items = el.querySelectorAll('.code-question-item')
  answers = []
  items.forEach(item => {
    let selected, custom, ans

    selected = item.querySelectorAll('.code-question-option.code-option-selected')
    ans = []
    selected.forEach(o => ans.push(o.dataset.opt))
    custom = item.querySelector('.code-question-custom')
    if (custom && custom.value.trim())
      ans.push(custom.value.trim())
    answers.push(ans)
  })
  questionRespond(buf, requestID, answers)
}

function skipQuestion
(u, we) {
  let buf, el, requestID

  buf = Pane.current().buf
  el = we.e.target.closest('.code-msg-question')
  requestID = el.dataset.requestid
  questionRespond(buf, requestID)
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

    total = sumTokens(info.tokens)
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

function handleToolPart
(buf, part) {
  let status, h

  status = part.state?.status
  d('CO tool: ' + icon(part.tool) + part.tool + ' ' + status)

  h = tools[part.tool]
  if (h) {
    if (status == 'completed' && h.onComplete)
      h.onComplete(buf, part)
    else if (status == 'error' && h.onErr)
      h.onErr(buf, part)
    else if (status == 'pending' && h.onPend)
      h.onPend(buf, part)
    else if (status == 'running' && h.onRun)
      h.onRun(buf, part)
    else if ([ 'pending', 'running' ].includes(status) && h.onPendOrRun)
      h.onPendOrRun(buf, part)
    else
      Ui.appendToolMsg(buf, part.callID, 'Tool call: ' + part.tool + (status ? (' (' + status + ')') : ''))
    return
  }
  Ui.appendToolMsg(buf, part.callID, 'Tool call: ' + part.tool + (status ? (' (' + status + ')') : ''))
}

function handlePart
(buf, event) {
  let part

  part = event.properties.part

  if (part.tokens) {
    let total

    total = sumTokens(part.tokens)
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
      Ui.appendMsg(buf, 0, part.text, part.id)
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
      Ui.appendThinking(buf, buffered, part.id)
    }
  }
  else if (part.type == 'tool')
    handleToolPart(buf, part)
}

function handlePartDelta
(buf, event) {
  let delta, field

  delta = event.properties.delta
  field = event.properties.field
  Util.eachCodeW(buf, (view, w) => {
    let msgEl, thinkingEl, textEl

    msgEl = w.querySelector('.code-msg-assistant[data-partid="' + event.properties.partID + '"]')
    if (msgEl) {
      textEl = msgEl.querySelector('.code-msg-text')
      if (textEl && field == 'text')
        Ui.withScroll(w, () => textEl.innerText = (textEl.innerText || '') + delta)
    }
    thinkingEl = w.querySelector('.code-msg-thinking[data-partid="' + event.properties.partID + '"]')
    if (thinkingEl && field == 'text') {
      textEl = thinkingEl.querySelector('.code-msg-text')
      if (textEl)
        Ui.withScroll(w, () => textEl.innerText = (textEl.innerText || '') + delta)
    }
    else if (field == 'text' && msgEl == null)
      Ui.appendX(w,
                 divCl('code-msg code-msg-thinking',
                       [ divCl('code-msg-text', delta) ],
                       { 'data-partid': event.properties.partID || 0 }))
  })
}

function handleSubagentIdle
(buf, event) {
  let callId

  callId = buf.vars('code').subagentCallIds?.get(event.properties.sessionID)
  if (callId)
    Util.eachCodeW(buf, (view, w) => {
      let els

      els = w.querySelectorAll('.code-msg-tool[data-callid="' + callId + '"]')
      els?.forEach(el => {
        let textEl

        textEl = el.querySelector('.code-msg-text')
        if (textEl && textEl.innerText.indexOf('◉') < 0)
          textEl.innerText = textEl.innerText + ' ◉'
      })
    })
}

async function send
(buf, text, provider, model, variant) {
  let sessionID, c, res

  provider = provider || Util.getProvider(buf)
  model = model || Util.getModel(buf)
  variant = variant || Util.getVariant(buf)

  sessionID = buf.vars('code').sessionID

  try {
    c = await Comm.ensureClient(buf)
  }
  catch (err) {
    d(err)
    Ui.appendMsg(buf, 'assistant', 'Error: ' + err.message)
    return
  }

  buf.vars('code').agentStopped = 0
  buf.vars('code').busy = 1

  Ui.appendMsg(buf, 'user', text)

  Ev.startSub(buf, events)

  try {
    let agent

    agent = Util.getAgent(buf)

    updateBufAgent(buf, agent)

    d('CO SEND (' + agent + ')' + (variant ? ' v:' + variant : ''))

    res = await c.session.prompt({ sessionID,
                                   directory: buf.dir,
                                   model: { providerID: provider, modelID: model },
                                   agent,
                                   variant: variant || undefined,
                                   parts: [ { id: 'prt_' + uuidv4(), type: 'text', text } ] })

    d('CO SEND done')
    d({ res })

    appendModel(buf, Util.modelName(res.data?.info?.modelID || '???', variant))
    if (provider == 'openrouter')
      updateCredits(buf)
  }
  catch (err) {
    d(err)
    Ui.appendMsg(buf, 'assistant', 'Error: ' + err.message)
    buf.vars('code').client = 0
    buf.vars('code').streamActive = 0
    Ev.startSub(buf, events)
  }

  if (res?.error) {
    d({ resError: res.error })
    Ui.appendMsg(buf, 'assistant', 'Error: ' + res.error.message)
    buf.vars('code').client = 0
    buf.vars('code').streamActive = 0
    Ev.startSub(buf, events)
  }
}

function stopAgent
(buf, sessionID) {
  buf.vars('code').agentStopped = 1
  Comm.ensureClient(buf).then(async client => {
    try {
      await client.session.abort({ sessionID, directory: buf.dir })
      d('CO stop done')
      Mess.yell('Stopped agent')
    }
    catch (err) {
      d('CO stop error: ' + err.message)
    }
  }).catch(err => {
    d('CO stop Comm.ensureClient error: ' + err.message)
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
  Prompt.choose(Util.iconAgent() + ' Agent',
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
(buf, pane, provider, model, variant) {
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
        mlModel.innerText = '🗩 ' + provider + '/' + Util.modelName(model, variant)
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
  let p, buf, provider, model, variant

  p = Pane.current()
  buf = p.buf

  if (buf.vars('code').permissions?.length)
    return

  if (buf.vars('code').questions?.length)
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

  provider = Util.getProvider(buf)
  model = Util.getModel(buf)
  variant = Util.getVariant(buf)

  openPrompt(buf, p, provider, model, variant)
}

function code
(given) {
  let pane, dir, name, provider, model, variant

  async function run
  (prompt) {
    if (prompt)
      hist.add(prompt)

    try {
      let c, buf, res

      buf = Buf.add(name, 'code', Ui.divW(dir, Opt.get('code.agent')), pane.dir)
      buf.vars('code').prompt = prompt
      buf.vars('code').provider = provider
      buf.vars('code').model = model
      buf.vars('code').variant = variant
      buf.opt('core.lint.enabled', 1)

      Mess.say('Spawning docker...')
      c = await Comm.ensureClient(buf)
      Mess.say('')

      res = await c.session.create({ directory: buf.dir, title: prompt || '' })

      buf.vars('code').sessionID = res.data.id

      pane.setBuf(buf, {}, () => {
        Prompt.nestBuf(buf, hist)
        Ui.updateDocker(buf)
        if (prompt)
          send(buf, prompt, provider, model, variant)
        else
          openPrompt(buf, pane, provider, model, variant)
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

  provider = Util.getProvider()
  model = Util.getModel()
  variant = Util.getVariant()
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
        let agentEl, elDocker

        agentEl = toH.querySelector('.code-agent')
        if (agentEl) {
          let fromAgent

          fromAgent = fromH?.querySelector('.code-agent')
          if (fromAgent)
            agentEl.innerText = fromAgent.innerText
        }

        elDocker = toH.querySelector('.code-docker')
        if (elDocker) {
          let fromDocker

          fromDocker = fromH?.querySelector('.code-docker')
          if (fromDocker)
            elDocker.innerText = fromDocker.innerText
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
  send(buf, text, buf.vars('code').provider, buf.vars('code').model, buf.vars('code').variant)
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
  let view, wh

  view = View.current()
  wh = whichHistFromBuf(view.buf)
  wh.prev(view.buf)
}

function nextHist
() {
  let view, wh

  view = View.current()
  wh = whichHistFromBuf(view.buf)
  wh.next(view.buf)
}

export
function init
() {
  let mo, moCodePrompt

  tools = { read: { onPendOrRun
                    (buf, part) {
                      let path

                      path = part.state.input.filePath
                      if (path) {
                        d('CO read file: ' + path)
                        Ui.appendToolMsg(buf, part.callID, fileLabel(buf, 'Read', path, 0,
                                                                     { input: part.state.input }))
                      }
                    },
                    onComplete
                    (buf, part) {
                      let path

                      path = part.state.input.filePath
                      if (path) {
                        d('CO read file completed: ' + path)
                        Ui.appendToolMsg(buf, part.callID, fileLabel(buf, 'Read', path, ' ✔️',
                                                                     { input: part.state.input }))
                      }
                    } },
            glob: { onPendOrRun
                    (buf, part) {
                      let pattern

                      pattern = part.state.input.pattern
                      if (pattern) {
                        d('CO glob: ' + pattern)
                        Ui.appendToolMsg(buf, part.callID, 'Glob "' + pattern)
                      }
                    },
                    onComplete
                    (buf, part) {
                      let count

                      count = part.state.metadata?.count
                      if (1) {
                        d('CO glob completed with ' + count + ' matches')
                        Ui.appendToolMsg(buf,
                                         part.callID,
                                         'Glob "' + part.state.input.pattern + ' (' + count + ' matches)',
                                         part.state.output)
                      }
                    } },
            grep: { onPendOrRun
                    (buf, part) {
                      let pattern, path

                      pattern = part.state.input.pattern
                      path = part.state.input.path
                      if (pattern) {
                        d('CO grep: ' + pattern + ' in ' + path)
                        Ui.appendToolMsg(buf, part.callID, 'Grep "' + pattern + '" in ' + (path || '.'))
                      }
                    },
                    onComplete
                    (buf, part) {
                      let matches, path

                      matches = part.state.metadata?.matches
                      path = part.state.input.path
                      if (matches) {
                        d('CO grep completed with ' + matches + ' matches')
                        Ui.appendToolMsg(buf,
                                         part.callID,
                                         'Grep "' + part.state.input.pattern + '" in ' + (path || '.') + ' (' + matches + ' matches)',
                                         part.state.output)
                      }
                    } },
            bash: { onPendOrRun
                    (buf, part) {
                      let command

                      command = part.state.input.command
                      if (command) {
                        d('CO bash: ' + command)
                        Ui.appendToolMsg(buf, part.callID, 'bash: ' + command + (part.state?.status == 'pending' ? ' (pending)' : ''))
                      }
                    },
                    onComplete
                    (buf, part) {
                      let command, exitCode

                      command = part.state.input.command
                      exitCode = part.state.metadata?.exit
                      if (command) {
                        d('CO bash completed: ' + command + ' (exit ' + exitCode + ')')
                        Ui.appendToolMsg(buf, part.callID, 'bash: $ ' + command + ' (exit ' + exitCode + ')', part.state.output)
                      }
                    } },
            write: { onPendOrRun
                     (buf, part) {
                       let path

                       path = part.state.input.filePath
                       if (path) {
                         d('CO write file: ' + path)
                         Ui.appendToolMsg(buf, part.callID, fileLabel(buf, 'Write', path, 0,
                                                                      { input: part.state.input }),
                                          part.state?.input?.content,
                                          { format: 'code', path })
                       }
                     },
                     onComplete
                     (buf, part) {
                       let path

                       path = part.state.input.filePath
                       if (path) {
                         d('CO write file: ' + path)
                         Ui.appendToolMsg(buf, part.callID, fileLabel(buf, 'Write', path, ' ✔️',
                                                                      { input: part.state.input }),
                                          part.state?.input?.content,
                                          { format: 'code', path })
                       }
                     } },
            edit: { onPendOrRun
                    (buf, part) {
                      let path

                      path = part.state.input.filePath
                      if (path) {
                        d('CO edit file: ' + path)
                        Ui.appendToolMsg(buf, part.callID, fileLabel(buf, 'Edit', path, 0,
                                                                     { input: part.state.input }))
                      }
                    },
                    onComplete
                    (buf, part) {
                      let path

                      path = part.state.input.filePath
                      if (path) {
                        let under

                        d('CO edit completed: ' + path)
                        under = '- ' + part.state?.input?.oldString + '\n+ ' + part.state?.input?.newString
                        under = part.state?.metadata?.diff || buf.vars('code').patch || under
                        Ui.appendToolMsg(buf, part.callID, fileLabel(buf, 'Edit', path, ' ✔️',
                                                                     { input: part.state.input }),
                                         under , { format: 'patch' })
                      }
                    },
                    onErr
                    (buf, part) {
                      let path

                      path = part.state.input.filePath
                      if (path) {
                        let under

                        d('CO edit error: ' + path)
                        under = '- ' + part.state?.input?.oldString + '\n+ ' + part.state?.input?.newString
                        under = buf.vars('code').patch || under
                        Ui.appendToolMsg(buf, part.callID, fileLabel(buf, 'Edit', path, ' ✘',
                                                                     { input: part.state.input }),
                                         under)
                        Ui.appendMsg(buf, 0, part.state?.error, part.id)
                      }
                    } },
            websearch: { onPendOrRun
                         (buf, part) {
                           let query

                           query = part.state.input.query
                           if (query) {
                             d('CO websearch: ' + query)
                             Ui.appendToolMsg(buf, part.callID, 'Web search: ' + query)
                           }
                         },
                         onComplete
                         (buf, part) {
                           let query, results

                           query = part.state.input.query
                           results = part.state.metadata?.results
                           if (query) {
                             d('CO websearch completed with ' + results + ' results')
                             Ui.appendToolMsg(buf,
                                              part.callID,
                                              'Web search: ' + query + ' (' + results + ' results)',
                                              part.state.output)
                           }
                         },
                         onErr
                         (buf, part) {
                           let query

                           query = part.state.input.query
                           if (query) {
                             d('CO websearch error')
                             Ui.appendToolMsg(buf,
                                              part.callID,
                                              'Web search: ' + query,
                                              part.state.error)
                           }
                         } },
            webfetch: { onPendOrRun
                        (buf, part) {
                          let url

                          url = part.state.input.url
                          if (url) {
                            d('CO webfetch: ' + url)
                            Ui.appendToolMsg(buf, part.callID, 'Fetch ' + url)
                          }
                        },
                        onComplete
                        (buf, part) {
                          let url, size

                          url = part.state.input.url
                          size = part.state.output?.length
                          if (url) {
                            d('CO webfetch completed, size: ' + size)
                            Ui.appendToolMsg(buf,
                                             part.callID,
                                             'Fetch ' + url + (size ? ' (' + size + ' bytes)' : ''))
                          }
                        },
                        onErr
                        (buf, part) {
                          let url

                          url = part.state.input.url
                          if (url) {
                            d('CO webfetch error')
                            Ui.appendToolMsg(buf,
                                             part.callID,
                                             'Fetch ' + url,
                                             part.state.error)
                          }
                        } },
            task: { onPendOrRun
                    (buf, part) {
                      let desc, agent, sessionId

                      desc = part.state.input.description
                      agent = part.state.input.subagent_type
                      sessionId = part.state.metadata?.sessionId
                      if (sessionId) {
                        getSubagentIds(buf).set(sessionId, 1)
                        getSubagentCallIds(buf).set(sessionId, part.callID)
                      }
                      desc = desc ? ('Task: ' + desc + ' (' + agent + ' agent)') : ('Task (' + agent + ' agent)')
                      Ui.appendToolMsg(buf, part.callID, desc)
                    },
                    onComplete
                    (buf, part) {
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
                      Ui.appendToolMsg(buf, part.callID, desc, part.state.output)
                    },
                    onErr
                    (buf, part) {
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
                      Ui.appendToolMsg(buf, part.callID, desc, part.state.error)
                    } } }

  events = { 'session.idle': { onArrive
                               (buf, event) {
                                 if (Util.isSessionMatch(buf, event.properties.sessionID))
                                   if (event.properties.sessionID == buf.vars('code').sessionID)
                                     updateIdle(buf, calculateTokenPercentage(buf))
                                   else
                                     handleSubagentIdle(buf, event)
                               } },
             'session.status': { onArrive
                                 (buf, event) {
                                   if (Util.isSessionMatch(buf, event.properties.sessionID)
                                       && event.properties.sessionID == buf.vars('code').sessionID)
                                     updateStatus(buf, event.properties, calculateTokenPercentage(buf))
                                 } },
             'permission.asked': { onArrive
                                   (buf, event) {
                                     if (Util.isSessionMatch(buf, event.properties.sessionID))
                                       handlePermissionAsked(buf, event)
                                   } },
             'permission.updated': { onArrive
                                     (buf, event) {
                                       if (Util.isSessionMatch(buf, event.properties.sessionID))
                                         handlePermissionUpdated(buf, event)
                                     } },
             'question.asked': { onArrive
                                 (buf, event) {
                                   if (Util.isSessionMatch(buf, event.properties.sessionID))
                                     handleQuestionAsked(buf, event)
                                 } },
             'session.error': { onArrive
                                (buf, event) {
                                  if (event.properties?.sessionID == buf.vars('code').sessionID) {
                                    let error

                                    error = event.properties.error
                                    d({ error })
                                    if (error)
                                      Mess.yell('🚨 session.error: ' + (error.name || '??') + ' ' + (error.data?.message || '????'))
                                    else
                                      Mess.yell('🚨 session.error: error missing')
                                  }
                                } },
             'session.updated': { onArrive
                                  (buf, event) {
                                    if (Util.isSessionMatch(buf, event.properties.info.id)
                                        && event.properties.info.id == buf.vars('code').sessionID)
                                      handleSessionUpdated(buf, event)
                                  } },
             'message.updated': { onArrive
                                  (buf, event) {
                                    if (event.properties.info.sessionID == buf.vars('code').sessionID)
                                      handleMessageUpdated(buf, event)
                                  } },
             'message.part.updated': { onArrive
                                       (buf, event) {
                                         if (Util.isSessionMatch(buf, event.properties.part.sessionID))
                                           handlePart(buf, event)
                                       } },
             'message.part.delta': { onArrive
                                     (buf, event) {
                                       if (Util.isSessionMatch(buf, event.properties.sessionID))
                                         handlePartDelta(buf, event)
                                     } },
             'server.connected': { onArrive
                                   (buf) {
                                     let client

                                     client = buf.vars('code').client
                                     if (client)
                                       Comm.ensureClient(buf).then(async c => {
                                         try {
                                           let h

                                           h = await c.global.health()
                                           d('CO server version: ' + (h.data?.version || '??'))
                                         }
                                         catch (err) {
                                           d('CO health failed: ' + err.message)
                                         }
                                       })
                                     Ui.updateStatus(buf, 'OK', '', '', VopenCode.version)
                                   } },
             'server.heartbeat': {},
             'sync': {}, // workspace sync messages
             'command.executed': { onArrive
                                   (buf, event) {
                                     if (event.properties.sessionID == buf.vars('code').sessionID) {
                                       Ui.appendMsg(buf, 0, '/' + event.properties.name + ' finished')
                                       appendModel(buf, Util.modelName(buf.vars('code').model, buf.vars('code').variant))
                                     }
                                   } } }

  hist = Hist.ensure('code')
  chatHist = Hist.ensure('code.chat')
  Opt.declare('code.agent', 'str', 'plan')
  Opt.declare('code.model.agent', 'str', 'deepseek-v4-pro')
  Opt.declare('code.provider.agent', 'str', 'opencode-go')
  Opt.declare('code.variant.agent', 'str', '')
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
  Cmd.add('code init', codeInit)

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

  Cmd.add('toggle question option', toggleQuestionOption, mo)
  Cmd.add('answer question', answerQuestion, mo)
  Cmd.add('skip question', skipQuestion, mo)

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

  Sessions.init(events)
}
