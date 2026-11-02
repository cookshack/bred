import * as Opt from '../../js/opt.mjs'

// Command Code's plan catalog, mirroring the `cmd` CLI. The credits endpoint
// reports only what is left, so the monthly percentage needs the grant size.
let planCredits

planCredits = { 'individual-go': 10,
                'individual-go-v1': 10,
                'individual-goat': 70,
                'individual-pro': 30,
                'individual-pro-v1': 80,
                'individual-provider': 15,
                'individual-max': 150,
                'individual-ultra': 300,
                'teams-pro': 40 }

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

// longest key first, so eg individual-pro-v1 wins over individual-pro
function planGrant
(planId) {
  let id, keys, key

  id = (planId || '').toLowerCase().replace(/_/g, '-')
  keys = Object.keys(planCredits)
  keys.sort((a, b) => b.length - a.length)
  key = keys.find(k => id.startsWith(k))
  if (key)
    return planCredits[key]
  return 0
}

function usagePct
(used, cap) {
  if (cap > 0)
    return Math.min(100, Math.round((used / cap) * 100))
  return 0
}

// resetAt can be epoch ms or an ISO string (the alpha endpoints are not
// consistent about it), and 0 when the window has never been used.
function resetMs
(at) {
  if (typeof at == 'number')
    return at
  if (typeof at == 'string' && at.length) {
    let ms

    ms = Date.parse(at)
    if (isNaN(ms))
      return 0
    return ms
  }
  return 0
}

// The rolling windows use used/cap directly; monthly is what is left of the
// plan grant for the current billing period.
export
function goatUsage
(credits, planId, periodEnd) {
  let usage, w, grant, remaining

  usage = []
  w = credits?.windowLimits
  if (w?.fiveHour?.cap > 0)
    usage.push({ key: '5h',
                 pct: usagePct(w.fiveHour.used, w.fiveHour.cap),
                 resetAt: w.fiveHour.resetAt })
  if (w?.weekly?.cap > 0)
    usage.push({ key: '1w',
                 pct: usagePct(w.weekly.used, w.weekly.cap),
                 resetAt: w.weekly.resetAt })
  grant = planGrant(planId)
  remaining = credits?.credits?.monthlyCredits
  if ((grant > 0) && Number.isFinite(remaining))
    usage.push({ key: '1m',
                 pct: usagePct(Math.max(0, grant - remaining), grant),
                 resetAt: periodEnd })
  return usage
}

export
function fmtResetIn
(at, now) {
  let ms, mins, d, h, m

  ms = resetMs(at)
  if ((ms <= 0) || isNaN(ms))
    return ''
  if (ms <= now)
    return 'resets now'
  mins = Math.ceil((ms - now) / 60000)
  d = Math.floor(mins / 1440)
  h = Math.floor((mins % 1440) / 60)
  m = mins % 60
  if (d > 0)
    return 'resets in ' + d + 'd' + (h > 0 ? ' ' + h + 'h' : '')
  if (h > 0)
    return 'resets in ' + h + 'h' + (m > 0 ? ' ' + m + 'm' : '')
  return 'resets in ' + m + 'm'
}

export
function usageHover
(usage, now) {
  return usage.map(u => {
                     let reset

                     reset = fmtResetIn(u.resetAt, now)
                     return u.key + ' ' + u.pct + '%' + (reset ? ' — ' + reset : '')
                   })
    .join('<br>')
}

export
function usageCls
(pct) {
  if (pct > 90)
    return 'code-usage-crit'
  if (pct > 80)
    return 'code-usage-warn'
  return ''
}
