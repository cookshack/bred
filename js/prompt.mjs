import { append, button, divCl, img, span } from './dom.mjs'

import * as Area from './Area.mjs'
import * as Buf from './Buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Ed from './ed.mjs'
import * as Em from './Em.mjs'
import * as Icon from './icon.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './Pane.mjs'
import * as Tab from './tab.mjs'
import * as Win from './win.mjs'
import { d } from './mess.mjs'

import * as PromptFile from './prompt-file.mjs'

let $callerView, ynEm, ynCb, chooseEm, chooseCb, open

export
function callerView
() {
  return $callerView
}

export
function yn
(content,
 spec, // { icon, under }
 cb) { // (yes)
  spec = spec || {}
  ynCb = cb
  demand(ynEm,
         [ divCl('float-ww',
                 divCl('float-w',
                       [ divCl('float-h',
                               [ divCl('float-icon' + (spec.icon ? '' : ' retracted'),
                                       img(Icon.path(spec.icon || 'blank'),
                                           Icon.alt(spec.icon),
                                           'filter-clr-nb3')),
                                 divCl('float-text', content),
                                 button([ span('y', 'key'), 'es' ], '', { 'data-run': 'yes' }),
                                 button([ span('n', 'key'), 'o' ], '', { 'data-run': 'no' }),
                                 button([ span('c', 'key'), 'ancel' ], '', { 'data-run': 'close demand' }) ]),
                         spec.under ])),
           divCl('float-shade') ])
}

export
function choose
(content,
 choices,
 spec, // { icon, under }
 cb) { // (choice)
  let list

  spec = spec || {}
  chooseCb = cb
  d(chooseCb)
  list = choices?.map(choice => divCl('float-choice', choice, { 'data-run': 'choose' }))
  demand(chooseEm,
         [ divCl('float-ww',
                 divCl('float-w',
                       [ divCl('float-h',
                               [ divCl('float-icon' + (spec.icon ? '' : ' retracted'),
                                       img(Icon.path(spec.icon || 'blank'),
                                           Icon.alt(spec.icon),
                                           'filter-clr-nb3')),
                                 divCl('float-text', content),
                                 button([ span('c', 'key'), 'ancel' ], '', { 'data-run': 'close choice' }) ]),
                         list,
                         spec.under ])),
           divCl('float-shade') ])
}

export
function demand
(em, co) {
  let p, area

  p = Pane.current()
  $callerView = p.view
  Area.getByName(p.win, 'bred-float')?.close()
  area = Area.add(p.win, 'bred-float')
  if (em)
    Em.replace(() => [ em ])
  append(area.el, co)
  area.show()
  return
}

export
function demandBuf
(w, spec) {
  let win, p, b, area, ml

  spec = spec || {}
  win = Win.current()
  Area.getByName(win, 'bred-float')?.close()
  area = Area.add(win, 'bred-float')
  Tab.add(area, { singleFrame: 1 })

  p = Pane.current()
  ml = w.querySelector('.edMl')
  if (ml)
    ml.innerText = 'Query replace'
  b = Buf.make({ name: 'QR',
                 modeKey: 'qr',
                 content: w,
                 dir: p.dir,
                 placeholder: spec.placeholder })
  b.vars('ed').fillParent = 0
  b.opts.set('core.autocomplete.enabled', 0)
  b.opts.set('core.brackets.close.enabled', 0)
  b.opts.set('core.folding.enabled', 0)
  b.opts.set('core.line.numbers.show', 0)
  b.opts.set('core.lint.enabled', 0)
  b.opts.set('minimap.enabled', 0)
  b.icon = 'prompt'
  area.tab.frame.pane.setBuf(b,
                             {},
                             () => {
                               area.show()
                               area.tab.frame.pane.focus()
                             })
  return p
}

export
function close
() {
  let win

  win = Win.current()
  Area.hide(win, 'bred-float')
  Em.replace()
  Area.show(win, 'bred-main')
}

function ensurePromptBuf
(parent, co, placeholder) {
  let vars, buf

  vars = parent.vars('prompt')
  if (vars.nest?.promptBuf) {
    let seen

    seen = 0
    parent.views.forEach(view => {
                           if (view.ele.querySelector('.bred-prompt-ask-nest-w'))
                             return
                           view.ele.prepend(divCl('bred-prompt-ask-nest-w retracted',
                                                  [ divCl('bred-nested-pane-w',
                                                          [],
                                                          { 'data-bred-nested-buf-id': vars.nest.promptBuf.id }) ]))
                           seen = 1
                         })
    if (seen)
      parent.nest(vars.nest.promptBuf)
    return vars
  }

  buf = Buf.make({ name: 'Nested Prompt',
                   modeKey: 'nested prompt',
                   content: Ed.divW(parent.dir,
                                    0,
                                    { ml: divCl('ml edMl', co) }),
                   dir: parent.dir,
                   placeholder })
  buf.vars('ed').fillParent = 0
  buf.opts.set('blankLines.enabled', 0)
  buf.opts.set('core.autocomplete.enabled', 0)
  buf.opts.set('core.brackets.close.enabled', 0)
  buf.opts.set('core.folding.enabled', 0)
  buf.opts.set('core.highlight.activeLine.enabled', 0)
  buf.opts.set('core.head.enabled', 0)
  buf.opts.set('core.line.numbers.show', 0)
  buf.opts.set('core.lint.enabled', 0)
  buf.opts.set('minimap.enabled', 0)
  buf.opts.set('ruler.enabled', 0)
  buf.icon = 'prompt'
  buf.vars('prompt').parent = parent

  parent.views.forEach(view => {
                         if (view.ele.querySelector('.bred-prompt-ask-nest-w'))
                           return
                         view.ele.prepend(divCl('bred-prompt-ask-nest-w retracted',
                                                [ divCl('bred-nested-pane-w',
                                                        [],
                                                        { 'data-bred-nested-buf-id': buf.id }) ]))
                       })

  parent.nest(buf)

  vars.nest = { promptBuf: buf }
  return vars
}

export
function ask
(spec, // { hist, text, onReady, placeholder, suggest, under, w }
 cb) { // (text)
  let win, p, buffer, area, tab, ml, under, placeholder

  function refresh
  () {
    if (spec.suggest) {
      Css.disable(under)
      spec.suggest(under, buffer.text(), placeholder)
    }
  }

  function onChange
  () {
    refresh()
  }

  function nest
  () {
    let parent, vars, ph

    p = Pane.current()
    parent = p.buf
    spec.hist?.reset()
    ph = spec.placeholder ?? spec.hist?.nth(0)?.toString()

    vars = ensurePromptBuf(parent,
                           [ img('', '', 'filter-clr-text bred-prompt-ask-nest-ml-icon retracted'),
                             divCl('bred-prompt-ask-nest-ml-text', spec.text || '') ],
                           ph)

    vars.nest.cb = cb
    vars.nest.hist = spec.hist

    parent.views.forEach(view => {
                           let container

                           container = view.ele.querySelector('.bred-prompt-ask-nest-w')
                           if (container) {
                             let nestedView

                             Css.expand(container)
                             nestedView = view.nestedViews?.find(nv => nv.buf == vars.nest.promptBuf)
                             if (nestedView?.ele) {
                               let mlText, mlIcon

                               mlText = nestedView.ele.querySelector('.bred-prompt-ask-nest-ml-text')
                               if (mlText)
                                 mlText.innerText = spec.text || ''
                               mlIcon = nestedView.ele.querySelector('.bred-prompt-ask-nest-ml-icon')
                               if (mlIcon)
                                 if (spec.icon) {
                                   mlIcon.src = Icon.path(spec.icon)
                                   mlIcon.alt = Icon.alt(spec.icon)
                                   Css.expand(mlIcon)
                                 }
                                 else
                                   Css.retract(mlIcon)
                             }
                             if (view == p.view && nestedView?.ele)
                               p.focusViewAt(nestedView.ele)
                           }
                         })

    if (spec.onReady)
      spec.onReady(vars.nest.promptBuf)
  }

  d('PROMPT ask')

  spec = spec || {}

  if (spec.nest)
    return nest()

  if (spec.under && spec.suggest)
    Mess.toss('under and suggest both given')

  if (spec.suggest)
    spec.under = divCl('bred-prompt-under')

  spec.w = spec.w || Ed.divW(0, 0, { extraWWCss: 'bred-prompt-buf-ww bred-prompt-attract',
                                     extraCo: [ spec.under,
                                                divCl('bred-prompt-icons',
                                                      [ divCl('bred-prompt-icon',
                                                              img(Icon.path('arrow-up'),
                                                                  '↑',
                                                                  'filter-clr-text'),
                                                              { 'data-run': 'previous history item' }),
                                                        divCl('bred-prompt-icon',
                                                              img(Icon.path('arrow-down'),
                                                                  '↓',
                                                                  'filter-clr-text'),
                                                              { 'data-run': 'next history item' }),
                                                        divCl('bred-prompt-icon',
                                                              img(Icon.path('arrow-right'),
                                                                  '→',
                                                                  'filter-clr-text'),
                                                              { 'data-run': 'ok' }) ]) ] })
  win = Win.current()
  Area.getByName(win, 'bred-float')?.close()
  area = Area.add(win, 'bred-float')

  p = Pane.current()
  ml = spec.w.querySelector('.edMl')
  if (ml)
    ml.innerText = spec.text || 'Enter text'
  placeholder = spec.placeholder ?? spec.hist?.nth(0)?.toString()
  buffer = Buf.make({ name: 'Prompt2',
                      modeKey: 'prompt2',
                      content: spec.w,
                      dir: p.dir,
                      placeholder,
                      single: 1 })
  buffer.vars('ed').fillParent = 0
  buffer.opts.set('blankLines.enabled', 0)
  buffer.opts.set('core.autocomplete.enabled', 0)
  buffer.opts.set('core.brackets.close.enabled', 0)
  buffer.opts.set('core.folding.enabled', 0)
  buffer.opts.set('core.highlight.activeLine.enabled', 0)
  buffer.opts.set('core.head.enabled', 0)
  buffer.opts.set('core.line.numbers.show', 0)
  buffer.opts.set('core.lint.enabled', 0)
  buffer.opts.set('minimap.enabled', 0)
  buffer.opts.set('ruler.enabled', 0)
  buffer.icon = 'prompt'
  buffer.vars('prompt').run = cb
  buffer.vars('prompt').orig = p.buf
  spec.hist?.reset()
  buffer.vars('prompt').hist = spec.hist
  buffer.off('change', onChange)
  tab = Tab.add(area,
                { singleFrame: 1,
                  buf: buffer,
                  setBufCb: view => {
                    d('PROMPT buf set')
                    area.show()
                    tab.frame.pane.focus()
                    spec.onReady && spec.onReady(tab.frame.pane)
                    setTimeout(() => {
                      buffer.views.forEach(v => {
                        let w

                        w = v.ele.querySelector('.bred-prompt-buf-ww')
                        Css.remove(w, 'bred-prompt-attract')
                      })
                    },
                               0.35 * 1000)
                    if (spec.suggest) {
                      under = view.ele.querySelector('.bred-prompt-under') || Mess.toss('under missing')
                      refresh()
                      buffer.on('change', onChange)
                    }
                  } })
  return p
}

export
function dir
(spec) {
  spec.dirsOnly = 1
  open(spec)
}

export
function file
(spec) {
  spec.dirsOnly = 0
  open(spec)
}

function initPrompt2
() {
  let mo

  function prevSugg
  (nth) {
    let p, under

    p = Pane.current()
    under = p.view.ele.querySelector('.bred-prompt-under')
    if (under) {
      let sug0

      sug0 = under.querySelector('.bred-prompt-sug0')
      if (sug0) {
        let sugs

        sugs = under.querySelectorAll('.bred-prompt-sug')
        if (sugs && sugs.length) {
          let el, index, sug, elImg, href

          index = sug0.dataset.index
          if (index == null)
            index = 0
          else if (nth < 0)
            index++
          else
            index--
          if (index >= sugs.length)
            index = sugs.length - 1
          if (index < 0)
            index = 0
          sug = sugs[index]
          el = sug0.firstElementChild.nextElementSibling
          href = sug.dataset.path
          sug0.dataset.index = index
          sug0.dataset.href = href

          sugs.forEach(s => Css.remove(s, 'bred-prompt-candidate'))
          Css.add(sug, 'bred-prompt-candidate')

          elImg = sug0.firstElementChild.firstElementChild
          if (href.startsWith('search://')) {
            el.innerText = href.slice('search://'.length)
            elImg.alt = '🔍'
            elImg.src = Icon.path('search')
          }
          else {
            el.innerText = href
            elImg.alt = '→'
            elImg.src = Icon.path('arrow-right')
          }
        }
      }
      else
        Mess.say("That's all")
    }
  }

  function prevHist
  (nth) {
    let p, hist

    p = Pane.current()
    hist = p.buf.vars('prompt').hist
    if (hist) {
      let prev

      prev = nth < 0 ? hist.next() : hist.prev()
      if (prev) {
        p.buf.clear()
        p.view.insert(prev)
      }
      else if (nth && (nth < 0))
        p.buf.clear()
      else
        Mess.say('End of history')
    }
  }

  function ok
  () {
    let p, cb, under, term

    p = Pane.current()
    under = p.view.ele.querySelector('.bred-prompt-under')
    if (under) {
      let sug0

      sug0 = under.querySelector('.bred-prompt-sug0')
      if (sug0)
        term = sug0.dataset.href
    }
    term = term || p.text()
    if (term.length == 0)
      term = p.buf.placeholder
    cb = p.buf.vars('prompt').run
    close()
    if (cb)
      cb(term)
  }

  mo = Mode.add('Prompt2', { hidePoint: 1,
                             viewInit: Ed.viewInit,
                             viewCopy: Ed.viewCopy,
                             initFns: Ed.initModeFns,
                             parentsForEm: 'ed' })

  Cmd.add('close buffer', () => close(), mo)
  Cmd.add('next history item', () => prevHist(-1), mo)
  Cmd.add('previous history item', () => prevHist(), mo)
  Cmd.add('next suggestion', () => prevSugg(-1), mo)
  Cmd.add('previous suggestion', () => prevSugg(), mo)
  Cmd.add('ok', () => ok(), mo)

  Em.on('ArrowUp', 'previous history item', mo)
  Em.on('ArrowDown', 'next history item', mo)
  Em.on('A-p', 'previous history item', mo)
  Em.on('A-n', 'next history item', mo)
  Em.on('C-c C-c', 'ok', mo)
  Em.on('C-g', 'close demand', mo)
  Em.on('C-n', 'next suggestion', mo)
  Em.on('C-p', 'previous suggestion', mo)
  Em.on('Escape', 'close demand', mo)
  Em.on('Enter', 'ok', mo)
}

function initNest
() {
  let mo

  function submit
  () {
    let p, parent, vars, promptBuf, text, cb

    p = Pane.current()
    parent = p.buf
    vars = parent.vars('prompt')
    if (vars.nest == null)
      return
    promptBuf = vars.nest.promptBuf
    text = promptBuf.text()
    if (text.length)
      text = text.trim()
    else
      text = promptBuf.placeholder || ''
    cb = vars.nest.cb
    vars.nest.hist?.add(text)
    promptBuf.clear()

    parent.views.forEach(view => {
                           let container

                           container = view.ele.querySelector('.bred-prompt-ask-nest-w')
                           if (container) {
                             let nestedPane

                             Css.retract(container)
                             nestedPane = container.querySelector('.pane.bred-nested.current')
                             if (nestedPane)
                               Css.remove(nestedPane, 'current')
                           }
                         })

    p.focus()
    if (cb)
      cb(text)
  }

  function cancel
  () {
    let p, parent
    let vars

    p = Pane.current()
    parent = p.buf

    vars = parent.vars('prompt')
    if (vars.nest == null)
      return

    parent.views.forEach(view => {
                           let container

                           container = view.ele.querySelector('.bred-prompt-ask-nest-w')
                           if (container) {
                             let nestedPane

                             Css.retract(container)
                             nestedPane = container.querySelector('.pane.bred-nested.current')
                             if (nestedPane)
                               Css.remove(nestedPane, 'current')
                           }
                         })

    p.focus()
  }

  function prevHist
  () {
    let p, parent, vars

    p = Pane.current()
    parent = p.buf
    vars = parent.vars('prompt')
    if (vars.nest?.hist)
      vars.nest.hist.prev(vars.nest.promptBuf)
  }

  function nextHist
  () {
    let p, parent, vars

    p = Pane.current()
    parent = p.buf
    vars = parent.vars('prompt')
    if (vars.nest?.hist)
      vars.nest.hist.next(vars.nest.promptBuf)
  }

  mo = Mode.add('Nested Prompt', { viewInit: Ed.viewInit,
                                   viewCopy: Ed.viewCopy,
                                   initFns: Ed.initModeFns,
                                   parentsForEm: 'ed' })

  Cmd.add('submit', () => submit(), mo)
  Cmd.add('cancel', () => cancel(), mo)
  Cmd.add('next history item', () => nextHist(), mo)
  Cmd.add('previous history item', () => prevHist(), mo)

  Em.on('Enter', 'submit', mo)
  Em.on('C-g', 'cancel', mo)
  Em.on('Escape', 'cancel', mo)
  Em.on('A-p', 'previous history item', mo)
  Em.on('A-n', 'next history item', mo)
}

export
function init
() {
  let mo, buf

  function run
  () {
    let p, text, orig

    function run1
    () {
      let cb

      cb = buf.vars('Prompt').run
      if (cb)
        cb(p, text)
    }

    p = Pane.current()
    text = p.text()
    orig = buf.vars('Prompt').orig
    if (orig)
      p.setBuf(orig, {}, () => run1())
    else
      run1()
  }

  Cmd.add('yes', () => {
                   Cmd.run('close demand')
                   ynCb && ynCb(1)
                 })
  Cmd.add('no', () => {
                  Cmd.run('close demand')
                  ynCb && ynCb(0)
                })
  Cmd.add('close yes/no', () => {
                            ynCb = null
                            Cmd.run('close demand')
                          })
  Cmd.add('close choice', () => {
                            chooseCb = null
                            Cmd.run('close demand')
                          })
  Cmd.add('choose', (u, we) => {
                      Cmd.run('close demand')
                      if (chooseCb) {
                        let choice

                        choice = we.e.target.innerText
                        chooseCb(choice)
                      }
                    })

  ynEm = Em.make('YN')
  ynEm.on('y', 'yes')
  ynEm.on('n', 'no')
  ynEm.on('c', 'close yes/no')
  Em.on('C-g', 'close yes/no', ynEm)
  Em.on('Escape', 'close yes/no', ynEm)

  chooseEm = Em.make('Choose')
  chooseEm.on('y', 'yes')
  chooseEm.on('n', 'no')
  chooseEm.on('c', 'close yes/no')
  Em.on('C-g', 'close yes/no', chooseEm)
  Em.on('Escape', 'close yes/no', chooseEm)

  mo = Mode.add('Prompt', { viewInit: Ed.viewInit,
                            viewCopy: Ed.viewCopy,
                            initFns: Ed.initModeFns,
                            parentsForEm: 'ed' })

  Cmd.add('run', () => run(), mo)

  Em.on('Enter', 'run', mo)

  Em.on('C-g', 'close buffer', mo)
  Em.on('Escape', 'close buffer', mo)
  Em.on('C-c', 'run', mo)

  initPrompt2()
  open = PromptFile.init()

  initNest()
}
