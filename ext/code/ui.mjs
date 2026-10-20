import { append, divCl, img, span } from '../../js/dom.mjs'
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
                                         divCl('code-under code-under-version', ''),
                                         divCl('code-under code-under-tokens', '') ]) ]) ]),
                 divCl('code-prompt-w retracted',
                       [ divCl('code-prompt-ml',
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
                          if (tokenEl)
                            if (tokenInfo)
                              tokenEl.innerText = tokenInfo
                            else
                              tokenEl.innerText = ''
                        }
                      }
                    })
}

export
function appendMsg
(buf, role, text, partID, at, spec) {
  Util.eachCodeW(buf, (view, w) => {
                        let contentEl, mdResult, messageID, tsText, now, h, m, s

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

                        now = at ? new Date(at) : new Date()
                        h = String(now.getHours()).padStart(2, '0')
                        m = String(now.getMinutes()).padStart(2, '0')
                        s = String(now.getSeconds()).padStart(2, '0')
                        tsText = h + 'h' + m + ':' + s

                        if (role == 'user')
                          contentEl = divCl('code-msg-text' + (text ? '' : ' code-msg-hidden'), text)
                        else if (spec?.log)
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
                                          span(tsText, 'code-msg-timestamp'),
                                          span('⋯', 'code-msg-menu', { 'data-run': 'message menu' }) ],
                                        { 'data-messageid': messageID || '' }))
                        }
                        else
                          appendX(w,
                                  divCl('code-msg code-msg-assistant' + (spec?.log ? ' code-msg-log' : ''),
                                        [ contentEl ],
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

export
function appendThinking
(buf, text, partId) {
  let codeW

  codeW = buf.anyView(1)?.eleOrReserved?.querySelector('.code-w')
  if (codeW?.querySelector('.code-msg-thinking[data-partid="' + partId + '"]')) {
    chunkThink(buf, partId, text)
    return
  }

  Util.eachCodeW(buf, (view, w) => {
                        appendX(w,
                                divCl('code-msg code-msg-thinking',
                                      [ divCl('code-msg-text', text) ],
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
                        let els, underEl

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
                                              [ (underEl ? divCl('code-msg-arrow', '', { 'data-run': 'toggle details' }) : Util.iconRightArrow()),
                                                ' ',
                                                label ]),
                                        underEl ],
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
// usable because .code-w is not a positioned element).
function msgTops
(w, els) {
  let rect

  rect = w.getBoundingClientRect()
  return els.map(el => Math.round(el.getBoundingClientRect().top - rect.top + w.scrollTop))
}

function scrollMsgW
(w, dir) {
  let els, i, tops

  els = msgEls(w)
  tops = msgTops(w, els)
  i = dir < 0 ? prevMsgIndex(tops, w.scrollTop)
              : nextMsgIndex(tops, w.scrollTop, halfRem(w))
  if (i < 0)
    w.scrollTop = dir < 0 ? 0 : w.scrollHeight
  else {
    els[i].scrollIntoView({ block: 'start', behavior: 'instant' })
    w.scrollTop -= halfRem(w)
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
                                             'code-msg-timestamp'),
                                        span(model,
                                             'code-msg-model',
                                             { 'data-run': 'set code model' }),
                                        span(cost,
                                             'code-msg-cost') ],
                                      { 'data-messageid': messageID || '' }))
                      })
}
