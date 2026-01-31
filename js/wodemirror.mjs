import { button, divCl, span, img } from './dom.mjs'

import * as Area from './area.mjs'
import * as Buf from './buf.mjs'
import * as Cut from './cut.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Ed from './ed.mjs'
import * as Frame from './frame.mjs'
import * as Icon from './icon.mjs'
import * as Loc from './loc.mjs'
import * as Lsp from './lsp.mjs'
import * as Mess from './mess.mjs'
import Mk from './mk.mjs'
import * as Opt from './opt.mjs'
import * as Pane from './pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Recent from './recent.mjs'
import * as Tab from './tab.mjs'
import * as Tron from './tron.mjs'
import * as U from './util.mjs'
import * as Win from './win.mjs'
import * as WodeCommon from './wode-common.mjs'
import * as WodeDecor from './wode-decor.mjs'
import * as WodeLang from './wode-lang.mjs'
import * as WodeMode from './wode-mode.mjs'
import * as WodePatch from './wode-patch.mjs'
import * as WodeTheme from './wode-theme.mjs'
import { d } from './mess.mjs'

import * as CMAuto from '../lib/@codemirror/autocomplete.js'
import * as CMCollab from '../lib/@codemirror/collab.js'
import * as CMComm from '../lib/@codemirror/commands.js'
import * as CMCont from '../lib/@valtown/codemirror-continue.js'
import * as CMLang from '../lib/@codemirror/language.js'
import * as LezUtils from '../lib/lezer-utils.js'
import * as CMLint from '../lib/@codemirror/lint.js'
import * as CMSearch from '../lib/@codemirror/search.js'
import * as CMState from '../lib/@codemirror/state.js'
import * as CMView from '../lib/@codemirror/view.js'
import { v4 as uuidv4 } from '../lib/uuid/index.js'
import { colorPicker } from '../lib/@replit/codemirror-css-color-picker.js'
import * as Wrap from '../lib/fast-word-wrap.js'
import Vode from '../lib/@codemirror/version.json' with { type: 'json' }

export { makeDecor } from './wode-decor.mjs'
export { langs } from './wode-lang.mjs'
export { modeFor, patchModeKey } from './wode-mode.mjs'
export { themeExtension, themeExtensionPart, Theme } from './wode-theme.mjs'

let completionNextLine, completionPreviousLine, spRe
let wexts, wextIds, registeredOpts, watching

export
function version
() {
  return Vode.version
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
function setValue
(ed, text, addToHistory) {
  ed.dispatch({ changes: { from: 0,
                           to: ed.state.doc.length,
                           insert: text },
                annotations: [ CMState.Transaction.addToHistory.of(addToHistory) ] })
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

let highlighters, stateHighlighters

{
  let all, id, effectHighlighters

  id = 0
  all = Mk.array

  highlighters = {
    add(highlight, update) {
      let h

      h = { id: id++,
            //
            highlight,
            remove() {
              all.removeIf(h1 => h1.id == h.id)
            },
            update }
      all.push(h)
      return h
    },
    forEach(cb) {
      all.forEach(cb)
    }
  }

  /// failed attempt to fake view change to refresh highlights

  //view.ed.dispatch({ effects: effectHighlighters.of('dummy') })

  effectHighlighters = CMState.StateEffect.define()

  {
    let tick

    tick = 0

    stateHighlighters = CMState.StateField.define({
      create() {
        return { tick: ++tick }
      },
      update(value, tr) {
        for (let effect of tr.effects)
          if (effect.is(effectHighlighters))
            value = { tick: ++tick }
        return value
      }
    })
    d({ stateHighlighters })
  }
}

async function pushUpdates
(id, version, updates, cb) {
  updates = updates?.map(u => ({ clientID: u.clientID,
                                 changes: u.changes.toJSON() }))
  await Tron.acmd('peer.push', [ id, version, updates ])
  cb()
}

// Make cm extensions for the wexts of every minor mode.
//
function makeExtsMinors
(view) {
  let exts

  exts = []
  view.buf?.minors.forEach(mode => mode.wexts?.filter(w => w.make).forEach(w => exts.push(w.make(view))))
  return exts
}

function makePlaceholder
(ph) {
  if (ph?.length)
    return CMView.placeholder(String(ph))
  return []
}

function makePeer
(id, startVersion) {
  let plugin

  plugin = CMView.ViewPlugin.fromClass(class {
    constructor
    (view) {
      this.view = view
      this.version = CMCollab.getSyncedVersion(this.view.state)
      this.ch = 'peer.pull/' + uuidv4()
      this.chOff = Tron.on(this.ch, this.pull.bind(this))
      Tron.cmd('peer.pull', [ id, this.version, this.ch ], err => {
        if (err) {
          d('peer.pull: ' + err.message)
          return
        }
      })
    }

    update
    (update) {
      if (update.docChanged)
        this.push()
    }

    push
    () {
      let updates, version

      updates = CMCollab.sendableUpdates(this.view.state)
      if (this.pushing || (updates.length == 0))
        return
      if (0) {
        d('UPDATES')
        updates.forEach((u,i) => {
          d(i + ': ' + u.changes?.toJSON())
        })
      }
      this.pushing = true
      version = CMCollab.getSyncedVersion(this.view.state)
      //d('SYNCED VERSION ' + version)
      pushUpdates(id, (version ?? 0) + 1, updates, () => {
        this.pushing = false
        // Regardless of whether the push failed or new updates came in
        // while it was running, try again if there are updates remaining
        if (CMCollab.sendableUpdates(this.view.state).length)
          setTimeout(() => this.push(), 100)
      })
    }

    pull
    (err, data) {
      let updates, tr

      //d('PULL ' + this.ch)

      if (err) {
        d('makePeer pull: ' + err.message)
        return
      }

      if (this.done)
        return

      if (data.updates.length) {
        let version

        version = CMCollab.getSyncedVersion(this.view.state)
        if (this.version >= version)
          return
      }

      updates = data.updates.map(u => ({ changes: CMState.ChangeSet.fromJSON(u.changes),
                                         clientID: u.clientID }))
      if (0) {
        d('RECEIVE')
        updates.forEach((u,i) => {
          d(i + ': ' + u.changes?.toJSON())
        })
      }
      tr = CMCollab.receiveUpdates(this.view.state, updates)
      this.view.dispatch(tr)
      if (data.updates.length)
        this.version = CMCollab.getSyncedVersion(this.view.state)
    }

    destroy() {
      this.done = true
      this.chOff && this.chOff()
    }
  })

  return [ CMCollab.collab({ startVersion }), plugin ]
}

export
function viewFromState
(state) {
  return state.facet(WodeCommon.bredView())
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
    return view?.ed?.coordsAtPos(vgetBep(view))
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

function reconfigureOpt
(buf, name) {
  //d('reconfigureOpt ' + name)
  buf.views.forEach(view => {
    if (view.ed && (view.win == Win.current()))
      wexts.forEach(b => {
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
      wexts.removeIf(b => b.id === wext.id)
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

    wexts.push(wext)

    return wext
  }
}

function watch
(buf, path) {
  if (watching.has(path))
    return

  Tron.cmd1('file.watch', [ path ], (err, ch) => {
    let off

    d('WODE 👀 watch ' + path)

    if (err) {
      Mess.log('watch failed on ' + path)
      watching.delete(path)
      return
    }

    off = Tron.on(ch, (err, data) => {
      // NB Beware of doing anything in here that modifies the file being watched,
      //    because that may cause recursive behaviour. Eg d when --logfile and
      //    log file is open in a buffer.
      console.log('WODE 👀 watch ev')
      console.log({ data })
      if (data.type == 'change') {
        if (buf.stat?.mtimeMs == data.stat?.mtimeMs)
          return
        buf.modifiedOnDisk = 1
      }
    })

    watching.set(path, off)

    buf.onRemove(() => {
      let off

      off = watching.get(path)
      if (off)
        off()
      watching.delete(path)
    })
  })
}

export
async function viewInit
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
  _viewInit(spec.single ? 0 : makePeer(view.buf.id, data.version),
            view,
            data.fresh ? 0 : data.text,
            spec.modeWhenText,
            spec.lineNum,
            whenReady,
            spec.placeholder,
            spec)
}

function runOnCursors
(view) {
  Ed.onCursors.forEach(oc => oc.cb && oc.cb('cm', view))
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
        highlighters.forEach(h => h.highlight(this.view.state,
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
        range = { from: sel.anchor, to: sel.head }
      else
        range = { from: sel.head, to: sel.anchor }
      str = vrangeText(view, range)
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
        col.innerText = 'C' + (bepCol(view, update.state.selection.main.head))

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
      runOnCursors(view)
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
        bep = vgetBep(view)
        if (event.clipboardData) {
          str = event.clipboardData.getData('text/plain') || event.clipboardData.getData('text/uri-list')
          if (str?.length) {
            vinsert1(view, 1, str || '')
            // have to do this after otherwise the insert moves the mark
            addMarkAt(view, bep)
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

  wexts.forEach(b => b.spec.make && opts.push(b.spec.part.of(b.spec.make(view))))

  if (peer) {
    view.wode.peer = new CMState.Compartment
    opts.push(view.wode.peer.of([ peer ]))
  }

  opts.push(view.wode.comp.extsMode.of(WodeMode.makeExtsMode(view)))
  opts.push(view.wode.comp.extsMinors.of(makeExtsMinors(view)))

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
      vgotoLine(view, lineNum)
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

      watch(buf, path)

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

      {
        let mtype

        if (buf.mode.mime) {
          let i

          i = buf.file.lastIndexOf('.')
          if (i >= 0) {
            let ext

            ext = buf.file.slice(i + 1)
            mtype = buf.mode?.mime?.find(mi => mi.ext == ext)
          }
        }
        Recent.add(Loc.make(buf.dir).join(buf.file),
                   mtype ? mtype.type : 'text/plain')
      }

      setValue(ed, data.data, false)
      if (view == Pane.current().view)
        ed.focus()
      if (U.defined(lineNum)) {
        vgotoLine(view, lineNum)
        //ed.renderer.once('afterRender', () => recenter(ed))
        0 && setTimeout(() => recenter(ed))
      }

      if (whenReady)
        whenReady(view)
      runOnCursors(view)

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
  runOnCursors(view)
}

export
function viewReopen
(view, lineNum, whenReady) {
  d('WODE ================== viewReopen')
  if (view.ele && view.ed)
    // timeout so behaves like viewInit
    setTimeout(() => {
      view.ready = 1
      //view.ed.resize()
      view.ed.focus()
      if (U.defined(lineNum))
        vgotoLine(view, lineNum)
      else
        view.ed.dispatch({ effects: CMView.EditorView.scrollIntoView(view.ed.state.selection.main.head,
                                                                     { y: 'center' }) })
      if (whenReady)
        whenReady(view)
      runOnCursors(view)
    })
  else
    // probably buf was switched out before init happened.
    viewInit(view,
             { lineNum },
             whenReady)
}

export
function viewCopy
(to, from, lineNum, whenReady) {
  d('WODE ================== viewCopy')
  viewInit(to,
           { text: from.ed.state.doc.toString(),
             modeWhenText: from.buf.opt('core.lang'),
             lineNum,
             whenReady },
           whenReady)
}

function charAt
(view, bep) {
  return view.ed.state.sliceDoc(bep, bep + 1)
}

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

function vsetSel
(view, from, to, reveal) {
  d('vsetSel')
  return view.ed.dispatch({ selection: { anchor: from,
                                         head: to },
                            ...(reveal ? { scrollIntoView: true } : {}) })
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

export
function makeRange
(from, to) {
  return { from, to }
}

export
function rangeEmpty
(range) {
  return range.from == range.to
}

export
function rangeOrder
(range) {
  if (range.from > range.to) {
    let tmp

    tmp = range.to
    range.to = range.from
    range.from = tmp

    return range
  }
  return range
}

export
function rangeStartBep
(range) {
  return range.from
}

export
function rangeEndBep
(range) {
  return range.to
}

function rangeStart
(view, range) {
  return bepToPos(view, range.from)
}

function rangeEnd
(view, range) {
  return bepToPos(view, range.to)
}

function rangeFromPoints
(view, pos1, pos2) {
  return makeRange(posToBep(view, pos1), posToBep(view, pos2))
}

function rangeContains
(view, range, pos) {
  let bep

  bep = posToBep(view, pos)
  return (range.from <= bep) && (range.to >= bep)
}

function textFromRange
(view, range) {
  return view.ed.state.sliceDoc(range.from, range.to)
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

function voffFocus
(view, cb) {
  if (view.ed) {
    view.onFocuss = view.onFocuss || Mk.array
    view.onFocuss.removeIf(o => o.cb === cb)
  }
}

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

function voffChange
(view, cb) {
  if (view.ed) {
    view.onChanges = view.onChanges || Mk.array
    view.onChanges.removeIf(o => o.cb === cb)
  }
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
      exts = makeExtsMinors(v)
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
      setValue(view.ed, '', true)
      return
    }
    // When the buffer was in some pane, but is no longer in any pane, then
    // the view will be reused if the buffer is shown in a pane again.
    b.views.forEach(v => {
      if (v.ed)
        try {
          setValue(v.ed, '', true)
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
        r = rangeFromPoints(view,
                            Ed.makePos(start.row, 0),
                            Ed.makePos(start.row, l.length))
        remove(view.ed, r)
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
          voffChange(view, cb)
      })
  }

  function on
  (b, name, cb) {
    if (name == 'change')
      b.views.forEach(view => {
        if (view.win == Win.current())
          vonChange(view, cb)
      })
  }

  function setPlaceholder
  (view, val) {
    view.ed.dispatch({ effects: view.wode.placeholder.reconfigure(makePlaceholder(val)) })
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
  mo.viewReopen = viewReopen
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
(view, range) {
  return view.ed.dispatch({ selection: { anchor: range.from,
                                         head: range.to } })
}

function regionRange
(view) {
  let head

  head = view.ed.state.selection.main.head
  if (view.marks.length) {
    let mark

    mark = view.marks.at(-1)
    if (head > mark)
      return { from: mark, to: head }
    return { from: head, to: mark }
  }
  return { from: head, to: head }
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
    vsetSel(p.view, p.view.ed.state.selection.main.to, l.from, 1)
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
    vsetSel(p.view, p.view.ed.state.selection.main.from, l.from, 1)
  else
    vsetBep(p.view, l.from, 1)
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

function bottomPos
(view) {
  return bepToPos(view, bottomBep(view))
}

function endPos
(view) {
  return bepToPos(view, vendBep(view))
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

function bottomBep
(view) {
  return xBep(view, 1)
}

function topBep
(view) {
  return xBep(view)
}

function topRow
(view) {
  let bep, l

  bep = topBep(view)
  l = view.ed.state.doc.lineAt(bep)
  if (l)
    return l.number - 1
  return 0
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

export
function revertV
(view,
 spec, // { lineNum }
 whenReady) {
  let lineNum

  d('WODE =====>>>>>>>>>> revertV')

  spec = spec || {}

  Css.disable(view.ele)
  lineNum = spec.lineNum ?? (bepRow(view, vgetBep(view)) + 1)

  view.ready = 0 // limit onChange handler
  view.buf.reverting = 1
  viewInit(view, { revert: 1, lineNum }, view => {
    view.buf.reverting = 0 // TODO might run before other views get the onChanges?
    if (whenReady)
      whenReady(view)
  })

  d('WODE =====>>>>>>>>>> revertV done')
}

export
function revert
() {
  let p

  p = Pane.current()
  if (p.view.buf.path) {
    if (p.view.buf.modified) {
      Prompt.demand(Ed.emRevert,
                    divCl('float-h',
                          [ divCl('float-icon', img(Icon.path('trash'), 'Trash', 'filter-clr-nb3')),
                            divCl('float-text', 'Buffer is modified. Discard changes?'),
                            button([ span('y', 'key'), 'es' ], '', { 'data-run': 'discard and revert' }),
                            button([ span('n', 'key'), 'o' ], '', { 'data-run': 'close demand' }) ]))
      return
    }
    revertV(p.view)
  }
  else
    Mess.toss('Buf needs path')
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
function vrangeText
(view, range) {
  rangeOrder(range)
  return view.ed.state.sliceDoc(range.from, range.to)
}

export
function setDecorMatch
(decorParent, view, range) {
  if (decorParent.decorMatch) {
    d('redecorate match')
    if (0)
      decorParent.decorMatch.update({ needle: vrangeText(view, range) })
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
function vfind
(view, needle, decorParent,
 // { backwards,
 //   caseSensitive,
 //   regExp,
 //   skipCurrent,
 //   wrap,
 //   stayInPlace,
 //   reveal } // 1 nearest, 2 center
 opts) {
  let ret, find, initialBep, initialSel, search, query

  function init
  () {
    d('vfind init ' + (opts.backwards ? 'backward' : 'forward') + ', needle: ' + needle)
    search = new CMSearch.SearchQuery({ search: needle,
                                        caseSensitive: opts.caseSensitive,
                                        literal: 1,
                                        regexp: U.bool(opts.regExp),
                                        wholeWord: 0 })
    //CMSearch.setSearchQuery(query)
    query = search.create()

    find = query.nextMatch
    if (opts.backwards)
      find = query.prevMatch
  }

  d('vfind ' + (opts.backwards ? 'backward ' : 'forward ') + needle + ' decor ' + (decorParent ? 'on' : 'off'))

  init()

  initialBep = vgetBep(view)
  if (view.markActive)
    initialSel = view.ed.state.selection.main

  ret = find.bind(query)(view.ed.state, initialBep, initialBep)
  //d(ret)
  if (ret) {
    let bep

    if (opts.skipCurrent
        && (ret.from == initialBep)) {
      let opts2

      vsetBep(view, ret.to)
      opts2 = Object.assign({}, opts)
      opts2.skipCurrent = 0
      return vfind(view, needle, decorParent, opts2)
    }

    if (opts.wrap == 0)
      if (opts.backwards
        ? (initialBep < ret.from)
        : (ret.from < initialBep))
        // wrapped
        return 0

    //view.ed.setSelection(ret.range)
    if (decorParent) {
      if (decorParent.decorAll)
        decorParent.decorAll.remove()
      decorParent.decorAll = highlighters.add((state, from, to, add) => { // highlight
        query.highlight(state, from, to, (from, to) => {
          let selected

          // is range selected?
          selected = state.selection.ranges.some(r => r.from == from && r.to == to)
          //d('ADD all ' + from + ' ' + to)
          add(from, to,
              CMView.Decoration.mark({ class: 'bred-search-all' + (selected ? ' bred-search-selected' : '') }),
              10)
        })
      },
                                              data => { // update
                                                needle = data.needle
                                                init()
                                              })

      if (decorParent.decorMatch)
        decorParent.decorMatch.remove()
      decorParent.decorMatch = highlighters.add((state, from, to, add) => { // highlight
        let selected

        // is range selected?
        selected = state.selection.ranges.some(r => r.from == ret.from && r.to == ret.to) // <=?
        //d('ADD match ' + ret.from + ' ' + ret.to)
        add(ret.from, ret.to,
            CMView.Decoration.mark({ class: 'bred-search-match' + (selected ? ' bred-search-selected' : '') }),
            11)
      },
                                                data => { // update
                                                  d('decor match update')
                                                  if (0) {
                                                    needle = data.needle
                                                    init()
                                                  }
                                                })
    }

    if (opts.stayInPlace)
      return ret

    bep = opts.backwards ? ret.from : ret.to
    if (initialSel)
      vsetSel(view, initialSel.from, bep, opts.reveal ?? 1)
    else
      vsetBep(view, bep, opts.reveal ?? 1)
    return ret
  }
  if (decorParent?.decorAll)
    if (opts.skipCurrent) {
      // searching again, keep highlights
    }
    else {
      decorParent.decorAll.remove(view)
      // change view to force highlight refresh
      vsetBep(view, initialBep)
    }

  if (decorParent?.decorMatch) {
    decorParent.decorMatch.remove(view)
    // change view to force highlight refresh
    vsetBep(view, initialBep)
  }
  return 0
}

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
    range = { from: sel.anchor, to: sel.head }
  else
    range = { from: sel.head, to: sel.anchor }
  str = vrangeText(p.view, range)
  str = cb(str, p.view)
  vsetBep(p.view, bep)

  // case range in current view
  {
    let view, vorigHead, vorigAnch

    view = p.view
    vorigHead = view.ed.state.selection.head
    vorigAnch = view.ed.state.selection.anchor
    clearSelection(view)
    remove(view.ed, range)
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
  range = { from: bep, to: line.to }
  str = vrangeText(p.view, range)
  if (str.length) {
    remove(p.view.ed, range)
    Cut.add(str)
  }
  else {
    delNextChar()
    Cut.add('\n')
  }
}

export
function remove
(ed, range) {
  rangeOrder(range)
  ed.dispatch({ changes: { from: range.from,
                           to: range.to,
                           insert: '' } })
}

export
function vremove
(view, range) {
  return remove(view.ed, range)
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
    range = { from: start, to: end }
  else
    range = { from: end, to: start }
  text = vrangeText(p.view, range)
  if (text && text.length) {
    remove(p.view.ed, range)
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
    remove(p.view.ed,
           { from: start,
             to: start + spRe.lastIndex })
  if (start > l.from) {
    str = [ ...l.text.slice(0, start - l.from) ].reverse().join('')
    spRe.lastIndex = 0
    if (spRe.exec(str))
      remove(p.view.ed,
             { from: start - spRe.lastIndex,
               to: start })
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
      range = { from: sel.anchor, to: sel.head }
    else
      range = { from: sel.head, to: sel.anchor }
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
      range = { from: mark, to: point }
    else
      range = { from: point, to: mark }
  }
  str = vrangeText(view, range)
  if (str && str.length) {
    if (cut)
      remove(view.ed, range)
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
  r = vfind(st.view, st.from, 0, { skipCurrent: 0,
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
  r = vfind(st.view, st.from, 0, { skipCurrent: 0,
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
             text: vrangeText(view, makeRange(node.from, node.to)) }
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

function makeSearcher
(view) {
  let opts

  function set
  (o) {
    opts = o
    opts.stayInPlace = 1
    return opts
  }

  function find
  () {
    let range, pos

    pos = vgetPos(view)
    if (opts.start)
      // have to change cursor because vfind searches from cursor
      vsetPos(view, opts.start)
    range = vfind(view, opts.needle, 0, opts)
    if (range) {
      opts.start = rangeEnd(view, range) // for next time
      if (opts.range) {
        if (rangeContains(view, opts.range, rangeStart(view, range))) {
          vsetPos(view, pos)
          return range
        }
        vsetPos(view, pos)
        return 0
      }
    }
    vsetPos(view, pos)
    return range
  }
  return { set,
           find }
}

export
function initComplete
() {
  let last

  function isWhite
  (ch) {
    return ch.charCodeAt(0) <= 32
  }

  // Get the word before point
  //
  function getWord
  (p) {
    let bep, bep1, word, start

    bep = vgetBep(p.view)
    start = vlineStart(p.view, bep)

    if (bep <= start)
      return 0

    bep1 = bep
    d('[' + charAt(p.view, bep1) + ']')
    // mv backwards over any space
    while (isWhite(charAt(p.view, bep1)))
      bep1--
    if (bep1 < start)
      return 0

    // mv backwards to start of word
    while (1) {
      if (bep1 == start)
        break
      d('[' + charAt(p.view, bep1) + ']')
      if (isWhite(charAt(p.view, bep1))) {
        bep1++
        break
      }
      bep1--
    }
    if (bep1 < start)
      // can this happen?
      return 0
    word = textFromRange(p.view, { from: bep1, to: bep })
    word = word.trim() // safety
    if (word.length == 0)
      return 0
    return word
  }

  // Get a potential completion.
  //
  function getRest
  (word, p, pos, phase, bufs, buf, ctags) {
    let srch

    function getBuf
    () {
      let b

      if (buf)
        return buf
      pos = Ed.makePos(0, 0)
      b = Buf.find(b => {
        if (bufs.includes(b))
          return 0
        return b.anyView()?.ed
      })
      if (b) {
        d('fresh buf')
        bufs.push(b)
      }
      else
        d('out of bufs')
      return b
    }

    // Make a search function
    //
    function makeSrch
    (view, pos1, bw, startRow, end, endLen) {
      let s, range

      if (bw)
        range = rangeFromPoints(view, Ed.makePos(startRow, 0), pos1)
      else
        range = rangeFromPoints(view, pos1, Ed.makePos(end, endLen))
      d({ range })
      d(rangeEnd(view, range))
      d(posRow(rangeEnd(view, range)))
      d('search for ' + word + ' '
        + (bw ? 'backward' : 'forward')
        + ' from (' + posRow(pos1) + ', ' + posCol(pos1) + ')'
        + ' in range (' + posRow(rangeStart(view, range)) + ',' + posCol(rangeStart(view, range)) + ')-'
        + '(' + posRow(rangeEnd(view, range)) + ',' + posCol(rangeEnd(view, range)) + ')')
      s = makeSearcher(view)
      // looking for the word followed by some chars, will either be at beginning of line or after space.
      // '\t\f\cK ' for horizontal whitespace, see https://stackoverflow.com/questions/3469080/match-whitespace-but-not-newlines
      s.set({ needle: '(^' + Ed.escapeForRe(word) + '[^\\s]+|[\t\f\cK ]' + Ed.escapeForRe(word) + '[^\\s]+)',
              //needle: Ed.escapeForRe(word) + '[^\\s]+',
              //needle: "(^" + Ed.escapeForRe(word) + "|\\s+" + Ed.escapeForRe(word) + ")",
              regExp: 1,
              caseSensitive: 1,
              skipCurrent: 0,
              start: pos1,
              backwards: bw,
              wholeWord: 0,
              wrap: 0,
              range })
      return s
    }

    // Prep match info for return
    //
    function pack
    (view, r, pos1, bw, phase) {
      let text

      text = vrangeText(view, r)
      d({ pos1 })
      d('pack text: [' + text + ']')
      d('found at: (' + posRow(pos1) + ',' + posCol(pos1) + ')')
      return { text: text.trim().slice(word.length), // trim to remove leading space introduced by regex
               pos: pos1,
               phase,
               buf }
    }

    phase = phase || 0
    d('word: [' + word + ']')

    // search visible lines before
    if (phase <= 0) {
      let r

      phase = 0
      d('== 0 search visible before')
      srch = makeSrch(p.view, pos, 1, topRow(p.view))
      while ((r = srch.find())) {
        let pos1

        d(r)
        //pos1 = Ed.makePos(posRow(rangeStart(p.view, r)), posCol(rangeStart(p.view, r)) - 1)
        pos1 = rangeStart(p.view, r)
        return pack(p.view, r, pos1, 1, phase)
      }
    }

    // search visible lines after
    if (phase <= 1) {
      let r, end, endLen

      phase = 1
      d('== 1 search visible after')
      end = bottomPos(p.view).row
      d({ end })
      endLen = lineAt(p.view, Ed.makePos(end, 0)).length
      d({ endLen })
      srch = makeSrch(p.view, pos, 0, topRow(p.view), end, endLen)
      while ((r = srch.find())) {
        let pos1

        pos1 = rangeEnd(p.view, r)
        return pack(p.view, r, pos1, 0, phase)
      }
    }

    // search buffer before
    if (phase <= 2) {
      let r

      phase = 2
      d('== 2 search current buffer before')
      srch = makeSrch(p.view, pos, 1, 0)
      while ((r = srch.find())) {
        let pos1

        pos1 = rangeStart(p.view, r)
        return pack(p.view, r, pos1, 1, phase)
      }
    }

    // search buffer after
    if (phase <= 3) {
      let r, end, endLen

      phase = 3
      d('== 3 search current buffer after')
      end = endPos(p.view).row
      endLen = lineAt(p.view, Ed.makePos(end, 0)).length
      srch = makeSrch(p.view, pos, 0, 0, end, endLen)
      while ((r = srch.find())) {
        let pos1

        pos1 = rangeEnd(p.view, r)
        return pack(p.view, r, pos1, 0, phase)
      }

      bufs.push(p.buf) // prevent research below
    }

    // search visible parts of other buffers in panes
    // search other buffers in panes

    // search remaining buffers
    if (phase <= 6) {
      phase = 6
      d('== 6 search remaining buffers')
      while ((buf = getBuf())) { // will skip buf if first in buf is in tries?
        let r, view, end, endLen

        d('= search buffer ' + buf.name)
        view = buf.anyView()
        end = endPos(view).row
        endLen = lineAt(view, Ed.makePos(end, 0)).length
        srch = makeSrch(view, pos, 0, 0, end, endLen)
        while ((r = srch.find())) {
          let pos1

          pos1 = rangeEnd(view, r)
          return pack(view, r, pos1, 0, phase)
        }
        buf = 0
      }
    }

    // search TAGS
    if (phase <= 7) {
      phase = 7
      d('== 7 search TAGS')
      for (let count = 0, i = 0; i < Ed.ctags.length; i++) {
        let ctag

        ctag = Ed.ctags[i]
        if ((ctag.name.length > word.length) && ctag.name.startsWith(word)) {
          count++
          if (count <= ctags)
            // already used
            continue
          //d('found ' + Ed.ctags[i].name)
          return { text: ctag.name.slice(word.length),
                   pos,
                   phase,
                   buf,
                   ctag }
        }
      }
    }

    return 0
  }

  // the complete command, on a-/, similar to emacs dabbrev-expand
  //
  function complete
  () {
    let p, rest, word, pos, phase, tries, bufs, buf, replace, orig
    let ctags // count of ctags to skip in phase 7

    d('=== complete')
    p = Pane.current()
    replace = last && (Cmd.last() == 'Complete')

    if (replace) {
      d('replace last candidate')
      word = last.word
      pos = last.pos
      phase = last.phase
      tries = last.tries
      bufs = last.bufs
      buf = last.buf
      orig = last.orig
      ctags = last.ctags || 0
    }
    else {
      d('fresh start')
      pos = vgetPos(p.view)
      word = getWord(p)
      phase = 0
      tries = []
      bufs = []
      buf = 0
      orig = vgetBep(p.view)
      ctags = 0
    }

    if (word == 0) {
      Mess.yell('word empty')
      return
    }

    while ((rest = getRest(word, p, pos, phase, bufs, buf, ctags))
           && tries.includes(rest.text)) {
      d('already used')
      pos = rest.pos
      phase = rest.phase
      buf = rest.buf
      if (rest.ctag)
        ctags++
    }
    if (replace) {
      let r

      r = makeRange(last.orig, posToBep(p.view, last.end))
      d('remove from ' + r.from + ' to ' + r.to)
      remove(p.view.ed, r)
    }
    if (rest) {
      let point

      d(rest)
      point = vgetPos(p.view)
      vsetBep(p.view, orig)
      vinsert1(p.view, 1, rest.text)
      tries.push(rest.text)
      if (rest.ctag)
        ctags++
      last = { tries,
               bufs,
               orig,
               start: point,
               end: vgetPos(p.view),
               word,
               pos: rest.pos,
               phase: rest.phase,
               buf: rest.buf,
               ctags }
    }
    else {
      Mess.say("That's all")
      last = 0
    }
  }

  return complete
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
  return { from: start.from,
           to: end.to }
}

export
function fill
(view, col) {
  let range, text

  range = para(view)
  text = vrangeText(view, range)
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
    r = { from: vgetBep(p.view),
          to: vgetBepEnd(p.view) }
  text = vrangeText(p.view, r)
  if (text.length)
    vreplaceAt(p.view, r, text.replace(/[^\S\r\n]+$/gm, ''))
}

export
function init
() {
  wextIds = 0
  wexts = Mk.array
  registeredOpts = new Set()

  completionNextLine = CMAuto.completionKeymap.find(e => e.key == 'ArrowDown').run
  completionPreviousLine = CMAuto.completionKeymap.find(e => e.key == 'ArrowUp').run

  watching = new Map()

  WodeCommon.init()
  WodeLang.init()
  WodeTheme.init()
  initActiveLine()
  WodePatch.init()
}
