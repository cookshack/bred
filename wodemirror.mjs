import { button, divCl, span, img } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cut from './cut.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Icon from './icon.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import Mk from './mk.mjs'
import * as Mode from './mode.mjs'
import * as Opt from './opt.mjs'
import * as Pane from './pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Recent from './recent.mjs'
import * as Tron from './tron.mjs'
import * as U from './util.mjs'
import * as Win from './win.mjs'
import { d } from './mess.mjs'

import * as CMAuto from './lib/@codemirror/autocomplete.js'
import * as CMCollab from './lib/@codemirror/collab.js'
import * as CMComm from './lib/@codemirror/commands.js'
import * as CMCont from './lib/@valtown/codemirror-continue.js'
import * as CMData from './lib/@codemirror/language-data.js'
import * as CMLang from './lib/@codemirror/language.js'
import * as LezUtils from './lib/lezer-utils.js'
import * as CMLint from './lib/@codemirror/lint.js'
import * as CMSearch from './lib/@codemirror/search.js'
import * as CMState from './lib/@codemirror/state.js'
import * as CMView from './lib/@codemirror/view.js'
import * as CMTheme from './lib/@uiw/codemirror-themes/index.js'
import * as Theme from './theme-solarized.js'
import { v4 as uuidv4 } from './lib/uuid/index.js'
import { colorPicker } from './lib/@replit/codemirror-css-color-picker.js'
import * as LZHighlight from './lib/@lezer/highlight.js'
import * as Wrap from './lib/fast-word-wrap.js'
import { Vode } from './json.mjs'

export let langs, themeExtension

let theme, themeTags, themeHighlighting
let themeCode, themeHighlightingCode, themeExtensionCode
let completionNextLine, completionPreviousLine, tagHighlighting, bredView, spRe
let brexts, brextIds, registeredOpts, watching

export
function version
() {
  return Vode.version
}

export
function modeFor
(path) {
  if (path) {
    let lang, filename

    //d("modeFor path: " + path)
    filename = Loc.make(path).filename
    lang = langs.find(l => l.path && l.path.test(path))
      || langs.find(l => l.filename && l.filename.test(filename))
      || langs.find(l => l.filenames?.some(fn => filename == fn))
      || langs.find(l => l.extensions?.some(e => path.endsWith(e)))
    d('modeFor lang: ' + lang?.id)
    return modeFromLang(lang?.id)
  }
  return 'Ed'
}

function updateMarks
(view, update) {

  function dbg
  (msg) {
    0 && d(msg)
  }

  function contains
  (from, to, off) {
    return (from > to) && (from <= off) && (to >= off)
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
  langs.find(l => l.id == id) || Mess.toss('missing lang: ' + id)
  d('vsetLang ' + id)
  view.buf.opts.set('core.lang', id)
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

function pushUpdates
(id, version, updates, cb) {
  updates = updates?.map(u => ({ clientID: u.clientID,
                                 changes: u.changes.toJSON() }))
  Tron.cmd('peer.push', [ id, version, updates ], () => {
    cb()
  })
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
      let version

      this.view = view
      version = CMCollab.getSyncedVersion(this.view.state)
      this.ch = 'peer.pull/' + uuidv4()
      this.pullCb = Tron.on(this.ch, this.pull.bind(this))
      Tron.cmd('peer.pull', [ id, version, this.ch ], err => {
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
    }

    destroy() {
      this.done = true
      Tron.off(this.ch, this.pullCb)
    }
  })

  return [ CMCollab.collab({ startVersion }), plugin ]
}

function markFromDec
(dec) {
  let m

  if (dec.ref)
    return { ref: dec.ref }

  m = {}

  if (dec.rules)
    m.class = dec.rules.map(c => 'bred-rule-' + c).join(' ')
  if (dec.attr)
    m.attributes = dec.attr

  if (dec.line)
    return { line: CMView.Decoration.line(m) }
  return { mark: CMView.Decoration.mark(m) }
}

export
function makeDecor
(spec) {
  return markFromDec(spec)
}

function makeDecorator
(spec) {
  let marks

  function decorate
  (edview) {
    let builder

    builder = new CMState.RangeSetBuilder()

    for (let { from, to } of edview.visibleRanges)
      for (let pos = from; pos <= to;) {
        let line, match

        line = edview.state.doc.lineAt(pos)
        match = line.text.match(spec.regex)
        if (match)
          for (let i = 1; i < match.indices.length; i++) {
            let index, from, to, mark

            index = match.indices[i]
            from = line.from + index[0]
            to = line.from + index[1]
            //d('adding ' + from + ' ' + to)
            mark = marks[i - 1]
            if (mark?.ref) {
              let markR, view

              view = edview.state.facet(bredView)
              if (view) {
                markR = mark.ref(view, match, line)
                if (markR?.mark)
                  builder.add(from, to, markR.mark)
                else if (markR?.line)
                  builder.add(line.from, line.from, markR.line)
                else
                  d('decorate: ref missing mark')
              }
              else
                d('decorate: missing view')
            }
            else if (mark?.mark)
              builder.add(from, to, mark.mark)
            else if (mark?.line)
              builder.add(line.from, line.from, mark.line)
            else
              d('decorate: missing mark')
          }
        pos = line.to + 1
      }

    return builder.finish()
  }

  class Pv {
    constructor(ed) {
      this.decorations = decorate(ed)
    }

    update(update) {
      if (update.docChanged || update.viewportChanged)
        this.decorations = decorate(update.view)
    }
  }

  marks = spec.decor.map(markFromDec)

  return CMView.ViewPlugin.fromClass(Pv, { decorations: v => v.decorations })
}

function decorate
(view, mode) {
  if (mode?.decorators) {
    let decorators

    decorators = []
    mode.decorators.forEach(dec => {
      d(dec)
      decorators.push(makeDecorator(dec))
    })

    view.ed.dispatch({ effects: view.wode.decorMode.reconfigure(decorators) })
  }
}

function diagnose
(win, diag) {
  if (win && diag) {
    win.diag.lastElementChild.firstElementChild.innerText = diag.message
    win.diag.lastElementChild.lastElementChild.innerText = diag.source
    Css.add(win.diag, 'bred-' + diag.severity)
    Css.show(win.diag)
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
      brexts.forEach(b => {
        if (b.spec.make && b.spec.reconfOpts && b.spec.reconfOpts.includes(name))
          view.ed.dispatch({ effects: b.spec.part.reconfigure(b.spec.make(view)) })
      })
  })
}

export
function findLang
(id) {
  return langs.find(l => l.id == id)
}

export
function register
(spec) { // { backend, make, part, reconfOpts }
  if (spec.backend == 'cm') {
    let brext, id

    function free
    () {
      brexts.removeIf(b => b.id === brext.id)
      // remove from existing views
      Buf.forEach(buf => buf.views.forEach(v => (v.win == Win.current()) && v.ed?.dispatch({ effects: spec.part.reconfigure([]) })))
      // reconfigure exts opts on all bufs, in case any other extensions use the opt
      spec.reconfOpts?.forEach(name => Buf.forEach(buf => reconfigureOpt(buf, name)))
    }

    id = ++brextIds

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
        //   could get handles and free them when the brext is freed
        Opt.onSet(name, () => Buf.forEach(buf => reconfigureOpt(buf, name)))
        Opt.onSetBuf(name, buf => reconfigureOpt(buf, name))
      }
      // reconfigure the opt on all bufs, in case any other extensions use the opt
      Buf.forEach(buf => reconfigureOpt(buf, name))
    })

    brext = { spec,
              free,
              //
              get id() {
                return id
              } }

    brexts.push(brext)

    return brext
  }
}

function watch
(buf, path) {
  if (watching.has(path))
    return
  watching.add(path)
  Tron.cmd1('file.watch', [ path ], (err, ch) => {
    if (err) {
      Mess.log('watch failed on ' + path)
      watching.delete(path)
      return
    }
    Tron.on(ch, (err, data) => {
      // NB Beware of doing anything in here that modifies the file being watched,
      //    because that may cause recursive behaviour. Eg d when --logfile and
      //    log file is open in a buffer.
      //d('--- file watch ev ---')
      //d({ data })
      if (data.type == 'change') {
        if (buf.stat?.mtimeMs == data.stat?.mtimeMs)
          return
        buf.modifiedOnDisk = 1
      }
    })
  })
}

export
function viewInitSpec
(view,
 spec, // { text, modeWhenText, lineNum, whenReady, forceFresh }
 cb) {
  d('peer.get ' + view.buf.id)
  d('vi vid: ' + view.vid)
  view.buf.modified = 0
  Ed.setIcon(view.buf, '.edMl-mod', 'blank')
  view.ready = 0
  Tron.cmd('peer.get', [ view.buf.id ], (err, data) => {
    if (err) {
      Mess.toss('peer.get: ' + err.message)
      return
    }
    d('peer.get ' + view.buf.id + ' ok (' + view.buf.name + ')')
    d({ data })
    _viewInit(makePeer(view.buf.id, data.version),
              view,
              (spec.forceFresh || data.fresh) ? 0 : data.text,
              spec.modeWhenText,
              spec.lineNum,
              spec.whenReady,
              spec.placeholder)
    if (cb)
      cb(view)
  })
}

export
function viewInit
(view, text, modeWhenText, lineNum,
 // only called if buf has a file.
 // may cause issues eg if call v.insert then the view must already have been added to the buf (which happens after viewInit).
 //   (probably it's fine because probably the Tron file.get cb below always runs after the current event).
 whenReady, // (view)
 // called after _viewInit runs, but before the file.get cb
 cb) { // (view)
  viewInitSpec(view,
               { text: text,
                 modeWhenText: modeWhenText,
                 lineNum: lineNum,
                 whenReady: whenReady },
               cb)
}

function _viewInit
(peer, view, text, modeWhenText, lineNum, whenReady, placeholder) {
  let ed, buf, edWW, edW, opts, domEventHandlers

  function removeAllKeyBindings
  () {
    // remove all user defined bindings

    // remove all built-in and extension-provided bindings
  }

  function clearHandlers
  () {
    //edW.onkeydown = undefined
    //edW.onkeyup = undefined
  }

  function onChange
  (update) {
    if (view?.ele) {
      //d('onChange ' + vlen(view))
      //d(update)
      if (view.ready) {
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
    //d("ed foc")
    if (view?.ele) {
      view.ele.querySelectorAll('.cursor.monaco-mouse-cursor-text').forEach(cur => Css.remove(cur, 'bred-blur'))
      Pane.focusView(view, 1)
    }
  }

  d('================== viewInit')

  if (view.ele) {
    // Have DOM.
  }
  else
    // Probably buffer was switched out while peer.get was running.
    return

  buf = view.buf
  buf.modified = 0
  Ed.setIcon(view.buf, '.edMl-mod', 'blank')
  buf.modifiedOnDisk = 0
  view.ready = 0
  view.marks = []
  view.wode = { comp: {} }

  view.wode.decorMode = new CMState.Compartment
  view.wode.exts = new Set()
  view.wode.comp.exts = new CMState.Compartment
  view.wode.themeExtension = new CMState.Compartment
  view.wode.peer = new CMState.Compartment
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
                                              (f, t, m, p) => ranges.push({ f: f,
                                                                            t: t,
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

    //d('update')
    if (posChanged(update)) {
      let col, p

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
    }

    if (update.docChanged) {
      //d('docChanged')
      if (view.onChanges)
        view.onChanges.forEach(on => {
          //d('onChange: ' + on)
          on.cb && on.cb(update)
        })

      if (0)
        d('tell lsp')
    }

    if (update.focusChanged) {
      0 && d('focusChanged')
      //d(view)
      //d(globalThis.document.activeElement)
      if (view.onFocuss)
        view.onFocuss.forEach(on => {
          d('onFocus: ' + on)
          on.cb && on.cb(update)
        })

    }
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
        Cmd.run(run, buf, Cmd.universal(run), { mouse: 1, name: 'click', e: e, buf: p?.buf })
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

           bredView.of(view),

           colorPicker,
           themeHighlighting,

           view.wode.decorMode.of([]),

           updateListener,

           view.wode.comp.exts.of([]) ]

  brexts.forEach(b => b.spec.make && opts.push(b.spec.part.of(b.spec.make(view))))

  if (peer)
    opts.push(view.wode.peer.of([ peer ]))
  else
    opts.push(view.wode.peer.of([]))

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
    ed.bred = { view: view }
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

  if (0) {
    if (view.ev_onDidBlurEditorWidget)
      view.ev_onDidBlurEditorWidget.dispose()
    view.ev_onDidBlurEditorWidget = ed.onDidBlurEditorWidget('XonDidBlurEditorWidget')
  }
  // problems, now done via lib/monaco-patches/02-turn-off-onkeydown.patch
  if (0) {
    ed.onDidChangeModelLanguageConfiguration(clearHandlers) // first init
    ed.onDidLayoutChange(clearHandlers) // every init
  }

  //// load file

  function modeFromFirstLine
  (text) {
    if (text && text.length) {
      let l

      l = langs.find(lang => lang.firstLine && (new RegExp(lang.firstLine)).test(text))
      if (l)
        return modeFromLang(l.id)
      if (text.startsWith('#!/bin/sh'))
        return 'sh'
      if (text.startsWith('#!/bin/bash'))
        return 'sh'
      if (text.startsWith('#!/usr/bin/env bash'))
        return 'sh'
      if (text.startsWith('#!/usr/bin/make'))
        return 'makefile'
    }
    return 0
  }

  if (0 && ((typeof text == 'string') || text instanceof String)) {
    let mode

    d('given mode: ' + modeWhenText)
    mode = modeFromFirstLine(text) || modeWhenText
    mode = mode || 'text'
    d('chose mode 1: ' + mode)
    Ed.setIcon(buf, '.edMl-type', Icon.mode(mode)?.name, 'describe buffer')
    vsetLang(view, modeLang(mode))
    if (U.defined(lineNum))
      //ed.renderer.once('afterRender', () => recenter(ed))
      vgotoLine(view, lineNum)

    if (whenReady)
      whenReady(view)

    return
  }

  if ((typeof text == 'string') || text instanceof String) {
    if (U.defined(lineNum))
      vgotoLine(view, lineNum)
  }
  else if (buf.file) {
    let path

    path = buf.path
    d('get file')
    Tron.cmd('file.get', path, (err, data) => {
      let mode

      if (err) {
        Mess.log('file: ' + buf.file)
        Mess.log(' dir: ' + buf.dir)
        Mess.log('path: ' + path)
        Mess.toss('Wodemirror viewinit: ' + err.message)
        return
      }

      d('got file')

      buf.stat = data.stat
      d(buf.stat)
      watch(buf, path)

      if (data.realpath) {
        let real

        real = Loc.make(data.realpath)
        buf.dir = real.dirname
        buf.file = real.filename
        Ed.setMlDir(buf, buf.dir)
      }

      mode = modeFor(path)
      if (mode == 'Ed')
        mode = 'text'
      d('mode offered: ' + mode)
      if (mode ? (mode == 'text') : 1)
        mode = modeFromFirstLine(data.data) || mode

      mode = mode || 'text'
      vsetLang(view, modeLang(mode))
      d('chose mode 2: ' + mode)
      buf.mode = mode
      Ed.setIcon(buf, '.edMl-type', Icon.mode(mode)?.name, 'describe buffer')
      decorate(view, buf.mode)

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
      lang = modeLang(mode)
      if (lang && langs.find(l => l.id == lang))
        vsetLang(view, lang)
    }
  }

  decorate(view, buf.mode)
  Css.enable(view.ele)
  d('ready empty ed')
  view.ready = 1
}

export
function viewReopen
(view, lineNum, whenReady, cb) {
  d('================== viewReopen')
  // timeout so behaves like viewInit
  if (view.ele && view.ed)
    setTimeout(() => {
      view.ready = 1
      //view.ed.resize()
      view.ed.focus()
      if (U.defined(lineNum))
        vgotoLine(view, lineNum)
      else
        view.ed.dispatch({ effects: CMView.EditorView.scrollIntoView(view.ed.state.selection.main.head,
                                                                     { y: 'center' }) })
      if (cb)
        cb(view)
      if (whenReady)
        whenReady(view)
    })
  else
    // probably buf was switched out before init happened.
    viewInit(view,
             { lineNum: lineNum,
               whenReady: whenReady },
             cb)
}

export
function viewCopy
(to, from, lineNum, whenReady, cb) {
  d('================== viewCopy')
  viewInit(to, from.ed.state.doc.toString(), from.buf.opt('core.lang'), lineNum, whenReady, cb)
}

function charAt
(view, off) {
  return view.ed.state.sliceDoc(off, off + 1)
}

function vlineStart
(view, off) {
  let l

  if (off < 0)
    off = 0
  l = view.ed.state.doc.lineAt(off)
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

  l = view.ed.state.doc.lineAt(vposToOff(view, pos))
  return l.text
}

function vposToOff
(view, pos) {
  return view.ed.state.doc.line(pos.row + 1).from + pos.column
}

function voffToPos
(view, off) {
  let line

  line = view.ed.state.doc.lineAt(off)
  return Ed.makePos(line.number - 1, off - line.from)
}

// pos here is bred pos (vs ace/mon pos)
export
function vsetPos
(view, pos, reveal) {
  return vsetOff(view, vposToOff(view, pos), reveal)
}

// pos here is bred pos (vs ace/mon pos)
export
function vgetPos
(view) {
  return voffToPos(view, vgetOff(view))
}

function vsetOff
(view, off,
 reveal, // 1 nearest, 2 center
 keepSelection) {
  let tr

  //d('vsetOff ' + off)
  if (keepSelection && view.markActive)
    tr = { selection: { anchor: view.ed.state.selection.main.anchor,
                        head: off } }
  else
    tr = { selection: { anchor: off, head: off } }
  if (reveal == 1)
    tr.effects = CMView.EditorView.scrollIntoView(off, { y: 'nearest' })
  else if (reveal == 2)
    tr.effects = CMView.EditorView.scrollIntoView(off, { y: 'center' })
  return view.ed.dispatch(tr)
}

function vgetOff
(view) {
  return view.ed.state.selection.main.head
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
  return vgetOff(view)
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
  return vsetOff(view, bep, reveal, keepSelection)
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
  return voffToPos(view, bep)
}

// pos here is bred pos (vs monaco/ace pos)
export
function posToBep
(view, pos) {
  return vposToOff(view, pos)
}

export
function bepToOff
(view, bep) {
  return bep
}

export
function makeRange
(from, to) {
  return { from: from, to: to }
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
  return voffToPos(view, range.from)
}

function rangeEnd
(view, range) {
  return voffToPos(view, range.to)
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
    view.onFocuss.push({ cb: cb })
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
    view.onChanges.push({ cb: cb })
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

function vendOff
(v) {
  return v.ed.state.doc.length
}

// get end line number
export
function vlen
(v) {
  let end, line

  end = vendOff(v)
  line = v.ed.state.doc.lineAt(end)
  return line.number
}

function seize
(b, mode) {
  d('ed seizing ' + b.name + ' for ' + mode.name)
  b.views.forEach(v => {
    if (v.ed && (v.win == Win.current()))
      decorate(v, b.mode)
  })
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
          get col() {
            return bepCol(view, bep)
          },
          get eol() {
            return bep == view.ed.state.doc.lineAt(bep).to
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
  function clear
  (b) {
    let view

    view = b.anyView()
    if (view)
      setValue(view.ed, '', true)
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

  mo.clear = clear
  mo.clearLine = clearLine
  mo.gotoLine = vgotoLine
  mo.lang = lang
  mo.langData = langData
  mo.line = line
  mo.lineAt = lineAt
  mo.lineStart = lineStart
  mo.excur = excur
  mo.goXY = vgoXY
  mo.makePsn = makePsn
  mo.off = off
  mo.on = on
  mo.prevLine = prevLine
  mo.region = vregion
  mo.nextLine = nextLine
  mo.seize = mo.seize || (b => seize(b, mo))
  mo.setBep = vsetBep
  mo.setPlaceholder = setPlaceholder
  mo.syntaxTreeStr = syntaxTreeStr
  mo.text = text
  mo.viewReopen = viewReopen
  mo.vinsertAll = vinsert1
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
function prevLine(v, u) {
  utimes(u, () => vexec(v, CMComm.cursorLineUp, CMComm.selectLineUp))
}

export
function nextLine(v, u) {
  utimes(u, () => vexec(v, CMComm.cursorLineDown, CMComm.selectLineDown))
}

export
function clearSelection
(view) {
  let head

  head = view.ed.state.selection.main.head
  view.markActive = 0
  return view.ed.dispatch({ selection: { anchor: head,
                                         head: head } })
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

function addMarkAt
(view, off) {
  view.marks.push(off)
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
    vsetOff(p.view, mark, 1)
  }
  else {
    let off

    off = vgetOff(p.view)
    addMarkAt(p.view, off)
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
  point = vgetOff(p.view)
  if (p.view.marks.length == 0) {
    Mess.say('Set a mark first')
    return
  }
  mark = p.view.marks.pop()
  if (p.view.markActive)
    selReverse(p.view)
  else
    vsetOff(p.view, mark, 1) // want to use 3rd option "reveal in center if off screen else stay the same"
  p.view.marks.push(point)
}

export
function lineStart
() {
  let p

  p = Pane.current()
  if (p.view.markActive)
    CMComm.selectLineStart(p.view.ed)
  else
    CMComm.cursorLineStart(p.view.ed)
}

export
function lineEnd
() {
  let p

  p = Pane.current()
  if (p.view.markActive)
    CMComm.selectLineEnd(p.view.ed)
  else
    CMComm.cursorLineEnd(p.view.ed)
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
(line) {
  let text

  text = line.text
  return (text.length == 0) || text.startsWith(' ') || text.startsWith('\t')
}

function lineIsText
(line) {
  if (lineIsClear(line))
    return 0
  return 1
}

export
function topLevelStart
() {
  let p, off, l

  p = Pane.current()

  off = vgetOff(p.view)
  //d('endLine: ' + endLine)
  l = p.view.ed.state.doc.lineAt(off)
  while ((l.number > 1) && lineIsText(l)) {
    off = l.from - 1
    l = p.view.ed.state.doc.lineAt(off)
  }

  while ((l.number > 1) && lineIsClear(l)) {
    off = l.from - 1
    l = p.view.ed.state.doc.lineAt(off)
  }

  if (p.view.markActive)
    vsetSel(p.view, p.view.ed.state.selection.main.to, l.from, 1)
  else
    vsetOff(p.view, l.from, 1)
}

export
function topLevelEnd
() {
  let p, off, endLine, l

  p = Pane.current()
  off = vgetOff(p.view)
  endLine = vlen(p.view)
  //d('endLine: ' + endLine)
  l = p.view.ed.state.doc.lineAt(off)
  while ((l.number < endLine) && lineIsText(l)) {
    off = l.to + 1
    l = p.view.ed.state.doc.lineAt(off)
  }

  while ((l.number < endLine) && lineIsClear(l)) {
    off = l.to + 1
    l = p.view.ed.state.doc.lineAt(off)
  }

  if (p.view.markActive)
    vsetSel(p.view, p.view.ed.state.selection.main.from, l.from, 1)
  else
    vsetOff(p.view, l.from, 1)
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
  return voffToPos(view, vendOff(view))
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
          width: width,
          height: height }

    r.right = r.x + r.width
    r.bottom = r.y + r.height

    return r
  }
}

function lineEle
(view, off) {
  let node, ele

  // https://discuss.codemirror.net/t/function-method-for-getting-a-lines-dom-element/8208
  node = view.ed.domAtPos(off)
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
  if (lineStart) {
    let ele, lineRect

    ele = lineEle(view, lineStart)
    if (ele)
      lineRect = makeRect(ele.getBoundingClientRect(), ele)
    return rect && lineRect && containsVertically(rect, lineRect)
  }
}

function xBep
(view, bottom) {
  let rect, xEdge, yEdge, off, scroller, first, leeway

  //return view.ed.viewport.from
  //return view.ed.visibleRanges.at(0)?.from || 0

  //d(view.ed.dom)
  scroller = view.ed.scrollDOM
  //d(scroller)
  rect = makeRect(scroller.getBoundingClientRect(), scroller)
  yEdge = bottom ? rect.bottom : rect.top
  xEdge = rect.x

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

  //d(rect)
  off = view.ed.posAtCoords({ x: xEdge, y: yEdge }) || 0
  off = vlineStart(view, off)
  first = off
  for (let i = 0; i < 10; i++) {
    //d('off: ' + off + ' line: ' + view.ed.state.doc.lineAt(off).number)
    if (lineFullyVisible(view, rect, off))
      return off
    off = vlineStart(view, off + (bottom ? -1 : 1))
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
    let off, scroller, middle, ele, rect

    off = vgetOff(view)
    d('off: ' + off + ' line: ' + view.ed.state.doc.lineAt(off).number)
    scroller = view.ed.scrollDOM
    middle = scroller.clientHeight / 2
    d('middle: ' + middle)
    rect = makeRect(scroller.getBoundingClientRect(), scroller)
    d(rect)
    ele = lineEle(view, off)
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
(view) {
  let lineNum

  Css.disable(view.ele)
  lineNum = bepRow(view, vgetBep(view)) + 1

  view.ready = 0 // limit onChange handler
  // dispatch so that peers get the same
  view.ed.dispatch({ changes: { from: 0,
                                to: view.ed.state.doc.length,
                                insert: '' } })
  viewInitSpec(view, { forceFresh: 1, // consider peer fresh so will reread file
                       lineNum: lineNum })
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
    decorParent.decorAll.update({ needle: needle })
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
  let ret, find, initialOff, initialSel, search, query

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

  initialOff = vgetOff(view)
  if (view.markActive)
    initialSel = view.ed.state.selection.main

  ret = find.bind(query)(view.ed.state, initialOff, initialOff)
  //d(ret)
  if (ret) {
    let off

    if (opts.skipCurrent
        && (ret.from == initialOff)) {
      let opts2

      vsetOff(view, ret.to)
      opts2 = Object.assign({}, opts)
      opts2.skipCurrent = 0
      return vfind(view, needle, decorParent, opts2)
    }

    if (opts.wrap == 0)
      if (opts.backwards
        ? (initialOff < ret.from)
        : (ret.from < initialOff))
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

    off = opts.backwards ? ret.from : ret.to
    if (initialSel)
      vsetSel(view, initialSel.from, off, opts.reveal ?? 1)
    else
      vsetOff(view, off, opts.reveal ?? 1)
    return ret
  }
  if (decorParent?.decorAll)
    if (opts.skipCurrent) {
      // searching again, keep highlights
    }
    else {
      decorParent.decorAll.remove(view)
      // change view to force highlight refresh
      vsetOff(view, initialOff)
    }

  if (decorParent?.decorMatch) {
    decorParent.decorMatch.remove(view)
    // change view to force highlight refresh
    vsetOff(view, initialOff)
  }
  return 0
}

function vinsert1
(view, u, text) {
  let off

  off = vgetOff(view)
  vinsertAt(view, off, u, text, 1)
}

export
function vinsertAt
(v, off, u, text, setOff, to) {
  if (v.ele) {
    clearSelection(v)
    if (typeof text == 'number')
      text = text.toString()
    for (let i = 0; i < u; i++) {
      if (setOff) {
        //d('insertAt ' + off + ' replace')

        // this way in case there are chars like backspace in the string that will be filtered out by cm
        // (if use selection with changes dispatch below then the selection will be wrong if cm filters
        //  out chars)

        setSelection(v, { from: off ?? 0,
                          to: to ?? (off ?? 0) })
        // this will set the off to the end of the text
        v.ed.dispatch(v.ed.state.replaceSelection(text))
        return
      }

      //d('insertAt ' + off)
      v.ed.dispatch({ changes: { from: off ?? 0,
                                 to: to ?? (off ?? 0),
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
    vinsert1(p.view, u, char)

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

      char = Ed.charForInsert({ e: e })
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
  let p, range, origHead, origAnch, sel, off, str

  p = Pane.current()

  // get the range to be cased
  off = vgetOff(p.view)
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
  vsetOff(p.view, off)

  // case range in current view
  {
    let view, vorigHead, vorigAnch

    view = p.view
    vorigHead = view.ed.state.selection.head
    vorigAnch = view.ed.state.selection.anchor
    clearSelection(view)
    remove(view.ed, range)
    vinsertAt(view, off, 1, str)
    view.ed.state.selection.head = vorigHead
    view.ed.state.selection.anchor = vorigAnch
  }

  // move point in current pane
  p.view.ed.state.selection.head = origHead
  p.view.ed.state.selection.anchor = origAnch
  vsetOff(p.view, range.to)
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
  let p, str, off, range

  p = Pane.current()
  off = vgetOff(p.view)
  line = p.view.ed.state.doc.lineAt(off)
  range = { from: off, to: line.to }
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
function delNextWordBound
(n) {
  let p, start, end, text, range

  p = Pane.current()
  clearSelection(p.view)
  start = vgetOff(p.view)
  if (n < 0)
    edexec(p.view.ed, p.view.markActive, CMComm.cursorGroupLeft)
  else
    edexec(p.view.ed, p.view.markActive, CMComm.cursorGroupRight)
  end = vgetOff(p.view)
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

  p.view.ed.dispatch({ changes: changes,
                       selection: { anchor: anchor, head: anchor } })
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
    changes.empty || p.view.ed.dispatch({ changes: changes })
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
  start = vgetOff(p.view)
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
  let sel, range, str

  sel = view.ed.state.selection.main
  if (sel.head > sel.anchor)
    range = { from: sel.anchor, to: sel.head }
  else
    range = { from: sel.head, to: sel.anchor }
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
  let r, off

  off = Math.min(st.view.ed.state.selection.main.anchor,
                 st.view.ed.state.selection.main.head)
  setSelection(st.view, { from: off, to: off })
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

  bep = view.ed.posAtCoords({ x: x, y: y })
  if (bep)
    vsetBep(view, bep)
}

export
function vtokenAt
(view, x, y) {
  let bep, tree, node

  bep = view.ed.posAtCoords({ x: x, y: y })
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
    let off, off1, word, start

    off = vgetOff(p.view)
    start = vlineStart(p.view, off)

    if (off <= start)
      return 0

    off1 = off
    d('[' + charAt(p.view, off1) + ']')
    // mv backwards over any space
    while (isWhite(charAt(p.view, off1)))
      off1--
    if (off1 < start)
      return 0

    // mv backwards to start of word
    while (1) {
      if (off1 == start)
        break
      d('[' + charAt(p.view, off1) + ']')
      if (isWhite(charAt(p.view, off1))) {
        off1++
        break
      }
      off1--
    }
    if (off1 < start)
      // can this happen?
      return 0
    word = textFromRange(p.view, { from: off1, to: off })
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
              range: range })
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
               phase: phase,
               buf: buf }
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
                   pos: pos,
                   phase: phase,
                   buf: buf,
                   ctag: ctag }
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
      last = { tries: tries,
               bufs: bufs,
               orig: orig,
               start: point,
               end: vgetPos(p.view),
               word: word,
               pos: rest.pos,
               phase: rest.phase,
               buf: rest.buf,
               ctags: ctags }
    }
    else {
      Mess.say("That's all")
      last = 0
    }
  }

  return complete
}

export
function patchModeName
() {
  return 'diff'
}

function modeFromLang
(id) {
  if (id == 'shell')
    return 'sh'
  if (id == 'plaintext')
    return 'text'
  return id
}

function modeLang
(id) {
  if (id == 'sh')
    return 'shell'
  return id
}

export
function addMode
(lang) {
  let mode, exts, mime, key

  function seizeLang
  (b) {
    d(lang.id + ' seizing ' + b.name)
    seize(b, mode)
    b.opts.set('core.lang', lang.id)
  }

  function minfo
  (exts) {
    if (exts)
      return exts.map(e => Ed.mimeByExt[e]).filter(mi => mi)

    return []
  }

  exts = lang.extensions?.map(e => e.slice(1))
  mime = minfo(exts)
  key = modeFromLang(lang.id)
  d('adding mode for ' + lang.id + ' with exts: ' + exts)
  mode = Mode.add(key,
                  { name: key,
                    viewInit: viewInit,
                    viewCopy: viewCopy,
                    initFns: Ed.initModeFns,
                    parentsForEm: 'ed',
                    exts: exts,
                    mime: mime,
                    //
                    seize: seizeLang })
  lang.mode = mode

  if (lang.id == 'css') {
    //Cmd.add('insert }', (u,we) => insertClose(u, we, mode), mode)
    //Em.on('}', 'insert }', mode)
  }
  else if (lang.id == 'richdown') {
    Em.on('e', 'markdown mode', 'richdown')
    Em.on('C-c C-c', 'markdown mode', 'richdown')
    // should use view mode
    Em.on('n', 'next line', 'richdown')
    Em.on('p', 'previous line', 'richdown')
    Em.on('q', 'bury', 'richdown')
    Em.on('Backspace', 'scroll up', 'richdown')
    Em.on(' ', 'scroll down', 'richdown')
  }
  else if (lang.id == 'markdown')
    Em.on('C-c C-c', 'rich', 'markdown')

  if ([ 'javascript', 'css', 'cpp' ].includes(lang.id))
    Em.on('}', 'self insert and indent', mode)
  mode.icon = Icon.mode(mode.key)
}

export
function addModes
() {
  // done by init
}

function themeStyles
(tags) {
  let styles

  styles = [ { tag: tags.attributeName, color: Theme.fg('attribute.name') },
             { tag: tags.angleBracket, color: Theme.fg('delimiter.angle') },
             { tag: tags.bool, color: Theme.fg('variable.name') },
             { tag: tags.comment, color: Theme.fg('comment') },
             { tag: tags.className, color: Theme.fg('class.identifier') },
             { tag: tags.definition(tags.variableName), color: Theme.fg('variable.name.def') },
             { tag: tags.function(tags.definition(tags.variableName)), color: Theme.fg('function.name.def') },
             { tag: tags.deleted, color: Theme.fg('minus') },
             { tag: tags.emphasis, color: Theme.fg('bold') },
             { tag: tags.heading, color: Theme.fg('bold') },
             { tag: tags.heading1, color: Theme.fg('bold'), fontSize: '2rem' },
             { tag: tags.heading2, color: Theme.fg('bold'), fontSize: '1.75rem' },
             { tag: tags.heading3, color: Theme.fg('bold'), fontSize: '1.5rem' },
             { tag: tags.heading4, color: Theme.fg('bold'), fontSize: '1.25rem' },
             { tag: tags.inserted, color: Theme.fg('plus') },
             { tag: tags.invalid, color: Theme.fg('invalid') },
             { tag: tags.special(tags.invalid), backgroundColor: Theme.meanings.fill, color: Theme.meanings.nb3, fontWeight: 'bold' },
             { tag: tags.keyword, color: Theme.fg('keyword') },
             { tag: tags.link, color: Theme.fg(''), textDecoration: 'underline' },
             { tag: tags.meta, backgroundColor: Theme.meanings.fill }, // eg patch @@ line
             { tag: tags.null, color: Theme.fg('variable.name') },
             { tag: tags.number, color: Theme.fg('number') },
             { tag: tags.operator, color: Theme.fg('operators') },
             { tag: tags.regexp, color: Theme.fg('regexp') },
             { tag: tags.standard(tags.variableName), color: Theme.fg('variable.name.std') },
             { tag: tags.strikethrough, textDecoration: 'line-through' },
             { tag: [ tags.string, tags.special(tags.brace) ], color: Theme.fg('string') },
             { tag: tags.strong, color: Theme.fg('bold') },
             { tag: tags.tagName, color: Theme.fg('tag') },
             { tag: tags.typeName, color: Theme.fg('type.identifier') },
             { tag: tags.variableName, color: Theme.fg('text') } ]

  if (tags.diffNewfile)
    styles.unshift({ tag: tags.diffNewfile, // patch +++ line
                     fontWeight: 'bold',
                     backgroundColor: Theme.meanings.fill,
                     color: Theme.fg('plus') })
  if (tags.diffOldfile)
    styles.unshift({ tag: tags.diffOldfile, // patch --- line
                     fontWeight: 'bold',
                     backgroundColor: Theme.meanings.fill,
                     color: Theme.fg('minus') })
  if (tags.diffFilename)
    styles.unshift({ tag: tags.diffFilename,
                     backgroundColor: Theme.meanings.fill,
                     color: Theme.fg('bold') })

  if (tags.gitHash)
    styles.unshift({ tag: tags.gitHash,
                     cursor: 'pointer',
                     color: Theme.fg('comment') })

  return styles
}

function handleCustomTags
(m) {
  if (m.customTags) {
    let highlightStyle

    for (let t in m.customTags)
      themeTags[t] = m.customTags[t]
    highlightStyle = CMLang.HighlightStyle.define(themeStyles(themeTags))
    themeExtension = CMLang.syntaxHighlighting(highlightStyle)
    Buf.forEach(buf => buf.views.forEach(view => {
      if (view.ed && (view.win == Win.current()))
        if (buf.opt('core.highlight.syntax.enabled'))
          view.ed.dispatch({ effects: view.wode.themeExtension.reconfigure(themeExtension) })
    }))
  }
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

  opts = [ themeHighlightingCode,
           themeExtensionCode,
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
function init
() {
  let languages, themeSettings

  brextIds = 0
  brexts = Mk.array
  registeredOpts = new Set()
  bredView = CMState.Facet.define({ combine: values => values.length ? values[0] : null })

  completionNextLine = CMAuto.completionKeymap.find(e => e.key == 'ArrowDown').run
  completionPreviousLine = CMAuto.completionKeymap.find(e => e.key == 'ArrowUp').run

  //langs = []

  languages = CMData.languages.filter(l => [ 'diff', 'javascript', 'markdown' ].includes(l.name.toLowerCase()) ? 0 : 1)

  function addLang
  (langs, lang, ed, opt) {
    //d('lang: ' + lang.name + ' (' + lang.id + ')')
    opt = opt || {}
    lang.id = lang.name.toLowerCase()
    lang.extensions = lang.extensions?.map(e => '.' + e)
    if (lang.id == 'dockerfile')
      lang.extensions = [ ...(lang.extensions || []), '.Dockerfile' ]
    lang.path = opt.path
    if (opt.firstLine)
      lang.firstLine = opt.firstLine
    if (lang.id == 'cmake')
      lang.filenames = [ ...(lang.filenames || []), 'CMakeLists.txt' ]
    else if (lang.id == 'ruby')
      lang.filenames = [ ...(lang.filenames || []), 'Vagrantfile' ]
    if (lang.id == 'rust')
      lang.alias = [ ...(lang.alias || []), 'rs' ]
    if (lang.load)
      lang.load().then(l => lang.language = l)
    if (opt.front)
      langs.unshift(lang)
    else
      langs.push(lang)
    if (ed)
      addMode(lang)
  }

  function loadLang
  (file, name, opt) {
    d('Loading lang: ' + file)
    opt = opt || {}
    Tron.cmd('file.exists', file, (err, data) => {
      if (err) {
        Mess.log('file: ' + file)
        Mess.toss('Wode init: ' + err.message)
        return
      }
      if (data.exists) {
        let lang

        lang = CMLang.LanguageDescription.of({ name: name,
                                               extensions: opt.ext,
                                               filename: opt.filename,
                                               load() {
                                                 return import(file).then(m => {
                                                   let ls

                                                   if (opt.preload)
                                                     opt.preload(m)

                                                   if (opt.load)
                                                     ls = opt.load(m)
                                                   else if (m['language'])
                                                     ls = m['language']()
                                                   else if (m[name.toLowerCase()])
                                                     ls = m[name.toLowerCase()]()
                                                   else
                                                     Mess.toss('missing loader for ' + name)

                                                   if (opt.postload)
                                                     opt.postload(m, ls)

                                                   handleCustomTags(m)

                                                   d('Initialised lang: ' + file)

                                                   return ls
                                                 })
                                               } })
        if (opt.module === undefined)
          lang.module = file.match(/^.\/lib\/(.*)\.js$/)?.at(1)
        else
          lang.module = opt.module
        languages.push(lang)
        addLang(langs, lang, opt.ed ?? 1, opt)
      }
    })
  }

  watching = new Set()
  langs = []
  languages.forEach(l => addLang(langs, l, 1))
  langs.unshift({ id: 'text',
                  alias: [],
                  name: 'Text',
                  extensions: [ '.txt' ] })
  addMode(langs[0])
  d({ langs })

  loadLang('./lib/@codemirror/lang-javascript.js',
           'JavaScript',
           { ext: [ 'js', 'mjs', 'cjs' ],
             firstLine: '^#!.*\\b(node|gjs)',
             preload(m) {
               let lang, props, indents

               indents = {
                 // Prevent indent when export/params are on their own line.
                 'ExportDeclaration FunctionDeclaration': CMLang.flatIndent,
                 // Flush switch case to block
                 SwitchBody: ctx => {
                   let closed, isCase

                   closed = /^\s*\}/.test(ctx.textAfter)
                   isCase = /^\s*(case|default)\b/.test(ctx.textAfter)
                   return ctx.baseIndent + (((closed || isCase) ? 0 : 1) * ctx.unit)
                 }
                 // always indent ternary like eslint (eg in array def overhang was flat)
                 // too weird, turned off eslint ternary indent instead
                 //ConditionalExpression: CMLang.continuedIndent({ units: 1 })
               }
               props = [ CMLang.indentNodeProp.add(indents) ]
               lang = m.javascriptLanguage
               lang.parser = lang.parser.configure({ props: props })
             } })

  loadLang('./lib/@replit/codemirror-lang-csharp.js', 'Csharp', { ext: [ 'cs', 'csx' ] })
  loadLang('./lib/@cookshack/codemirror-lang-csv.js', 'Csv', { ext: [ 'csv' ] })
  loadLang('./lib/codemirror-lang-diff.js', 'Diff', { ext: [ 'diff', 'patch' ] })
  loadLang('./lib/codemirror-lang-elixir.js', 'Elixir', { ext: [ 'ex', 'exs' ] })
  loadLang('./lib/@codemirror/lang-lezer.js', 'Lezer', { ext: [ 'grammar' ] })
  loadLang('./lib/codemirror-lang-git-log.js', 'Git Log',
           { ed: 0 }) // prevent mode creation, already have VC Log mode
  loadLang('./lib/@cookshack/codemirror-lang-ini.js', 'Ini',
           { exts: [ 'ini', 'cfg', 'conf', 'desktop', 'service', 'gitconfig' ],
             path: /\.git\/config$/ })
  loadLang('./lib/@cookshack/codemirror-lang-lezer-tree.js', 'Lezer Tree', { ext: [ 'leztree' ] })
  loadLang('./lib/codemirror-lang-makefile.js', 'Makefile', { filename: /^(GNUmakefile|makefile|Makefile)$/ })
  loadLang('./lib/@cookshack/codemirror-lang-nasl.js', 'NASL', { ext: [ 'nasl' ] })
  loadLang('./lib/@kittycad/codemirror-lang-kcl.js', 'Kcl', { ext: [ 'kcl' ] })
  loadLang('./lib/@replit/codemirror-lang-nix.js', 'Nix', { ext: [ 'nix' ] })
  loadLang('./lib/@orgajs/codemirror-lang-org.js', 'Org', { ext: [ 'org' ] })
  loadLang('./lib/@cookshack/codemirror-lang-peg.js', 'PEG', { ext: [ 'peg' ] })
  loadLang('./lib/@cookshack/codemirror-lang-zig.js', 'Zig', { ext: [ 'zig' ] })

  loadLang('./lib/@codemirror/lang-markdown.js',
           'Markdown',
           { ext: [ 'md', 'markdown', 'mkd' ],
             load(m) {
               return m.markdown({ codeLanguages: langs })
             } })

  loadLang('./lib/codemirror-lang-richdown.js', 'Richdown',
           { front: 0, // priority goes to markdown
             ext: [ 'md' ],
             module: 0,
             load(m) {
               return m.richdown({ lezer: { codeLanguages: langs } })
             } })

  themeTags = LZHighlight.tags
  themeSettings = { backgroundImage: '',
                    foreground: Theme.meanings.text,
                    caret: Theme.meanings.pointCurrent,
                    //selection: 'rgb(38 139 210 / 20%)', //'rgb(238 232 213 / 45%)', //Theme.clrs.yellow,
                    selection: Theme.meanings.nb0Light,
                    selectionMatch: 'var(--clr-fill-aux)',
                    lineHighlight: Theme.meanings.nb0VeryLight, //'rgb(238 232 213 / 60%)', //Theme.meanings.fill,
                    gutterBorder: '1px solid #ffffff10',
                    gutterBackground: Theme.meanings.fill,
                    gutterForeground: Theme.meanings.text }
  theme = CMTheme.createTheme({ theme: 'light',
                                settings: { background: Theme.meanings.light,
                                            ...themeSettings },
                                styles: themeStyles(themeTags) })
  themeHighlighting = theme[0]
  themeExtension = theme[1]

  themeCode = CMTheme.createTheme({ theme: 'code-light',
                                    settings: { background: Theme.meanings.fill,
                                                ...themeSettings },
                                    styles: themeStyles(themeTags) })
  themeHighlightingCode = themeCode[0]
  themeExtensionCode = themeCode[1]

  {
    let classTags

    classTags = Object.entries(themeTags).map(kv => {
      return { tag: kv[1],
               class: 'bred-hz-' + kv[0] }
    })
    d({ classTags })
    tagHighlighting = LZHighlight.tagHighlighter(classTags)
    d({ tagHighlighting })
  }

  /*
  theme = CMView.EditorView.theme({
    ".cm-content": {color: "darkorange"},
    "&.cm-focused .cm-content": {color: "orange"}
    })
  */

  initActiveLine()
}
