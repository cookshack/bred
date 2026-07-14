import { button, divCl, img, span } from './dom.mjs'

import * as Bred from './bred.mjs'
import * as Buf from './Buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Cut from './cut.mjs'
import * as Dom from './dom.mjs'
import * as Em from './Em.mjs'
import * as Hist from './hist.mjs'
import * as Icon from './icon.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Opt from './opt.mjs'
import * as Pane from './Pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Timing from './timing.mjs'
import * as Tron from './tron.mjs'
import * as U from './util.mjs'
import * as View from './view.mjs'
import { d } from './mess.mjs'

import escapeStringRegexp from '../lib/escape-string-regexp.js'

import mbe from '../lib/mime-by-ext.json' with { type: 'json' }

export let Backend
export let makeRange
export let mimeByExt
export let viewCopy
export let viewInit
export let viewReopen
export let vfind
export let emRevert
export let backend
export let ctags

let bepRow, bepCol, bepGt, bepGtEq, bepLt, bepLtEq, posRow, posCol, tokenRe, nonTokenRe, onCursors
let bepToPos, offToBep, posToBep
let pageBreakRe, pageCmds

export { bepRow, bepCol, bepGt, bepGtEq, bepLt, bepLtEq, posRow, posCol, tokenRe, nonTokenRe, onCursors }
export { bepToPos, offToBep, posToBep }

mimeByExt = mbe

export
function divMl
(dir, name, opts) {
  opts = opts || {}
  return divCl('ml edMl' + (opts.hideMl ? ' retracted' : ''),
               [ divCl('edMl-type',
                       img(Icon.path(opts.icon || 'blank'), 'Blank', 'filter-clr-text'),
                       { 'data-run': 'describe buffer' }),
                 divCl('edMl-mod',
                       img(Icon.path('blank'), 'Modified', 'filter-clr-text')),
                 divCl('edMl-file', name || ''),
                 divCl('edMl-dir', makeMlDir(dir)),
                 divCl('ml-close') ])
}

export
function divW
(dir, name, opts) {
  opts = opts || {}
  return divCl('edWW' + (opts.extraWWCss ? (' ' + opts.extraWWCss) : ''),
               [ opts.ml || divMl(dir, name, opts),
                 opts.extraBefore,
                 divCl('bred-info-www',
                       divCl('bred-info-ww')),
                 divCl('edW' + (opts.extraWCss ? (' ' + opts.extraWCss) : '')),
                 opts.extraCo ])
}

export
function posRowDecr
(pos) {
  if (pos?.lineNumber) {
    pos.lineNumber--
    pos.row = pos.lineNumber - 1
    return pos.row
  }
  if (pos?.row) {
    pos.row--
    pos.lineNumber = pos.row + 1
    return pos.row
  }
  return 0
}

export
function posRowIncr
(pos) {
  if (pos?.lineNumber) {
    pos.lineNumber++
    pos.row = pos.lineNumber - 1
    return pos.row
  }
  if (pos?.row) {
    pos.row++
    pos.lineNumber = pos.row + 1
    return pos.row
  }
  return 0
}

export
function themeExtension
() {
  return Backend.themeExtension
}

export
function langs
() {
  return Backend.langs || []
}

export
function make
(p,
 spec, // { name, dir, file, lineNum }
 whenReady) { // (view)
  let modeKey

  function makeBuf
  () {
    let icon

    icon = modeKey && Icon.mode(modeKey)?.name
    p.setBuf(Buf.add(spec.name || spec.file,
                     modeKey || 'ed',
                     divW(spec.dir,
                          spec.name || spec.file,
                          { icon }),
                     spec.dir,
                     { file: spec.file,
                       lineNum: spec.lineNum }),
             { lineNum: spec.lineNum },
             view => {
               p.buf.icon = icon
               spec.file || (p.buf.file = spec.name)
               if (whenReady)
                 whenReady(view)
             })
  }

  if (spec.file)
    modeKey = Backend.modeFor(spec.file)
  else if (spec.name)
    modeKey = Backend.modeFor(spec.name)
  if (spec.file)
    spec.file = Loc.make(spec.file).removeSlash() // for name
  if (Loc.make(spec.file).filename == spec.file) {
    let exist

    spec.dir = Loc.make(spec.dir)
    spec.dir.ensureSlash()
    if (spec.file)
      exist = Buf.find(b => (b.fileType == 'file') && (b.file == spec.file) && (b.dir == spec.dir.path))
    if (exist) {
      p.setBuf(exist, { lineNum: spec.lineNum }, whenReady)
      return
    }
    if (U.isDefined(spec.lineNum))
      makeBuf()
    else {
      let path

      spec.dir = Buf.prepDir(spec.dir)
      path = spec.dir + spec.file
      d('get pos')
      Tron.cmd1('profile.get', [ 'poss', path ], (err, resp) => {
                                                   if (err)
                                                     Mess.log('Error getting line num of ' + path + ', will use 1: ' + err.message)
                                                   else if (resp.data)
                                                     spec.lineNum = resp.data.row + 1
                                                   d('make buf')
                                                   makeBuf()
                                                 })
    }
  }
  else
    Mess.warn('ed.make: file has a directory component')
}

export
function charForInsert
(we) {
  let char

  char = we.e.key
  if (we.e.ctrlKey) {
    let charCode

    charCode = char.charCodeAt(0)
    if (charCode == '@'.charCodeAt(0))
      char = String.fromCharCode(0)
    else if ((charCode >= 'a'.charCodeAt(0)) && (charCode <= 'z'.charCodeAt(0)))
      char = String.fromCharCode(charCode - 'a'.charCodeAt(0) + 1)
    else if ((charCode >= 'A'.charCodeAt(0)) && (charCode <= '_'.charCodeAt(0))) // A .. Z [ / ] ^ _
      char = String.fromCharCode(charCode - '_'.charCodeAt(0) + 1)
  }
  else if (char == 'Tab')
    char = String.fromCharCode(9) // ^I \t
  else if (char == 'Enter')
    char = String.fromCharCode(10) // ^J \n
  return char
}

export
function mtypeFromExt
(ext) {
  return ext && mimeByExt[ext]?.type
}

export
function supports
(mtype) {
  function yes
  (m) {
    //d(m.mime)
    return m.mime?.find(mt => mt.type == mtype)
  }
  return Mode.find(yes) ? 1 : 0
}

// caller must strip off .gz etc
export
function supportsExt
(ext) {
  function yes
  (m) {
    return m.exts?.find(e => e == ext)
  }
  return Mode.find(yes) ? 1 : 0
}

export
function escapeForRe
(s) {
  return escapeStringRegexp(s)
}

function initComplete
() {
  Cmd.add('complete', Backend.initComplete())
  Em.on('A-/', 'complete')
}

function initFlushLines
(mo) {
  let hist

  function flushLines
  (other, regex) {
    let view, prompt

    function flush
    (needle) {
      let psn, match

      if (regex)
        regex = new RegExp(needle)

      match = text => text.includes(needle)
      if (other)
        if (regex)
          match = text => regex.test(text) == 0
        else
          match = text => text.includes(needle) == 0
      else if (regex)
        match = text => regex.test(text)

      hist.add(needle)
      psn = Backend.makePsn(view, Backend.vgetBepEnd(view))
      while (1) {
        let text

        psn.lineStart()
        text = Backend.lineAtBep(view, psn.bep)
        d('bep: ' + psn.bep)
        d('text: ' + text)
        if (match(text, needle)) {
          let start, range, atEnd

          d('remove line')
          start = psn.bep
          psn.lineEnd()
          atEnd = psn.charRight()
          range = makeRange(view, start, psn.bep)

          // mv back to start of line to be removed, so that psn is right
          atEnd || psn.linePrev()
          psn.lineStart()

          range.remove()
        }
        if (psn.charLeft())
          break
      }
    }

    prompt = (other ? 'Keep' : 'Flush') + ' lines containing ' + (regex ? 'regex' : 'string')
    view = View.current()
    Prompt.ask({ text: prompt,
                 hist },
               flush)
  }

  hist = Hist.ensure('flush lines')

  Cmd.add('flush lines', () => flushLines(), mo)
  Cmd.add('flush lines regex', () => flushLines(0, 1), mo)
  Cmd.add('keep lines', () => flushLines(1), mo)
  Cmd.add('keep lines regex', () => flushLines(1, 1), mo)
}

function initGotoLine
(mo) {
  let hist

  function gotoLine
  () {
    let view

    function go
    (text) {
      let num

      num = parseInt(text)
      isNaN(num) && Mess.toss('Must be a number')
      Backend.vgotoLine(view, num)
      hist.add(num)
    }

    view = View.current()
    Prompt.ask({ nest: 1,
                 text: 'goto line:',
                 hist },
               go)
  }

  hist = Hist.ensure('goto line')

  Cmd.add('goto line', () => gotoLine(), mo)
}

function initQR
(mo) {
  let moQr, moQrFrom, moQrTo, moQrPrompt, st, hist, emQr, emCtl, emAlt

  function qrLayoutW
  (fromBufId, toBufId) {
    return divCl('edWW float-ww bred-qr-ww',
                 [ divCl('bred-qr-text', 'Replace'),
                   divCl('bred-nested-pane-w bred-qr-from', [],
                         { 'data-bred-nested-buf-id': fromBufId }),
                   divCl('bred-qr-text', 'with'),
                   divCl('bred-qr-ed',
                         [ divCl('bred-nested-pane-w bred-qr-to', [],
                                 { 'data-bred-nested-buf-id': toBufId }),
                           divCl('bred-qr-buttons retracted',
                                 [ button([ span('y', 'key'), 'es' ], { 'data-run': 'qr yes' }),
                                   button([ span('n', 'key'), 'o' ], { 'data-run': 'qr next' }),
                                   button([ span('a', 'key'), 'll' ], { 'data-run': 'qr all' }),
                                   button([ span('c', 'key'), 'ancel' ], { 'data-run': 'close qr' }) ]) ]) ],
                 { 'data-run': 'qr ignore click' })
  }

  function searchNext
  () {
    if (Backend.find(st)) {
      let bs

      bs = st.parentView.ele.querySelector('.bred-qr-buttons')
      Css.expand(bs)
      st.toBuf.addMode(moQrPrompt)
    }
    else {
      d("that's all")
      closeQr()
    }
  }

  function replaceOne
  () {
    Backend.replace(st, 0, searchNext)
  }

  function skipOne
  () {
    if (Backend.find(st))
      st.toBuf.addMode(moQrPrompt)
    else
      closeQr()
  }

  function replaceAll
  () {
    let noop

    noop = () => {}
    st.toBuf.rmMode(moQrPrompt)
    while (Backend.replace(st, 1, noop) && Backend.find(st)) {
      // keep going
    }
    closeQr()
  }

  function submitFrom
  () {
    let toView

    toView = st.parentView.nestedViews?.find(nv => nv.buf == st.toBuf)
    if (toView?.ele) {
      Css.add(toView.ele, 'current')
      Pane.holding(toView.ele)?.focusViewAt(toView.ele)
    }
  }

  function submitTo
  () {
    st.from = st.fromBuf.text()
    st.to = st.toBuf.text()
    if (st.from.length == 0) {
      st.from = st.fromBuf.placeholder
      if (st.from.length == 0) {
        Mess.toss('Empty')
        return
      }
    }
    hist.add({ from: st.from, to: st.to })
    searchNext()
  }

  function toggleField
  () {
    let currentView

    currentView = View.current()
    if (currentView?.buf == st.fromBuf)
      submitFrom()
    else {
      let fromView

      st.toBuf.rmMode(moQrPrompt)

      fromView = st.parentView.nestedViews?.find(nv => nv.buf == st.fromBuf)
      if (fromView?.ele) {
        Css.add(fromView.ele, 'current')
        Pane.holding(fromView.ele)?.focusViewAt(fromView.ele)
      }
    }
  }

  function loadHist
  (nth) {
    let prev

    prev = nth < 0 ? hist.next() : hist.prev()
    if (prev) {
      if (st.fromBuf) {
        st.fromBuf.clear()
        st.fromBuf.insert(prev.from)
      }
      if (st.toBuf) {
        st.toBuf.clear()
        st.toBuf.insert(prev.to)
      }
    }
  }

  function qrEnter
  () {
    let currentView

    currentView = View.current()
    if (currentView?.buf == st.fromBuf)
      submitFrom()
    else
      submitTo()
  }

  function qrKeyY
  (u, we) {
    if (st.toBuf.minors?.find(m => m == moQrPrompt))
      replaceOne()
    else
      Backend.selfInsert(u, we)
  }

  function qrKeyN
  (u, we) {
    if (st.toBuf.minors?.find(m => m == moQrPrompt))
      skipOne()
    else
      Backend.selfInsert(u, we)
  }

  function qrKeyA
  (u, we) {
    if (st.toBuf.minors?.find(m => m == moQrPrompt))
      replaceAll()
    else
      Backend.selfInsert(u, we)
  }

  function qrKeyC
  (u, we) {
    if (st.toBuf.minors?.find(m => m == moQrPrompt))
      closeQr()
    else
      Backend.selfInsert(u, we)
  }

  function qrViewInit
  (view, spec, whenReady) {
    setTimeout(() => {
                 let ready

                 function nestBuf
                 (childBuf) {
                   view.buf.views.forEach(parentView => {
                                            let container

                                            parentView.ele || Mess.toss('nest: parent view missing ele')
                                            container = parentView.ele.querySelector('[data-bred-nested-buf-id="' + childBuf.id + '"]')
                                            if (container) {
                                              let paneW, pane, overlayW, overlay, point, pointLine, headW, head, lint, col, nestedView

                                              if (container.querySelector('.pane.bred-nested'))
                                                return
                                              container.innerHTML = ''

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
                                                                 if (nestedView && nestedView.ed)
                                                                   return
                                                                 if (nestedView && nestedView.scroll?.manual)
                                                                   return
                                                                 if (nestedView)
                                                                   nestedView.point.ensureInView()
                                                               }

                                              container.appendChild(paneW)

                                              nestedView = Buf.view(childBuf,
                                                                    { ele: pane, elePoint: point },
                                                                    v => {
                                                                      if (v.ed) {
                                                                        Css.add(paneW, 'ed')
                                                                        if (childBuf == st.fromBuf) {
                                                                          Css.add(pane, 'current')
                                                                          v.ed.focus()
                                                                        }
                                                                        ready++
                                                                        if (ready == 2) {
                                                                          Em.replace(() => [ emQr ])
                                                                          st.parentView = view
                                                                          if (whenReady)
                                                                            whenReady(view)
                                                                        }
                                                                      }
                                                                    })
                                              parentView.nestedViews = parentView.nestedViews || []
                                              parentView.nestedViews.push(nestedView)
                                            }
                                          })

                   childBuf.nested = 1
                   childBuf.parent = view.buf

                   view.buf.children = view.buf.children || []
                   if (view.buf.children.indexOf(childBuf) == -1)
                     view.buf.children.push(childBuf)
                 }

                 ready = 0
                 nestBuf(st.fromBuf)
                 nestBuf(st.toBuf)
               })
  }

  function qrViewCopy
  (view, existingView, lineNum, whenReady) {
    setTimeout(() => {
                 view.buf.nest(st.fromBuf)
                 view.buf.nest(st.toBuf)
                 st.parentView = view
                 if (whenReady)
                   whenReady(view)
               })
  }

  function qr
  () {
    let view, ph

    view = View.current()
    st = {}
    st.view = view
    hist.reset()
    st.occur = st.view.buf.opts.get('core.highlight.occurrences.enabled')
    st.view.buf.opts.set('core.highlight.occurrences.enabled', 0)
    ph = hist.nth()?.from

    st.fromBuf = Buf.add('QR From',
                         'qr from',
                         divW(view.buf.dir, 0, { hideMl: 1 }),
                         view.buf.dir,
                         { vars: { qr: { role: 'from' } } })
    st.fromBuf.vars('ed').fillParent = 0
    st.fromBuf.opts.set('core.autocomplete.enabled', 0)
    st.fromBuf.opts.set('core.brackets.close.enabled', 0)
    st.fromBuf.opts.set('core.folding.enabled', 0)
    st.fromBuf.opts.set('core.highlight.activeLine.enabled', 0)
    st.fromBuf.opts.set('core.head.enabled', 0)
    st.fromBuf.opts.set('core.line.numbers.show', 0)
    st.fromBuf.opts.set('core.lint.enabled', 0)
    st.fromBuf.opts.set('minimap.enabled', 0)
    st.fromBuf.opts.set('ruler.enabled', 0)
    st.fromBuf.icon = 'prompt'
    if (ph?.length)
      st.fromBuf.placeholder = ph

    st.toBuf = Buf.add('QR To',
                       'qr to',
                       divW(view.buf.dir, 0, { hideMl: 1 }),
                       view.buf.dir,
                       { vars: { qr: { role: 'to' } } })
    st.toBuf.vars('ed').fillParent = 0
    st.toBuf.opts.set('core.autocomplete.enabled', 0)
    st.toBuf.opts.set('core.brackets.close.enabled', 0)
    st.toBuf.opts.set('core.folding.enabled', 0)
    st.toBuf.opts.set('core.highlight.activeLine.enabled', 0)
    st.toBuf.opts.set('core.head.enabled', 0)
    st.toBuf.opts.set('core.line.numbers.show', 0)
    st.toBuf.opts.set('core.lint.enabled', 0)
    st.toBuf.opts.set('minimap.enabled', 0)
    st.toBuf.opts.set('ruler.enabled', 0)
    st.toBuf.icon = 'prompt'

    st.p = Prompt.demandBuf(qrLayoutW(st.fromBuf.id, st.toBuf.id), {})
  }

  function closeQr
  () {
    st.toBuf.rmMode(moQrPrompt)
    st.view.buf.opts.set('core.highlight.occurrences.enabled', st.occur)
    Prompt.close()
  }

  function closeAndPassThrough
  (u, we) {
    let view

    closeQr()

    if (we.mouse) {
      let target

      target = globalThis.document.elementFromPoint(we.e.clientX, we.e.clientY)
      view = Pane.holding(target)?.view
      we.buf = view?.buf
    }
    else {
      view = View.current()
      we.buf = view?.buf
    }
    Em.handle(we, view)
  }

  moQr = Mode.add('qr', { hidePoint: 1,
                          viewInit: qrViewInit,
                          viewCopy: qrViewCopy })

  moQrFrom = Mode.add('qr from', { hidePoint: 1,
                                   viewCopy,
                                   viewInit,
                                   viewReopen,
                                   initFns: initModeFns,
                                   parentsForEm: [ 'qr', 'ed' ] })

  moQrTo = Mode.add('qr to', { hidePoint: 1,
                               viewCopy,
                               viewInit,
                               viewReopen,
                               initFns: initModeFns,
                               parentsForEm: [ 'qr', 'ed' ] })

  moQrPrompt = Mode.add('QR Prompt', { minor: 1 })

  hist = Hist.ensure('QR')

  Cmd.add('close qr', () => closeQr(), moQr)
  Cmd.add('close buffer', () => closeQr(), moQr)
  Cmd.add('close qr and pass through', closeAndPassThrough, moQr)
  Cmd.add('qr ignore click', () => {}, moQr)
  Cmd.add('qr yes', () => replaceOne(), moQr)
  Cmd.add('qr next', () => skipOne(), moQr)
  Cmd.add('qr all', () => replaceAll(), moQr)
  Cmd.add('qr previous history item', () => loadHist(), moQr)
  Cmd.add('qr next history item', () => loadHist(-1), moQr)
  Cmd.add('qr enter', () => qrEnter(), moQr)
  Cmd.add('qr key y', qrKeyY, moQr)
  Cmd.add('qr key n', qrKeyN, moQr)
  Cmd.add('qr key a', qrKeyA, moQr)
  Cmd.add('qr key c', qrKeyC, moQr)

  Cmd.add('qr submit from', () => submitFrom(), moQrFrom)
  Cmd.add('qr toggle field', () => toggleField(), moQrFrom)
  Cmd.add('qr previous history item', () => loadHist(), moQrFrom)
  Cmd.add('qr next history item', () => loadHist(-1), moQrFrom)

  Cmd.add('qr submit to', () => submitTo(), moQrTo)
  Cmd.add('qr toggle field to', () => toggleField(), moQrTo)
  Cmd.add('qr previous history item', () => loadHist(), moQrTo)
  Cmd.add('qr next history item', () => loadHist(-1), moQrTo)

  moQrPrompt.em.on('y', 'qr yes')
  moQrPrompt.em.on('n', 'qr next')
  moQrPrompt.em.on('a', 'qr all')
  moQrPrompt.em.on('!', 'qr all')
  moQrPrompt.em.on('c', 'close qr')
  Em.on('Enter', 'qr next', moQrPrompt.em)
  Em.on('C-g', 'close qr', moQrPrompt.em)
  Em.on('Escape', 'close qr', moQrPrompt.em)

  emQr = Em.make('QR')

  for (let i = 32; i <= 127; i++)
    emQr.on(String.fromCharCode(i), 'self insert')

  emQr.on('y', 'qr key y')
  emQr.on('n', 'qr key n')
  emQr.on('a', 'qr key a')
  emQr.on('!', 'qr key a')
  emQr.on('c', 'qr key c')

  emQr.on('Enter', 'qr enter')
  emQr.on('C-o', 'qr toggle field')
  Em.on('C-g', 'close qr', emQr)
  Em.on('Escape', 'close qr', emQr)
  Em.on('ArrowUp', 'qr previous history item', emQr)
  Em.on('ArrowDown', 'qr next history item', emQr)
  Em.on('A-p', 'qr previous history item', emQr)
  Em.on('A-n', 'qr next history item', emQr)

  emCtl = Em.make('')
  emCtl.otherwise = 'close qr and pass through'
  emQr.on('Control', emCtl)

  emAlt = Em.make('')
  emAlt.otherwise = 'close qr and pass through'
  emQr.on('Alt', emAlt)

  emQr.otherwise = 'close qr and pass through'

  Cmd.add('query replace', () => qr(), mo)
  Cmd.add('find and replace', () => qr(), mo)
}

function initSearch
(mo) {
  Bred.initSearch(vfind,
                  { Backend,
                    cancel: Backend.cancel,
                    cleanup
                    (s) {
                      Backend.clearDecorMatch(s.st.view, s.st)
                      Backend.clearDecorAll(s.st.view, s.st)
                    },
                    emName: 'Ed: Search',
                    mode: mo })
}

export
function makeMlDir
(dir) {
  let mlDir

  mlDir = []
  if (dir) {
    let path

    path = ''
    U.shortHome(Buf.prepDir(dir)).split('/').forEach((c, i) => {
                                                       let r, home

                                                       if (c.length == 0)
                                                         return

                                                       home = i == 0 && c == '~'

                                                       if (home)
                                                         path = U.home().replace(/\/$/, '')
                                                       else
                                                         path = path + '/' + c
                                                       r = span(c, { 'data-path': path, 'data-run': 'open link' })

                                                       if (home)
                                                         mlDir.push(r)
                                                       else
                                                         mlDir.push([ '/', r ])
                                                     })
  }
  return mlDir
}

export
function setMlDir
(buf, dir) {

  function set
  (ele) {
    if (ele) {
      let mlDir

      mlDir = ele.querySelector('.edMl-dir')
      if (mlDir) {
        mlDir.innerHTML = ''
        Dom.append(mlDir, makeMlDir(dir))
      }
    }
  }

  if (buf) {
    set(buf.co)
    buf.views.forEach(v => set(v.ele))
  }
}

export
function setIcon
(buf, css, name, run) {

  function set
  (ele) {
    if (ele) {
      let icon

      icon = ele.querySelector(css)
      if (icon) {
        icon.firstElementChild.src = Icon.path(name)
        if (run)
          icon.setAttribute('data-run', run)
        else
          icon.removeAttribute('data-run')
      }
    }
  }

  if (buf) {
    if (css == '.edMl-type')
      buf.icon = name
    set(buf.co)
    buf.views.forEach(v => set(v.ele))
  }
}

export
function initTheme
(theme) {
  let css

  function nameToCss
  (name) {
    let split

    // blueLight => blue-light
    split = name.split(/(?=[A-Z])/)
    return split.join('-').toLowerCase()
  }

  /*
  let css
  css = globalThis.document.querySelector('#cssBred')
  if (css) {
    let root
    root = css.cssRules[0]
    d('css.cssRules')
    d(css.cssRules)
    for (let clr in theme.clrs) {
  */

  //globalThis.document.head.appendChild(globalThis.document.createElement("style")).innerHTML = s;

  /*
  let sheet
  //sheet = globalThis.document.querySelector('#cssBred')
  sheet = globalThis.document.styleSheets[0]
  d(sheet)
  if (sheet) {
    let css
    css = ':root {\n'
    Object.entries(theme.clrs).forEach(kv => {
      css += '  --clr-' + nameToCss(kv[0]) + ': ' + kv[1] + ';\n'
    })
    css += '}\n'
    sheet.insertRule(css)
  }
  */

  css = ':root {\n'

  Object.entries(theme.clrs).forEach(kv => {
                                       css += '  --theme-clr-' + nameToCss(kv[0]) + ': ' + kv[1] + ';\n'
                                     })

  css += '\n'
  Object.entries(theme.meanings).forEach(kv => {
                                           css += '  --clr-' + nameToCss(kv[0]) + ': ' + kv[1] + ';\n'
                                         })

  css += '\n'
  theme.rules.forEach(rule => {
                        if (rule?.token?.length && rule.foreground)
                          css += '  --rule-clr-' + rule.token + ': ' + rule.foreground + ';\n'
                      })

  css += '\n'
  Object.entries(theme.filters).forEach(kv => {
                                          css += '  --theme-filter-clr-' + nameToCss(kv[0]) + ': ' + kv[1] + ';\n'
                                        })

  css += '\n'
  Object.entries(theme.filterMeanings).forEach(kv => {
                                                 css += '  --filter-clr-' + nameToCss(kv[0]) + ': ' + kv[1] + ';\n'
                                               })

  css += '}\n'
  globalThis.document.head.appendChild(globalThis.document.createElement('style')).innerHTML = css
}

function setBackend
(be, cb) {
  function load
  (file) {
    import(file).then(m => {
                        Backend = m
                        d('backend loaded')
                        cb()
                      },
                      err => {
                        Mess.yell('Failed to load ' + backend + ': ' + err.message)
                        cb(err)
                      })
  }

  backend = be
  //backend = "codemirror"

  if (backend == 'codemirror') {
    Mess.log('Backend: CodeMirror')
    load('./wode.mjs')
  }
  else
    Mess.toss('Ed:init caller must specify backend')
}

export
function getCTag
(name) {
  // {"_type": "tag", "name": "divW", "path": "js/shell.mjs", "pattern": "/^function divW$/", "kind": "function"},
  if ((typeof name == 'string') && name.includes('.')) {
    let split, ctag

    // Hack for finding eg Ed.divW in ed.mjs instead of in about.mjs
    split = name.split('.')
    ctag = ctags.find(c => (c.name == split[1]) && (c.path.includes('/' + split[0].toLowerCase() + '.')))
    return ctag || ctags.find(c => c.name == name)
  }
  return ctags.find(c => c.name == name)
}

export
function addCTags
(file) {
  let dir

  function prep
  (t) {
    let loc

    loc = Loc.make(dir)
    loc.join(t.path)
    t.path = loc.path
    if (t.pattern) {
      if (t.pattern.startsWith('/'))
        t.pattern = t.pattern.slice(1)
      if (t.pattern.endsWith('/'))
        t.pattern = t.pattern.slice(0, t.pattern.length - 1)
      if (t.pattern.startsWith('^')
          && t.pattern.endsWith('$')) {
        t.line = t.pattern.slice(1, t.pattern.length - 1)
        t.regex = new RegExp('^' + escapeForRe(t.line) + '$')
      }
      else if (t.pattern.startsWith('^')) {
        t.line = t.pattern.slice(1)
        t.regex = new RegExp('^' + escapeForRe(t.line))
      }
      else if (t.pattern.endsWith('$')) {
        t.line = t.pattern.slice(0, t.pattern.length - 1)
        t.regex = new RegExp(escapeForRe(t.line) + '$')
      }
      else {
        t.line = t.pattern
        t.regex = new RegExp(escapeForRe(t.line))
      }
    }
    return t
  }

  dir = Loc.make(file).dirname

  //import(file, { assert: { type: 'json' } }).then(m => { ctags = m.default; d({ctags}) },
  //                                                err => Mess.yell("Failed to load TAGS: " + err.message))
  import(file).then(m => {
                      ctags = [ ...(ctags || []), ...m.tags.map(prep) ]
                    },
                    err => Mess.yell('Failed to load TAGS ' + file + ': ' + err.message))
}

export
function initCTags
() {
  let file

  Timing.start('ed.initCTags')
  file = Loc.appDir().join('TAGS.mjs')
  addCTags(file)
  Timing.stop('ed.initCTags')
}

function vinsert
(view, u, str) {
  let bep

  bep = view.bep
  Backend.vinsertAt(view, bep, u, str)
  // have to do this after otherwise the insert moves the mark
  Backend.addMarkAt && Backend.addMarkAt(view, bep)
}

export
function initModeFns
(mo) {
  function save
  (b, cb) {
    let v

    v = b.views.find(view => view.ele)
    if (v)
      Backend.vsave(v, cb)
    else
      cb(new Error('View missing'))
  }

  function append
  (b, str,
   afterEndPoint) { // if point at end, then final position of point will be before str.
    let view

    view = b.anyView(1) || Mess.log('ED append missing view')
    if (view?.ed) {
      let atEnd, end, bep, movePoint

      bep = Backend.vgetBep(view)
      end = Backend.vgetBepEnd(view)
      atEnd = Backend.vbepEq(bep, end)
      if (afterEndPoint && atEnd)
        movePoint = 0
      else if (atEnd)
        movePoint = 1
      else
        movePoint = 0
      //d(b.name + ": append: " + str)
      Backend.vinsertAt(view, end, 1, str, movePoint)
    }
    else
      Mess.log('ED append missing view.ed')
  }

  function insert
  (b, str, bep) {
    let view

    view = b.anyView() || Mess.log('ED insert missing view')
    if (view?.ed) {
      //d(b.name + ": insert: " + str)
      Backend.vinsertAt(view, bep, 1, str)
      // have to do this after otherwise the insert moves the mark
      Backend.addMarkAt && Backend.addMarkAt(view, bep)
    }
    else
      Mess.log('ED insert missing view.ed')
  }

  mo.append = append
  mo.bep = Backend.vgetBep
  mo.bepEnd = Backend.vgetBepEnd
  mo.bufEnd = Backend.vbufEnd
  mo.bufStart = Backend.vbufStart
  mo.ensurePointVisible = Backend.ensurePointVisible
  mo.insert = insert
  mo.vinsert = vinsert
  mo.forward = Backend.vforward
  mo.len = Backend.vlen
  mo.offset = v => Backend.bepToOff(v, Backend.vgetBep(v))
  mo.pos = v => Backend.bepToPos(v, Backend.vgetBep(v))
  mo.save = save

  Backend.initModeFns(mo)
}

export
function tokenAt
(x, y) {
  if (Backend.vtokenAt) {
    let view

    view = View.current()
    return Backend.vtokenAt(view, x, y)
  }
  return null
}

export
function makeDecor
(spec) {
  return Backend.makeDecor && Backend.makeDecor(spec)
}

pageBreakRe = /^/g

function vpageForward
(view, u) {
  let backward

  u = u || 1
  backward = u < 0
  u = Math.abs(u)
  if (backward)
    Backend.lineStart(view)
  else
    Backend.lineEnd(view)
  for (let i = 0; i < u; i++) {
    if (vfind(view,
              pageBreakRe,
              0,
              { skipCurrent: 0,
                backwards: backward,
                wrap: 0,
                caseSensitive: 0,
                wholeWord: 0,
                regExp: 1,
                reveal: 3 })) // if scroll, land in middle
      continue
    if (backward)
      Backend.vbufStart(view)
    else
      Backend.vbufEnd(view)
    break
  }
}

function pageForward
(u) {
  let view

  view = View.current()
  vpageForward(view, u)
}

function pageBackward
(u) {
  pageForward(u ? -u : -1)
}

pageCmds = [ 'Page Forward', 'Page Backward' ]

function pageForwardOrSelf
(u, we) {
  let last

  last = Cmd.last()
  if (pageCmds.includes(last)
      || Cmd.lastFlag('page xward or self insert')) {
    Cmd.flagLast('page xward or self insert', 1)
    pageForward(u)
  }
  else
    Backend.selfInsert(u, we)
}

function pageBackwardOrSelf
(u, we) {
  let last

  last = Cmd.last()
  if (pageCmds.includes(last)
      || Cmd.lastFlag('page xward or self insert')) {
    Cmd.flagLast('page xward or self insert', 1)
    pageBackward(u)
  }
  else
    Backend.selfInsert(u, we)
}

export
function vforLines
(view, cb) { // (line)
  if (Backend.vforLines)
    Backend.vforLines(view, cb)
}

export
function vwordForward
(view, u) {
  let backward

  u = u || 1
  backward = u < 0
  u = Math.abs(u)
  //utimes(u, () => pexec(p, "cursorWordEndRight", "cursorWordEndRightSelect"))
  for (let i = 0; i < u; i++)
    if (vfind(view,
              tokenRe,
              0,
              { skipCurrent: 0,
                backwards: backward,
                wrap: 0,
                caseSensitive: 0,
                wholeWord: 0,
                regExp: 1 })
        == 0)
      break
}

function getNextWord
(view, n) {
  let r

  r = vfind(view,
            tokenRe,
            0,
            { skipCurrent: 0,
              backwards: n < 0,
              wrap: 0,
              stayInPlace: 1,
              caseSensitive: 0,
              wholeWord: 0,
              regExp: 1 })
  if (r.empty)
    return 0
  return r
}

function transposeWords
() {
  let view, r1, r2

  view = View.current()
  r1 = getNextWord(view)
  r2 = getNextWord(view, -1)
  d({ r1 })
  d({ r2 })
  if (r1 && r2) {
    let t1, t2

    t1 = r1.text
    t2 = r2.text
    d({ t1 })
    d({ t2 })
    Backend.vreplaceAtAll(view, r1, t2, [ { range: r2, text: t1 } ])
    Backend.wordForward()
  }
}

function delNextWord
(u) {
  let view, bep1, bep2, range, text

  view = View.current()

  bep1 = Backend.vgetBep(view)

  Backend.clearSelection(view)

  vwordForward(view, u)

  bep2 = Backend.vgetBep(view)

  range = makeRange(view, bep1, bep2)
  text = range.text
  if (text && text.length) {
    range.remove()
    Cut.add(text)
  }
}

function indentLineRigidly
(view, row, str, setBep) {
  let bep

  bep = Backend.makeBep(view, row, 0)
  d('line start: ' + bep)
  view.buf.views.forEach(v => {
                           Backend.vinsertAt(v, bep, 1, str)
                           if (setBep && (v == view)) {
                             let bep2

                             bep2 = Backend.bepRightOverSpace(v, bep)
                             Backend.vsetBep(v, bep2)
                           }
                         })
}

function indentRigidly
(u) {
  let view, str, psns, rows, singleRow, region

  //d('ir')
  str = ' '.repeat(u || 1)
  //d('[' + str + ']')
  view = View.current()
  region = view.region
  psns = region.psns
  singleRow = psns.length <= 1
  if (psns.length > 1) {
    // skip first line if region starts at the end of the line
    if (psns.at(0).eol)
      psns = psns.slice(1)
    // skip last line if region ends at the start of the line
    if (region.end.col == 0)
      psns = psns.slice(0, psns.length - 1)
  }
  rows = psns.map(psn => Backend.bepRow(view, psn.bep))
  // skip 0 len lines
  rows = rows.filter(r => Backend.rowLen(view, r))
  rows.forEach(line => indentLineRigidly(view, line, str, singleRow))
}

function discardAndRevert
() {
  let view

  Prompt.close()
  view = Prompt.callerView()
  if (view?.buf.path)
    Backend.revertV(view)
  else
    Mess.toss('Need view with path')
}

function countRegion
() {
  let view, region, lines

  view = View.current()
  region = view.region
  if (region.chars)
    lines = bepRow(view, region.to) - bepRow(view, region.from) + 1
  else
    lines = 0
  Mess.say('Region has ' + lines + ' lines, ' + region.chars + ' characters')
}

function newlineAndIndent
(u) {
  if (Backend.newlineAndIndent)
    Backend.newlineAndIndent(u)
  else
    Backend.newline(u)
}

function insertSlash
(u, we) {
  if (Backend.insertSlash)
    Backend.insertSlash(u)
  else
    Backend.selfInsert(u, we)
}

function cmdSave
(fn, // (view, cb)
 cb) { // (err)
  let view, path

  function error
  (msg) {
    if (cb)
      cb(new Error(msg))
    else
      Mess.yell(msg)
  }

  fn = fn || Backend.vsave
  view = View.current()

  path = Loc.make(view.buf.path).expand()
  Tron.cmd('file.stat', path, (err, data) => {
                                if (err) {
                                  if (err.code == 'ENOENT') {
                                    // new file
                                    fn(view, cb)
                                    return
                                  }
                                  error(err.message)
                                  return
                                }
                                // existing file
                                if (view.buf.stat) {
                                  if (view.buf.stat?.mtimeMs < data.data.mtimeMs)
                                    Prompt.yn('File has changed on disk. Overwrite?',
                                              { icon: 'save' },
                                              yes => {
                                                if (yes)
                                                  fn(view, cb)
                                              })
                                  else
                                    fn(view, cb)
                                  return
                                }
                                error('Buffer missing stat')
                              })
}

function revert
() {
  let view

  view = View.current()
  if (view.buf.path) {
    if (view.buf.modified) {
      Prompt.demand(emRevert,
                    divCl('float-h',
                          [ divCl('float-icon', img(Icon.path('trash'), 'Trash', 'filter-clr-nb3')),
                            divCl('float-text', 'Buffer is modified. Discard changes?'),
                            button([ span('y', 'key'), 'es' ], '', { 'data-run': 'discard and revert' }),
                            button([ span('n', 'key'), 'o' ], '', { 'data-run': 'close demand' }) ]))
      return
    }
    Backend.revertV(view)
  }
  else
    Mess.toss('Buf needs path')
}

function selfInsertIndent
(u, we) {
  Backend.selfInsert(u, we)
  Backend.indentLine()
}

export
function enable
(u, name) {
  if (u == 4)
    Opt.set(name, 0)
  else
    Opt.set(name, 1)
}

export
function enableBuf
(u, name) {
  let view

  view = View.current()
  if (u == 4)
    view?.buf?.opts.set(name, 0)
  else
    view?.buf?.opts.set(name, 1)
}

export
function init
(be, cb) { // (err)
  d('set backend')

  ctags = []
  onCursors = []

  // Here so it loads before backend.
  Opt.declare('core.theme.mode', 'str', 'light')

  tokenRe = new RegExp('[\\p{L}\\p{N}_$]+', 'gu')
  nonTokenRe = new RegExp('(?:[^\\p{L}\\p{N}_$]|\\s)+', 'gu')

  setBackend(be, err => {
                   let mo

                   if (err)
                     cb(err)

                   bepRow = Backend.bepRow
                   bepCol = Backend.bepCol
                   bepGt = Backend.bepGt
                   bepGtEq = Backend.bepGtEq
                   bepLt = Backend.bepLt
                   bepLtEq = Backend.bepLtEq
                   bepToPos = Backend.bepToPos
                   offToBep = Backend.offToBep
                   posToBep = Backend.posToBep
                   posRow = Backend.posRow
                   posCol = Backend.posCol
                   viewCopy = Backend.viewCopy
                   viewInit = Backend.viewInit
                   viewReopen = Backend.viewReopen
                   vfind = Backend.vfind
                   makeRange = Backend.makeRange

                   d('init theme')
                   if (Backend.Theme)
                     initTheme(Backend.Theme)

                   emRevert = Em.make('Revert')
                   emRevert.on('y', 'discard and revert')
                   emRevert.on('n', 'close demand')
                   Em.on('C-g', 'close demand', emRevert)
                   Em.on('Escape', 'close demand', emRevert)

                   d('add ed mode')
                   mo = Mode.add('Ed', { hidePoint: 1,
                                         viewInit: Backend.viewInit,
                                         viewCopy: Backend.viewCopy,
                                         viewReopen: Backend.viewReopen,
                                         initFns: initModeFns,
                                         assist: 0,
                                         //
                                         onRemove: Backend.onBufRemove })

                   d('init backend')
                   Backend.init(mo)

                   d('add modes')
                   Backend.addModes()

                   d('add cmds')
                   Cmd.add('activate mark', () => Backend.activateMark(), mo)
                   Cmd.add('delete previous char', () => Backend.delPrevChar(), mo)
                   Cmd.add('delete next char', () => Backend.delNextChar(), mo)
                   Cmd.add('delete next word', delNextWord, mo)
                   Cmd.add('delete previous word', u => delNextWord(-u), mo)
                   Cmd.add('delete to next word boundary', Backend.delNextWordBound, mo)
                   Cmd.add('delete to previous word boundary', u => Backend.delNextWordBound(-u), mo)
                   Cmd.add('trim', () => Backend.trim(), mo)
                   Cmd.add('comment region', Backend.commentRegion, mo)
                   Cmd.add('count region', () => countRegion(), mo)
                   Cmd.add('sort buffer lines', () => Backend.sortLines(), mo)
                   Cmd.add('sort lines', () => Backend.sortRegion(), mo)
                   Cmd.add('capitalize word', () => Backend.capitalizeWord(), mo)
                   Cmd.add('lowercase word', () => Backend.caseWord(w => w.toLowerCase()), mo)
                   Cmd.add('uppercase word', () => Backend.caseWord(w => w.toUpperCase()), mo)
                   Cmd.add('new line and indent', newlineAndIndent, mo)
                   Cmd.add('new line', Backend.newline, mo)
                   Cmd.add('insert /', insertSlash, mo)
                   Cmd.add('forward', Backend.forward, mo)
                   Cmd.add('backward', Backend.backward, mo)
                   Cmd.add('cut line', () => Backend.cutLine(), mo)
                   Cmd.add('group forward', Backend.groupForward, mo)
                   Cmd.add('group backward', Backend.groupBackward, mo)
                   Cmd.add('syntax forward', Backend.syntaxForward, mo)
                   Cmd.add('syntax backward', Backend.syntaxBackward, mo)
                   Cmd.add('word forward', Backend.wordForward, mo)
                   Cmd.add('word backward', Backend.wordBackward, mo)
                   Cmd.add('page forward', pageForward, mo)
                   Cmd.add('page backward', pageBackward, mo)
                   Cmd.add('page forward or self insert', pageForwardOrSelf, mo)
                   Cmd.add('page backward or self insert', pageBackwardOrSelf, mo)
                   Cmd.add('previous line', u => Backend.prevLine(View.current(), u), mo)
                   Cmd.add('next line', u => Backend.nextLine(View.current(), u), mo)
                   Cmd.add('previous boundary', u => Backend.prevBoundary(View.current(), u), mo)
                   Cmd.add('next boundary', u => Backend.nextBoundary(View.current(), u), mo)
                   Cmd.add('line start', () => Backend.lineStart(), mo)
                   Cmd.add('line end', () => Backend.lineEnd(), mo)
                   Cmd.add('buffer start', () => Backend.bufferStart(), mo)
                   Cmd.add('buffer end', () => Backend.bufferEnd(), mo)
                   Cmd.add('scroll up', () => Backend.scrollUp(), mo)
                   Cmd.add('scroll down', () => Backend.scrollDown(), mo)
                   Cmd.add('mark set', u => Backend.setMark(u), mo)
                   Cmd.add('mark exchange', () => Backend.exchange(), mo)
                   Cmd.add('open line', () => Backend.openLine(), mo)
                   Cmd.add('cancel', () => Backend.cancel(), mo)
                   Cmd.add('recenter', () => Backend.recenter(View.current()), mo)
                   Cmd.add('redo', () => Backend.redo(), mo)
                   Cmd.add('undo', () => Backend.undo(), mo)
                   Cmd.add('self insert', Backend.selfInsert, mo)
                   Cmd.add('quoted insert', Backend.quotedInsert, mo)
                   Cmd.add('self insert and indent', selfInsertIndent, mo)
                   Cmd.add('indent buffer', () => Backend.indentBuffer(), mo)
                   Cmd.add('suggest', () => Backend.suggest(), mo)
                   Cmd.add('next suggestion', () => Backend.nextSuggest(), mo)
                   Cmd.add('previous suggestion', () => Backend.prevSuggest(), mo)
                   Cmd.add('indent region', () => Backend.indentRegion(), mo)
                   Cmd.add('indent line', () => Backend.indentLine(), mo)
                   Cmd.add('indent rigidly', indentRigidly, mo)
                   Cmd.add('insert two spaces', () => Backend.insertTwoSpaces(), mo)
                   Cmd.add('save', () => cmdSave(), mo)
                   Cmd.add('save as', () => Backend.vsaveAs(View.current()), mo)
                   Cmd.add('transpose chars', () => Backend.transposeChars(), mo)
                   Cmd.add('transpose words', () => transposeWords(), mo)
                   Cmd.add('toggle overwrite', () => Backend.toggleOverwrite(), mo)
                   Cmd.add('top level start', () => Backend.topLevelStart(), mo)
                   Cmd.add('top level end', () => Backend.topLevelEnd(), mo)
                   Cmd.add('top of pane', () => Backend.topOfPane(), mo)
                   Cmd.add('bottom of pane', () => Backend.bottomOfPane(), mo)
                   Cmd.add('select all', () => Backend.selectAll(), mo)
                   Cmd.add('open lint panel', () => Backend.openLint(), mo)
                   Cmd.add('first diagnostic', (u, we) => Backend.firstDiagnostic && Backend.firstDiagnostic(u, we), mo)
                   Cmd.add('flush trailing whitespace', (u, we) => Backend.flushTrailing && Backend.flushTrailing(u, we), mo)

                   Cmd.add('yank', () => Backend.yank(), mo)
                   Cmd.add('yank roll', () => Backend.yankRoll(), mo)
                   Cmd.add('paste', () => Backend.yank(), mo)
                   Cmd.add('paste roll', () => Backend.yankRoll(), mo)
                   Cmd.add('cut', () => Backend.cut(), mo)
                   Cmd.add('copy', () => Backend.copy(), mo)

                   Cmd.add('revert buffer', () => revert(), mo)
                   Cmd.add('discard and revert', () => discardAndRevert()) // global because call from prompt area

                   Em.on('Escape', 'cancel', mo)
                   Em.on('Enter', 'new line and indent', mo)
                   Em.on('Backspace', 'delete previous char', mo)
                   Em.on('Delete', 'delete next char', mo)
                   Em.on('Tab', 'indent region', mo)
                   Em.on('C-x Tab', 'indent rigidly', mo)
                   Em.on('C-Tab', 'suggest', mo)
                   Em.on('Insert', 'toggle overwrite', mo)
                   Em.on('ArrowUp', 'previous line', mo)
                   Em.on('ArrowDown', 'next line', mo)
                   Em.on('ArrowRight', 'forward', mo)
                   Em.on('ArrowLeft', 'backward', mo)
                   Em.on('Home', 'buffer start', mo)
                   Em.on('End', 'buffer end', mo)
                   for (let i = 32; i <= 127; i++)
                     Em.on(String.fromCharCode(i), 'self insert', mo)
                   Em.on('/', 'insert /', mo)
                   Em.on('[', 'page backward or self insert', mo)
                   Em.on(']', 'page forward or self insert', mo)

                   Em.on('C-ArrowLeft', 'word backward', mo)
                   Em.on('C-ArrowRight', 'word forward', mo)
                   //Em.on("C-PageUp", "paragraph forward", mo)
                   //Em.on("C-PageDown", "paragraph backward", mo)
                   Em.on('C-a', 'line start', mo)
                   Em.on('C-b', 'backward', mo)
                   Em.on('C-d', 'delete next char', mo)
                   Em.on('C-e', 'line end', mo)
                   Em.on('C-f', 'forward', mo)
                   Em.on('C-g', 'cancel', mo)
                   Em.on('Escape', 'cancel', mo)
                   Em.on('C-j', 'new line', mo)
                   Em.on('C-k', 'cut line', mo)
                   Em.on('C-p', 'previous line', mo)
                   Em.on('C-n', 'next line', mo)
                   Em.on('C-q', 'quoted insert', mo)
                   // C-r Bred.initSearch
                   // C-s Bred.initSearch
                   Em.on('C-w', 'cut', mo)
                   Em.on('C- ', 'mark set', mo)
                   Em.on('C-y', 'paste', mo) // aka Yank
                   Em.on('C-z', 'undo', mo)
                   Em.on('C-/', 'undo', mo)

                   Em.on('A-Delete', 'delete next word', mo)
                   Em.on('A-Backspace', 'delete previous word', mo)
                   Em.on('A-f', 'word forward', mo)
                   Em.on('A-b', 'word backward', mo)
                   Em.on('A-c', 'capitalize word', mo)
                   Em.on('A-j', 'new line', mo)
                   Em.on('A-l', 'lowercase word', mo)
                   Em.on('A-n', 'next suggestion', mo)
                   Em.on('A-p', 'previous suggestion', mo)
                   Em.on('A-u', 'uppercase word', mo)
                   Em.on('A-d', 'delete next word', mo)
                   // A-q fill to ruler ext/ruler
                   Em.on('A-t', 'transpose words', mo)
                   Em.on('A-w', 'copy', mo)
                   Em.on('A-y', 'yank roll', mo)
                   Em.on('A-z', 'trim', mo)
                   Em.on('A-=', 'count region', mo)
                   Em.on('A-<', 'buffer start', mo)
                   Em.on('A->', 'buffer end', mo)
                   Em.on('A-,', 'top of pane', mo)
                   Em.on('A-.', 'bottom of pane', mo)

                   Em.on('C-A-b', 'syntax backward', mo)
                   Em.on('C-A-f', 'syntax forward', mo)

                   Em.on('C-c ;', 'comment region', mo)

                   Em.on('C-x [', 'page backward', mo)
                   Em.on('C-x ]', 'page forward', mo)
                   Em.on('C-x o', 'open line', mo)
                   Em.on('C-x  ', 'activate mark', mo)
                   Em.on('C-x t', 'transpose chars', mo)
                   Em.on('C-x C-s', 'save', mo)
                   Em.on('C-x C-w', 'save as', mo)
                   Em.on('C-x C-x', 'mark exchange', mo)

                   Em.on('C-A-a', 'top level start', mo)
                   Em.on('C-A-e', 'top level end', mo)

                   Em.on('A-g l', 'goto line', mo)

                   Em.on('C-c A-r', 'revert buffer', mo)

                   initComplete()
                   initFlushLines(mo)
                   initGotoLine(mo)
                   initQR(mo)
                   initSearch(mo)

                   cb()
                 })
}

export
function findLang
(id) {
  return Backend.findLang && Backend.findLang(id)
}

export
function register
(spec) {
  return Backend.register && Backend.register(spec)
}

export
function code
(el, langId, text) {
  return Backend.code && Backend.code(el, langId, text)
}

export
function fill
(view, col) {
  return Backend.fill && Backend.fill(view, col)
}

export
function onCursor
(cb) { // (backend, view)
  let oc

  function free
  () {
    U.arrRm1(onCursors, o => o.cb == cb)
  }

  oc = { cb, free }

  onCursors.push(oc)
  return oc
}
