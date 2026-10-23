import * as Opt from '../../js/opt.mjs'

export
function iconAgent
() {
  return '⚡'
}

export
function iconRightArrow
() {
  return '➔'
}

export
function modelName
(model, variant) {
  return model + (variant ? ':' + variant : '')
}

export
function fmtCost
(cost) {
  if (cost && cost > 0)
    return '$' + cost.toFixed(4)
  return ''
}

export
function makeRelative
(buf, path) {
  if (path?.startsWith(buf.dir))
    return path.slice(buf.dir.length)
  return path
}

// Provider and model come from Opt.declare in code.mjs (code.provider.agent,
// code.model.agent) — the single source of truth. No fallbacks here on purpose:
// a missing value is a configuration bug, and promptBlocked reports it rather
// than us sending a made-up model.

export
function getProvider
(buf) {
  return (buf && buf.vars('code').provider) || Opt.get('code.provider.agent')
}

export
function getModel
(buf) {
  return (buf && buf.vars('code').model) || Opt.get('code.model.agent')
}

export
function getVariant
(buf) {
  return (buf && buf.vars('code').variant) || Opt.get('code.variant.agent') || ''
}

export
function getAgent
(buf) {
  return (buf && buf.opts.get('code.agent')) || Opt.get('code.agent')
}

export
function isSubagentId
(buf, id) {
  return buf?.vars('code')?.subagentIds?.has(id)
}

// why a prompt can't be sent now, if any
export
function promptBlocked
(buf) {
  if (buf.vars('code').permissions?.length)
    return 'Permission check pending'
  if (buf.vars('code').questions?.length)
    return 'Question pending'
  if (buf.vars('code').sessionID) {
    // ok
  }
  else
    return 'ERR session missing'
  if (buf.vars('code').busy)
    return 'Agent is busy'
  if (getProvider(buf) && getModel(buf)) {
    // ok
  }
  else
    return 'No model selected'
}

export
function isSessionMatch
(buf, id) {
  return (id == buf.vars('code')?.sessionID) || isSubagentId(buf, id)
}

export
function eachCodeW
(buf, fn) {
  buf.views.forEach(view => {
                      if (view.eleOrReserved) {
                        let w

                        w = view.eleOrReserved.querySelector('.code-w')
                        if (w)
                          fn(view, w)
                      }
                    })
}

export
function sameDir
(sessionDir, bufDir) {
  let a, b

  if (sessionDir == '/')
    return bufDir == '/'

  a = sessionDir.replace(/\/$/, '')
  b = bufDir.replace(/\/$/, '')
  return a == b
}

// The server stores session directories without a trailing slash and matches
// them exactly, so strip the buffer's trailing slash before calling the API.
export
function apiDir
(buf) {
  return buf.dir.length > 1 ? buf.dir.replace(/\/$/, '') : buf.dir
}

export
function ensureThinkChunks
(buf) {
  let chunks

  chunks = buf.vars('code').thinkChunks
  if (chunks)
    return chunks
  return buf.vars('code').thinkChunks = {}
}

export
function ensureTextChunks
(buf) {
  let chunks

  chunks = buf.vars('code').textChunks
  if (chunks)
    return chunks
  return buf.vars('code').textChunks = {}
}

// The task prompt a parent agent sent to a subagent. The field name is not
// documented in the v2 types, so accept the obvious aliases.
export
function subagentPrompt
(part) {
  let input

  input = part.state?.input || {}
  return input.prompt || input.message || input.task || ''
}

// The subagent's result, or why it failed. Errors can be an object. Live parts
// carry output/error; parts loaded from history carry content instead.
export
function subagentResult
(part) {
  let err, out

  if (part.state?.output)
    return part.state.output
  err = part.state?.error
  if (err)
    return (typeof err == 'string') ? err : (err.message || String(err))
  out = []
  for (let content of (part.state?.content || []))
    if (content.type == 'text')
      out.push(content.text)
  return out.join('\n')
}

// Which agent a subagent call used. Live parts say agent, stored ones say
// subagent_type.
export
function subagentAgent
(part) {
  let input

  input = part.state?.input || {}
  return input.agent || input.subagent_type || 'general'
}

export
function subagentLabel
(part) {
  let input, desc, status

  input = part.state?.input || {}
  status = part.state?.status
  desc = input.description
  return (desc ? 'Task: ' + desc : 'Task')
    + ' (' + subagentAgent(part) + ' agent)'
    + (status == 'completed' ? ' ✔️' : (status == 'error' ? ' ✘' : ''))
}

// The child session a subagent call started. Live parts use sessionID, stored
// ones use sessionId.
export
function subagentChildId
(part) {
  let md

  md = part.state?.metadata || {}
  return md.sessionID || md.sessionId || ''
}

export
function sumTokens
(tokens) {
  return (tokens.input || 0)
    + (tokens.output || 0)
    + (tokens.reasoning || 0)
    + (tokens.cache?.read || 0)
    + (tokens.cache?.write || 0)
}

export
function fmtSessionStart
(ts) {
  let dt, h, m

  dt = new Date(ts)
  h = String(dt.getHours()).padStart(2, '0')
  m = String(dt.getMinutes()).padStart(2, '0')
  return String(dt.getFullYear()) + '-'
    + String(dt.getMonth() + 1).padStart(2, '0') + '-'
    + String(dt.getDate()).padStart(2, '0') + ' ' + h + 'h' + m
}

export
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
