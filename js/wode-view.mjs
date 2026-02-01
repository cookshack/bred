import * as Area from './area.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Ed from './ed.mjs'
import * as Frame from './frame.mjs'
import * as Icon from './icon.mjs'
import * as Loc from './loc.mjs'
import Mk from './mk.mjs'
import * as Mess from './mess.mjs'
import * as Pane from './pane.mjs'
import * as Tab from './tab.mjs'
import * as Tron from './tron.mjs'
import * as U from './util.mjs'
import * as Wode from './wode.mjs'
import * as WodeCommon from './wode-common.mjs'
import * as WodeDecor from './wode-decor.mjs'
import * as WodeHi from './wode-hi.mjs'
import * as WodeLang from './wode-lang.mjs'
import * as WodeMode from './wode-mode.mjs'
import * as WodePeer from './wode-peer.mjs'
import * as WodeRange from './wode-range.mjs'
import * as WodeWatch from './wode-watch.mjs'
import { d } from './mess.mjs'

import * as CMAuto from '../lib/@codemirror/autocomplete.js'
import * as CMComm from '../lib/@codemirror/commands.js'
import * as CMLang from '../lib/@codemirror/language.js'
import * as CMLint from '../lib/@codemirror/lint.js'
import * as CMState from '../lib/@codemirror/state.js'
import * as CMView from '../lib/@codemirror/view.js'
import { colorPicker } from '../lib/@replit/codemirror-css-color-picker.js'

export
function vonChange
(view, cb) { // (update)
  if (view.ed) {
    view.onChanges = view.onChanges || Mk.array
    //d('vonChange ' + cb)
    if (view.onChanges.find(o => o.cb == cb))
      Mess.toss('already have an onChange for this cb')
    view.onChanges.push({ cb })
    return cb
  }
}

export
function voffChange
(view, cb) {
  if (view.ed) {
    view.onChanges = view.onChanges || Mk.array
    view.onChanges.removeIf(o => o.cb === cb)
  }
}

export
function vonFocus
(view, cb) {
  if (view.ed) {
    view.onFocuss = view.onFocuss || Mk.array
    //d('vonFocus ' + cb)
    if (view.onFocuss.find(o => o.cb == cb))
      Mess.toss('already have an onFocus for this cb')
    view.onFocuss.push({ cb })
    return cb
  }
}

export
function voffFocus
(view, cb) {
  if (view.ed) {
    view.onFocuss = view.onFocuss || Mk.array
    view.onFocuss.removeIf(o => o.cb === cb)
  }
}

function ensureCursorVisible
(ed, scrollTop) {
  let pos, first, last

  //d('ensureCursorVisible')
  //d(scrollTop)
  pos = ed.getCursorPosition()
  d(pos)
  first = Math.floor(scrollTop / ed.renderer.lineHeight) - 1
  //d('first: ' + first)
  last = Math.floor((scrollTop + ed.renderer.$size.scrollerHeight) / ed.renderer.lineHeight) - 3
  //d('last: ' + last)
  if (pos.row < first) {
    pos.row = Math.max(0, first)
    ed.setPosition(pos)
  }
  else if (pos.row > last) {
    pos.row = Math.max(0, last)
    ed.setPosition(pos)
  }
}

function diagnose
(win, diag) {
  function covers
  (el, rect) {
    if (rect) {
      let rEl

      rEl = el.getBoundingClientRect()
      return rEl
        && (rEl.top <= rect.bottom)
        && (rEl.right >= rect.left)
    }
  }
  function xy
  () {
    let view, area, frame, tab

    area = Area.current(win)
    tab = Tab.current(area)
    frame = area && Frame.current(tab)
    view = frame && Pane.current(frame)?.view
    view = Pane.current().view
    return view?.ed?.coordsAtPos(Wode.vgetBep(view))
  }
  if (win && diag) {
    win.diag.lastElementChild.firstElementChild.innerText = diag.message
    win.diag.lastElementChild.lastElementChild.innerText = diag.source
    Css.add(win.diag, 'bred-' + diag.severity)
    Css.show(win.diag)
    if (covers(win.diag, xy()))
      Css.add(win.diag.parentNode, 'bred-diag-right')
    else
      Css.remove(win.diag.parentNode, 'bred-diag-right')
    return
  }
  Css.hide(win?.diag)
}

0 && function tip
(win, diags) {
  if (diags) {
    let diag

    diag = diags.filter(d => d).at(0)
    if (diag) {
      win.tip.lastElementChild.firstElementChild.innerText = diag.message
      win.tip.lastElementChild.lastElementChild.innerText = diag.source
      Css.add(win.tip, 'bred-' + diag.severity)
      Css.show(win.tip)
    }
    return
  }
}

function updateMarks
(view, update) {

  function dbg
  (msg) {
    0 && d(msg)
  }

  function contains
  (from, to, bep) {
    return (from > to) && (from <= bep) && (to >= bep)
  }

  function change
  (start, end, insert) {
    end = end ?? start
    if (start > end) {
      let tmp

      tmp = start
      start = end
      end = tmp
    }
    dbg('start: ' + start)
    dbg('end: ' + end)
    for (let i = view.marks.length - 1; i >= 0; i--) {
      let mark, delta

      mark = view.marks[i]
      dbg('mark: ' + mark)

      // first deal with removed range

      if (contains(start, end, mark)) {
        // Mark is in range, remove it
        dbg('= remove')
        view.marks.splice(i, 1)
        continue
      }
      if (mark < end) {
        dbg('= mark stays the same')
        continue
      }

      dbg('= mark is after')
      delta = end - start - 1

      dbg('delta: ' + delta)
      mark -= delta

      dbg('insert?.length: ' + insert?.length)
      mark += (insert?.length || 0)
      view.marks[i] = mark
    }
    dbg(view.marks)
  }

  dbg('== updateMarks')
  update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => change(fromA, toA, inserted),
                             false) // combine adjacent
  dbg('==')
}

export
function makePlaceholder
(ph) {
  if (ph?.length)
    return CMView.placeholder(String(ph))
  return []
}

function vsetLang
(view, id) {
  id = id || 'text'
  WodeLang.langs.find(l => l.id == id) || Mess.toss('missing lang: ' + id)
  d('vsetLang ' + id)
  view.buf.opts.set('core.lang', id)
  // this should happen in the opt
  if (view.buf.path)
    Tron.cmd('lsp.edit', [ id, view.buf.path, view.buf.id ], (err, data) => {
      if (err) {
        Mess.yell('lsp.edit: ' + err.message)
        return
      }
      if (data.lang)
        Mess.yell('Opened in lang server ' + data.lang + ': ' + view.buf.path)
    })
}

export
async function init
(view,
 // { text,
 //   modeWhenText,
 //   lineNum,
 //   revert,
 //   single,        // skip peer (for bufs that only appear in 1 place, like prompts)
 //   wextsMode }
 spec,
 whenReady) { // (view) // Runs when the view is ready and any file is loaded
  let data

  d('WODE peer.get ' + view.buf.id)
  d('WODE vi vid: ' + view.vid)
  view.buf.modified = 0
  Ed.setIcon(view.buf, '.edMl-mod', 'blank')
  view.ready = 0
  data = await Tron.acmd('peer.get', [ view.buf.id ])
  d('WODE peer.get ' + view.buf.id + ' ok (' + view.buf.name + ')')
  d({ data })
  _viewInit(spec.single ? 0 : WodePeer.make(view.buf.id, data.version),
            view,
            data.fresh ? 0 : data.text,
            spec.modeWhenText,
            spec.lineNum,
            whenReady,
            spec.placeholder,
            spec)
}

function _viewInit
(peer, view, text, modeWhenText, lineNum, whenReady, placeholder, spec) {
  let ed, buf, edWW, edW, opts, domEventHandlers, useText

  function removeAllKeyBindings
  () {
    // remove all user defined bindings

    // remove all built-in and extension-provided bindings
  }

  function onChange
  (update) {
    if (view?.ele) {
      //d('onChange ' + vlen(view))
      //d(update)
      if (view.ready && buf.reverting == null) {
        //d("modified")
        buf.modified = 1
        Ed.setIcon(buf, '.edMl-mod', 'save', 'save')
        updateMarks(view, update)
        return
      }
      d('ready in onchange')
      Css.enable(view.ele)
      view.ready = 1
    }
  }

  function onFocus
  () {
    //d('WODE focus')
    if (view?.ele) {
      view.ele.querySelectorAll('.cursor.monaco-mouse-cursor-text').forEach(cur => Css.remove(cur, 'bred-blur'))
      Pane.focusView(view, 1)
    }
  }

  d('WODE ================== _viewInit')

  spec = spec || {}

  if (view.ele) {
    // Have DOM.
  }
  else
    // Probably buffer was switched out while peer.get was running.
    return

  buf = view.buf
  buf.ed = 1
  buf.modified = 0
  Ed.setIcon(view.buf, '.edMl-mod', 'blank')
  view.ready = 0
  view.marks = []
  view.wode = { comp: {} }

  view.wode.decorMode = new CMState.Compartment
  view.wode.exts = new Set()
  view.wode.comp.exts = new CMState.Compartment
  view.wode.wextsMode = spec.wextsMode // [ wext ]
  view.wode.comp.extsMode = new CMState.Compartment
  view.wode.wextsMinors = [] // [ { name, wexts: [ wext ] } ]
  view.wode.comp.extsMinors = new CMState.Compartment
  view.wode.placeholder = new CMState.Compartment

  let decorator

  decorator = CMView.ViewPlugin.fromClass(class {
    constructor
    (view) {
      this.view = view
      this.decorations = this.decorate()
    }

    update
    (update) {
      if (update.docChanged || update.selectionSet || update.viewportChanged)
        this.decorations = this.decorate()
    }

    decorate
    () {
      let builder, ranges, visibles

      // ret: <0 a first, 0 same, >0 b first
      function compare
      (a, b) {
        if (a.f == b.f) {
          if (b.decorMark.startSide == a.decorMark.startSide)
            return b.precedence - a.precedence
          return b.decorMark.startSide - a.decorMark.startSide
        }
        return a.f - b.f
      }

      //d('decorate')
      visibles = this.view.visibleRanges
      ranges = []
      for (let i = 0; i < visibles.length; i++) {
        let range, to

        range = visibles[i]
        to = range.to
        while ((i < (visibles.length - 1)) && (range.to > visibles[i + 1].from))
          to = visibles[++i].to
        //d('h.hi ' + range.from + ' ' + to)
        WodeHi.highlighters.forEach(h => h.highlight(this.view.state,
                                                     range.from,
                                                     to,
                                                     // add
                                                     (f, t, m, p) => ranges.push({ f,
                                                                                   t,
                                                                                   decorMark: m,
                                                                                   // higher comes first
                                                                                   precedence: p })))
      }
      builder = new CMState.RangeSetBuilder()
      ranges.sort(compare)
      //d(ranges)
      ranges.forEach(r => builder.add(r.f, r.t, r.decorMark))
      return builder.finish()
    }
  },
                                          { decorations: v => v.decorations })

  let updateListener, selectTimeout

  function tronSelect
  (str) {
    selectTimeout = 0
    //d('SELECT ' + str)
    Tron.cmd1('clip.select', [ str ])
  }

  updateListener = CMView.EditorView.updateListener.of(update => {
    let curse

    function posChanged
    () {
      if (update.state.selection.main.head == update.startState.selection.main.head)
        return 0
      return 1
    }

    // HACK: Past a certain line in big buffers CM has the right window.getSelection()
    //       but the text is missing from the X primary selection buffer. Maybe due
    //       to timing or something because CM is tracking its own selection in
    //       DOMObserver in lib/@codemirror/view.js.
    //       Same thing works OK in CM homepage demo in Chromium, so it's related to
    //       running under Electron.
    if (update.selectionSet) {
      let sel, range, str

      //d('WODE selectionSet hack')

      sel = view.ed.state.selection.main
      if (sel.head > sel.anchor)
        range = WodeRange.make(view, sel.anchor, sel.head)
      else
        range = WodeRange.make(view, sel.head, sel.anchor)
      str = range.text
      if (str && str.length) {
        if (selectTimeout)
          clearTimeout(selectTimeout)
        selectTimeout = setTimeout(() => tronSelect(str),
                                   100)
      }
    }

    //d('WODE update')
    if (posChanged(update)) {
      let col, p

      //d('WODE pos changed')

      p = Pane.holdingView(view)
      col = p?.head?.querySelector('.bred-head-col')
      if (col)
        col.innerText = 'C' + (Wode.bepCol(view, update.state.selection.main.head))

      diagnose(p?.win)
      CMLint.forEachDiagnostic(view.ed.state, (diag, from, to) => {
        let bep, line

        bep = update.state.selection.main.head
        line = view.ed.state.doc.lineAt(bep)
        if ((from >= line.from) && (to <= line.to))
          diagnose(p?.win, diag)
      })

      curse = 1
    }

    if (update.docChanged) {
      //d('WODE docChanged')
      if (view.onChanges)
        view.onChanges.forEach(on => {
          //d('onChange: ' + on)
          on.cb && on.cb(update)
        })

      if (0)
        d('tell lsp')

      curse = 1
    }

    if (update.focusChanged) {
      0 && d('WODE focusChanged')
      //d(view)
      //d(globalThis.document.activeElement)
      if (view.onFocuss)
        view.onFocuss.forEach(on => {
          d('onFocus: ' + on)
          on.cb && on.cb(update)
        })

    }

    if (curse)
      WodeCommon.runOnCursors(view)
  })

  domEventHandlers = {
    click(e) {
      let run, target

      // duplicated from Em.handle
      // Required for data-run eg of file name in A-x Search Files when core.highlight.occurrences.enabled.
      // In Em.handle the target is the activeLine instead of the activeLine > selectionMatch which has the data-run.

      target = globalThis.document.elementFromPoint(e.clientX, e.clientY)
      run = target?.dataset?.run
      if (run) {
        let p

        p = Pane.holding(target)
        if (p)
          p.focus()
        Mess.say('')

        d('wode cmd on data-run: ' + run)
        d(run)
        Cmd.run(run, buf, Cmd.universal(run), { mouse: 1, name: 'click', e, buf: p?.buf })
      }
    },
    contextmenu() {
      // prevent right click from moving point
      return true
    },
    mousedown(event) {
      // prevent right click from moving point
      if (event.button == 2)
        return true
    },
    mouseup(event) {
      // prevent right click from moving point
      if (event.button == 2)
        return true
    },
    paste(event, ed) {
      try {
        let bep, str, view

        view = ed.bred.view
        bep = Wode.vgetBep(view)
        if (event.clipboardData) {
          str = event.clipboardData.getData('text/plain') || event.clipboardData.getData('text/uri-list')
          if (str?.length) {
            Wode.vinsert1(view, 1, str || '')
            // have to do this after otherwise the insert moves the mark
            Wode.addMarkAt(view, bep)
          }
        }
      }
      catch (err) {
        Mess.yell(err.message)
      }

      return true
    }
  }

  opts = [ CMComm.history(),
           view.wode.placeholder.of(makePlaceholder(placeholder)),

           CMView.EditorView.domEventHandlers(domEventHandlers),

           CMAuto.closeBrackets(), // needed for CMAuto.insertBracket to work
           CMLang.indentOnInput(),

           //CMSearch.search(), // for searchHighlighter, see lib/@codemirror/search.js
           //stateHighlighters,
           CMState.Prec.low(decorator),

           WodeCommon.bredView().of(view),

           colorPicker,

           view.wode.decorMode.of([]),

           updateListener,

           view.wode.comp.exts.of([]) ]

  WodeMode.wexts.forEach(b => b.spec.make && opts.push(b.spec.part.of(b.spec.make(view))))

  if (peer) {
    view.wode.peer = new CMState.Compartment
    opts.push(view.wode.peer.of([ peer ]))
  }

  opts.push(view.wode.comp.extsMode.of(WodeMode.makeExtsMode(view)))
  opts.push(view.wode.comp.extsMinors.of(WodeMode.makeExtsMinors(view)))

  edWW = view.ele.firstElementChild
  edW = edWW.querySelector('.edW')
  if (0 && view.ed)
    ed = view.ed
  else {
    let startState

    if (view.ed)
      view.ed.destroy()

    startState = CMState.EditorState.create({ doc: text || '',
                                              extensions: opts })

    ed = new CMView.EditorView({ state: startState,
                                 parent: edW })
    ed.bred = { view }
  }

  view.ed = ed

  //ed.setOption('autoScrollEditorIntoView', 1) // seems broken
  if (0)
    ed.session.on('changeScrollTop', scrollTop => ensureCursorVisible(ed, scrollTop))

  if (buf.vars('ed').fillParent === undefined)
    buf.vars('ed').fillParent = 1
  if (buf.vars('ed').fillParent)
    Css.add(edWW, 'fillParent')
  else {
    // wace does height setting here
  }

  ed.focus()

  //// remove all key bindings

  removeAllKeyBindings()

  //// handlers

  if (view.ev_onChange)
    voffChange(view, view.ev_onChange)
  view.ev_onChange = vonChange(view, onChange)

  if (view.ev_onFocus)
    voffFocus(view, view.ev_onFocus)
  view.ev_onFocus = vonFocus(onFocus)

  if (view.ev_onRemove) {
    // This view has been initialized before.
  }
  else {
    view.ev_onRemove = () => {
      if (view.ed) {
        view.ed.destroy()
        view.ed = null
      }
    }
    view.onRemove(view.ev_onRemove)
  }

  if (0) {
    if (view.ev_onDidBlurEditorWidget)
      view.ev_onDidBlurEditorWidget.dispose()
    view.ev_onDidBlurEditorWidget = ed.onDidBlurEditorWidget('XonDidBlurEditorWidget')
  }

  //// load file

  function modeFromFirstLine
  (text) {
    if (text && text.length) {
      let l

      l = WodeLang.langs.find(lang => lang.firstLine && (new RegExp(lang.firstLine)).test(text))
      if (l)
        return WodeMode.modeFromLang(l.id)
      if (text.startsWith('#!/bin/sh'))
        return 'sh'
      if (text.startsWith('#!/bin/bash'))
        return 'sh'
      if (text.startsWith('#!/usr/bin/env bash'))
        return 'sh'
      if (text.startsWith('#!/usr/bin/make'))
        return 'makefile'
      if (text.startsWith('#!/usr/bin/env python'))
        return 'python'
    }
    return 0
  }

  useText = (typeof text == 'string') || text instanceof String
  if (spec.revert)
    useText = 0

  if (useText) {
    if (buf.modifiedOnDisk)
      // Reset it so the revert dialog will appear (it will just skip existing views)
      buf.modifiedOnDisk = 1
    if (U.defined(lineNum))
      Wode.vgotoLine(view, lineNum)
  }
  else if (buf.file) {
    let path

    path = buf.path
    d('WODE get file')
    Tron.cmd('file.get', [ path ], (err, data) => {
      let mode

      if (err) {
        Mess.log('file: ' + buf.file)
        Mess.log(' dir: ' + buf.dir)
        Mess.log('path: ' + path)
        Mess.toss('Wodemirror viewInit: ' + err.message)
        return
      }

      d('WODE got file')

      buf.modifiedOnDisk = 0
      buf.stat = data.stat
      d('WODE new mtime ' + buf.stat.mtimeMs)

      WodeWatch.watch(buf, path)

      if (data.realpath) {
        let real

        real = Loc.make(data.realpath)
        buf.dir = real.dirname
        buf.file = real.filename
        Ed.setMlDir(buf, buf.dir)
      }

      mode = WodeMode.modeFor(path)
      if (mode == 'Ed')
        mode = 'text'
      d('mode offered: ' + mode)
      if (mode ? (mode == 'text') : 1)
        mode = modeFromFirstLine(data.data) || mode

      mode = mode || 'text'
      vsetLang(view, WodeMode.modeLang(mode))
      d('chose mode 2: ' + mode)
      buf.mode = mode
      Ed.setIcon(buf, '.edMl-type', Icon.mode(mode)?.name, 'describe buffer')
      WodeDecor.decorate(view, buf.mode)

      buf.addToRecents()

      WodeCommon.setValue(ed, data.data, false)
      if (view == Pane.current().view)
        ed.focus()
      if (U.defined(lineNum)) {
        Wode.vgotoLine(view, lineNum)
        //ed.renderer.once('afterRender', () => recenter(ed))
        0 && setTimeout(() => Wode.recenter(ed))
      }

      if (whenReady)
        whenReady(view)
      WodeCommon.runOnCursors(view)

      //ed.session.getUndoManager().reset()

      /*
      ed.on('input', () => {
        if (ed.session.getUndoManager().isClean()) {
          view.buf.modified = 0
          Ed.setIcon(view.buf, '.edMl-mod', 'blank')
        }
      })
      */
    })
    return
  }

  {
    let mode

    mode = buf.mode.name
    if (mode) {
      let lang

      d('mode from buf: ' + mode)
      lang = WodeMode.modeLang(mode)
      if (lang && WodeLang.langs.find(l => l.id == lang))
        vsetLang(view, lang)
    }
  }

  WodeDecor.decorate(view, buf.mode)
  Css.enable(view.ele)
  d('ready empty ed')
  view.ready = 1
  if (whenReady)
    whenReady(view)
  WodeCommon.runOnCursors(view)
}

export
function reopen
(view, lineNum, whenReady) {
  d('WODE ================== viewReopen')
  if (view.ele && view.ed)
    // timeout so behaves like viewInit
    setTimeout(() => {
      view.ready = 1
      //view.ed.resize()
      view.ed.focus()
      if (U.defined(lineNum))
        Wode.vgotoLine(view, lineNum)
      else
        view.ed.dispatch({ effects: CMView.EditorView.scrollIntoView(view.ed.state.selection.main.head,
                                                                     { y: 'center' }) })
      if (whenReady)
        whenReady(view)
      WodeCommon.runOnCursors(view)
    })
  else
    // probably buf was switched out before init happened.
    Wode.viewInit(view,
                  { lineNum },
                  whenReady)
}

export
function copy
(to, from, lineNum, whenReady) {
  d('WODE ================== viewCopy')
  Wode.viewInit(to,
                { text: from.ed.state.doc.toString(),
                  modeWhenText: from.buf.opt('core.lang'),
                  lineNum,
                  whenReady },
                whenReady)
}

export
function revertV
(view,
 spec, // { lineNum }
 whenReady) {
  let lineNum

  d('WODE =====>>>>>>>>>> revertV')

  spec = spec || {}

  Css.disable(view.ele)
  lineNum = spec.lineNum ?? (Wode.bepRow(view, Wode.vgetBep(view)) + 1)

  view.ready = 0 // limit onChange handler
  view.buf.reverting = 1
  init(view, { revert: 1, lineNum }, view => {
    view.buf.reverting = 0 // TODO might run before other views get the onChanges?
    if (whenReady)
      whenReady(view)
  })

  d('WODE =====>>>>>>>>>> revertV done')
}
