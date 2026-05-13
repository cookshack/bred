import { append, divCl, img } from '../../js/dom.mjs'
import * as Css from '../../js/css.mjs'
import * as Ed from '../../js/ed.mjs'
import * as Icon from '../../js/icon.mjs'
import { d } from '../../js/mess.mjs'

import * as Util from './util.mjs'

import * as CMState from '../../lib/@codemirror/state.js'
import * as CMView from '../../lib/@codemirror/view.js'
import { patch } from '../../lib/codemirror-lang-diff.js'
import { markdown } from '../../lib/@codemirror/lang-markdown.js'
import { langs } from '../../js/wode-lang.mjs'
import { modeFor } from '../../js/wode-mode.mjs'
import { themeExtension } from '../../js/wode-theme.mjs'

export
function divW
(dir, agent) {
  return divCl('code-ww',
               [ divCl('code-h',
                       [ divCl('code-icon',
                               img(Icon.path('assist'), 'Code', 'filter-clr-text')),
                         divCl('code-title', Ed.makeMlDir(dir)),
                         divCl('code-h-right',
                               [ divCl('code-docker', ''),
                                 divCl('code-agent', agent || '', { 'data-run': 'Set Agent' }),
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

export
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
(buf, role, text, partID) {
  Util.eachCodeW(buf, (view, w) => {
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
  })
}

export
function appendThinking
(buf, text, partID) {
  Util.eachCodeW(buf, (view, w) => {
    let el

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
                  { 'data-callid': callID }))
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
  let name

  name = buf.vars('code').containerName || ''
  buf.views.forEach(view => {
    if (view.eleOrReserved) {
      let h

      h = view.eleOrReserved.querySelector('.code-h')
      if (h) {
        let el

        el = h.querySelector('.code-docker')
        if (el)
          el.innerText = name
      }
    }
  })
}
