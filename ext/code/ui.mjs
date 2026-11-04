import { append, create, divCl, img, span } from '../../js/dom.mjs'
import * as Css from '../../js/css.mjs'
import * as Ed from '../../js/ed.mjs'
import * as Icon from '../../js/icon.mjs'
import { d } from '../../js/mess.mjs'

import * as Util from './util.mjs'
import { extTables, padTableText } from './tables.mjs'

import * as CMState from '../../lib/@codemirror/state.js'
import * as CMView from '../../lib/@codemirror/view.js'
import { patch } from '../../js/wode-lang-patch.mjs'
import { markdown, markdownLanguage } from '../../lib/@codemirror/lang-markdown.js'
import { langs } from '../../js/wode-lang.mjs'
import { modeFor } from '../../js/wode-mode.mjs'
import { themeExtension } from '../../js/wode-theme.mjs'

import { hideMarks } from './md.mjs'

import { atEnd, makeStick, nextMsgIndex, prevMsgIndex } from './scroll.mjs'

export { atEnd }

export
function divW
(dir, agent) {
  let navDown, navUp

  navUp = divCl('code-nav-up', img(Icon.path('arrow-up'), 'Previous message', 'filter-clr-text'),
                { 'data-run': 'message prev' })
  navDown = divCl('code-nav-down', img(Icon.path('arrow-down'), 'Next message', 'filter-clr-text'),
                  { 'data-run': 'message next' })

  return divCl('code-ww',
               [ divCl('code-h',
                       [ divCl('code-icon',
                               img(Icon.modePath('code'), 'Code', 'filter-clr-text')),
                         divCl('code-title', Ed.makeMlDir(dir)),
                         divCl('code-h-right',
                               [ divCl('code-docker onfill',
                                       [ img(Icon.path('docker'), 'Docker', 'filter-clr-text'),
                                         span('', 'code-docker-name') ],
                                       { 'data-run': 'docker details', 'data-id': '' }),
                                 divCl('code-agent', Util.iconAgent() + (agent || ''), { 'data-run': 'Set Agent' }),
                                 divCl('code-thought code-icon',
                                       img(Icon.path('thinking.active'), 'Thinking', 'filter-clr-text'),
                                       { 'data-run': 'toggle thinking' }),
                                 divCl('code-nav', [ navUp, navDown ]) ]) ]),
                 divCl('code-w bred-scroller',
                       [ divCl('code-session-title'),
                         divCl('code-under-w',
                               [ divCl('code-under code-under-status'),
                                 divCl('code-under code-under-model'),
                                 divCl('code-under-end',
                                       [ divCl('code-under code-under-credits', ''),
                                         divCl('code-under code-under-usage', ''),
                                         divCl('code-under code-under-version', ''),
                                         divCl('code-under code-under-tokens', '') ]) ]) ]),
                 divCl('code-prompt-w retracted',
                       [ divCl('code-prompt-mounts'),
                         divCl('code-prompt-ml',
                               [ divCl('code-prompt-model onfill', '', { 'data-run': 'set code model' }),
                                 span('↵', 'code-submit onfill', { 'data-run': 'code submit' }) ]),
                         divCl('code-prompt-scroll',
                               divCl('bred-nested-pane-w')) ]) ])
}

function scroll
(underW) {
  //d('CO SCROLL')
  underW.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'instant' })
}

let sticks

sticks = new WeakMap()

// whether w should stay pinned to the end (until the user scrolls away)
function stick
(w) {
  let fn

  fn = sticks.get(w)
  if (fn == null) {
    fn = makeStick(w)
    sticks.set(w, fn)
  }
  return fn()
}

export
function keepAtEnd
(w) {
  let underW

  underW = w.querySelector('.code-under-w')
  if (underW)
    scroll(underW)
}

export
function withScroll
(w, cb) { // (underW)
  let underW, wasVisible

  underW = w.querySelector('.code-under-w') || d('CO underW missing')

  wasVisible = stick(w)
  //d({ wasVisible })

  if (cb)
    cb(underW)

  if (wasVisible && underW)
    scroll(underW)
}

export
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
(text, decorate) {
  let el, state, ed, exts

  exts = [ CMView.EditorView.editable.of(false),
           CMView.EditorView.lineWrapping,
           markdown({ base: markdownLanguage,
                      codeLanguages: langs }),
           themeExtension ]
  if (decorate)
    exts.push(hideMarks, extTables)
  el = divCl('code-markdown-ed')
  state = CMState.EditorState.create({ doc: padTableText(text),
                                       extensions: exts })
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

export
function updateStatus
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
                          if (tokenEl) {
                            let i

                            // the colon reads as a separator, not as the T: label
                            i = (tokenInfo || '').indexOf(':')
                            tokenEl.innerText = ''
                            if (i > 0)
                              append(tokenEl, [ tokenInfo.slice(0, i),
                                                span(':', 'code-under-token-colon'),
                                                tokenInfo.slice(i + 1) ])
                            else if (tokenInfo)
                              tokenEl.innerText = tokenInfo
                          }
                        }
                      }
                    })
}

// Goat quota windows (5h/weekly/monthly), shown as eg 12%/34%/56%. The hover
// text is recomputed on mouseenter so its countdown stays current without a
// timer or another request.
export
function updateUsage
(buf, usage) {
  buf.views.forEach(view => {
                      let el

                      el = view.eleOrReserved?.querySelector('.code-under-usage')
                      if (el) {
                        let parts

                        parts = []
                        el.innerText = ''
                        if (usage)
                          usage.forEach((u, i) => {
                                          if (i > 0)
                                            parts.push(span('/', 'code-usage-sep'))
                                          parts.push(span(u.pct + '%', Util.usageCls(u.pct)))
                                        })
                        append(el, parts)
                        if (usage)
                          el.dataset.hover = Util.usageHover(usage, Date.now())
                        else
                          delete el.dataset.hover
                        el.onmouseenter = () => {
                                            let current

                                            current = buf.vars('code').goatUsage
                                            if (current)
                                              el.dataset.hover = Util.usageHover(current, Date.now())
                                          }
                      }
                    })
}

// Render the mount checkbox grid into el. state is { candidates, mounts, locked }
// and state.mounts is mutated in place. onChange re-renders, eg every view of a
// code buffer or the single container in the session-open demand.
export
function renderMounts
(el, state, onChange) {
  let parts

  function toggle
  (c, checked) {
    if (checked) {
      if (state.mounts.includes(c.path) == 0)
        state.mounts.push(c.path)
    }
    else {
      let i

      i = state.mounts.indexOf(c.path)
      if (i >= 0)
        state.mounts.splice(i, 1)
    }
    if (onChange)
      onChange()
  }

  parts = []
  el.innerText = ''
  if (state.candidates?.length) {
    state.candidates.forEach(c => {
                               let input, label

                               input = create('input', [],
                                              'code-prompt-mount-check',
                                              { type: 'checkbox' })
                               input.checked = state.mounts.includes(c.path) ? 1 : 0
                               input.onmousedown = e => e.preventDefault()
                               label = create('label',
                                              [ input,
                                                span(c.label + (c.ro ? ' (ro)' : ''),
                                                     'code-prompt-mount-name') ],
                                              'code-prompt-mount')
                               label.dataset.hover = c.path + (c.ro ? ' (read-only)' : '')
                               label.dataset.native = '1'
                               label.onmousedown = e => e.preventDefault()
                               if (state.locked)
                                 input.disabled = 1
                               else
                               // bred prevents click defaults, so toggle
                               // ourselves and keep focus in the editor
                                 label.onclick = e => {
                                                   e.preventDefault()
                                                   toggle(c, state.mounts.includes(c.path) == 0)
                                                 }
                               parts.push(label)
                             })
    if (state.locked)
      parts.push(span('(fixed)', 'code-prompt-mount-fixed'))
  }
  append(el, parts)
}

// Mounts for the first prompt of a code buffer. Real checkboxes, with mousedown
// cancelled so clicking one does not take focus from the prompt editor (bred's
// key handler prevents every keydown, so a focused checkbox would block typing).
export
function updateMounts
(buf, candidates) {
  let state

  if (candidates?.length && (buf.vars('code').mounts == null))
    buf.vars('code').mounts = candidates.map(c => c.path)
  state = { candidates,
            mounts: buf.vars('code').mounts || [],
            locked: buf.vars('code').mountsLocked }

  buf.views.forEach(view => {
                      let el

                      el = view.eleOrReserved?.querySelector('.code-prompt-mounts')
                      if (el)
                        renderMounts(el, state, () => updateMounts(buf, candidates))
                    })
}

// A prompt is drawn before the server answers with its real message id, so
// swap the placeholder for the id the server knows (revert, message.get etc).
export
function setMessageID
(buf, fromID, toID) {
  for (let view of buf.views) {
    let w

    w = view.eleOrReserved?.querySelector('.code-w')
    if (w)
      for (let el of w.querySelectorAll('[data-messageid="' + fromID + '"]'))
        el.dataset.messageid = toID
  }
}

// Drop every rendered message so the transcript can be rendered again (eg
// after a revert deleted messages on the server).
export
function clearMsgs
(buf) {
  buf.vars('code').partTexts = {}
  buf.vars('code').curMessageID = 0
  buf.vars('code').callLabels = {}
  for (let view of buf.views) {
    let w

    view.vars('code').eds?.forEach(ed => ed.destroy())
    view.vars('code').eds = []
    view.vars('code').partEds = {}
    view.vars('code').partEls = new Map()
    w = view.eleOrReserved?.querySelector('.code-w')
    if (w)
      for (let el of [ ...w.children ])
        // the header and footer of the message area stay
        if ([ 'code-session-title', 'code-under-w' ].includes(el.classList[0]) == 0)
          el.remove()
  }
}

// Per-part time and menu, overlaid on the message (see .code-msg-foot in
// code.css).
function msgFoot
(at) {
  return divCl('code-msg-foot',
               [ at ? span(ts(at),
                           'code-msg-timestamp',
                           { 'data-hover': fullDate(at) }) : 0,
                 span('⋯', 'code-msg-menu', { 'data-run': 'message menu' }) ])
}

export
function appendMsg
(buf, role, text, partID, at, spec) {
  Util.eachCodeW(buf, (view, w) => {
                        let contentEl, mdResult, messageID, tsText

                        messageID = spec?.messageID ?? buf.vars('code').curMessageID

                        if (role == 'user') {
                        }
                        else {
                          let el

                          el = w.querySelector('.code-msg-assistant[data-partid="' + partID + '"]')
                          if (el) {
                            let ed

                            ed = view.vars('code').partEds?.[partID]
                            if (ed) {
                              buf.vars('code').partTexts = buf.vars('code').partTexts || {}
                              buf.vars('code').partTexts[partID] = text
                            }
                            else {
                              let oldMdEl

                              oldMdEl = el.querySelector('.code-markdown-ed')
                              if (oldMdEl) {
                                let mdEd

                                mdEd = makeMarkdownEd(text, 1)
                                withScroll(w, () => oldMdEl.replaceWith(mdEd.el))
                                view.vars('code').eds = view.vars('code').eds || []
                                view.vars('code').eds.push(mdEd.ed)
                                buf.vars('code').partTexts = buf.vars('code').partTexts || {}
                                buf.vars('code').partTexts[partID] = text
                                view.vars('code').partEds = view.vars('code').partEds || {}
                                view.vars('code').partEds[partID] = mdEd.ed
                              }
                            }
                            return
                          }
                        }

                        // A part knows when it was sent; anything else (eg an
                        // errored out turn) has no time to show.
                        tsText = at ? ts(at) : ''

                        if (role == 'user')
                          contentEl = divCl('code-msg-text' + (text ? '' : ' code-msg-hidden'), text)
                        else if (spec?.log || spec?.stopped)
                          contentEl = divCl('code-msg-text', text || '')
                        else {
                          mdResult = makeMarkdownEd(text || '', 1)
                          contentEl = mdResult.el
                        }
                        if (role == 'user') {
                          let agentEl

                          appendX(w,
                                  divCl('code-msg code-msg-user',
                                        [ contentEl ],
                                        { 'data-partid': partID || 0,
                                          'data-messageid': messageID || '' }))
                          agentEl = spec?.agent ? span(Util.iconAgent() + spec.agent, 'code-msg-agent') : 0
                          appendX(w,
                                  divCl('code-msg-ts code-msg-ts-user',
                                        [ agentEl,
                                          span(tsText || ts(),
                                               'code-msg-timestamp',
                                               { 'data-hover': fullDate(at) }),
                                          span('⋯', 'code-msg-menu', { 'data-run': 'message menu' }) ],
                                        { 'data-messageid': messageID || '' }))
                        }
                        else
                          appendX(w,
                                  divCl('code-msg code-msg-assistant'
                                        + (spec?.log ? ' code-msg-log' : '')
                                        + (spec?.subagent ? ' code-msg-subagent' : '')
                                        + (spec?.stopped ? ' code-msg-stopped' : ''),
                                        [ contentEl,
                                          spec?.log ? 0 : msgFoot(at) ],
                                        { 'data-partid': partID || 0,
                                          'data-messageid': messageID || '' }))
                        if (mdResult) {
                          view.vars('code').eds = view.vars('code').eds || []
                          view.vars('code').eds.push(mdResult.ed)
                          buf.vars('code').partTexts = buf.vars('code').partTexts || {}
                          buf.vars('code').partTexts[partID] = text || ''
                          view.vars('code').partEds = view.vars('code').partEds || {}
                          view.vars('code').partEds[partID] = mdResult.ed
                        }
                        if (role == 'user') {
                          let underW

                          underW = w.querySelector('.code-under-w')
                          scroll(underW)
                        }
                      })
}

// Server/spawn log lines are useful but can pile up over a long-lived buffer,
// so keep only the newest ones.
export
function appendServerLog
(buf, text) {
  let maxServerLogs

  maxServerLogs = 20
  appendMsg(buf, 0, text, undefined, undefined, { log: 1 })
  Util.eachCodeW(buf, (view, w) => {
                        let els, excess, beforeTop, beforeH, afterH

                        els = w.querySelectorAll('.code-msg-log')
                        excess = els.length - maxServerLogs
                        if (excess <= 0)
                          return
                        beforeTop = w.scrollTop
                        beforeH = w.scrollHeight
                        for (let i = 0; i < excess; i++)
                          els[i].remove()
                        if (stick(w))
                          return
                        afterH = w.scrollHeight
                        w.scrollTop = beforeTop - (beforeH - afterH)
                      })
}

// The Task label for a subagent call, with the marker tinted so it reads as
// "green means subagent output".
export
function subagentLabel
(part) {
  return [ span('Task', 'code-msg-subagent-task'), Util.subagentLabel(part).slice(4) ]
}

export
function appendThinking
(buf, text, partId, at) {
  let codeW

  codeW = buf.anyView(1)?.eleOrReserved?.querySelector('.code-w')
  if (codeW?.querySelector('.code-msg-thinking[data-partid="' + partId + '"]')) {
    chunkThink(buf, partId, text)
    return
  }

  Util.eachCodeW(buf, (view, w) => {
                        appendX(w,
                                divCl('code-msg code-msg-thinking',
                                      [ divCl('code-msg-text', text),
                                        msgFoot(at) ],
                                      { 'data-partid': partId || 0,
                                        'data-messageid': buf.vars('code').curMessageID || '' }))
                      })
}

export
function appendToolMsg
(buf, callID, label, under, spec) {
  spec = spec || {}
  if (callID) {
    buf.vars('code').callLabels = buf.vars('code').callLabels || {}
    buf.vars('code').callLabels[callID] = label
  }
  Util.eachCodeW(buf, (view, w) => {
                        let els, underEl, alwaysEl, resultEl

                        els = w.querySelectorAll('.code-msg-tool[data-callid="' + callID + '"]')
                        els?.forEach(el => el.remove())
                        if (spec.always)
                          alwaysEl = divCl('code-msg-text code-msg-prompt', spec.always)
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
                        if (spec.result)
                          resultEl = divCl('code-msg-text code-msg-under code-msg-result', spec.result)
                        appendX(w,
                                divCl('code-msg code-msg-tool',
                                      [ divCl('code-msg-text',
                                              [ ((underEl || resultEl) ? divCl('code-msg-arrow', '', { 'data-run': 'toggle details' }) : Util.iconRightArrow()),
                                                ' ',
                                                span(label, 'code-msg-label') ]),
                                        alwaysEl,
                                        underEl,
                                        resultEl ],
                                      { 'data-callid': callID,
                                        'data-messageid': (spec.messageID ?? buf.vars('code').curMessageID) || '' }))
                      })
  if (callID && label)
    Util.eachCodeW(buf, (view, w) => {
                          let permEl

                          permEl = w.querySelector('.code-msg-permission[data-permission-callid="' + callID + '"]')
                          if (permEl) {
                            let labelEl

                            labelEl = permEl.querySelector('.code-msg-label')
                            if (labelEl)
                              labelEl.innerText = label
                            else {
                              let patternEl

                              patternEl = permEl.querySelector('.code-msg-pattern')
                              labelEl = divCl('code-msg-label', label)
                              if (patternEl)
                                patternEl.before(labelEl)
                              else
                                permEl.append(labelEl)
                            }
                          }
                        })
}

// Update just the label of an existing tool message, leaving its details (and
// their codemirror) alone. Used by execute, whose nested call count streams.
export
function updateToolLabel
(buf, callID, label) {
  Util.eachCodeW(buf, (view, w) => {
                        let el

                        el = w.querySelector('.code-msg-tool[data-callid="' + callID + '"] .code-msg-label')
                        if (el)
                          el.innerText = label
                      })
}

export
function toolHasCode
(buf, callID) {
  return buf.views.some(view => Boolean(view.eleOrReserved?.querySelector('.code-msg-tool[data-callid="' + callID + '"] .code-code-ed')))
}

// Add the tool's output to an existing message, below its code/details. The
// result shares the under styling so the existing toggle hides/shows it too.
export
function appendToolResult
(buf, callID, result) {
  Util.eachCodeW(buf, (view, w) => {
                        let el, resultEl, underEl

                        el = w.querySelector('.code-msg-tool[data-callid="' + callID + '"]')
                        if ((el == null) || (result == null) || (result.length == 0))
                          return
                        if (el.querySelector('.code-msg-result'))
                          return
                        resultEl = divCl('code-msg-text code-msg-under code-msg-result', result)
                        underEl = el.querySelector('.code-msg-under, .code-code-ed, .code-patch-ed')
                        if (underEl)
                          underEl.after(resultEl)
                        else
                          el.append(resultEl)
                      })
}

export
function updateDocker
(buf) {
  let name, id

  name = buf.vars('code').containerName || ''
  id = buf.vars('code').containerID || ''
  buf.views.forEach(view => {
                      if (view.eleOrReserved) {
                        let h

                        h = view.eleOrReserved.querySelector('.code-h')
                        if (h) {
                          let dockerEl, el

                          dockerEl = h.querySelector('.code-docker')
                          if (dockerEl)
                            dockerEl.dataset.id = id
                          el = h.querySelector('.code-docker-name')
                          if (el)
                            el.innerText = name
                        }
                      }
                    })
}

export
function chunkThink
(buf, partId, delta) {
  let chunks

  chunks = Util.ensureThinkChunks(buf)
  chunks[partId] = (chunks[partId] || '') + delta
  if (buf.vars('code').thinkPending)
    return
  buf.vars('code').thinkPending = 1
  globalThis.requestAnimationFrame(() => flushThink(buf))
}

export
function flushThink
(buf) {
  let chunks

  chunks = buf.vars('code').thinkChunks
  if (chunks) {
    buf.vars('code').thinkChunks = {}
    buf.vars('code').thinkPending = 0

    Util.eachCodeW(buf, (view, w) => {
                          for (let [ partID, text ] of Object.entries(chunks)) {
                            let el

                            el = w.querySelector('.code-msg-thinking[data-partid="' + partID + '"]')
                            if (el) {
                              let textEl

                              textEl = el.querySelector('.code-msg-text')
                              if (textEl)
                                withScroll(w, () => textEl.innerText = (textEl.innerText || '') + text)
                            }
                          }
                        })
  }
}

function laterTick
(underW, w) {
  if (stick(w))
    scroll(underW)
}

export
function chunkText
(buf, partId, delta) {
  let chunks

  globalThis.clearTimeout(buf.vars('code').finalizeTimer)
  chunks = Util.ensureTextChunks(buf)
  chunks[partId] = (chunks[partId] || '') + delta
  buf.vars('code').partTexts = buf.vars('code').partTexts || {}
  buf.vars('code').partTexts[partId] = (buf.vars('code').partTexts[partId] || '') + delta
  if (buf.vars('code').textPending)
    return
  buf.vars('code').textPending = 1
  globalThis.requestAnimationFrame(() => flushText(buf))
}

export
function flushText
(buf) {
  let chunks

  chunks = buf.vars('code').textChunks
  if (chunks) {
    buf.vars('code').textChunks = {}
    buf.vars('code').textPending = 0

    Util.eachCodeW(buf, (view, w) => {
                          let eds

                          eds = view.vars('code').partEds
                          for (let partID of Object.keys(chunks))
                            if (eds?.[partID]) {
                              let ed, delta, tr, underW, wasVisible

                              ed = eds[partID]
                              delta = chunks[partID]
                              tr = { changes: { from: ed.state.doc.length, to: ed.state.doc.length, insert: delta } }
                              underW = w.querySelector('.code-under-w')
                              wasVisible = underW && stick(w)
                              ed.dispatch(tr)
                              // CM defers DOM writes; re-check scroll next frame
                              if (wasVisible && underW)
                                globalThis.requestAnimationFrame(() => laterTick(underW, w))
                            }
                        })
    globalThis.clearTimeout(buf.vars('code').finalizeTimer)
    buf.vars('code').finalizeTimer = globalThis.setTimeout(() => finalizeText(buf), 500)
  }
}

export
function finalizeText
(buf) {
  let parts

  parts = buf.vars('code').partTexts
  if (parts)
    Util.eachCodeW(buf, (view, w) => {
                          let eds

                          eds = view.vars('code').partEds
                          if (eds)
                            for (let partID of Object.keys(eds)) {
                              let raw, padded, ed, tr

                              raw = parts[partID]
                              if (raw == null)
                                continue
                              padded = padTableText(raw)
                              ed = eds[partID]
                              if (padded == ed.state.doc.toString())
                                continue
                              tr = { changes: { from: 0, to: ed.state.doc.length, insert: padded } }
                              withScroll(w, () => ed.dispatch(tr))
                            }
                        })
}

function ts
(at) {
  let now, h, m, s

  now = at ? new Date(at) : new Date()
  h = String(now.getHours()).padStart(2, '0')
  m = String(now.getMinutes()).padStart(2, '0')
  s = String(now.getSeconds()).padStart(2, '0')
  return h + 'h' + m + ':' + s
}

// Full local date for the timestamp hovers; the labels themselves only show
// the time of day.
function fullDate
(at) {
  let dt, pad

  pad = n => String(n).padStart(2, '0')
  dt = at ? new Date(at) : new Date()
  return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate())
    + ' ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + ':' + pad(dt.getSeconds())
}

// The bit of the previous message to leave visible above a jumped-to one. Also
// used as the step size so a repeated click keeps advancing.
function halfRem
(w) {
  return Math.round(0.5 * parseFloat(globalThis.getComputedStyle(w).fontSize))
}

function msgEls
(w) {
  return [ ...w.querySelectorAll('.code-msg-user') ]
}

// Top of each message in the scroller's scroll coordinates (offsetTop is not
// usable because .code-w is not a positioned element). Keep them fractional:
// rounding would fight the sub-pixel snapping the browser does on scroll.
function msgTops
(w, els) {
  let rect

  rect = w.getBoundingClientRect()
  return els.map(el => el.getBoundingClientRect().top - rect.top + w.scrollTop)
}

function scrollMsgW
(w, dir) {
  let els, i, pad, tops

  els = msgEls(w)
  tops = msgTops(w, els)
  pad = halfRem(w)
  i = dir < 0 ? prevMsgIndex(tops, w.scrollTop)
              : nextMsgIndex(tops, w.scrollTop, pad, w.scrollHeight - w.clientHeight)
  if (i < 0)
    w.scrollTop = dir < 0 ? 0 : w.scrollHeight
  else {
    els[i].scrollIntoView({ block: 'start', behavior: 'instant' })
    w.scrollTop -= pad
  }
}

// Header nav: step to the previous (dir < 0) or next user message.
export
function navMsg
(we, dir) {
  let w

  w = we?.e?.target?.closest?.('.code-ww')?.querySelector('.code-w')
  if (w)
    scrollMsgW(w, dir)
}

export
function appendModel
(buf, model, cost, at, messageID) {
  Util.eachCodeW(buf, (view, w) => {
                        messageID = messageID ?? buf.vars('code').curMessageID
                        appendX(w,
                                divCl('code-msg code-msg-role',
                                      [ span('⋯', 'code-msg-menu', { 'data-run': 'message menu' }),
                                        span(ts(at),
                                             'code-msg-timestamp',
                                             { 'data-hover': fullDate(at) }),
                                        span(model,
                                             'code-msg-model',
                                             { 'data-run': 'set code model' }),
                                        span(cost,
                                             'code-msg-cost') ],
                                      { 'data-messageid': messageID || '' }))
                      })
}
