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
