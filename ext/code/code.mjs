import { button, create, divCl, span } from '../../js/dom.mjs'

import * as Buf from '../../js/Buf.mjs'
import * as Cmd from '../../js/cmd.mjs'
import * as Css from '../../js/css.mjs'
import * as Ed from '../../js/ed.mjs'
import * as Em from '../../js/Em.mjs'
import * as Hist from '../../js/hist.mjs'
import * as Icon from '../../js/icon.mjs'
import * as Loc from '../../js/loc.mjs'
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
import * as PartCache from './part-cache.mjs'
import * as Prompt from './prompt.mjs'
import * as Stop from './stop.mjs'
import * as Ui from './ui.mjs'
import * as Util from './util.mjs'
import * as Sessions from './sessions.mjs'

import VopenCode from './lib/opencode/version.json' with { type: 'json' }

let agentCycle, hist, chatHist, stopTimeout, tools, events, mostRecentAgents

function getSubagentIds
(buf) {
  return buf.vars('code').subagentIds || (buf.vars('code').subagentIds = new Map())
}

function getSubagentCallIds
(buf) {
  return buf.vars('code').subagentCallIds || (buf.vars('code').subagentCallIds = new Map())
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
    Ui.appendMsg(existingBuf, 'user', '/init', undefined, undefined, { agent: 'build' })
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
  buf.vars('code').thinkingHidden = 1
  buf.opt('core.lint.enabled', 1)

  Comm.ensureClient(buf).then(c => {
                                c.session.create({ directory: buf.dir, title: '/init' })
                                  .then(res => {
                                          buf.vars('code').sessionID = res.data.id
                                          buf.vars('code').sessionStart = res.data.time?.created

                                          pane.setBuf(buf, {}, () => {
                                                                 Prompt.nestBuf(buf, hist)
                                                                 buf.vars('code').firstPromptSent = 1
                                                                 buf.vars('code').busy = 1
                                                                 Ui.appendMsg(buf, 'user', '/init', undefined, undefined, { agent: 'build' })
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

function setCreditsText
(buf, text) {
  buf.views.forEach(view => {
                      if (view.eleOrReserved) {
                        let el

                        el = view.eleOrReserved.querySelector('.code-under-credits')
                        if (el)
                          el.innerText = text
                      }
                    })
}

function getOpenrouterKey
() {
  let key

  key = Opt.get('code.key')
  if (key.length == 0)
    key = Opt.get('query.key')
  return key
}

function updateDeepinfraCredits
(buf) {
  Comm.ensureClient(buf).then(async c => {
                                let providers, key

                                providers = await c.config.providers({ directory: buf.dir })
                                providers.data.providers?.some(p => {
                                                                 if (p.id == 'deepinfra') {
                                                                   key = p.key
                                                                   return true
                                                                 }
                                                               })
                                if (key)
                                  fetch('https://api.deepinfra.com/v1/me?checklist=true',
                                        { method: 'GET',
                                          headers: { Authorization: 'Bearer ' + key,
                                                     'Content-Type': 'application/json' } })
                                    .then(response => {
                                            if (response.ok) {
                                              response.json().then(data => {
                                                                     let bal, recent

                                                                     bal = data.checklist?.stripe_balance
                                                                     recent = data.checklist?.recent || 0
                                                                     if (bal == null)
                                                                       setCreditsText(buf, 'DI:$0.00')
                                                                     else {
                                                                       let left

                                                                       left = -bal - recent
                                                                       if (left >= 0)
                                                                         setCreditsText(buf, 'DI:$' + left.toFixed(2))
                                                                       else
                                                                         setCreditsText(buf, 'DI:-$' + (-left).toFixed(2))
                                                                     }
                                                                   })
                                                .catch(err => {
                                                         d('ERR .json: ' + err.message)
                                                       })
                                              return
                                            }
                                            d('Error fetching deepinfra credits')
                                          })
                                    .catch(err => {
                                             d('ERR fetch:')
                                             d(err.message)
                                           })
                              })
}

function updateCredits
(buf, provider) {
  if (provider == 'openrouter') {
    let key

    key = getOpenrouterKey()
    if (key.length == 0)
      return

    fetch('https://openrouter.ai/api/v1/auth/key',
          { method: 'GET',
            headers: { Authorization: 'Bearer ' + key,
                       'Content-Type': 'application/json' } })
      .then(response => {
              if (response.ok) {
                response.json().then(data => {
                                       let dol

                                       d({ data })
                                       d(data.data.limit_remaining)
                                       dol = parseFloat(data.data.limit_remaining)
                                       if (isNaN(dol))
                                         setCreditsText(buf, 'OR:$')
                                       else
                                         setCreditsText(buf, 'OR:$' + dol.toFixed(2))
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
    return
  }
  if (provider == 'deepinfra')
    updateDeepinfraCredits(buf)
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
                 { 'data-run': 'open link', 'data-runaux': 'open link in other pane', 'data-path': path }),
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
  else {
    let codeBuf, promptBuf, block

    codeBuf = buf.parent || buf
    block = Util.promptBlocked(codeBuf)
    if (block) {
      Mess.yell(block)
      return
    }
    setAgent(codeBuf, 'build')
    promptBuf = codeBuf.vars('code').promptBuf
    promptBuf.clear()
    promptBuf.append(yes ? 'yes' : 'no')
    submitPrompt()
  }
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
  Mess.yell('')
  if (buf.vars('code').agentStopped) {
    buf.vars('code').agentStopped = 0
    Ui.appendMsg(buf, 0, '...stopped')
    buf.vars('code').stepActiveSessions = new Set()
  }
}

function updateStatus
(buf, req, tokenInfo) {

  if (req.status?.type == 'busy')
    Ui.updateStatus(buf, '🌊', Util.modelName(buf.vars('code').model, buf.vars('code').variant), tokenInfo, VopenCode.version)
  else if (req.status?.type == 'idle')
    updateIdle(buf, tokenInfo)
  else if (req.status?.type == 'retry')
    Ui.updateStatus(buf, '🔁 retry' + (req.status.message ? ': ' + req.status.message : ''), Util.modelName(buf.vars('code').model, buf.vars('code').variant), tokenInfo, VopenCode.version)
  else if (req.status?.type)
    // unknown status type
    d('🌱 TODO status: ' + req.status?.type)
}

function updateModelContextLimit
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
  Comm.ensureClient(buf).then(async c => {
                                try {
                                  let providers, model

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
                                  else
                                    d('CO modelContextLimit missing')
                                }
                                catch (err) {
                                  d('CO failed to get providers: ' + err.message)
                                }
                              })
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
                                  if (answers) {
                                    await c.question.reply({ requestID, answers, directory: buf.dir })
                                    Util.eachCodeW(buf, (view, w) => {
                                                          let el

                                                          el = w.querySelector('.code-msg-question[data-requestid="' + requestID + '"]')
                                                          if (el) {
                                                            let textEl

                                                            Css.add(el, 'code-question-answered')
                                                            textEl = el.querySelector('.code-msg-text')
                                                            if (textEl)
                                                              textEl.innerText = '▣ Questions (answered)'
                                                            el.querySelectorAll('.code-question-option').forEach(o => o.removeAttribute('data-run'))
                                                            el.querySelectorAll('button').forEach(b => b.removeAttribute('data-run'))
                                                          }
                                                        })
                                  }
                                  else {
                                    await c.question.reject({ requestID, directory: buf.dir })
                                    Util.eachCodeW(buf, (view, w) => {
                                                          let el

                                                          el = w.querySelector('.code-msg-question[data-requestid="' + requestID + '"]')
                                                          if (el) {
                                                            let textEl

                                                            Css.add(el, 'code-question-skipped')
                                                            textEl = el.querySelector('.code-msg-text')
                                                            if (textEl)
                                                              textEl.innerText = '▣ Questions (skipped)'
                                                            el.querySelectorAll('.code-question-option').forEach(o => o.removeAttribute('data-run'))
                                                            el.querySelectorAll('button').forEach(b => b.removeAttribute('data-run'))
                                                          }
                                                        })
                                  }
                                  buf.vars('code').questions = buf.vars('code').questions.slice(1)
                                  if (buf.vars('code').questions.length)
                                    appendQuestion(buf, buf.vars('code').questions[0])
                                }
                                catch (err) {
                                  d('CO question respond error: ' + err.message)
                                }
                              })
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

function activeQuestionID
(buf) {
  let req

  req = buf.vars('code')?.questions?.[0]
  return req?.id
}

function questionEl
(buf, requestID, we) {
  let el, w

  el = we?.e?.target?.closest?.('.code-msg-question')
  if (el)
    return el
  w = Pane.current().view.eleOrReserved.querySelector('.code-w')
  if (w)
    el = w.querySelector('.code-msg-question[data-requestid="' + requestID + '"]')
  return el
}

function answerQuestion
(u, we) {
  let buf, requestID, el, items, answers

  buf = Pane.current().buf
  requestID = activeQuestionID(buf)
  if (requestID == null) {
    Mess.yell('No question pending')
    return
  }
  el = questionEl(buf, requestID, we)
  items = el ? el.querySelectorAll('.code-question-item') : []
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
() {
  let buf, requestID

  buf = Pane.current().buf
  requestID = activeQuestionID(buf)
  if (requestID == null) {
    Mess.yell('No question pending')
    return
  }
  questionRespond(buf, requestID)
}

function skipQuestionOrStop
() {
  let buf

  buf = Pane.current().buf
  if (buf.vars('code')?.questions?.length)
    skipQuestion()
  else
    stopWithCaution()
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
  if (title) {
    buf.vars('code').sessionTitle = title
    buf.views.forEach(view => {
                        if (view.eleOrReserved) {
                          let titleEl

                          titleEl = view.eleOrReserved.querySelector('.code-session-title')
                          if (titleEl)
                            titleEl.innerText = title
                        }
                      })
    // Update assist sidebar extras
    Buf.forEach(b => {
                  if (b.mode.key == 'assist')
                    b.views.forEach(v => {
                                      let el

                                      el = v.ele?.querySelector('.assist-extra.assist-mode-session-title')
                                      if (el)
                                        el.innerText = title
                                    })
                })
  }
  if (event.properties.info?.time?.created) {
    let ts

    ts = event.properties.info.time.created
    buf.vars('code').sessionStart = buf.vars('code').sessionStart || ts
    Buf.forEach(b => {
                  if (b.mode.key == 'assist')
                    b.views.forEach(v => {
                                      let el

                                      el = v.ele?.querySelector('.assist-extra.assist-mode-session-start')
                                      if (el)
                                        el.innerText = 'Started: ' + Util.fmtSessionStart(ts)
                                    })
                })
  }
}

function handleMessageUpdated
(buf, event) {
  let info

  info = event.properties.info
  if (info.tokens) {
    let total

    total = Util.sumTokens(info.tokens)
    if (total > 0)
      buf.vars('code').lastTokens = total
  }
  if (info.cost && info.cost > 0)
    buf.vars('code').lastCost = info.cost
  if (info.model)
    updateModelContextLimit(buf, info.model.providerID, info.model.modelID)
}

function handleToolPart
(buf, part) {
  let status, h

  if (part.messageID)
    buf.vars('code').curMessageID = part.messageID
  status = part.state?.status

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

  if (part.messageID)
    buf.vars('code').curMessageID = part.messageID

  if (part.tokens) {
    let total

    total = Util.sumTokens(part.tokens)
    if (total > 0)
      buf.vars('code').lastTokens = total
  }

  if (part.type == 'step-start') {
    let steps

    steps = buf.vars('code').stepActiveSessions
    if (steps == null) {
      steps = new Set()
      buf.vars('code').stepActiveSessions = steps
    }
    steps.add(part.sessionID)
  }
  else if (part.type == 'step-finish') {
    let steps

    steps = buf.vars('code').stepActiveSessions
    if (steps)
      steps.delete(part.sessionID)
  }
  else if (part.type == 'text') {
    buf.vars('code').gotContent = 1
    if (buf.vars('code').stepActiveSessions?.size)
      Ui.appendMsg(buf, 0, part.text, part.id)
  }
  else if (part.type == 'reasoning') {
    let buffered

    buffered = (event.properties.delta || '')
    if (buffered) {
      buf.vars('code').gotContent = 1
      Ui.appendThinking(buf, buffered, part.id)
    }
  }
  else if (part.type == 'tool') {
    buf.vars('code').gotContent = 1
    handleToolPart(buf, part)
  }
}

function partCache
(view) {
  let cache

  cache = view.vars('code').partEls
  if (cache == null) {
    cache = new Map()
    view.vars('code').partEls = cache
  }
  return cache
}

function handlePartDelta
(buf, event) {
  let delta, field, partID

  delta = event.properties.delta
  field = event.properties.field
  partID = event.properties.partID

  if (field == 'text' && delta) {
    let view, w

    view = buf.anyView(1)
    w = view?.eleOrReserved?.querySelector('.code-w')
    if (w && PartCache.find(partCache(view), w, partID, 'code-msg-thinking', 'think')) {
      Ui.chunkThink(buf, partID, delta)
      return
    }
  }

  Util.eachCodeW(buf, (view, w) => {
                        let cache, msgEl, textEl, thinkEl

                        cache = partCache(view)
                        msgEl = PartCache.find(cache, w, partID, 'code-msg-assistant', 'msg')
                        if (msgEl) {
                          textEl = msgEl.querySelector('.code-msg-text')
                          if (textEl && field == 'text')
                            Ui.withScroll(w, () => textEl.innerText = (textEl.innerText || '') + delta)
                          else if (field == 'text' && msgEl.querySelector('.code-markdown-ed'))
                            Ui.chunkText(buf, partID, delta)
                        }
                        thinkEl = PartCache.find(cache, w, partID, 'code-msg-thinking', 'think')
                        if (thinkEl && field == 'text') {
                          textEl = thinkEl.querySelector('.code-msg-text')
                          if (textEl)
                            Ui.withScroll(w, () => textEl.innerText = (textEl.innerText || '') + delta)
                        }
                        else if (field == 'text' && msgEl == null)
                          Ui.appendX(w,
                                     divCl('code-msg code-msg-thinking',
                                           [ divCl('code-msg-text', delta) ],
                                           { 'data-partid': partID || 0 }))
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

function ensureTitle
(c, buf, sessionID, text) {
  if (buf.vars('code').prompt)
    return
  if (buf.vars('code').titleUpdated)
    return
  buf.vars('code').titleUpdated = 1
  c.session.update({ sessionID,
                     directory: buf.dir,
                     title: text })
    .catch(() => {})
}

function send
(buf, text, provider, model, variant) {
  let sessionID

  provider = provider || Util.getProvider(buf)
  model = model || Util.getModel(buf)
  variant = variant || Util.getVariant(buf)

  sessionID = buf.vars('code').sessionID

  Comm.ensureClient(buf).then(async c => {
                                let agent, res, tmpID

                                buf.vars('code').agentStopped = 0
                                buf.vars('code').busy = 1
                                buf.vars('code').gotContent = 0

                                agent = Util.getAgent(buf)

                                tmpID = 'tmp_' + uuidv4()
                                Ui.appendMsg(buf, 'user', text, undefined, undefined, { agent, messageID: tmpID })

                                Ev.startSub(buf, events)

                                await buf.vars('code').streamReady

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

                                backfillMessageID(buf, tmpID, res.data?.info?.parentID)

                                ensureTitle(c, buf, sessionID, text)

                                if (provider == 'openrouter' || provider == 'deepinfra')
                                  updateCredits(buf, provider)

                                await new Promise(r => setTimeout(r))
                                if (buf.vars('code').gotContent == 0 && res.data?.parts)
                                  for (let part of res.data.parts)
                                    if (part.type == 'step-start') {
                                      let steps

                                      steps = buf.vars('code').stepActiveSessions
                                      if (steps == null) {
                                        steps = new Set()
                                        buf.vars('code').stepActiveSessions = steps
                                      }
                                      steps.add(part.sessionID)
                                    }
                                    else if (part.type == 'text' && part.text)
                                      Ui.appendMsg(buf, 0, part.text, part.id)
                                    else if (part.type == 'reasoning' && part.text)
                                      Ui.appendThinking(buf, part.text, part.id)
                                    else if (part.type == 'tool')
                                      handleToolPart(buf, part)

                                if (res?.error) {
                                  d({ resError: res.error })
                                  Ui.appendMsg(buf, 'assistant', 'Error: ' + (res.error.message || JSON.stringify(res.error)))
                                  buf.vars('code').client = 0
                                  buf.vars('code').streamActive = 0
                                  Ev.startSub(buf, events)
                                }

                                // after the response, so the model footer never
                                // lands above a response that rendered late
                                Ui.appendModel(buf, Util.modelName(res.data?.info?.modelID || '???', variant), Util.fmtCost(res.data?.info?.cost), undefined, res.data?.info?.id)
                              }).catch(err => {
                                         d(err)
                                         Ui.appendMsg(buf, 'assistant', 'Error: ' + (err.message || JSON.stringify(err)))
                                         buf.vars('code').client = 0
                                         buf.vars('code').streamActive = 0
                                         Ev.startSub(buf, events)
                                       })
}

// The live user message is rendered before the server assigns its id, so tag
// it with a temporary id and swap in the real one (the assistant's parentID)
// once the turn completes.
function backfillMessageID
(buf, tmpID, realID) {
  if (realID == null)
    return
  Util.eachCodeW(buf, (view, w) => {
                        w.querySelectorAll('[data-messageid="' + tmpID + '"]').forEach(el => el.setAttribute('data-messageid', realID))
                      })
}

function viewMessageJSON
(buf, messageID) {
  let pane

  pane = Pane.current()
  Comm.ensureClient(buf).then(async c => {
                                let res

                                res = await c.session.message({ sessionID: buf.vars('code').sessionID,
                                                                messageID,
                                                                directory: buf.dir })
                                Ed.make(pane,
                                        { name: 'code-msg-' + messageID.replace(/^msg_/, '') + '.json',
                                          dir: buf.dir },
                                        view => {
                                          view.buf.opts.set('core.lang', 'json')
                                          view.insert(JSON.stringify(res.data, null, 2))
                                          view.buf.modified = 0
                                        })
                              }).catch(err => {
                                         Mess.yell('View failed: ' + err.message)
                                         d('CO view message error: ' + err.message)
                                       })
}

function removeMessageEls
(buf, messageID) {
  Util.eachCodeW(buf, (view, w) => {
                        w.querySelectorAll('[data-messageid="' + messageID + '"]').forEach(el => el.remove())
                      })
}

function deleteMessage
(buf, messageID) {
  Comm.ensureClient(buf).then(async c => {
                                await c.session.deleteMessage({ sessionID: buf.vars('code').sessionID, messageID, directory: buf.dir })
                                removeMessageEls(buf, messageID)
                              }).catch(err => {
                                         Mess.yell('Delete failed: ' + err.message)
                                         d('CO delete message error: ' + err.message)
                                       })
}

function messageMenu
(u, we) {
  let buf, el, messageID

  buf = Pane.current().buf
  el = we.e.target.closest('[data-messageid]')
  messageID = el?.dataset.messageid
  if (messageID == null || messageID.length == 0)
    return
  Prompt.choose('Message',
                [ 'View JSON',
                  { name: 'Delete Message', enable: buf.vars('code').busy ? 0 : 1 } ],
                {},
                choice => {
                  if (choice == 'View JSON')
                    viewMessageJSON(buf, messageID)
                  else if (choice == 'Delete Message') {
                    if (buf.vars('code').busy) {
                      Mess.yell('Agent is busy')
                      return
                    }
                    Prompt.yn('Delete message?',
                              { icon: 'trash' },
                              yes => {
                                if (yes)
                                  deleteMessage(buf, messageID)
                              })
                  }
                })
}

function stopAgent
(buf, sessionID) {
  buf.vars('code').agentStopped = 1
  Comm.ensureClient(buf).then(async client => {
                                try {
                                  await Stop.cancel(client, sessionID, buf.dir)
                                  Mess.yell('Stopped agent')
                                }
                                catch (err) {
                                  Mess.yell('Stop failed: ' + err.message)
                                }
                              }).catch(err => {
                                         Mess.yell('Stop failed: ' + err.message)
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
  p.buf.vars('code').thinkingHidden = p.buf.vars('code').thinkingHidden ? 0 : 1
  p.buf.views.forEach(view => {
                        if (view.eleOrReserved) {
                          let w

                          w = view.eleOrReserved.querySelector('.code-w')
                          if (w) {
                            let img, h

                            h = view.eleOrReserved.querySelector('.code-h')
                            img = h?.querySelector('.code-thought img')
                            if (p.buf.vars('code').thinkingHidden) {
                              Css.add(w, 'code-thinking-hidden')
                              if (img)
                                img.src = Icon.path('thinking.zen')
                            }
                            else {
                              Css.remove(w, 'code-thinking-hidden')
                              if (img)
                                img.src = Icon.path('thinking.active')
                            }
                          }
                        }
                      })
}

function toggleDetails
(u, we) {
  let el, w

  el = we.e.target.closest('.code-msg-tool')
  if (el == null)
    return
  w = el.closest('.code-w')
  if (Css.has(el, 'code-details-open')) {
    Css.remove(el, 'code-details-open')
    Css.add(el, 'code-closed')
  }
  else if (Css.has(el, 'code-closed')
           || (w && Css.has(w, 'code-thinking-hidden'))) {
    Css.remove(el, 'code-closed')
    Css.add(el, 'code-details-open')
  }
  else
    Css.add(el, 'code-closed')
}

function setAgent
(buf, agent) {
  buf.opts.set('code.agent', agent)
  Hist.ensure('code.agent').add(agent)
  updateBufAgent(buf, agent)
}

function setModel
(buf, providerID, modelID, variant) {
  buf.vars('code').provider = providerID
  buf.vars('code').model = modelID
  buf.vars('code').variant = variant || ''
  buf.opts.set('code.provider.agent', providerID)
  buf.opts.set('code.model.agent', modelID)
  buf.opts.set('code.variant.agent', variant || '')
  Hist.ensure('code.model').add(modelID)
  updateModelContextLimit(buf, providerID, modelID)
  updateModelPromptLabel(buf)
}

function updateModelPromptLabel
(buf) {
  let provider, model, variant

  provider = buf.vars('code').provider
  model = buf.vars('code').model
  variant = buf.vars('code').variant
  buf.views.forEach(view => {
                      let container

                      container = view.ele?.querySelector?.('.code-prompt-w')
                      if (container) {
                        let mlModel

                        mlModel = container.querySelector('.code-prompt-model')
                        if (mlModel)
                          mlModel.innerText = '🗩 ' + provider + '/' + Util.modelName(model, variant)
                      }
                    })
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

function listModels
() {
  let buf

  buf = Pane.current().buf
  if (buf.vars('code') == null) {
    Mess.yell('Not a code buffer')
    return
  }

  Comm.ensureClient(buf).then(async c => {
                                let res, providers, choices, byChoice

                                function rank
                                (id) {
                                  if (id == 'opencode-go')
                                    return 0
                                  if (id == 'opencode')
                                    return 1
                                  return 2
                                }

                                async function build
                                () {
                                  let entries

                                  entries = []
                                  providers.forEach(p => {
                                                      let modelIDs

                                                      modelIDs = Object.keys(p.models || {})
                                                      if (modelIDs.length == 0)
                                                        return
                                                      modelIDs.forEach(modelID => {
                                                                         let fullId, active

                                                                         fullId = p.id + '/' + modelID
                                                                         active = p.id == buf.vars('code').provider
            && modelID == buf.vars('code').model
                                                                         entries.push({ fullId,
                                                                                        active,
                                                                                        providerID: p.id,
                                                                                        modelID,
                                                                                        sortKey: rank(p.id) + '/' + p.id + '/' + modelID })
                                                                       })
                                                    })
                                  entries.sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0))
                                  choices = entries.map(e => e.fullId + (e.active ? ' ◀ current' : ''))
                                  byChoice = new Map(entries.map(e => [ e.fullId + (e.active ? ' ◀ current' : ''), e ]))
                                }

                                res = await c.config.providers({ directory: buf.dir })
                                providers = res.data.providers || []

                                choices = []
                                byChoice = new Map()
                                await build()

                                Prompt.choose(Util.iconAgent() + ' Set code model',
                                              choices,
                                              {},
                                              sel => {
                                                if (sel) {
                                                  let info

                                                  info = byChoice.get(sel)
                                                  if (info) {
                                                    let model, variantKeys

                                                    model = providers.find(p => p.id == info.providerID)?.models?.[info.modelID]
                                                    variantKeys = model?.variants ? Object.keys(model.variants) : []
                                                    if (variantKeys.length == 0) {
                                                      setModel(buf, info.providerID, info.modelID, '')
                                                      return
                                                    }

                                                    Prompt.choose(Util.iconAgent() + ' Set variant',
                                                                  [ '(default)', ...variantKeys ],
                                                                  {},
                                                                  vsel => {
                                                                    let variant

                                                                    if (vsel == null)
                                                                      return
                                                                    variant = vsel == '(default)' ? '' : vsel
                                                                    setModel(buf, info.providerID, info.modelID, variant)
                                                                  })
                                                  }
                                                }
                                              })
                              }).catch(err => {
                                         Mess.yell('Failed: ' + err.message)
                                         d('CO listModels error: ' + err.message)
                                       })
}

function openPrompt
(buf, pane, provider, model, variant) {
  let wh

  Mess.yell('')
  wh = whichHistFromBuf(buf)
  buf.vars('code').promptBuf.placeholder = wh?.nth(0)?.toString()

  buf.views.forEach(view => {
                      let container, w

                      container = view.ele.querySelector('.code-prompt-w')
                      w = view.ele.querySelector('.code-w')
                      if (container) {
                        let mlModel

                        // the prompt takes height from the scroller, so keep
                        // the end in view if it was there before
                        if (w && Ui.atEnd(w)) {
                          Css.expand(container)
                          globalThis.requestAnimationFrame(() => Ui.keepAtEnd(w))
                        }
                        else
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

// A view with a real element. A buried buf's sole view is closed (view.ele
// undefined) but stays in buf.views, so presence in buf.views is not enough.
function liveView
(buf) {
  return buf.views.find(v => v.ele)
}

// Startup work that needs a live view: nest the prompt buffer and, for a
// promptless start, open it. If the buf was buried while the session was being
// created there is no live view, so leave startupPending set and let viewInit /
// viewReopen finish the job when the buf is shown again.
function finishStartup
(buf) {
  let pending, view

  pending = buf.vars('code').startupPending
  if (pending == null)
    return
  view = liveView(buf)
  if (view == null)
    return
  buf.vars('code').startupPending = 0
  Prompt.nestBuf(buf, hist)
  if (pending.open)
    openPrompt(buf, Pane.holdingView(view), pending.provider, pending.model, pending.variant)
}

function next
() {
  let p, buf, block, provider, model, variant

  p = Pane.current()
  buf = p.buf

  block = Util.promptBlocked(buf)
  if (block) {
    Mess.yell(block)
    return
  }

  provider = Util.getProvider(buf)
  model = Util.getModel(buf)
  variant = Util.getVariant(buf)

  openPrompt(buf, p, provider, model, variant)
}

function code
(given, givenDir) {
  let pane, dir, name, provider, model, variant

  async function run
  (prompt) {
    let buf

    if (prompt)
      hist.add(prompt)

    buf = Buf.add(name, 'code', Ui.divW(dir, Opt.get('code.agent')), dir)
    buf.vars('code').prompt = prompt
    buf.vars('code').provider = provider
    buf.vars('code').model = model
    buf.vars('code').variant = variant
    buf.vars('code').thinkingHidden = 1
    buf.opt('core.lint.enabled', 1)

    pane.setBuf(buf, {}, () => {
                           Ui.appendMsg(buf, 0, 'Spawning docker...')
                           Comm.ensureClient(buf).then(async c => {
                                                         let res

                                                         Ui.appendMsg(buf, 0, 'Creating session...')
                                                         res = await c.session.create({ directory: buf.dir,
                                                                                        ...(prompt ? { title: prompt } : {}) })

                                                         buf.vars('code').sessionID = res.data.id
                                                         buf.vars('code').sessionStart = res.data.time?.created
                                                         buf.vars('code').startupPending = { provider,
                                                                                             model,
                                                                                             variant,
                                                                                             open: prompt ? 0 : 1 }

                                                         Ui.updateDocker(buf)
                                                         Ui.appendMsg(buf, 0, 'Ready for prompt.')
                                                         // The buf may have been buried while the session was
                                                         // created, closing its view. Nests/opens the prompt when a
                                                         // live view is available (now or on reopen).
                                                         finishStartup(buf)
                                                         if (prompt)
                                                           send(buf, prompt, provider, model, variant)
                                                       }).catch(err => {
                                                                  Mess.yell('Failed: ' + err.message)
                                                                })
                         })
  }

  pane = Pane.current()
  dir = givenDir || pane.dir
  name = 'CO ' + dir
  provider = Util.getProvider()
  model = Util.getModel()
  variant = Util.getVariant()
  {
    let buf

    buf = Buf.find(b => b.name == name)
    if (buf) {
      pane.setBuf(buf)
      if (provider == 'openrouter' || provider == 'deepinfra')
        updateCredits(buf, provider)
      return
    }
  }

  if (given)
    run(given)
  else
    run()
}

function codeQuestion
() {
  let dir

  dir = Loc.make('~/tmp/question').expand()
  Tron.acmd('dir.make', [ dir ]).then(() => code(0, dir))
    .catch(err => Mess.yell('code question: ' + err.message))
}

function viewInit
(view, spec, cb) { // (view)
  if (view.buf?.vars('code')?.thinkingHidden) {
    let w

    w = view.ele?.querySelector?.('.code-w')
    if (w) {
      let h

      Css.add(w, 'code-thinking-hidden')
      h = view.ele.querySelector('.code-h')
      if (h) {
        let img

        img = h.querySelector('.code-thought img')
        if (img)
          img.src = Icon.path('thinking.zen')
      }
    }
  }
  finishStartup(view.buf)
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

    if (to.buf.vars('code').thinkingHidden) {
      let h

      Css.add(toW, 'code-thinking-hidden')

      h = to.ele.querySelector('.code-h')
      if (h) {
        let img

        img = h.querySelector('.code-thought img')
        if (img)
          img.src = Icon.path('thinking.zen')
      }
    }

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
      let toH

      toH = to.ele.querySelector('.code-h')
      if (toH) {
        let elAgent

        elAgent = toH.querySelector('.code-agent')
        if (elAgent)
          elAgent.innerText = Util.iconAgent() + to.buf.opt('code.agent')

        {
          let elDocker

          elDocker = toH.querySelector('.code-docker-name')
          if (elDocker)
            elDocker.innerText = to.buf.vars('code').containerName || ''
        }
      }
    }
    {
      let fromPrompt, toPrompt

      fromPrompt = from.ele.querySelector('.code-prompt-w')
      toPrompt = to.ele.querySelector('.code-prompt-w')
      if (fromPrompt && toPrompt) {
        if (Css.has(fromPrompt, 'retracted') == 0)
          Css.remove(toPrompt, 'retracted')
        {
          let fromModel, toModel

          fromModel = fromPrompt.querySelector('.code-prompt-model')
          toModel = toPrompt.querySelector('.code-prompt-model')
          if (fromModel && toModel)
            toModel.innerText = fromModel.innerText
        }
      }
    }
  }

  if (from.nestedViews)
    from.nestedViews.forEach(nv => {
                               let outer, nestedView, src

                               src = from.ele.querySelector('[data-bred-nested-buf-id="' + nv.buf.id + '"]')
                               if (src?.closest('.code-prompt-w') == null)
                                 return

                               outer = to.ele.querySelector('.code-prompt-w .bred-nested-pane-w')
                               if (outer) {
                                 let inner, paneW, pane, overlayW, overlay, point, pointLine, headW, head, lint, col

                                 inner = outer.querySelector('[data-bred-nested-buf-id="' + nv.buf.id + '"]')
                                 if (inner)
                                   inner.innerHTML = ''
                                 else {
                                   inner = divCl('bred-nested-pane-w', [], { 'data-bred-nested-buf-id': nv.buf.id })
                                   outer.appendChild(inner)
                                 }

                                 point = divCl('bred-point')
                                 pointLine = divCl('bred-point-line')
                                 lint = divCl('bred-head-ed bred-head-lint hidden',
                                              divCl('bred-lint-marker', [],
                                                    { 'data-run': 'first diagnostic' }))
                                 col = divCl('bred-head bred-head-end',
                                             [ divCl('bred-head-ed bred-head-col', 'C1') ])
                                 head = divCl('bred-head bred-head-mid', [ lint ])
                                 headW = divCl('bred-head-w', [ head, col ])
                                 overlay = divCl('bred-overlay', [ point, pointLine, headW ])
                                 overlayW = divCl('bred-overlay-w bred-nested', overlay)
                                 pane = divCl('pane bred-nested', [])
                                 paneW = divCl('paneW bred-nested', [ pane, overlayW ])

                                 paneW.onscroll = () => {
                                                    if (nestedView.ed)
                                                      return
                                                    if (nestedView.scroll?.manual)
                                                      return
                                                    nestedView.point.ensureInView()
                                                  }

                                 inner.appendChild(paneW)

                                 nestedView = Buf.view(nv.buf,
                                                       { ele: pane, elePoint: point },
                                                       v => {
                                                         if (v.ed) {
                                                           Css.add(paneW, 'ed')
                                                           v.ed.focus()
                                                         }
                                                       })

                                 Css.add(pane, 'current')

                                 to.nestedViews = to.nestedViews || []
                                 to.nestedViews.push(nestedView)
                               }
                             })

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
                 finishStartup(view.buf)
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
  let buf, p, text, codeBuf, whichHist, block

  p = Pane.current()
  buf = p.buf
  codeBuf = buf.parent || buf
  block = Util.promptBlocked(codeBuf)
  if (block) {
    Mess.yell(block)
    return
  }
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
                        if (container) {
                          let nestedPane

                          Css.retract(container)
                          nestedPane = view.ele.querySelector('.pane.bred-nested.current')
                          if (nestedPane)
                            Css.remove(nestedPane, 'current')
                        }
                      })

    p.focus()
  }
}

function codeCancel
() {
  let p, buf, codeBuf, open

  p = Pane.current()
  buf = p.buf
  codeBuf = buf.parent || buf
  if (codeBuf.vars('code')?.firstPromptSent)
    buf.views.forEach(view => {
                        let container

                        container = view.ele?.querySelector?.('.code-prompt-w')
                        if (container && Css.has(container, 'retracted') == 0)
                          open = 1
                      })

  if (open)
    cancelPrompt(p)
  else
    Cmd.run('cancel', buf)
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

function isShownInCurrentTab
(b) {
  let f, tab

  f = 0
  tab = Pane.current().frame.tab
  Pane.forEach(pane => {
                 if (pane.buf == b && pane.frame.tab == tab)
                   f = 1
               })
  return f
}

// Snapshot the recency order starting just after cur (cur wraps at the end),
// dropping buffers already visible elsewhere in the current tab.
function startAgentCycle
(cur) {
  let i, order

  i = mostRecentAgents.indexOf(cur)
  if (i >= 0)
    order = mostRecentAgents.slice(i + 1).concat(mostRecentAgents.slice(0, i + 1))
  else
    order = mostRecentAgents.slice()
  order = order.filter(b => (b == cur) || (isShownInCurrentTab(b) == 0))
  return { list: order, idx: 0, last: 0 }
}

function mostRecentAgent
() {
  let buf, cur, list, restart

  if (mostRecentAgents.length == 0) {
    Mess.yell('Run an agent first')
    return
  }
  cur = Pane.current().buf
  restart = agentCycle && agentCycle.last == cur ? 0 : 1
  if (restart)
    agentCycle = startAgentCycle(cur)
  list = agentCycle.list
  if (list.length == 0 || (list.length == 1 && list[0] == cur)) {
    Mess.yell('No other agent')
    agentCycle = 0
    return
  }
  buf = list[agentCycle.idx]
  agentCycle.idx = (agentCycle.idx + 1) % list.length
  agentCycle.last = buf
  Pane.current().setBuf(buf)
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
                             let label

                             d('CO websearch completed with ' + results + ' results')
                             label = 'Web search: ' + query
                             if (results)
                               label += ' (' + results + ' results)'
                             Ui.appendToolMsg(buf,
                                              part.callID,
                                              label,
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
                            Ui.appendToolMsg(buf, part.callID, [ 'Fetch ', span(url, 'code-file', { 'data-run': 'open link', 'data-runaux': 'open link in other pane', 'data-path': url }) ])
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
                                             [ 'Fetch ', span(url, 'code-file', { 'data-run': 'open link', 'data-runaux': 'open link in other pane', 'data-path': url }), size ? ' (' + size + ' bytes)' : '' ])
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
                                             [ 'Fetch ', span(url, 'code-file', { 'data-run': 'open link', 'data-runaux': 'open link in other pane', 'data-path': url }) ],
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
                                     updateIdle(buf, Util.calculateTokenPercentage(buf))
                                   else
                                     handleSubagentIdle(buf, event)
                               } },
             'session.status': { onArrive
                                 (buf, event) {
                                   if (Util.isSessionMatch(buf, event.properties.sessionID)
                                       && event.properties.sessionID == buf.vars('code').sessionID)
                                     updateStatus(buf, event.properties, Util.calculateTokenPercentage(buf))
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
                                      Ui.appendMsg(buf, 'assistant', 'Error: ' + (error.data?.message || error.name || '??'))
                                    else
                                      Ui.appendMsg(buf, 'assistant', 'Error: session error - details missing')
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
                                       Ui.appendModel(buf, Util.modelName(buf.vars('code').model, buf.vars('code').variant), Util.fmtCost(buf.vars('code').lastCost))
                                     }
                                   } } }

  hist = Hist.ensure('code')
  chatHist = Hist.ensure('code.chat')

  mostRecentAgents = []

  Opt.declare('code.agent', 'str', 'plan')
  Opt.declare('code.model.agent', 'str', 'deepseek/deepseek-v4-flash')
  Opt.declare('code.provider.agent', 'str', 'goat')
  Opt.declare('code.variant.agent', 'str', '')
  Opt.declare('code.key', 'str', '')
  mo = Mode.add('code',
                { viewInit,
                  viewCopy,
                  viewReopen,
                  assist: { extras: [ { key: 'session-title',
                                        co
                                        (view) {
                                          return view.buf.vars('code')?.sessionTitle || view.buf.vars('code')?.prompt || ''
                                        } },
                                      { key: 'session-start',
                                        co
                                        (view) {
                                          let ts

                                          ts = view.buf.vars('code')?.sessionStart
                                          return 'Started: ' + (ts ? Util.fmtSessionStart(ts) : '?')
                                        } } ] },
                  onRemove
                  (buf) {
                    let i

                    i = mostRecentAgents.indexOf(buf)
                    if (i >= 0)
                      mostRecentAgents.splice(i, 1)
                    agentCycle = 0
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
  Cmd.add('code question', () => codeQuestion())

  Cmd.add('respond', () => next(), mo)

  Cmd.add('stop', stop, mo)
  Cmd.add('stop with caution', stopWithCaution, mo)

  Cmd.add('yes', () => yn(1), mo)
  Cmd.add('no', () => yn(), mo)

  Em.on('y', 'yes', mo)
  Em.on('n', 'no', mo)
  Em.on('+', 'respond', mo)
  Em.on('Enter', 'respond', mo)

  Em.on('Backspace', 'scroll up', mo)
  Em.on(' ', 'scroll down', mo)
  Em.on('b', 'set agent build', mo)
  Em.on('p', 'set agent plan', mo)
  Em.on('q', 'bury', mo)
  Em.on('s', 'skip question or stop', mo)
  Em.on('t', 'toggle thinking', mo)
  Em.on('C-g', 'cancel prompt or cancel', mo)

  Cmd.add('toggle thinking', toggleThinking, mo)
  Cmd.add('toggle details', toggleDetails, mo)
  Cmd.add('cancel prompt or cancel', () => codeCancel(), mo)

  Cmd.add('set agent', () => promptAgent(), mo)
  Cmd.add('set agent plan', () => setAgent(Pane.current().buf, 'plan'), mo)
  Cmd.add('set agent build', () => setAgent(Pane.current().buf, 'build'), mo)

  Cmd.add('set code model', () => listModels(), mo)

  Cmd.add('message menu', messageMenu, mo)

  Em.on('a', 'answer question', mo)

  Cmd.add('toggle question option', toggleQuestionOption, mo)
  Cmd.add('answer question', answerQuestion, mo)
  Cmd.add('skip question', skipQuestion, mo)
  Cmd.add('skip question or stop', skipQuestionOrStop, mo)

  Cmd.add('code buffer', () => {
                           code(Pane.current().buf.text())
                         })

  Cmd.add('most recent agent', mostRecentAgent)

  Pane.onSetBuf(view => {
                  if (view.buf.mode.key == 'code') {
                    let i

                    i = mostRecentAgents.indexOf(view.buf)
                    if (i >= 0)
                      mostRecentAgents.splice(i, 1)
                    mostRecentAgents.unshift(view.buf)
                  }
                })

  moCodePrompt = Mode.add('Code Prompt', { minor: 1 })

  Cmd.add('submit prompt', () => submitPrompt(), moCodePrompt)
  Cmd.add('code submit', () => submitPrompt(), mo)
  Cmd.add('cancel prompt', () => cancelPrompt(), moCodePrompt)
  Cmd.add('previous history item', () => prevHist(), moCodePrompt)
  Cmd.add('next history item', () => nextHist(), moCodePrompt)

  Em.on('Enter', 'submit prompt', moCodePrompt)
  Em.on('C-g', 'cancel prompt', moCodePrompt)
  Em.on('A-p', 'previous history item', moCodePrompt)
  Em.on('A-n', 'next history item', moCodePrompt)

  Sessions.init(events)
}
