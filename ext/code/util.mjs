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
function makeRelative
(buf, path) {
  if (path?.startsWith(buf.dir))
    return path.slice(buf.dir.length)
  return path
}

export
function getProvider
(buf) {
  return (buf && buf.vars('code').provider) || Opt.get('code.provider.agent') || 'opencode-go'
}

export
function getModel
(buf) {
  return (buf && buf.vars('code').model) || Opt.get('code.model.agent') || 'deepseek-v4-pro'
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
