import * as Buf from './buf.mjs'
import * as Cut from './cut.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Ed from './ed.mjs'
import * as Loc from './loc.mjs'
import * as Lsp from './lsp.mjs'
import * as Mess from './mess.mjs'
import * as Opt from './opt.mjs'
import * as Pane from './pane.mjs'
import * as Tron from './tron.mjs'
import * as Win from './win.mjs'
import * as WodeCommon from './wode-common.mjs'
import * as WodeFind from './wode-find.mjs'
import * as WodeHi from './wode-hi.mjs'
import * as WodeLang from './wode-lang.mjs'
import * as WodeMode from './wode-mode.mjs'
import * as WodePatch from './wode-patch.mjs'
import * as WodeRange from './wode-range.mjs'
import * as WodeTheme from './wode-theme.mjs'
import * as WodeView from './wode-view.mjs'
import * as WodeWatch from './wode-watch.mjs'
import { d } from './mess.mjs'

import * as CMAuto from '../lib/@codemirror/autocomplete.js'
import * as CMComm from '../lib/@codemirror/commands.js'
import * as CMCont from '../lib/@valtown/codemirror-continue.js'
import * as CMLang from '../lib/@codemirror/language.js'
import * as LezUtils from '../lib/lezer-utils.js'
import * as CMLint from '../lib/@codemirror/lint.js'
import * as CMState from '../lib/@codemirror/state.js'
import * as CMView from '../lib/@codemirror/view.js'
import * as Wrap from '../lib/fast-word-wrap.js'
import Vode from '../lib/@codemirror/version.json' with { type: 'json' }

export { init as initComplete } from './wode-complete.mjs'
export { makeDecor } from './wode-decor.mjs'
export { vfind } from './wode-find.mjs'
export { langs } from './wode-lang.mjs'
export { modeFor, patchModeKey } from './wode-mode.mjs'
export { make as makeRange } from './wode-range.mjs'
export { themeExtension, themeExtensionPart, Theme } from './wode-theme.mjs'
export { init as viewInit, copy as viewCopy, reopen as viewReopen, revertV } from './wode-view.mjs'

let completionNextLine, completionPreviousLine, spRe
let wextIds, registeredOpts

export
function version
() {
  return Vode.version
}

export
function viewFromState
(state) {
  return state.facet(WodeCommon.bredView())
}

function reconfigureOpt
(buf, name) {
  //d('reconfigureOpt ' + name)
  buf.views.forEach(view => {
    if (view.ed && (view.win == Win.current()))
      WodeMode.wexts.forEach(b => {
        if (b.spec.make && b.spec.reconfOpts && b.spec.reconfOpts.includes(name))
          view.ed.dispatch({ effects: b.spec.part.reconfigure(b.spec.make(view)) })
      })
  })
}

export
function findLang
(id) {
  return WodeLang.langs.find(l => l.id == id)
}

export
function register
(spec) { // { backend, make, part, reconfOpts }
  if (spec.backend == 'cm') {
    let wext, id

    function free
    () {
      WodeMode.wexts.removeIf(b => b.id === wext.id)
      // remove from existing views
      Buf.forEach(buf => buf.views.forEach(v => (v.win == Win.current()) && v.ed?.dispatch({ effects: spec.part.reconfigure([]) })))
      // reconfigure exts opts on all bufs, in case any other extensions use the opt
      spec.reconfOpts?.forEach(name => Buf.forEach(buf => reconfigureOpt(buf, name)))
    }

    id = ++wextIds

    spec.part = spec.part || new CMState.Compartment

    if (spec.make)
      // every existing ed must get a compartment
      Buf.forEach(buf => buf.views.forEach(view => {
        if (view.ele && view.ed && (view.win == Win.current()))
          view.ed.dispatch({ effects: CMState.StateEffect.appendConfig.of(spec.part.of(spec.make(view))) })
      }))

    spec.reconfOpts?.forEach(name => {
      if (registeredOpts.has(name)) {
      }
      else {
        registeredOpts.add(name)
        // these will just listen forever, which is ok
        //   could get handles and free them when the wext is freed
        Opt.onSet(name, () => Buf.forEach(buf => reconfigureOpt(buf, name)))
        Opt.onSetBuf(name, buf => reconfigureOpt(buf, name))
      }
      // reconfigure the opt on all bufs, in case any other extensions use the opt
      Buf.forEach(buf => reconfigureOpt(buf, name))
    })

    wext = { spec,
             free,
             //
             get id() {
               return id
             } }

    WodeMode.wexts.push(wext)

    return wext
  }
}

export
function vlineStart
(view, bep) {
  let l

  if (bep < 0)
    bep = 0
  l = view.ed.state.doc.lineAt(bep)
  return l.from
}

export
function lineAtBep
(view, bep) {
  let l

  l = view.ed.state.doc.lineAt(bep)
  return l.text
}

export
function lineAt
(view, pos) {
  let l

  l = view.ed.state.doc.lineAt(posToBep(view, pos))
  return l.text
}

// pos here is bred pos (vs the pos's that were in the old ace/mon backends)
export
function vsetPos
(view, pos, reveal) {
  return vsetBepSpec(view, posToBep(view, pos), { reveal })
}

// pos here is bred pos (vs the pos's that were in the old ace/mon backends)
export
function vgetPos
(view) {
  return bepToPos(view, vgetBep(view))
}

export
function vsetBepSpec
(view, bep, spec) { // { reveal /* 1 nearest 2 center */, keepSelection, goalCol }
  let tr

  d('goalCol: ' + spec.goalCol)
  if (spec.keepSelection && view.markActive)
    tr = { selection: { anchor: view.ed.state.selection.main.anchor,
                        head: bep,
                        goalColumn: spec.goalCol },
           userEvent: 'select' }
  else
    // the goalColumn is only set when the wrapping create is used.
    tr = { selection: CMState.EditorSelection.create([ CMState.EditorSelection.cursor(bep, 0, undefined, spec.goalCol) ]),
           userEvent: 'select' }
  if (spec.reveal == 1)
    tr.effects = CMView.EditorView.scrollIntoView(bep, { y: 'nearest' })
  else if (spec.reveal == 2)
    tr.effects = CMView.EditorView.scrollIntoView(bep, { y: 'center' })
  return view.ed.dispatch(tr)
}

export
function ensurePointVisible
(view) {
  if (view.ed) {
    let tr

    tr = {}
    tr.effects = CMView.EditorView.scrollIntoView(vgetBep(view))
    view.ed.dispatch(tr)
  }
}

export
function makeBep
(view,
 row, // 0 indexed
 col) { // 0 indexed
  return view.ed.state.doc.line(row + 1).from + col
}

export
function posRow
(pos) {
  if (pos?.lineNumber)
    return pos.lineNumber - 1
  if (pos?.row)
    return pos.row
  return 0
}

export
function posCol
(pos) {
  if (pos?.column)
    return pos.column - 1
  if (pos?.col)
    return pos.col
  return 0
}

// Back End Positions

export
function vgetBep
(view) {
  return view.ed.state.selection.main.head
}

export
function bepGt
(bep1, bep2) {
  return bep1 > bep2
}

export
function bepGtEq
(bep1, bep2) {
  return bep1 >= bep2
}

export
function bepLt
(bep1, bep2) {
  return bep1 < bep2
}

export
function bepLtEq
(bep1, bep2) {
  return bep1 <= bep2
}

// 0 indexed
export
function bepRow
(view, bep) {
  let line

  line = view.ed.state.doc.lineAt(bep)
  return line.number - 1
}

export
function rowLen
(view, row) { // 0 indexed
  let bep, line

  bep = makeBep(view, row, 0)
  line = view.ed.state.doc.lineAt(bep)
  return line.length
}

// 0 indexed
export
function bepCol
(view, bep) {
  let line

  line = view.ed.state.doc.lineAt(bep)
  return bep - line.from
}

export
function vgetBepEnd
(view) {
  return view.ed.state.doc.length
}

export
function vsetBep
(view, bep, reveal, // 1 nearest, 2 center
 keepSelection) {
  //d('vsetBep ' + bep)
  return vsetBepSpec(view, bep, { reveal, keepSelection })
}

export
function vbepIncr
(view, bep) {
  return bep + 1
}

export
function vbepEq
(bep1, bep2) {
  return bep1 == bep2
}

export
function bepRightOverSpace
(view, bep) {
  let line

  line = view.ed.state.doc.lineAt(bep)
  spRe.lastIndex = 0
  if (spRe.exec(line.text.slice(bep - line.from)))
    bep += spRe.lastIndex

  return bep
}

// pos here is bred pos (vs monaco/ace pos)
export
function bepToPos
(view, bep) {
  let line

  line = view.ed.state.doc.lineAt(bep)
  return Ed.makePos(line.number - 1, bep - line.from)
}

// pos here is bred pos (vs monaco/ace pos)
export
function posToBep
(view, pos) {
  return view.ed.state.doc.line(pos.row + 1).from + pos.column
}

export
function bepToOff
(view, bep) {
  return bep
}

export
function offToBep
(view, off) {
  return off
}

function line
(view, n) {
  let l, bep

  if (n == -1)
    bep = view.ed.state.doc.length
  else
    bep = vgetBep(view)
  l = view.ed.state.doc.lineAt(bep)
  return l.text
}

function excur
(view, cb) {
  let bep, ret

  bep = vgetBep(view)
  try {
    ret = cb()
  }
  finally {
    if (bep > view.ed.state.doc.length)
      vsetBep(view, view.ed.state.doc.length)
    else
      vsetBep(view, bep)
  }
  return ret
}

export
function vgotoLine
(view, num) { // 1 indexed
  let bep, last

  num = parseInt(num)
  last = vlen(view)
  if (num < 1)
    num = 1
  if (num > last)
    num = last
  bep = view.ed.state.doc.line(num).from
  vsetBep(view, bep, 2)
}

function vendBep
(v) {
  return v.ed.state.doc.length
}

// get end line number
export
function vlen
(v) {
  let end, line

  end = vendBep(v)
  line = v.ed.state.doc.lineAt(end)
  return line.number
}

function addMinor
(b, mode) {
  //d(' ed adding minor ' + mode.name + ' to ' + b.name)
  if (mode.minor)
    b.views.forEach(v => {
      let effects, exts

      // remove old minor specific extensions, add new ones
      exts = WodeMode.makeExtsMinors(v)
      effects = v.wode.comp.extsMinors.reconfigure(exts)
      v.ed.dispatch({ effects })
    })
  else
    Mess.warn('addMinor: attempt to add major: ' + mode?.name)
}

export
function makePsn
(view, bep) {
  let psn

  function getText
  () {
    let line

    line = view.ed.state.doc.lineAt(bep)
    if (line)
      return line.text.slice(bep - line.from)
    return ''
  }

  function charLeft
  (u) {
    bep -= (u || 1)
    if (bep < 0) {
      bep = 0
      return true
    }
  }

  function charRight
  (u) {
    let end

    end = vgetBepEnd(view)
    bep += (u || 1)
    if (bep > end) {
      bep = end
      return true
    }
  }

  function lineRightOverSpace
  () {
    let line

    line = view.ed.state.doc.lineAt(bep)
    spRe.lastIndex = 0
    if (spRe.exec(line.text.slice(bep - line.from)))
      bep += spRe.lastIndex
  }

  function lineStart
  () {
    let line

    line = view.ed.state.doc.lineAt(bep)
    if (line)
      bep = line.from
  }

  function lineEnd
  () {
    let line

    line = view.ed.state.doc.lineAt(bep)
    if (line)
      bep = line.to
  }

  function lineNext
  () {
    let line, end

    end = vgetBepEnd(view)

    if (bep == end)
      return 0

    line = view.ed.state.doc.lineAt(bep)
    if (line) {
      bep = line.to
      bep++
      if (bep > end) {
        bep--
        return 0
      }
      return 1
    }

    return 0
  }

  function linePrev
  () {
    let line

    if (bep == 0)
      return 0

    line = view.ed.state.doc.lineAt(bep)
    if (line) {
      let off

      off = bep - line.from
      bep = line.from
      if (bep == 0)
        return 0

      bep--
      line = view.ed.state.doc.lineAt(bep)
      if (line) {
        bep = line.from
        if (off > line.length)
          bep += line.length
        else
          bep += off
        return 1
      }
      return 0
    }

    return 0
  }

  bep = bep ?? vgetBep(view)

  psn = { get bep() {
    return bep
  },
          get col() { // 0 indexed
            return bepCol(view, bep)
          },
          get eol() {
            return bep == view.ed.state.doc.lineAt(bep).to
          },
          get pos() {
            return bepToPos(view, bep)
          },
          get row() { // 0 indexed
            return bepRow(view, bep)
          },
          get text() {
            return getText()
          },
          //
          charLeft,
          charRight,
          lineEnd,
          lineNext,
          lineRightOverSpace,
          linePrev,
          lineStart }

  return psn
}

export
function vregion
(view) {
  let reg, from, to, end

  function makePsns
  () {
    let psn, psns

    psns = []

    if (from > to)
      psn = makePsn(view, to)
    else
      psn = makePsn(view, from)

    while (psn.bep <= end) {
      d('push ' + psn.bep)
      psns.push(psn)
      psn = makePsn(view, psn.bep)
      psn.lineStart()
      psn.lineNext()
      d(psn.bep)
    }

    return psns
  }

  from = view.ed.state.selection.main.from
  to = view.ed.state.selection.main.to
  d({ from })
  d({ to })

  if (from > to)
    end = from
  else
    end = to
  d({ end })

  reg = { get chars() {
    return to - from
  },
          get end() {
            return makePsn(view, end)
          },
          get from() {
            return from
          },
          get to() {
            return to
          },
          get psns() {
            return makePsns()
          } }

  return reg
}

export
function initModeFns
(mo) {
  function getCallers
  (view,
   cb, // ({ node, def, callers, err })
   cbSig) { // ({ sig })
    let state, err

    state = view.ed.state
    if (state) {
      let node, word

      node = CMLang.syntaxTree(state).resolveInner(vgetBep(view))

      word = view.pos
      word.view = view
      Lsp.callers(view.buf.opt('core.lang'), view.buf.path, view.buf.id, word,
                  ret => cb({ node,
                              def: ret?.def,
                              callers: ret?.callers }),
                  cbSig)
      return
    }
    err = { err: 'Missing state' }
    cb(err)
    return err
  }

  function clear
  (b) {
    let view

    view = b.anyView()
    if (view) {
      WodeCommon.setValue(view.ed, '', true)
      return
    }
    // When the buffer was in some pane, but is no longer in any pane, then
    // the view will be reused if the buffer is shown in a pane again.
    b.views.forEach(v => {
      if (v.ed)
        try {
          WodeCommon.setValue(v.ed, '', true)
        }
        catch (e) {
          // I dunno, maybe ed was already destroyed.
          d('clear: ' + e)
        }
    })
  }

  function clearLine
  (b) {
    let view

    view = b.anyView()
    if (view?.ed) {
      let start, r, l

      start = vgetPos(view)
      l = lineAt(view, start)
      if (l.length) {
        r = WodeRange.fromPoints(view,
                                 Ed.makePos(start.row, 0),
                                 Ed.makePos(start.row, l.length))
        r.remove()
      }
    }
  }

  function text
  (view) {
    return view.ed.state.doc.toString()
  }

  function lang
  (view) {
    return view.buf.opt('core.lang')
  }

  function langData
  (view) {
    let data

    data = view.ed.state.languageDataAt('commentTokens', vgetBep(view))
    if (data.length)
      return { legacy: 0,
               comment: { line: data[0].line,
                          block: data[0].block } }
    return null
  }

  function off
  (b, name, cb) {
    if (name == 'change')
      b.views.forEach(view => {
        if (view.win == Win.current())
          WodeView.voffChange(view, cb)
      })
  }

  function on
  (b, name, cb) {
    if (name == 'change')
      b.views.forEach(view => {
        if (view.win == Win.current())
          WodeView.vonChange(view, cb)
      })
  }

  function setPlaceholder
  (view, val) {
    view.ed.dispatch({ effects: view.wode.placeholder.reconfigure(WodeView.makePlaceholder(val)) })
  }

  function syntaxTreeStr
  (b) {
    let state

    state = b?.anyView()?.ed?.state
    if (state)
      return LezUtils.pretty(CMLang.syntaxTree(state).topNode)
    return 'ERR'
  }

  mo.addMinor = addMinor
  mo.clear = clear
  mo.clearLine = clearLine
  mo.gotoLine = vgotoLine
  mo.lang = lang
  mo.langData = langData
  mo.line = line
  mo.lineAt = lineAt
  mo.lineEnd = lineEnd
  mo.lineStart = lineStart
  mo.excur = excur
  mo.getCallers = getCallers
  mo.goXY = vgoXY
  mo.makePsn = makePsn
  mo.off = off
  mo.on = on
  mo.prevLine = prevLine
  mo.region = vregion
  mo.nextLine = nextLine
  mo.seize = mo.seize || (b => WodeMode.seize(b, mo))
  mo.setBep = vsetBep
  mo.setPlaceholder = setPlaceholder
  mo.syntaxTreeStr = syntaxTreeStr
  mo.text = text
  mo.viewReopen = WodeView.reopen
}

function edexec
(ed, markActive, cmd, markCmd, args) {
  return ((markCmd && markActive) ? markCmd : cmd)(ed, args)
}

function vexec
(view, cmd, markCmd, args) {
  return edexec(view.ed, view.markActive, cmd, markCmd, args)
}

function pexec
(p, cmd, markCmd, args) {
  return vexec(p.view, cmd, markCmd, args)
}

function exec
(cmd, markCmd, args) {
  return vexec(Pane.current().view, cmd, markCmd, args)
}

function utimes
(u, cb) {
  u = u || 1
  for (let i = 0; i < u; i++)
    cb()
}

// nav

export
function vforward(v, u) {
  utimes(u, () => vexec(v, CMComm.cursorCharRight, CMComm.selectCharRight))
}

export
function forward(u) {
  let p

  p = Pane.current()
  vforward(p.view, u)
}

export
function backward(u) {
  let p

  p = Pane.current()
  utimes(u, () => pexec(p, CMComm.cursorCharLeft, CMComm.selectCharLeft))
}

export
function wordForward(u) {
  let p

  p = Pane.current()
  Ed.vwordForward(p.view, u)
}

export
function wordBackward(u) {
  //utimes(u, () => pexec(p, 'cursorWordStartLeft', 'cursorWordStartLeftSelect'))
  wordForward(u ? -u : -1)
}

export
function groupForward(u) {
  let p

  p = Pane.current()
  utimes(u, () => pexec(p, CMComm.cursorGroupRight, CMComm.selectGroupRight))
}

export
function groupBackward(u) {
  let p

  p = Pane.current()
  utimes(u, () => pexec(p, CMComm.cursorGroupLeft, CMComm.selectGroupLeft))
}

export
function syntaxForward(u) {
  let p

  p = Pane.current()
  utimes(u, () => pexec(p, CMComm.cursorSyntaxRight, CMComm.selectSyntaxRight))
}

export
function syntaxBackward(u) {
  let p

  p = Pane.current()
  utimes(u, () => pexec(p, CMComm.cursorSyntaxLeft, CMComm.selectSyntaxLeft))
}

export
function prevWrappedLine(v, u) {
  utimes(u, () => vexec(v, CMComm.cursorLineUp, CMComm.selectLineUp))
}

export
function nextWrapedLine(v, u) {
  utimes(u, () => vexec(v, CMComm.cursorLineDown, CMComm.selectLineDown))
}

function prevLine1(v) {
  let bep, col, goalCol

  bep = vgetBep(v)
  line = v.ed.state.doc.lineAt(bep)
  goalCol = v.ed.state.selection.main.goalColumn
  //d('goalCol was ' + goalCol)
  if (goalCol)
    col = goalCol
  else
    col = bep - line.from
  bep = line.from
  if (bep > 0) {
    bep--
    line = v.ed.state.doc.lineAt(bep)
    bep = line.from
    if (line.length < col)
      bep += line.length
    else
      bep += col
  }
  //d('goalCol set ' + col)
  vsetBepSpec(v, bep, { goalCol: col, reveal: 1 })
  //d('goalCol now ' + v.ed.state.selection.main.goalColumn)
}

export
function prevLine(v, u) {
  if (v.markActive)
    utimes(u, () => CMComm.selectLineUp(v.ed))
  else
    utimes(u, () => prevLine1(v))
}

function nextLine1(v) {
  let bep, col, goalCol

  bep = vgetBep(v)
  line = v.ed.state.doc.lineAt(bep)
  goalCol = v.ed.state.selection.main.goalColumn
  //d('goalCol was ' + goalCol)
  if (goalCol)
    col = goalCol
  else
    col = bep - line.from
  bep = line.to
  if (bep < vgetBepEnd(v)) {
    bep++
    line = v.ed.state.doc.lineAt(bep)
    if (line.length < col)
      bep += line.length
    else
      bep += col
  }
  //d('goalCol set ' + col)
  vsetBepSpec(v, bep, { goalCol: col, reveal: 1 })
  //d('goalCol now ' + v.ed.state.selection.main.goalColumn)
}

export
function nextLine(v, u) {
  if (v.markActive)
    utimes(u, () => CMComm.selectLineDown(v.ed))
  else
    utimes(u, () => nextLine1(v))
}

export
function prevBoundary(v, u) {
  utimes(u, () => vexec(v, CMComm.cursorLineBoundaryBackward, CMComm.selectLineBoundaryBackward))
}

export
function nextBoundary(v, u) {
  utimes(u, () => vexec(v, CMComm.cursorLineBoundaryForward, CMComm.selectLineBoundaryForward))
}

export
function clearSelection
(view) {
  let head

  head = view.ed.state.selection.main.head
  view.markActive = 0
  return view.ed.dispatch({ selection: { anchor: head,
                                         head } })
}

function setSelection
(view, fromTo) {
  return view.ed.dispatch({ selection: { anchor: fromTo.from,
                                         head: fromTo.to } })
}

function regionRange
(view) {
  let head

  function range
  (from, to) {
    return WodeRange.make(view, from, to)
  }

  head = view.ed.state.selection.main.head
  if (view.marks.length) {
    let mark

    mark = view.marks.at(-1)
    if (head > mark)
      return range(mark, head)
    return range(head, mark)
  }
  return range(head, head)
}

function selReverse
(view) {
  let anchor, head

  anchor = view.ed.state.selection.main.anchor
  head = view.ed.state.selection.main.head
  return view.ed.dispatch({ selection: { anchor: head,
                                         head: anchor } })
}

export
function addMarkAt
(view, bep) {
  view.marks.push(bep)
}

export
function setMark(u) {
  let p

  p = Pane.current()
  if ((Cmd.lastFlag('Set Mark') == 2) || (u == 4)) {
    let mark

    Cmd.flagLast('Set Mark', 2)
    if (p.view.marks.length == 0) {
      Mess.say('Set a mark first')
      return
    }
    clearSelection(p.view)
    mark = p.view.marks.pop()
    Mess.say('Mark popped')
    vsetBep(p.view, mark, 1)
  }
  else {
    let bep

    bep = vgetBep(p.view)
    addMarkAt(p.view, bep)
    if (p.view.markActive)
      clearSelection(p.view)
    p.view.markActive = 1
    Mess.say('Mark pushed')
    //d(p.view.marks)
    //p.view.ed.setSelection(new Mon.Selection(pos.lineNumber, pos.column, pos.lineNumber, pos.column))
  }
}

export
function activateMark
() {
  let p

  p = Pane.current()
  p.view.markActive = 1
  setSelection(p.view, regionRange(p.view))
}

export
function exchange() {
  let p, point, mark

  p = Pane.current()
  point = vgetBep(p.view)
  if (p.view.marks.length == 0) {
    Mess.say('Set a mark first')
    return
  }
  mark = p.view.marks.pop()
  if (p.view.markActive)
    selReverse(p.view)
  else
    vsetBep(p.view, mark, 1) // want to use 3rd option "reveal in center if off screen else stay the same"
  p.view.marks.push(point)
}

export
function lineStart
(view) {
  view = view || Pane.current().view
  if (view.markActive)
    CMComm.selectLineStart(view.ed)
  else
    CMComm.cursorLineStart(view.ed)
}

export
function lineEnd
(view) {
  view = view || Pane.current().view
  if (view.markActive)
    CMComm.selectLineEnd(view.ed)
  else
    CMComm.cursorLineEnd(view.ed)
}

export
function vbufEnd(v) {
  vexec(v, CMComm.cursorDocEnd)
}

export
function vbufStart(v) {
  vexec(v, CMComm.cursorDocStart)
}

function bufferStartEnd
(cursor, select) {
  let p

  p = Pane.current()
  if (p.view.markActive) {
  }
  else {
    setMark()
    clearSelection(p.view)
  }
  vexec(p.view, cursor, select)
}

export
function bufferStart() {
  bufferStartEnd(CMComm.cursorDocStart, CMComm.selectDocStart)
}

export
function bufferEnd() {
  bufferStartEnd(CMComm.cursorDocEnd, CMComm.selectDocEnd)
}

export
function scrollUp() {
  exec(CMComm.cursorPageUp, CMComm.selectPageUp)
}

export
function scrollDown() {
  exec(CMComm.cursorPageDown, CMComm.selectPageDown)
}

export
function toggleOverwrite() {
  exec('overwrite')
}

export
function selectAll() {
  exec(CMComm.selectAll)
}

function lineIsClear
(line, extras) {
  let text

  text = line.text
  if ((text.length == 0) || text.startsWith(' ') || text.startsWith('\t'))
    return 1
  if (extras)
    for (let i = 0; i < extras.length; i++)
      if (text.startsWith(extras[i]))
        return 1
  return 0
}

function lineIsText
(line, extras) {
  if (lineIsClear(line, extras))
    return 0
  return 1
}

export
function topLevelStart
(extras) {
  let p, bep, l

  p = Pane.current()

  bep = vgetBep(p.view)
  //d('endLine: ' + endLine)
  l = p.view.ed.state.doc.lineAt(bep)
  while ((l.number > 1) && lineIsText(l, extras)) {
    bep = l.from - 1
    l = p.view.ed.state.doc.lineAt(bep)
  }

  while ((l.number > 1) && lineIsClear(l, extras)) {
    bep = l.from - 1
    l = p.view.ed.state.doc.lineAt(bep)
  }

  if (p.view.markActive)
    WodeCommon.vsetSel(p.view, p.view.ed.state.selection.main.to, l.from, 1)
  else
    vsetBep(p.view, l.from, 1)
}

export
function topLevelEnd
(extras) {
  let p, bep, endLine, l

  p = Pane.current()
  bep = vgetBep(p.view)
  endLine = vlen(p.view)
  //d('endLine: ' + endLine)
  l = p.view.ed.state.doc.lineAt(bep)
  while ((l.number < endLine) && lineIsText(l, extras)) {
    bep = l.to + 1
    l = p.view.ed.state.doc.lineAt(bep)
  }

  while ((l.number < endLine) && lineIsClear(l, extras)) {
    bep = l.to + 1
    l = p.view.ed.state.doc.lineAt(bep)
  }

  if (p.view.markActive)
    WodeCommon.vsetSel(p.view, p.view.ed.state.selection.main.from, l.from, 1)
  else
    vsetBep(p.view, l.from, 1)
}

function containsVertically
(rect1, rect2) {
  //d(rect2)
  return ((rect1.y <= rect2.y)
          && (rect1.bottom >= rect2.bottom))
}

function makeRect
(rect, ele) {
  if (rect) {
    let r, width, height

    width = rect.width
    height = rect.height
    if (ele) {
      // exclude scrollbars
      width = ele.clientWidth
      height = ele.clientHeight
    }

    r = { left: rect.left,
          x: rect.left,
          top: rect.top,
          y: rect.y,
          width,
          height }

    r.right = r.x + r.width
    r.bottom = r.y + r.height

    return r
  }
}

function lineEle
(view, bep) {
  let node, ele

  // https://discuss.codemirror.net/t/function-method-for-getting-a-lines-dom-element/8208
  node = view.ed.domAtPos(bep)
  ele = node?.node
  while (ele) {
    if ((ele instanceof globalThis.HTMLElement) && Css.has(ele, 'cm-line'))
      break
    ele = ele.parentNode
  }
  return ele
}

function lineFullyVisible
(view, rect, lineStart) {
  let ele, lineRect

  ele = lineEle(view, lineStart)
  if (ele)
    lineRect = makeRect(ele.getBoundingClientRect(), ele)
  return rect && lineRect && containsVertically(rect, lineRect)
}

function xBep
(view, bottom) {
  let rect, xEdge, yEdge, bep, scroller, first

  //return view.ed.viewport.from
  //return view.ed.visibleRanges.at(0)?.from || 0

  //d(view.ed.dom)
  scroller = view.ed.scrollDOM
  //d(scroller)
  rect = makeRect(scroller.getBoundingClientRect(), scroller)
  yEdge = bottom ? rect.bottom : rect.top
  xEdge = rect.x

  if (0) {
    let leeway

    // a little leeway because the text is still visible even when the
    // line is slightly outside the scroller.
    leeway = 3
    if (bottom) {
      rect.bottom += leeway
      rect.height += leeway
    }
    else
      if (rect.top > leeway) {
        rect.top -= leeway
        rect.y -= leeway
        rect.height += leeway
      }
      else {
        rect.height -= rect.top
        rect.top = 0
        rect.y = 0
      }
  }

  //d(rect)
  bep = view.ed.posAtCoords({ x: xEdge, y: yEdge }) || 0
  bep = vlineStart(view, bep)
  first = bep
  for (let i = 0; i < 10; i++) {
    let line

    line = view.ed.state.doc.lineAt(bep)
    if (line) {
      d('bep: ' + bep + ' line: ' + line.number)
      if (lineFullyVisible(view, rect, bep))
        return bep
      if (bottom)
        bep = vlineStart(view, line.from - 1)
      else
        bep = line.to + 1
    }
  }
  return first
}

export
function bottomBep
(view) {
  return xBep(view, 1)
}

export
function topBep
(view) {
  return xBep(view)
}

export
function topOfPane
() {
  let p, bep

  p = Pane.current()
  bep = topBep(p.view)
  vsetBep(p.view, bep, 0, 1)
}

export
function bottomOfPane
() {
  let p, bep

  p = Pane.current()
  bep = bottomBep(p.view)
  vsetBep(p.view, bep, 0, 1)
}

export
function recenter
(view) {
  if (view?.ed) {
    let bep, scroller, middle, ele, rect

    bep = vgetBep(view)
    d('bep: ' + bep + ' line: ' + view.ed.state.doc.lineAt(bep).number)
    scroller = view.ed.scrollDOM
    middle = scroller.clientHeight / 2
    d('middle: ' + middle)
    rect = makeRect(scroller.getBoundingClientRect(), scroller)
    d(rect)
    ele = lineEle(view, bep)
    d(ele)
    if (ele) {
      let lineRect, dest, delta, middleLine

      lineRect = makeRect(ele.getBoundingClientRect(), ele)
      d(lineRect)
      middleLine = lineRect.height / 2
      delta = (lineRect.y - rect.y) // distance from top of line to top of pane
      d('scrollTop: ' + scroller.scrollTop)
      d('scrollHeight: ' + scroller.scrollHeight)
      d('delta: ' + delta)
      dest = Math.max(scroller.scrollTop + delta - middle + middleLine, 0)
      d('dest: ' + dest)
      if (lineRect)
        scroller.scrollTop = dest
    }
  }
}

export
function cancel
() {
  //exec('keyboardQuit')
  clearSelection(Pane.current().view)
  Pane.cancel()
}

export
function vsaveAs
(view, cb) {
  d('save as')
  d({ view })
  d({ cb })
}

export
function vsave
(view, cb) { // (err)
  if (view?.ed)
    if (view.buf.path) {
      Css.disable(view.ele)
      Tron.cmd('file.save', [ Loc.make(view.buf.path).expand(), view.ed.state.doc.toString() ], (err, data) => {
        Css.enable(view.ele)
        view.ed.focus()
        if (err) {
          if (cb)
            cb(err)
          else
            Mess.yell(err.message)
          return
        }
        view.buf.modified = 0
        view.buf.modifiedOnDisk = 0
        view.buf.stat = data.stat
        Ed.setIcon(view.buf, '.edMl-mod', 'blank')
        if (cb)
          cb()
        else
          Mess.say('Saved')
      })
    }
    else if (cb)
      cb(new Error('Buf needs path'))
    else
      Mess.toss('Buf needs path')

  else if (cb)
    cb(new Error('Must be an Ed buf'))
}

// modify

export
function undo
() {
  let pview

  pview = Pane.current().view
  if (exec(CMComm.undo)) {
    if (CMComm.undoDepth(pview.ed.state) > 0)
      // there's more to undo
      return
  }
  else
    Mess.say("That's all")
  pview.buf.modified = 0
  Ed.setIcon(pview.buf, '.edMl-mod', 'blank')
}

export
function redo
() {
  exec(CMComm.redo)
}

export
function setDecorMatch
(decorParent, view, range) {
  if (decorParent.decorMatch) {
    d('redecorate match')
    if (0)
      decorParent.decorMatch.update({ needle: range.text })
  }
}

export
function setDecorAll
(decorParent, view, needle) {
  if (decorParent.decorAll) {
    d('redecorate all')
    decorParent.decorAll.update({ needle })
  }
}

export
function vinsert1
(view, u, text) {
  let bep

  bep = vgetBep(view)
  vinsertAt(view, bep, u, text, 1)
}

export
function vinsertAll
(view, u, text) {
  vinsert1(view, u, text)
}

export
function vinsertAt
(v, bep, u, text, setBep, to) {
  if (v.ele) {
    clearSelection(v)
    if (typeof text == 'number')
      text = text.toString()
    for (let i = 0; i < u; i++) {
      if (setBep) {
        //d('insertAt ' + bep + ' replace')

        // this way in case there are chars like backspace in the string that will be filtered out by cm
        // (if use selection with changes dispatch below then the selection will be wrong if cm filters
        //  out chars)

        setSelection(v, { from: bep ?? 0,
                          to: to ?? (bep ?? 0) })
        // this will set the bep to the end of the text
        v.ed.dispatch(v.ed.state.replaceSelection(text))
        v.ed.dispatch({ scrollIntoView: true })
        return
      }

      //d('insertAt ' + bep)
      v.ed.dispatch({ changes: { from: bep ?? 0,
                                 to: to ?? (bep ?? 0),
                                 insert: text } })
    }
  }
}

export
function vreplaceAt
(view, range, text,
 more) { // [ { range, text }* ]  Must order desc by position, and 'more' ranges must come after range in arg 2.
  if (view.ele) {
    vinsertAt(view, range.from, 1, text, 1, range.to)
    if (more)
      more.forEach(m => vinsertAt(view, m.range.from, 1, m.text, 1, m.range.to))
  }
}

export
function vreplaceAtAll
(view, range, text, more) {
  // Peer does the "all" part
  return vreplaceAt(view, range, text, more)
}

function isOpenBracket
(char) {
  // really depends on lang which char could be open brackets
  return [ '(', '<', '{', '[', "'", '"' ].includes(char)
}

export
function selfInsert
(u, we) {
  let char, p, bracket

  if ([ 'Alt', 'Control', 'CapsLock', 'Shift' ].includes(we.key))
    return

  char = Ed.charForInsert(we)

  p = Pane.current()
  u = u || 1

  if (p.buf.opt('core.brackets.close.enabled'))
    bracket = isOpenBracket(char)

  if (bracket && (u == 1)) {
    let tr

    tr = CMAuto.insertBracket(p.view.ed.state, char)
    if (tr)
      p.view.ed.dispatch(tr)
    else
      vinsert1(p.view, u, char)
  }
  else
    vinsert1(p.view, 1, char.repeat(u))

  if (char == ' ')
    return
  if (bracket)
    return
  suggest()
}

export
function quotedInsert
(u) {
  let p, oldOnKeyDown

  oldOnKeyDown = globalThis.onkeydown
  p = Pane.current()
  Mess.echoMore('C-q-')
  globalThis.onkeydown = e => {
    e.preventDefault()
    if ([ 'Alt', 'Control', 'CapsLock', 'Shift' ].includes(e.key))
      return
    try {
      let char

      char = Ed.charForInsert({ e })
      vinsert1(p.view, u, char)
    }
    finally {
      globalThis.onkeydown = oldOnKeyDown
      Mess.say()
    }
  }
}

export
function caseWord(cb) {
  let p, range, origHead, origAnch, sel, bep, str

  p = Pane.current()

  // get the range to be cased
  bep = vgetBep(p.view)
  origHead = p.view.ed.state.selection.head
  origAnch = p.view.ed.state.selection.anchor
  clearSelection(p.view)
  CMComm.selectGroupRight(p.view.ed)
  sel = p.view.ed.state.selection.main
  if (sel.head > sel.anchor)
    range = WodeRange.make(p.view, sel.anchor, sel.head)
  else
    range = WodeRange.make(p.view, sel.head, sel.anchor)
  str = range.text
  str = cb(str, p.view)
  vsetBep(p.view, bep)

  // case range in current view
  {
    let view, vorigHead, vorigAnch

    view = p.view
    vorigHead = view.ed.state.selection.head
    vorigAnch = view.ed.state.selection.anchor
    clearSelection(view)
    range.remove()
    vinsertAt(view, bep, 1, str)
    view.ed.state.selection.head = vorigHead
    view.ed.state.selection.anchor = vorigAnch
  }

  // move point in current pane
  p.view.ed.state.selection.head = origHead
  p.view.ed.state.selection.anchor = origAnch
  vsetBep(p.view, range.to)
}

export
function capitalizeWord() {
  caseWord(str => {
    // better go beginning of word
    Ed.nonTokenRe.lastIndex = 0
    if (Ed.nonTokenRe.exec(str) === null)
      str = Buf.capitalize(str)
    else {
      let i

      i = Ed.nonTokenRe.lastIndex
      str = str.slice(0, i) + Buf.capitalize(str.slice(i))
    }
    return str
  })
}

export
function newline
() {
  exec(CMComm.insertNewline)
}

export
function newlineAndIndent
() {
  let p

  p = Pane.current()
  if (p.buf.opt('core.comments.continue')
      && CMCont.insertNewlineContinueComment({ state: p.view.ed.state,
                                               dispatch: p.view.ed.dispatch }))
    return
  exec(CMComm.insertNewlineAndIndent)
}

export
function insertSlash
(u) {
  let p

  p = Pane.current()
  u = u || 1

  if (p.buf.opt('core.comments.continue')
      && CMCont.maybeCloseBlockComment({ state: p.view.ed.state,
                                         dispatch: p.view.ed.dispatch }))
    return

  vinsert1(p.view, u, '/')
}

export
function openLine() {
  exec(CMComm.splitLine)
}

export
function delPrevChar() {
  exec(CMComm.deleteCharBackward)
}

export
function delNextChar() {
  exec(CMComm.deleteCharForward)
}

export
function cutLine() {
  let p, str, bep, range

  p = Pane.current()
  bep = vgetBep(p.view)
  line = p.view.ed.state.doc.lineAt(bep)
  range = WodeRange.make(p.view, bep, line.to)
  str = range.text
  if (str.length) {
    range.remove()
    Cut.add(str)
  }
  else {
    delNextChar()
    Cut.add('\n')
  }
}

export
function delNextWordBound
(n) {
  let p, start, end, text, range

  p = Pane.current()
  clearSelection(p.view)
  start = vgetBep(p.view)
  if (n < 0)
    edexec(p.view.ed, p.view.markActive, CMComm.cursorGroupLeft)
  else
    edexec(p.view.ed, p.view.markActive, CMComm.cursorGroupRight)
  end = vgetBep(p.view)
  if (end >= start)
    range = WodeRange.make(p.view, start, end)
  else
    range = WodeRange.make(p.view, end, start)
  text = range.text
  if (text && text.length) {
    range.remove()
    Cut.add(text)
  }
  return p
}

export
function suggest() {
  exec(CMAuto.startCompletion)
}

export
function nextSuggest() {
  let p

  p = Pane.current()
  if (completionNextLine(p.view.ed))
    return
}

export
function prevSuggest() {
  let p

  p = Pane.current()
  if (completionPreviousLine(p.view.ed))
    return
}

export
function commentRegion
(u) {
  if (u == 4)
    exec(CMComm.lineUncomment)
  else
    exec(CMComm.lineComment)
}

export
function indentLine
() {
  let p, l, changes, newWhiteLen, anchor, bep
  let oldLeadingWhiteLen
  let oldTextOff // offset into the text that follows the leading whitespace on the current line

  function getWhiteLen
  (fromA, toA, fromB, toB, inserted) {
    d({ inserted })
    newWhiteLen = inserted?.text?.at(0).search(/\S|$/) // There should be only one change
  }

  p = Pane.current()

  if (CMAuto.acceptCompletion(p.view.ed))
    return

  bep = vgetBep(p.view)
  l = p.view.ed.state.doc.lineAt(bep)

  // get offset into existing line text (excl leading whitespace)
  oldTextOff = bep - l.from
  oldLeadingWhiteLen = l.text.search(/\S|$/)
  if (oldLeadingWhiteLen >= 0) {
    oldTextOff -= oldLeadingWhiteLen
    if (oldTextOff < 0)
      // point is in the leading whitespace
      oldTextOff = 0
  }
  else
    oldLeadingWhiteLen = 0
  if (oldTextOff < 0)
    // something went wrong
    oldTextOff = 0

  changes = CMLang.indentRange(p.view.ed.state, l.from, l.to)
  if (changes.empty) {
    if (oldTextOff == 0)
      // may have been inside leading whitespace, move to start of text
      vsetBep(p.view, l.from + oldLeadingWhiteLen)
    return
  }

  // get length of leading whitespace that line will have
  changes.iterChanges(getWhiteLen, false) // combine adjacent

  // calc new point
  anchor = l.from
  if (newWhiteLen > 0)
    anchor += newWhiteLen
  if (oldTextOff > 0)
    anchor += oldTextOff

  p.view.ed.dispatch({ changes,
                       selection: { anchor, head: anchor } })
}

export
function indentRegion
() {
  let p

  p = Pane.current()
  if (p.view.markActive) {
    let to, from, lto, changes

    from = p.view.ed.state.selection.main.from
    to = p.view.ed.state.selection.main.to

    from = p.view.ed.state.doc.lineAt(from).from
    lto = p.view.ed.state.doc.lineAt(to)
    if (lto.from == to)
      // region ends at start of line, skip that line
      to = lto.from - 1
    else
      to = lto.from
    if (to < from)
      // happens when region empty and at start of line
      to = from

    changes = CMLang.indentRange(p.view.ed.state, from, to)
    changes.empty || p.view.ed.dispatch({ changes })
    clearSelection(p.view)
  }
  else
    indentLine()
}

export
function indentBuffer
() {
  let p

  p = Pane.current()
  p.view.ed.dispatch({ changes: CMLang.indentRange(p.view.ed.state, 0, p.view.ed.state.doc.length) })
}

export
function sortLines
() {
  let p, lines, sorted, iter, lastWasBreak

  p = Pane.current()
  lines = []
  iter = p.view.ed.state.doc.iter()
  while (1) {
    line = iter.next()
    if (iter.done)
      break
    lastWasBreak = iter.lineBreak
    iter.lineBreak || lines.push(line.value)
  }
  sorted = lines.sort((a, b) => a.localeCompare(b))
  p.view.ed.dispatch({ changes: { from: 0,
                                  to: p.view.ed.state.doc.length,
                                  insert: sorted.map(l => l).join('\n') + (lastWasBreak ? '\n' : '') } })
}

export
function insertTwoSpaces() {
  vinsert1(Pane.current().view, 1, '  ')
}

export
function transposeChars() {
  exec(CMComm.transposeChars)
}

spRe = /^\s+/g

export
function trim() {
  let p, str, start, l

  p = Pane.current()
  start = vgetBep(p.view)
  l = p.view.ed.state.doc.lineAt(start)
  spRe.lastIndex = 0
  if (spRe.exec(l.text.slice(start - l.from)))
    WodeRange.make(p.view, start, start + spRe.lastIndex).remove()
  if (start > l.from) {
    str = [ ...l.text.slice(0, start - l.from) ].reverse().join('')
    spRe.lastIndex = 0
    if (spRe.exec(str))
      WodeRange.make(p.view, start - spRe.lastIndex, start).remove()
  }
}

export
function yank() {
  let p, str

  p = Pane.current()
  str = Cut.nth(0)
  if (str) {
    let bep

    bep = vgetBep(p.view)
    vinsert1(p.view, 1, str || '')
    // have to do this after otherwise the insert moves the mark
    addMarkAt(p.view, bep)
  }
  else
    Mess.say('Cut list empty')
}

export
function yankRoll() {
  if ([ 'Paste', 'Paste Roll', 'Yank', 'Yank Roll' ].includes(Cmd.last())) {
    let p, str

    p = Pane.current()
    Cut.roll()
    str = Cut.nth(0)
    if (str) {
      let r

      r = regionRange(p.view)
      vreplaceAt(p.view, r, str || '')
    }
    else
      Mess.say('Cut list empty')
    return
  }
  yank()
}

function vcutOrCopy
(view, cut) {
  let range, str

  if (view.markActive) {
    let sel

    sel = view.ed.state.selection.main
    if (sel.head > sel.anchor)
      range = WodeRange.make(view, sel.anchor, sel.head)
    else
      range = WodeRange.make(view, sel.head, sel.anchor)
  }
  else {
    let point, mark

    // still want to cut/copy to mark if there is one

    point = vgetBep(view)
    if (view.marks.length == 0) {
      Mess.say('Set a mark first')
      return
    }
    mark = view.marks.at(view.marks.length - 1)
    if (point > mark)
      range = WodeRange.make(view, mark, point)
    else
      range = WodeRange.make(view, point, mark)
  }
  str = range.text
  if (str && str.length) {
    if (cut)
      range.remove()
    Cut.add(str)
  }
  if (cut)
    view.markActive = 0
  clearSelection(view)
}

export
function cut() {
  vcutOrCopy(Pane.current().view, 1)
}

export
function copy() {
  vcutOrCopy(Pane.current().view)
}

export
function openLint() {
  exec(CMLint.openLintPanel)
}

export
function firstDiagnostic(u, we) {
  let p, done

  if (we?.e && (we.e.button == 0))
    p = Pane.holding(we.e.target.parentNode.querySelector('.pane'))
  p = p || Pane.current()
  CMLint.forEachDiagnostic(p.view.ed.state,
                           diag => {
                             if (done)
                               return
                             done = 1
                             d(diag)
                             vsetBep(p.view, diag.from, 2)
                             p.focus()
                           })
}

export
function find
(st) {
  let r

  clearSelection(st.view)
  r = WodeFind.vfind(st.view, st.from, 0, { skipCurrent: 0,
                                            backwards: 0,
                                            wrap: 0,
                                            caseSensitive: 1,
                                            wholeWord: 0,
                                            regExp: 0 })
  if (r)
    setSelection(st.view, r)
  return r
}

export
function replace
(st, all, search) {
  let r, bep

  bep = Math.min(st.view.ed.state.selection.main.anchor,
                 st.view.ed.state.selection.main.head)
  setSelection(st.view, { from: bep, to: bep })
  r = WodeFind.vfind(st.view, st.from, 0, { skipCurrent: 0,
                                            backwards: 0,
                                            wrap: 0,
                                            caseSensitive: 1,
                                            wholeWord: 0,
                                            regExp: 0 })
  if (r) {
    vreplaceAt(st.view, r, st.to)
    d('got one')
    if (all)
      return 1
    search()
    return 1
  }
  d("that's all 2")
  return 0
}

export
function vgoXY
(view, x, y) {
  let bep

  bep = view.ed.posAtCoords({ x, y })
  if (bep)
    vsetBep(view, bep)
}

export
function vtokenAt
(view, x, y) {
  let bep, tree, node

  bep = view.ed.posAtCoords({ x, y })
  if (bep === null)
    return null
  tree = CMLang.syntaxTree(view.ed.state)
  node = tree.resolve(bep)
  if (node)
    return { name: node.name,
             text: WodeRange.make(view, node.from, node.to).text }
  return null
}

export
function vforLines(view, cb) { // (line)
  let bep, end

  bep = 0
  end = vgetBepEnd(view)
  while (bep <= end) {
    let line

    line = view.ed.state.doc.lineAt(bep)
    cb(line)
    bep = line.to + 1
  }
}

export
function clearDecorMatch
(view, decorParent) {
  if (decorParent.decorMatch) {
    decorParent.decorMatch.remove()
    decorParent.decorMatch = 0
  }
}

export
function clearDecorAll
(view, decorParent) {
  if (decorParent.decorAll) {
    decorParent.decorAll.remove()
    decorParent.decorAll = 0
  }
}

export
function onBufRemove
(buf) {
  d('WODE handling remove of buf ' + buf.name)
  buf.views.forEach(view => {
    if (view.ed)
      view.ed.destroy()
  })
}

export
function addModes
() {
  // done by init
}

function initActiveLine
() {
  let css

  css = `
div.cm-line.cm-activeLine {
  position: relative;
  background: inherit;
}`

  globalThis.document.head.appendChild(globalThis.document.createElement('style')).innerHTML = css
}

function langFromCodeLang
(code) {
  if (code == 'sh')
    return 'shell'
  if (code == 'bash')
    return 'shell'
  return code
}

export
function code
(el, langId, text) {
  let lang, opts, state

  opts = [ WodeTheme.themeHighlightingCode,
           WodeTheme.themeExtensionCode,
           CMView.EditorView.editable.of(false) ]

  if (langId) {
    lang = Ed.findLang(langFromCodeLang(langId))
    if (lang?.language)
      opts = [ ...opts,
               lang.language,
               ...(lang.support ? [ lang.support ] : []) ]
    else
      Mess.log('code: Missed lang: ' + langId)
  }

  state = CMState.EditorState.create({ doc: text || '',
                                       extensions: opts })

  return new CMView.EditorView({ state,
                                 parent: el })
}

function para
(view) {
  let bep, bepEnd, start, end

  bep = vgetBep(view)
  bepEnd = vgetBepEnd(view)
  start = view.ed.state.doc.lineAt(bep)
  if (start.length == 0)
    return 0
  end = start
  while (1) {
    let l

    if (start.from == 0)
      break
    l = view.ed.state.doc.lineAt(start.from - 1)
    if (l.length == 0)
      break
    if (l.text.trim().length == 0)
      break
    start = l
  }
  while (end.length && end.text.trim().length) {
    if (end.to == bepEnd)
      break
    end = view.ed.state.doc.lineAt(end.to + 1)
  }
  return WodeRange.make(view, start.from, end.to)
}

export
function fill
(view, col) {
  let range, text

  range = para(view)
  text = range.text
  if (text.length) {
    let wrap, prep, bep

    //d({ text })

    bep = vgetBep(view)

    prep = text.replaceAll('\n', ' ').trim()
    //d({ prep })

    wrap = Wrap.wrap(prep, col)
    //d({ wrap })
    if (wrap == text)
      return
    vreplaceAt(view, range, wrap)
    vsetBep(view, bep)
  }
}

export
function flushTrailing
() {
  let p, r, text

  p = Pane.current()
  if (p.view.markActive) {
    r = regionRange(p.view)
    if (r.from == r.to)
      r.to = vgetBepEnd(p.view)
  }
  else
    r = WodeRange.make(p.view, vgetBep(p.view), vgetBepEnd(p.view))
  text = r.text
  if (text.length)
    vreplaceAt(p.view, r, text.replace(/[^\S\r\n]+$/gm, ''))
}

export
function init
() {
  wextIds = 0
  registeredOpts = new Set()

  completionNextLine = CMAuto.completionKeymap.find(e => e.key == 'ArrowDown').run
  completionPreviousLine = CMAuto.completionKeymap.find(e => e.key == 'ArrowUp').run

  WodeCommon.init()
  WodeHi.init()
  WodeLang.init()
  WodeMode.init() // before WodeTheme
  WodeTheme.init()
  initActiveLine()
  WodePatch.init()
  WodeWatch.init()
}
