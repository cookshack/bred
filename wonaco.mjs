import { button, divCl, span, img } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cut from './cut.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Ed from './ed.mjs'
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
import { Vonaco } from './json.mjs'
import { d } from './mess.mjs'

/*
import {SyncDescriptor} from './lib/monaco/vs/platform/instantiation/common/descriptors.js'
import {AbstractKeybindingService} from './lib/monaco/vs/platform/keybinding/common/abstractKeybindingService.js'
let StandaloneKeybindingService = class StandaloneKeybindingService extends AbstractKeybindingService {
  constructor(contextKeyService, commandService, telemetryService, notificationService, logService, codeEditorService) {
    super(contextKeyService, commandService, telemetryService, notificationService, logService)
  }
  addDynamicKeybinding(command, keybinding, handler, when) {
  }
  addDynamicKeybindings(rules) {
  }
  updateResolver() {
  }
  resolveKeyboardEvent(keyboardEvent) {
  }
}
let overrides = { keybindingService: new SyncDescriptor(StandaloneKeybindingService,
                                                        [],
                                                        0) } // supportsDelayedInstantiation
let {StandaloneServices} = await import('./lib/monaco/vs/editor/standalone/browser/standaloneServices.js')
//import {StandaloneServices} from './lib/monaco/vs/editor/standalone/browser/standaloneServices.js'
StandaloneServices.initialize(overrides)
*/

import { LinkedList } from './lib/monaco/vs/base/common/linkedList.js'
import { KeybindingsRegistry } from './lib/monaco/vs/platform/keybinding/common/keybindingsRegistry.js'
import * as Mon from './lib/monaco/vs/editor/editor.main.js'
import * as theme from './theme-solarized.js'
import { wordChars } from './lib/unicode.mjs'

import { init as initPatch } from './lang-patch.js'
import { init as initMakefile } from './lang-makefile.js'

let langs, tokenRe, nonTokenRe

export
function version
() {
  return Vonaco.version
}

export
function modeFor
(path) {
  if (path) {
    let lang, filename

    filename = Loc.make(path).filename
    lang = langs.find(l => l.filenames?.some(fn => filename == fn))
      || langs.find(l => l.extensions?.some(e => path.endsWith(e)))
    d('modeFor lang: ' + lang?.id)
    return modeFromLang(lang?.id)
  }
  return 'Ed'
}

function updateMarks
(view, e) {
  //d('== updateMarks')
  e.changes.forEach(change => {
    let start, end, delta

    //d(change)
    start = change.range.getStartPosition()
    end = change.range.getEndPosition()
    //d("start: " + start)
    //d("end: " + end)
    delta = end.lineNumber - start.lineNumber - 1
    //d("delta: " + delta)
    for (let i = view.marks.length - 1; i >= 0; i--) {
      let mark, colStart, colEnd, onSameLine

      mark = view.marks[i]

      // first deal with removed range

      if (change.range.containsPosition(mark)) {
        // Mark is in range, remove it
        //d("remove")
        d(mark)
        view.marks.splice(i, 1)
        continue
      }
      if (mark.isBefore(end))
        continue
      //d("mark is after")
      if (mark.lineNumber <= end.lineNumber)
        onSameLine = 1
      // Mark is after range
      //   decr lineNumber by num of whole lines removed by range
      if (delta > 0)
        mark.lineNumber -= delta
      if (mark.lineNumber < 1)
        // something went wrong
        mark.lineNumber = 1
      if (onSameLine) {
        //d("same line")
        // Mark is on last line of range
        //   decr cols by num of chars removed from that line
        colStart = 1
        if (end.lineNumber == start.lineNumber)
          colStart = start.column
        colEnd = end.column
        //d("col delta: " + (colEnd - colStart))
        mark.column -= (colEnd - colStart)
        if (mark.column < 1)
          // something went wrong
          mark.column = 1
      }

      // then deal with added text
    }
  })
  //d('==')
}

export
function viewInit
(view, text, modeWhenText, lineNum, whenReady) {
  let ed, buf, edWW, edW, opts

  function removeAllKeyBindings
  () {
    let rules

    rules = []

    // remove all user defined bindings
    Object.keys(Mon.KeyCode).forEach(code => {
      //d("  remove " + code)
      rules.push({ keybinding: code, command: null },
                 { keybinding: Mon.KeyMod.CtrlCmd | code, command: null },
                 { keybinding: Mon.KeyMod.Alt | code, command: null },
                 { keybinding: Mon.KeyMod.Shift | code, command: null },
                 { keybinding: Mon.KeyMod.WinCtrl | code, command: null })
    })
    Mon.editor.addKeybindingRules(rules)

    // remove all built-in and extension-provided bindings
    //
    // required because eg setting Enter to null above just means that
    // one of the built in multi-key enter bindings will be found,
    // preventing the event from propagating up to bred.
    //
    // this misses some, so the event handler is skipped entirely, see lib/monaco-patches/02-turn-off-onkeydown.patch
    KeybindingsRegistry._cachedMergedKeybindings = null
    KeybindingsRegistry._coreKeybindings = new LinkedList()
    KeybindingsRegistry._extensionKeybindings = []
    KeybindingsRegistry.getDefaultKeybindings() // force recache
  }

  function clearHandlers
  () {
    edW.onkeydown = undefined
    edW.onkeyup = undefined
  }

  function onDidChangeModelContent
  (e) {
    if (view?.ele) {
      d('onDidChangeModelContent ' + view.ed.getModel().getLineCount())
      if (view.ready) {
        //d("modified")
        buf.modified = 1
        Ed.setIcon(buf, '.edMl-mod', 'save', 'save')
        updateMarks(view, e)
        return
      }
      Css.enable(view.ele)
      view.ready = 1
    }
  }

  function onDidFocusEditorWidget
  () {
    //d("ed foc")
    if (view?.ele) {
      view.ele.querySelectorAll('.cursor.monaco-mouse-cursor-text').forEach(cur => Css.remove(cur, 'bred-blur'))
      Pane.focusView(view, 1)
    }
  }

  function onDidBlurEditorWidget
  () {
    //d("ed blur")
    if (view?.ele)
      view.ele.querySelectorAll('.cursor.monaco-mouse-cursor-text').forEach(cur => Css.add(cur, 'bred-blur'))

  }

  buf = view.buf
  buf.modified = 0
  view.ready = 0
  view.marks = []

  opts = { autoDetectHighContrast: false,
           automaticLayout: true,
           bracketPairColorization: { enabled: false },
           //'bracketPairColorization.enabled': false, // needed pre 03-bracket-colorization-opti((on.patch
           contextmenu: false,
           cursorBlinking: Opt.get('core.cursor.blink') ? 'blink' : 'solid',
           cursorStyle: 'line',
           fixedOverflowWidgets: false,
           fontSize: 16, // must be px
           links: false,
           insertSpaces: true, // tab with spaces
           occurrencesHighlight: true,
           renderIndentGuides: true,
           renderLineHighlight: 'line', //"none",
           scrollBeyondLastLine: true,
           selectionHighlight: true, //false,
           stickyScroll: { enabled: false },
           theme: 'solarized-light',
           wordWrap: 'on' }

  if (buf.opt('minimap.enabled'))
    opts.minimap = { enabled: true }
  else
    opts.minimap = { enabled: false }

  edWW = view.ele.firstElementChild
  edW = edWW.querySelector('.edW')
  //d('won overrides')
  //d(overrides)
  if (view.ed)
    ed = view.ed

  else
    ed = Mon.editor.create(edW, opts, /*overrides*/)

  view.ed = ed

  ed.updateOptions(opts)
  Mon.editor.setModelLanguage(ed.getModel(), 'text/plain')
  ed.getModel().updateOptions({ tabSize: 2 })
  if (buf.opt('core.line.numbers.show')) {
  }
  else
    ed.updateOptions({ lineNumbers: 'off',
                       glyphMargin: false,
                       folding: false,
                       // Undocumented see https://github.com/Microsoft/vscode/issues/30795#issuecomment-410998882
                       lineDecorationsWidth: 0,
                       lineNumbersMinChars: 0,
                       showFoldingControls: 'never' })

  //ed.setOption("autoScrollEditorIntoView", 1) // seems broken
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

  if (0) {
    // problems, now done via lib/monaco-patches/02-turn-off-onkeydown.patch
    ed.onDidChangeModelLanguageConfiguration(clearHandlers) // first init
    ed.onDidLayoutChange(clearHandlers) // every init
  }

  if (view.ev_onDidChangeModelContent)
    view.ev_onDidChangeModelContent.dispose()
  ed.getModel().setValue(text || '')
  view.ev_onDidChangeModelContent = ed.onDidChangeModelContent(onDidChangeModelContent)

  if (view.ev_onDidFocusEditorWidget)
    view.ev_onDidFocusEditorWidget.dispose()
  view.ev_onDidFocusEditorWidget = ed.onDidFocusEditorWidget(onDidFocusEditorWidget)

  if (view.ev_onDidBlurEditorWidget)
    view.ev_onDidBlurEditorWidget.dispose()
  view.ev_onDidBlurEditorWidget = ed.onDidBlurEditorWidget(onDidBlurEditorWidget)

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
    }
    return 0
  }

  if ((typeof text == 'string') || text instanceof String) {
    let mode

    d('given mode: ' + modeWhenText)
    mode = modeFromFirstLine(text) || modeWhenText
    mode = mode || 'text'
    d('chose mode 1: ' + mode)
    Ed.setIcon(buf, '.edMl-type', Icon.mode(mode)?.name, 'describe buffer')
    Mon.editor.setModelLanguage(ed.getModel(), modeLang(mode))
    if (Ed.defined(lineNum))
      //ed.renderer.once("afterRender", () => recenter(ed))
      vgotoLine(view, lineNum)

    if (whenReady)
      whenReady(view)

    return
  }
  else if (buf.file) {
    let path

    path = buf.path
    Tron.cmd('file.get', path, (err, data) => {
      let mode

      if (err) {
        Mess.log('file: ' + buf.file)
        Mess.log(' dir: ' + buf.dir)
        Mess.log('path: ' + path)
        Mess.toss('Wonaco viewinit: ' + err.message)
        return
      }

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
      Mon.editor.setModelLanguage(ed.getModel(), modeLang(mode))
      d('chose mode 2: ' + mode)
      Ed.setIcon(buf, '.edMl-type', Icon.mode(mode)?.name, 'describe buffer')

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

      ed.getModel().setValue(data.data)
      if (view == Pane.current().view)
        ed.focus()
      if (Ed.defined(lineNum))
        vgotoLine(view, lineNum)
        //ed.renderer.once("afterRender", () => recenter(ed))
        //setTimeout(() => recenter(ed))

      if (whenReady)
        whenReady(view)

      //ed.session.getUndoManager().reset()

      /*
      ed.on("input", () => {
        if (ed.session.getUndoManager().isClean()) {
          view.buf.modified = 0
          Ed.setIcon(view.buf, ".edMl-mod", "blank")
        }
      })
      */
    })
    return
  }

  Css.enable(view.ele)
  view.ready = 1
}

export
function viewReopen
(view, lineNum, whenReady) {
  d('viewReopen')
  view.ready = 1
  //view.ed.resize()
  view.ed.focus()
  if (Ed.defined(lineNum))
    vgotoLine(view, lineNum)
  if (whenReady)
    whenReady(view)
}

export
function viewCopy
(to, from, lineNum, whenReady) {
  viewInit(to, from.ed.getModel().getValue(), from.ed.getModel().getLanguageId(), lineNum, whenReady)
}

function lineAt
(view, pos) {
  let l

  l = view.ed.getModel().getLineContent(pos.lineNumber)
  return l
}

// pos here is bred pos (vs ace pos)
export
function vsetPos
(view, pos, reveal) {
  return vsetBep(view, makeBep(0, pos.row, pos.col - 1), reveal)
}

function vgetPos
(view) {
  return view.ed.getPosition()
}

export
function ensurePointVisible
(view) {
  view.ed.revealPosition(vgetBep(view))
}

export
function makeBep
(view,
 row, // 0 indexed (Mon is 1 indexed)
 col) { // 0 indexed (Mon is 1 indexed)
  return new Mon.Position(row + 1, col + 1)
}

export
function posRow
(pos) {
  if (pos?.lineNumber)
    return pos.lineNumber - 1
  return 0
}

export
function posCol
(pos) {
  if (pos?.column)
    return pos.column - 1
  return 0
}

// Back End Positions

export
function vgetBep
(view) {
  return vgetPos(view)
}

// 0 indexed
export
function bepRow
(view, bep) {
  if (bep.lineNumber > 0)
    return bep.lineNumber - 1
  return 0
}

// 0 indexed
export
function bepCol
(view, bep) {
  if (bep.column > 0)
    return bep.column - 1
  return 0
}

export
function vgetBepEnd
(view) {
  let line, lineLen

  line = view.ed.getModel().getLineCount()
  lineLen = view.ed.getModel().getLineLength(line)
  return new Mon.Position(line, lineLen + 1)
}

export
function vsetBep
(view, bep, reveal) {
  let ret

  d('vsetBep ' + bep)
  ret = view.ed.setPosition(bep)
  if (reveal)
    view.ed.revealPosition(bep)
  return ret
}

export
function vbepIncr
(view, bep) {
  let model

  model = view.ed.getModel()
  // probably should get line length and incr col,/row
  return model.getPositionAt(model.getOffsetAt(bep) + 1)
}

export
function vbepEq
(bep1, bep2) {
  return bep1.equals(bep2)
}

// pos here is bred pos (vs monaco/ace pos)
export
function bepToPos
(view, bep) {
  return Ed.makePos(bep.lineNumber - 1, bep.column)
}

// pos here is bred pos (vs monaco/ace pos)
export
function posToBep
(view, pos) {
  return { lineNumer: pos.lineNumber, column: pos.column }
}

export
function makeRange
(from, to) {
  return new Mon.Range(from.lineNumber, from.column,
                       to.lineNumber, to.column)
}

export
function rangeStartBep
(range) {
  return range.getStartPosition()
}

export
function rangeEndBep
(range) {
  return range.getEndPosition()
}

function rangeStart
(range) {
  return range.getStartPosition()
}

function rangeEnd
(range) {
  return range.getEndPosition()
}

function rangeFromPoints
(pos1, pos2) {
  return new Mon.Range(pos1.lineNumber, pos1.column,
                       pos2.lineNumber, pos2.column)
}

function rangeContains
(range, pos) {
  return range.containsPosition(pos)
}

function textFromRange
(view, range) {
  return view.ed.getModel().getValueInRange(range)
}

function line
(view) {
  return lineAt(view, vgetPos(view))
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
  let bep

  num = parseInt(num)
  bep = makeBep(0, num ? num - 1 : 0, 0)
  vsetBep(view, bep)
  view.ed.revealLineInCenter(bep.lineNumber)
}

function vonChange
(view, cb) {
  if (view.ed) {
    view.onChanges = view.onChanges || Mk.array
    if (view.onChanges.find(o => o.cb == cb))
      Mess.toss('already have an onChange for this cb')
    view.onChanges.push({ cb: cb, ref: view.ed.onDidChangeModelContent(cb) })
  }
}

function voffChange
(view, cb) {
  if (view.ed) {
    let onChange

    view.onChanges = view.onChanges || Mk.array
    onChange = view.onChanges.find(o => o.cb == cb)
    if (onChange)
      onChange.ref.dispose()
    view.onChanges.removeIf(o => o.cb === cb)
  }
}

export
function vlen
(v) {
  return v.ed.getModel().getLineCount()
}

function makePsn
(view) {
  let psn, bep

  function getText
  () {
    let text

    text = view.ed.getModel().getLineContent(bep.lineNumber)

    if (text)
      return text.slice(Math.max(bep.column - 1, 0))
    return ''
  }

  function lineStart
  () {
    bep.column = 0
  }

  function lineEnd
  () {
    bep.column = view.ed.getModel().getLineMaxColumn(bep.lineNumber)
  }

  function lineNext
  () {
    let last, col

    last = view.ed.getModel().getLineCount()
    if (bep.lineNumber == last)
      return 0

    bep.lineNumber++
    col = view.ed.getModel().getLineMaxColumn(bep.lineNumber)
    if (col < bep.column)
      bep.column = col

    return 1
  }

  function linePrev
  () {
    let col

    if (bep.lineNumber == 1)
      return 0

    bep.lineNumber--
    col = view.ed.getModel().getLineMaxColumn(bep.lineNumber)
    if (col < bep.column)
      bep.column = col

    return 1
  }

  bep = vgetBep(view)

  psn = { get text() {
    return getText()
  },
          get bep() {
            return bep
          },
          //
          lineEnd,
          lineStart,
          lineNext,
          linePrev }

  return psn
}

export
function initModeFns
(mo) {
  function clear
  (b) {
    b.views.forEach(view => {
      if (view.ed)
        view.ed.getModel().setValue('')

    })
  }

  function clearLine
  (b) {
    b.views.forEach(view => {
      if (view.ed) {
        let start, r, l

        start = vgetPos(view)
        l = lineAt(view, start)
        if (l.length) {
          r = rangeFromPoints(makeBep(0, start.row, 0),
                              makeBep(0, start.row, l.length))
          remove(view.ed, r)
        }
      }
    })
  }

  function text
  (view) {
    return view.ed.getModel().getValue()
  }

  function lang
  (view) {
    return view.ed.getModel().getLanguageId()
  }

  function off
  (b, name, cb) {
    if (name == 'change')
      b.views.forEach(view => {
        voffChange(view, cb)
      })
  }

  function on
  (b, name, cb) {
    if (name == 'change')
      b.views.forEach(view => {
        vonChange(view, cb)
      })
  }

  mo.clear = clear
  mo.clearLine = clearLine
  mo.excur = excur
  mo.gotoLine = vgotoLine
  mo.lang = lang
  mo.line = line
  mo.lineAt = lineAt
  mo.lineStart = lineStart
  mo.makePsn = makePsn
  mo.off = off
  mo.on = on
  mo.prevLine = prevLine
  mo.nextLine = nextLine
  mo.setBep = vsetBep
  mo.text = text
  mo.viewReopen = viewReopen
  mo.vinsertAll = vinsertAll
}

export
function divW
(dir, name, opts) {
  opts = opts || {}
  return divCl('edWW' + (opts.extraWWCss ? (' ' + opts.extraWWCss) : ''),
               [ divCl('ml edMl' + (opts.hideMl ? ' retracted' : ''),
                       [ divCl('edMl-type',
                               img(Icon.path(opts.icon || 'blank'), 'Blank', 'filter-clr-text')),
                         divCl('edMl-mod',
                               img(Icon.path('blank'), 'Modified', 'filter-clr-text')),
                         divCl('edMl-file', name || ''),
                         divCl('edMl-dir', Ed.makeMlDir(dir)),
                         divCl('ml-close') ]),
                 opts.extraBefore,
                 divCl('edW' + (opts.extraWCss ? (' ' + opts.extraWCss) : '')),
                 opts.extraCo ])
}

function edexec
(ed, markActive, cmd, markCmd, args) {
  if (markCmd)
    //ed.trigger('bred', ed.session.$emacsMark ? markCmd : cmd, args)
    ed.trigger('bred', markActive ? markCmd : cmd, args)
  else
    ed.trigger('bred', cmd, args)
}

function vexec
(view, cmd, markCmd, args) {
  edexec(view.ed, view.markActive, cmd, markCmd, args)
}

function pexec
(p, cmd, markCmd, args) {
  vexec(p.view, cmd, markCmd, args)
}

function exec
(cmd, markCmd, args) {
  vexec(Pane.current().view, cmd, markCmd, args)
}

function utimes
(u, cb) {
  u = u || 1
  for (let i = 0; i < u; i++)
    cb()
}

// nav

export
function forward(u) {
  let p

  p = Pane.current()
  utimes(u, () => pexec(p, 'cursorRight', 'cursorRightSelect'))
}

export
function backward(u) {
  let p

  p = Pane.current()
  utimes(u, () => pexec(p, 'cursorLeft', 'cursorLeftSelect'))
}

/* these behave weirdly
export
function wordForward(u) {
  let p = Pane.current()
  utimes(u, () => pexec(p, "cursorWordEndRight", "cursorWordEndRightSelect"))
}

export
function wordBackward(u) {
  let p = Pane.current()
  utimes(u, () => pexec(p, "cursorWordStartLeft", "cursorWordStartLeftSelect"))
}
*/

export
function wordForward(u) {
  let p, backward

  p = Pane.current()
  u = u || 1
  backward = u < 0
  u = Math.abs(u)
  //utimes(u, () => pexec(p, "cursorWordEndRight", "cursorWordEndRightSelect"))
  for (let i = 0; i < u; i++)
    if (vfind(p.view,
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

export
function wordBackward(u) {
  //utimes(u, () => pexec(p, "cursorWordStartLeft", "cursorWordStartLeftSelect"))
  wordForward(u ? -u : -1)
}

function getTokens
(model, lineNumber) {
  let state

  // https://github.com/microsoft/monaco-editor/issues/346#issuecomment-277215371

  // Force line's state to be accurate
  model.getLineTokens(lineNumber, false) // inaccurateTokensAcceptable
  // Get the tokenization state at the beginning of this line
  state = model._lines[lineNumber - 1].getState().clone()
  // Get the human readable tokens on this line
  return model._tokenizationSupport.tokenize(model.getLineContent(lineNumber), state, 0).tokens
}

export
function syntaxForward() {
  let p, toks, bep

  d('sf')

  p = Pane.current()
  bep = vgetBep(p.view)
  toks = getTokens(p.view.ed.getModel(), bep.lineNumber)
  d({ toks })
}

export
function syntaxBackward() {
  d('sb')
}

export
function prevLine(v, u) {
  utimes(u, () => vexec(v, 'cursorUp', 'cursorUpSelect'))
}

export
function nextLine(v, u) {
  utimes(u, () => vexec(v, 'cursorDown', 'cursorDownSelect'))
}

function addMarkAt
(view, off) {
  view.marks.push(off)
}

export
function setMark(u) {
  let p

  p = Pane.current()
  if (u == 4) {
    let mark

    if (p.view.marks.length == 0) {
      Mess.say('Set a mark first')
      return
    }
    clearSelection(p.view)
    mark = p.view.marks.pop()
    p.view.ed.setPosition(mark)
  }
  else {
    let pos

    pos = vgetPos(p.view)
    addMarkAt(p.view, pos)
    p.view.markActive = 1
    //d(p.view.marks)
    p.view.ed.setSelection(new Mon.Selection(pos.lineNumber, pos.column, pos.lineNumber, pos.column))
  }
}

function selReverse
(sel) {
  if (sel.getDirection() == Mon.SelectionDirection.LTR)
    return Mon.Selection.fromPositions(sel.getEndPosition(), sel.getStartPosition())
  return Mon.Selection.fromPositions(sel.getStartPosition(), sel.getEndPosition())
}

export
function exchange() {
  let p, point, mark

  p = Pane.current()
  point = vgetPos(p.view)
  if (p.view.marks.length == 0) {
    Mess.say('Set a mark first')
    return
  }
  mark = p.view.marks.pop()
  if (p.view.markActive) {
    let sel

    sel = p.view.ed.getSelection()
    sel && (sel.isEmpty() || p.view.ed.setSelection(selReverse(sel)))
  }
  else
    p.view.ed.setPosition(mark)
  p.view.marks.push(point)
}

export
function lineStart
() {
  let p, pos

  p = Pane.current()
  pos = vgetPos(p.view)
  pos.column = 0
  p.view.ed.setPosition(pos)
}

export
function lineEnd
() {
  //exec("gotolineend", "selecttolineend")
  Pane.current().view.ed.trigger('bred', 'cursorLineEnd')
  //Pane.current().view.ed.getAction('editor.action.format').run()
}

export
function vbufEnd(v) {
  vexec(v, 'cursorBottom')
}

export
function vbufStart(v) {
  vexec(v, 'cursorTop')
}

export
function bufferStart() {
  exec('cursorTop', 'cursorTopSelect')
}

export
function bufferEnd() {
  exec('cursorBottom', 'cursorBottomSelect')
}

export
function scrollUp() {
  exec('cursorPageUp', 'cursorPageUpSelect')
}

export
function scrollDown() {
  exec('cursorPageDown', 'cursorPageDownSelect')
}

export
function toggleOverwrite() {
  exec('overwrite')
}

export
function selectAll() {
  exec('editor.action.selectAll')
}

function lineIsClear
(view) {
  let text

  text = line(view)
  return (text.length == 0) || text.startsWith(' ') || text.startsWith('\t')
}

function lineIsText
(view) {
  if (lineIsClear(view))
    return 0
  return 1
}

export
function topLevelStart
() {
  let p, pos

  p = Pane.current()

  lineStart(p.view)

  pos = vgetPos(p.view)
  while ((pos.lineNumber > 0) && lineIsText(p.view)) {
    prevLine(p.view)
    pos = vgetPos(p.view)
  }

  while ((pos.lineNumber > 0) && lineIsClear(p.view)) {
    prevLine(p.view)
    pos = vgetPos(p.view)
  }

  lineStart(p.view)
}

export
function topLevelEnd
() {
  let p, pos, end

  p = Pane.current()
  end = p.view.ed.getModel().getLineCount() - 1

  pos = vgetPos(p.view)
  while ((pos.lineNumber < end) && lineIsText(p.view)) {
    nextLine(p.view)
    pos = vgetPos(p.view)
  }

  while ((pos.lineNumber < end) && lineIsClear(p.view)) {
    nextLine(p.view)
    pos = vgetPos(p.view)
  }

  lineStart(p.view)
}

function ensureCursorVisible
(ed, scrollTop) {
  let pos, first, last

  //d("ensureCursorVisible")
  //d(scrollTop)
  pos = ed.getCursorPosition()
  d(pos)
  first = Math.floor(scrollTop / ed.renderer.lineHeight) - 1
  //d("first: " + first)
  last = Math.floor((scrollTop + ed.renderer.$size.scrollerHeight) / ed.renderer.lineHeight) - 3
  //d("last: " + last)
  if (pos.row < first) {
    pos.row = Math.max(0, first)
    ed.setPosition(pos)
  }
  else if (pos.row > last) {
    pos.row = Math.max(0, last)
    ed.setPosition(pos)
  }
}

function topRow
(view) {
  let num

  num = view.ed.getVisibleRanges()[0].startLineNumber
  return num ? num - 1 : 0
}

export
function topOfPane
() {
  let p, row

  p = Pane.current()
  row = topRow(p.view)
  vsetBep(p.view, makeBep(0, row, 0))
}

export
function bottomOfPane
() {
  let p, last, num

  p = Pane.current()
  last = p.view.ed.getVisibleRanges().at(-1)
  num = last.endLineNumber
  vsetBep(p.view, makeBep(0, num ? num - 1 : 0, 0))
}

export
function recenter
(view) {
  if (view?.ed) {
    let pos

    pos = vgetPos(view)
    view.ed.revealLineInCenter(pos.lineNumber)
    view.ed.focus()
  }
}

export
function cancel
() {
  //exec("keyboardQuit")
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
(view, cb) {
  if (view?.ed)
    if (view.buf.path) {
      Css.disable(view.ele)
      Tron.cmd('file.save', [ Loc.make(view.buf.path).expand(), view.ed.getValue() ], err => {
        Css.enable(view.ele)
        if (err) {
          if (cb)
            cb(err)
          else
            Mess.yell(err.message)
          return
        }
        view.buf.modified = 0
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
  let pos

  Css.disable(view.ele)
  pos = vgetPos(view)
  //view.ed.getModel().setValue("")
  viewInit(view, 0, 0, posRow(pos) + 1)
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

function handleChange
(pview, e) {
  pview.sync(view => {
    if (view.ed)
      e.changes.forEach(change => {
        d(change)
        view.ed.executeEdits('bred',
                             [ { range: change.range,
                                 text: change.text,
                                 forceMoveMarkers: true } ])
      })

  })
}

export
function undo
() {
  let pview

  function onChange (e) {
    handleChange(pview, e)
    // is it garaunteed that one change event will happen per undo?
    voffChange(pview, onChange)
  }

  pview = Pane.current().view
  vonChange(pview, onChange)
  exec('undo')
}

export
function redo
() {
  let pview

  function onChange (e) {
    handleChange(pview, e)
    // is it garaunteed that one change event will happen per undo?
    voffChange(pview, onChange)
  }

  pview = Pane.current().view
  vonChange(pview, onChange)
  exec('redo')
}

export
function vrangeText
(view, range) {
  return view.ed.getModel().getValueInRange(range)
}

export
function setDecorMatch
(decorParent, view, range) {
  let model

  model = view.ed.getModel()
  decorParent.decorMatch = model.deltaDecorations(decorParent.decorMatch || [],
                                                  [ { range: range,
                                                      options: { isWholeLine: 0,
                                                                 inlineClassName: 'bred-search-match' } } ])
}

export
function setDecorAll
(decorParent, view, needle, opts) {
  let ms, model

  model = view.ed.getModel()
  ms = model.findMatches(needle,
                         0, // search only editable
                         opts.regExp,
                         opts.caseSensitive,
                         null, // word separators
                         0) // capture matches
  decorParent.decorAll = model.deltaDecorations(decorParent.decorAll || [],
                                                ms.map(m => {
                                                  return { range: m.range,
                                                           options: { isWholeLine: 0,
                                                                      inlineClassName: 'bred-search-all' } }
                                                }))
}

export
function vfind
(view, needle, decorParent, opts) {
  let ret, find, model, initialPos, initialSel

  //d('vfind ' + needle)

  model = view.ed.getModel()

  find = model.findNextMatch
  if (opts.backwards)
    find = model.findPreviousMatch

  // add highlighting: https://stackoverflow.com/questions/73791014/how-to-highligh-specific-text-in-the-monaco-editor

  if (opts.skipCurrent) {
    // searching again
  }
  else
    // first time
    if (decorParent)
      setDecorAll(decorParent, view, needle, opts)

  initialPos = vgetPos(view)
  if (view.markActive)
    initialSel = view.ed.getSelection()

  ret = find.bind(model)(needle,
                         initialPos,
                         opts.regExp,
                         opts.caseSensitive,
                         null, // word separators
                         0) // capture matches
  //d(ret)
  if (ret) {
    let pos, rStart, rEnd

    if (opts.wrap == 0)
      if (opts.backwards
        ? initialPos.isBefore(ret.range.getStartPosition())
        : ret.range.getStartPosition().isBefore(initialPos))
        // wrapped
        return 0

    //view.ed.setSelection(ret.range)
    if (decorParent)
      setDecorMatch(decorParent, view, ret.range)
      //d(decorParent.decorMatch)

    if (opts.stayInPlace)
      return ret.range

    rStart = ret.range.getStartPosition()
    rEnd = ret.range.getEndPosition()
    pos = opts.backwards ? rStart : rEnd
    if (initialSel)
      view.ed.setSelection(Mon.Selection.fromPositions(initialSel.getStartPosition(), pos))

    else
      view.ed.setPosition(pos)

    view.ed.revealPosition(pos)
    return ret.range
  }
  return 0
}

function vinsert
(view, u, text) {
  let pos

  pos = vgetPos(view)
  vinsertAtAll(view, pos, u, text)
}

export
function vinsertAt
(view, pos, u, text, setBep, to) {
  view.buf.views.forEach(view => {
    for (let i = 0; i < u; i++)
      //view.ed.trigger('keyboard', 'type', {text: char})
      view.ed.executeEdits('source',
                           [ { range: new Mon.Range(pos.lineNumber,
                                                    pos.column,
                                                    to ? to.lineNumber : pos.lineNumber,
                                                    to ? to.column : pos.column),
                               text: text,
                               forceMoveMarkers: true } ],
                           [ view.ed.getSelection() ])
    if (setBep) {
      let bep, off

      off = view.ed.getModel().getOffsetAt(pos)
      off += text.length
      bep = view.ed.getModel().getPositionAt(off)
      vsetBep(view, bep, 1)
    }
  })
}

function vinsertAll
(view, u, text) {
  let pos

  pos = vgetPos(view)
  view.buf.views.forEach(v => {
    if (v.ele)
      vinsertAt(v, pos, u, text, v == view)
  })
}

function vinsertAtAll
(view, off, u, text) {
  view.buf.views.forEach(v => {
    if (v.ele)
      vinsertAt(v, off, u, text, v == view)
  })
}

export
function selfInsert
(u, we) {
  let char, p

  if ([ 'Alt', 'Control', 'CapsLock', 'Shift' ].includes(we.key))
    return

  char = Ed.charForInsert(we)

  p = Pane.current()
  vinsert(p.view, u, char)
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
      vinsert(p.view, u, char)
    }
    finally {
      globalThis.onkeydown = oldOnKeyDown
      Mess.say()
    }
  }
}

function atPos
(cmd, args) {
  let p, pos

  p = Pane.current()
  pos = vgetPos(p.view)
  vexec(p.view, cmd, cmd, args)
  p.view.sync(view => {
    if (view.ed)
      excur(view, () => {
        view.ed.setPosition(pos)
        vexec(view, cmd, cmd, args)
      })
  })
  return p
}

export
function caseWord(cb) {
  let p, range, orig, pos, str

  p = Pane.current()
  // get the range to be cased
  pos = vgetPos(p.view)
  orig = p.view.ed.getSelection()
  clearSelection(p.view)
  p.view.ed.trigger('bred', 'cursorWordEndRightSelect')
  range = p.view.ed.getSelection()
  str = p.view.ed.session.getTextRange(range)
  str = cb(str, p.view)
  p.view.ed.setPosition(pos)

  // case range in each view
  p.buf.views.forEach(view => {
    let vorig

    vorig = view.ed.getSelection()
    clearSelection(view)
    remove(view.ed, range)
    vinsert(view, 1, str)
    view.ed.setSelection(vorig)
  })

  // move point in current pane
  p.view.ed.setSelection(orig)
  p.view.ed.setPosition(range.end)
}

export
function capitalizeWord() {
  caseWord(str => {
    // better go beginning of word
    nonTokenRe.lastIndex = 0
    if (nonTokenRe.exec(str) === null)
      str = Buf.capitalize(str)
    else {
      let i

      i = nonTokenRe.lastIndex
      str = str.slice(0, i) + Buf.capitalize(str.slice(i))
    }
    return str
  })
}

export
function newline
(u) {
  let p

  p = Pane.current()
  vinsert(p.view, u, '\n')
}

export
function openLine() {
  atPos('splitline')
}

export
function delPrevChar() {
  atPos('deleteLeft')
}

export
function delNextChar() {
  atPos('deleteRight')
}

export
function cutLine() {
  let p, str, pos

  p = Pane.current()
  pos = vgetPos(p.view)
  str = p.view.ed.getModel().getLineContent(pos.lineNumber) // slice pos.column?
  if (str.length) {
    p.view.ed.executeEdits('',
                           [ { range: new Mon.Range(pos.lineNumber, pos.column,
                                                    pos.lineNumber, str.length + 1),
                               text: null } ])
    Cut.add(str)
  }
  else {
    delNextChar()
    Cut.add('\n')
  }
}

export
function clearSelection
(view) {
  let pos

  pos = vgetPos(view)
  view.markActive = 0
  view.ed.setSelection(new Mon.Selection(pos.lineNumber, pos.column, pos.lineNumber, pos.column))
}

export
function remove
(ed, range) {
  ed.executeEdits('bred', [ { range: range, text: null } ])
}

export
function delNextWord
(n) {
  let p, start, end, text, range

  //atPos("deleteWordRight")
  p = Pane.current()
  clearSelection(p.view)
  start = vgetPos(p.view)
  if (n < 0)
    edexec(p.view.ed, p.view.markActive, 'cursorWordLeft')
  else
    edexec(p.view.ed, p.view.markActive, 'cursorWordRight')
  end = vgetPos(p.view)
  range = new Mon.Range(start.lineNumber, start.column,
                        end.lineNumber, end.column)
  text = p.view.ed.getModel().getValueInRange(range)
  if (text && text.length) {
    p.buf.views.forEach(view => {
      remove(view.ed, range)
    })
    Cut.add(text)
  }
  return p
}

export
function indentLine() {
  insertTwoSpaces()
}

export
function indentBuffer() {
  atPos('autoindent')
}

export
function insertTwoSpaces() {
  let p

  p = Pane.current()
  vinsert(p.view, 1, '  ')
}

export
function transposeChars() {
  atPos('transposeletters')
}

export
function transposeWords() {
  d('t')
}

let spRe

spRe = /^\s+/g

export
function trim() {
  let p, str, start, r, l

  p = Pane.current()
  start = vgetPos(p.view)
  l = lineAt(p.view, start)
  spRe.lastIndex = 0
  if (spRe.exec(l.slice(start.column - 1))) {
    r = new Mon.Range(start.lineNumber, start.column,
                      start.lineNumber, start.column + spRe.lastIndex)
    remove(p.view.ed, r)
  }
  if (start.column > 1) {
    str = [ ...l.slice(0, start.column - 1) ].reverse().join('')
    spRe.lastIndex = 0
    if (spRe.exec(str)) {
      r = new Mon.Range(start.lineNumber, start.column - spRe.lastIndex,
                        start.lineNumber, start.column)
      remove(p.view.ed, r)
    }
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
    vinsert(p.view, 1, str || '')
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
    if ([ 'Paste', 'Yank' ].includes(Cmd.last()))
      Cut.roll()
    str = Cut.roll()
    if (str) {
      let ed, r

      ed = p.view.ed
      if (ed.selection.isEmpty())
        ed.selection.selectToPosition(ed.emacsMarkForSelection())
      r = ed.selection.getRange()
      if (r.isEmpty()) {
      }
      else
        ed.session.remove(r)
      p.view.ed.onPaste(str || '')
    }
    else
      Mess.say('Cut list empty')
    return
  }
  Mess.say('Yank/Paste first')
}

function cutOrCopy
(cut) {
  let p, str, sel

  p = Pane.current()
  sel = p.view.ed.getSelection()
  if (sel) {
    if (sel.isEmpty())
      return
    str = p.view.ed.getModel().getValueInRange(sel)
    if (cut)
      remove(p.view.ed, sel)
    Cut.add(str)
  }
  p.view.markActive = 0
}

export
function cut() {
  cutOrCopy(1)
}

export
function copy() {
  cutOrCopy()
}

export
function find
(st) {
  st.view.ed.clearSelection()
  return st.view.ed.find(st.from,
                         { skipCurrent: 0,
                           backwards: 0,
                           wrap: 0,
                           caseSensitive: 1,
                           wholeWord: 0,
                           regExp: 0 })
}

export
function replace
(st, all, search) {
  if (st.view.ed.replace(st.to,
                         { needle: st.from,
                           skipCurrent: 0,
                           backwards: 0,
                           wrap: 0,
                           caseSensitive: 1,
                           wholeWord: 0,
                           regExp: 0 })) {
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
function clearDecorMatch
(view, decorParent) {
  if (decorParent.decorMatch)
    decorParent.decorMatch = view.ed.getModel().deltaDecorations(decorParent.decorMatch, [])
}

export
function clearDecorAll
(view, decorParent) {
  if (decorParent.decorAll)
    decorParent.decorAll = view.ed.getModel().deltaDecorations(decorParent.decorAll, [])
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
      vsetBep(view, opts.start)
    range = vfind(view, opts.needle, 0, opts)
    if (range) {
      opts.start = rangeEnd(range) // for next time
      vsetBep(view, pos)
      if (opts.range)
        return rangeContains(opts.range, rangeStart(range)) && range
    }
    return range
  }
  return { set,
           find }
}

export
function initComplete
() {
  let last

  function getWord
  (p) {
    let pos, pos1, word

    pos = vgetPos(p.view)

    line = lineAt(p.view, pos)
    pos1 = Object.assign({}, pos)
    if (line[pos1.column] == ' ')
      pos1.column--
    while (pos1.column >= 0) {
      if (line[pos1.column] == ' ')
        break
      pos1.column--
    }
    if (pos1.column == pos.column)
      return 0
    word = textFromRange(p.view, rangeFromPoints(pos1, pos))
    if (word.length == 0)
      return 0
    return word
  }

  function getRest
  (word, p, pos, phase, bufs, buf) {
    let startRow, end, endLen, srch

    function getBuf
    () {
      let b

      if (buf)
        return buf
      pos = makeBep(0, 0, 0)
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

    function makeSrch
    (view, pos1, bw) {
      let s, range

      if (bw)
        range = rangeFromPoints(makeBep(0, startRow, 0), pos1)
      else
        range = rangeFromPoints(pos1, makeBep(0, end, endLen))
      d('search '
        + (bw ? 'backward' : 'forward')
        + ' from (' + posRow(pos1) + ', ' + posCol(pos1) + ')'
        + ' in range (' + posRow(rangeStart(range)) + ',' + posCol(rangeStart(range)) + ')-'
        + '(' + posRow(rangeEnd(range)) + ',' + posCol(rangeEnd(range)) + ')')
      s = makeSearcher(view)
      s.set({ needle: '(^' + Ed.escapeForRe(word) + '|\\s+' + Ed.escapeForRe(word) + ')',
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

    function check
    (view, r, pos1, bw, phase) {
      let sl

      sl = lineAt(view, rangeEnd(r))
      sl = sl.slice(posCol(rangeEnd(r)))
      d('check line: ' + sl)
      if ((sl.length == 0) || sl.startsWith(' ')) {
        srch = makeSrch(view, pos1, bw)
        return 0
      }
      d('found at: (' + posRow(pos1) + ',' + posCol(pos1) + ')')
      return { text: sl.split(' ')[0],
               pos: pos1,
               phase: phase,
               buf: buf }
    }

    phase = phase || 0
    d('word: ' + word)

    // search visible lines before
    startRow = topRow(p.view)
    if (phase <= 0) {
      let r

      phase = 0
      d('= 0 search visible before')
      srch = makeSrch(p.view, pos, 1)
      while ((r = srch.find())) {
        let pos1, ret

        pos1 = makeBep(0, posRow(rangeStart(r)), posCol(rangeStart(r)) - 1)
        ret = check(p.view, r, pos1, 1, phase)
        if (ret)
          return ret
        continue
      }
    }

    // search visible lines after
    if (phase <= 1) {
      let r

      phase = 1
      d('= 1 search visible after')
      end = p.view.ed.renderer.getLastFullyVisibleRow()
      endLen = lineAt(p.view, makeBep(0, posRow(end), 0)).length
      srch = makeSrch(p.view, pos, 0)
      while ((r = srch.find())) {
        let pos1, ret

        pos1 = rangeEnd(r)
        ret = check(p.view, r, pos1, 0, phase)
        if (ret)
          return ret
        continue
      }
    }

    // search buffer before
    if (phase <= 2) {
      let r

      phase = 2
      d('= 2 search current buffer before')
      startRow = 0
      srch = makeSrch(p.view, pos, 1)
      while ((r = srch.find())) {
        let pos1, ret

        pos1 = makeBep(0, posRow(rangeStart(r)), posCol(rangeStart(r)) - 1)
        ret = check(p.view, r, pos1, 1, phase)
        if (ret)
          return ret
        continue
      }
    }

    // search buffer after
    if (phase <= 3) {
      let r

      phase = 3
      d('= 3 search current buffer after')
      startRow = 0
      end = p.view.ed.getModel().getLineCount()
      endLen = lineAt(p.view, makeBep(0, end, 0)).length
      srch = makeSrch(p.view, pos, 0)
      while ((r = srch.find())) {
        let pos1, ret

        pos1 = rangeEnd(r)
        ret = check(p.view, r, pos1, 0, phase)
        if (ret)
          return ret
        continue
      }
    }

    // search visible parts of other buffers in panes
    // search other buffers in panes

    // search remaining buffers
    if (phase <= 6) {
      phase = 6
      d('= 6 search remaining buffers')
      while ((buf = getBuf())) {
        let r, view

        d('search buffer ' + buf.name)
        view = buf.anyView()
        startRow = 0
        end = p.view.ed.getModel().getLineCount()
        endLen = lineAt(p.view, makeBep(0, end, 0)).length
        srch = makeSrch(p.view, pos, 0)
        while ((r = srch.find())) {
          let pos1, ret

          pos1 = rangeEnd(r)
          ret = check(view, r, pos1, 0, phase)
          if (ret)
            return ret
          continue
        }
        buf = 0
      }
    }

    // search tags

    return 0
  }

  function complete
  () {
    let p, rest, word, pos, phase, tries, bufs, buf, replace

    d('== complete')
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
    }
    else {
      pos = vgetPos(p.view)
      word = getWord(p)
      phase = 0
      tries = []
      bufs = []
      buf = 0
    }

    if (word == 0) {
      Mess.yell('word empty')
      return
    }

    while ((rest = getRest(word, p, pos, phase, bufs, buf))
           && tries.includes(rest.text)) {
      d('already used')
      pos = rest.pos
      phase = rest.phase
      buf = rest.buf
    }
    if (replace) {
      let r

      r = rangeFromPoints(last.start, last.end)
      remove(p.view.ed, r)
    }
    if (rest) {
      let point

      point = vgetPos(p.view)
      vinsert(p.view, 1, rest.text)
      tries.push(rest.text)
      last = { tries: tries,
               bufs: bufs,
               start: point,
               end: vgetPos(p.view),
               word: word,
               pos: rest.pos,
               phase: rest.phase,
               buf: rest.buf }
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
  return 'patch'
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
  if (id == 'text')
    return 'plaintext'
  return id
}

export
function addModes
() {
  d('Ed modes:')
  langs = Mon.languages.getLanguages()
  langs.forEach(lang => {
    let mode, exts, mime, key

    function seize
    (b) {
      d(lang.id + ' seizing ' + b.name)
      b.views.forEach(v => {
        if (v.ed) {
          let model

          model = v.ed.getModel()
          v.ed.updateOptions({ language: lang.id })
          Mon.editor.setModelLanguage(model, lang.id)
          model.setValue(model.getValue())
          setTimeout(() => {
            //
            model.setValue(model.getValue())
            v.ed.render(true)
            v.ed.focus()
          })
        }
      })
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
    //d("adding mode " + lang.id + " with exts: " + exts)
    mode = Mode.add(key,
                    { name: key,
                      viewInit: viewInit,
                      viewCopy: viewCopy,
                      initFns: Ed.initModeFns,
                      parentsForEm: 'ed',
                      exts: exts,
                      mime: mime,
                      //
                      seize: seize })

    if (lang.id == 'css') {
      //Cmd.add("insert }", (u,we) => insertClose(u, we, mode), mode)
      //Em.on('}', "insert }", mode)
    }
    mode.icon = Icon.mode(mode.key)
  })
  d('Ed modes.')
}

function reconfigureMinimap
(buf, view) {
  view.ed.updateOptions({ minimap: { enabled: buf.opt('minimap.enabled') ? true : false } })
}

function reconfigureCursorBlink
(buf, view) {
  view.ed.updateOptions({ cursorBlinking: buf.opt('core.cursor.blink') ? 'blink' : 'solid' })
}

function initOpt
() {
  function on
  (name, cb) {
    Opt.onSet(name, () => Buf.forEach(buf => buf.views.forEach(view => {
      if (view.ed)
        cb(buf, view)
    })))

    Opt.onSetBuf(name, buf => buf.views.forEach(view => {
      if (view.ed)
        cb(buf, view)
    }))
  }

  on('core.cursor.blink', reconfigureCursorBlink)
  on('minimap.enabled', reconfigureMinimap)
}

export
function init
() {
  function getPath
  (label) {
    if (label === 'json')
      return './lib/monaco/vs/language/json/json.worker.js'

    if ([ 'css', 'scss', 'less' ].includes(label))
      return './lib/monaco/vs/language/css/css.worker.js'

    if ([ 'html', 'handlebars', 'razor' ].includes(label))
      return './lib/monaco/vs/language/html/html.worker.js'

    if ([ 'typescript', 'javascript' ].includes(label))
      return './lib/monaco/vs/language/typescript/ts.worker.js'

    return './lib/monaco/vs/editor/editor.worker.js'
  }

  // these two from ace
  tokenRe = new RegExp('[' + wordChars + '\\$_]+', 'g')
  nonTokenRe = new RegExp('(?:[^' + wordChars + '\\$_]|\\s])+', 'g')

  /*
  themeSolarized.rules = themeSolarized.rules || []
  themeSolarized.rules.push({ "foreground": "2aa198",
                              "token": "plus" })  //--solarized-cyan
  themeSolarized.rules.push({ "foreground": "dc322f",
                              "token": "minus" }) //--solarized-red
  themeSolarized.rules.push({ "foreground": '073642',
                              "background": 'eee8d5',
                              // why fail
                              //globalThis.getComputedStyle(document.body).getPropertyValue('--clr-fill'),
                              "token": "bredfill" })
  themeSolarized.colors["editor.selectionBackground"] = "#b58900"
  //d(themeSolarized)
  */

  Mon.editor.defineTheme(theme.name, theme.theme)

  initPatch(Mon)
  initMakefile(Mon)

  globalThis.self.MonacoEnvironment = {
    getWorker: (workerId, label) => {
      d('getWorker(' + workerId + ', ' + label + ')')
      return new globalThis.Worker(getPath(label), { name: label, type: 'module' })
    }
  }

  initOpt()
}
