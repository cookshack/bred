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
import * as Mode from './mode.mjs'
import * as Opt from './opt.mjs'
import * as Pane from './pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Recent from './recent.mjs'
import * as Tron from './tron.mjs'
import { d } from './mess.mjs'

const ace = globalThis.ace
const Modelist = ace.require('ace/ext/modelist')
const Search = ace.require('ace/search')

export
function modeFor
(path) {
  if (path) {
    let m

    m = Modelist.getModeForPath(path).mode
    //d("mode offered: " + mode)
    if (m)
      m = m.split('/').pop()
    return m
  }
  return 'Ed'
}

function setBlink
(ed, blink) {
  ed.setOption('cursorStyle', blink ? 'thin' : 'wide') // wide prevents blink, css sets width
}

export
function viewInit
(view, text, modeWhenText, lineNum) {
  let ed, buf, edWW, edW

  buf = view.buf

  edWW = view.ele.firstElementChild
  edW = edWW.querySelector('.edW')
  ed = ace.edit(edW)
  globalThis.bred.provider.registerEditor(ed)
  view.ed = ed
  view.ready = 0

  ed.setTheme('ace/theme/solarized_light')
  ed.session.setMode('ace/mode/text')
  ed.setKeyboardHandler('ace/keyboard/emacs')
  ed.setOption('enableMultiselect', 0) // messes with cursor on alt
  ed.setOption('enableBlockSelect', 0) // messes with cursor on alt
  setBlink(ed, buf.opt('core.cursor.blink'))
  ed.setOption('cursorStyle', buf.opt('core.cursor.blink') ? 'slim' : 'wide') // wide prevents blink, css sets width
  ed.setOption('wrap', 1)
  ed.session.setWrapLimitRange()
  ed.setOption('scrollPastEnd', 0.5)
  ed.setOption('tabSize', 2)
  ed.setOption('useSoftTabs', 1) // tab with spaces
  ed.setOption('navigateWithinSoftTabs', 1)
  ed.setOption('enableBasicAutocompletion', 1)
  ed.setOption('enableLiveAutocompletion', 1)
  ed.setOption('enableSnippets', 1)
  //ed.setOption("customScrollbar", 1)
  //ed.setOption("fontSize", "1rem")
  ed.setHighlightActiveLine(0)
  ed.setOption('showGutter', buf.opt('core.line.numbers.show') ? 1 : 0)
  ed.setOption('displayIndentGuides', 1)
  ed.setOption('minLines', 1)
  //ed.setOption("maxLines", Infinity) // breaks v scroll
  //scrollPastEnd
  //ed.setOption("firstLineNumber", lineNum || 0) // seems broken

  //ed.setOption("autoScrollEditorIntoView", 1) // seems broken
  if (0)
    ed.session.on('changeScrollTop', scrollTop => ensureCursorVisible(ed, scrollTop))

  ed.setValue(text || '', -1 /* go start after */)
  if (buf.vars('ed').fillParent === undefined)
    buf.vars('ed').fillParent = 1
  if (buf.vars('ed').fillParent)
    Css.add(edWW, 'fillParent')
  else {
    function setHeight
    () {
      let h

      h = ed.session.getScreenLength() * ed.renderer.lineHeight
        + (ed.renderer.$horizScroll ? ed.renderer.scrollBar.getWidth() : 0)
      if (h < ed.renderer.lineHeight)
        h = ed.renderer.lineHeight
      edW.style.height = h + 'px'
      ed.resize()
    }
    setHeight()
    ed.session.on('change', setHeight)
  }

  if (0) {
    d('ace options...')
    Object.entries(ed.session.getOptions()).forEach(kv => d('ace options: ' + kv[0] + ': ' + kv[1]))
    d('ace options.')
  }

  //// remove all bindings

  setTimeout(() => {
    if (view == Pane.current().view) ed.focus()
    setTimeout(() => {
      //d("timeout $emacsModeHandler")
      //d(ed.$emacsModeHandler)
      //d(ed["$emacsModeHandler"])

      //ed.commands.commandKeyBinding = {}
      //ed.keyBinding.$defaultHandler.commandKeyBinding = {}
      /*
                         let all = ed.commands.byName
                         ed.commands.removeCommands(all)
                         for (cm in all)
                         ed.commands.addCommand(cm)
                       */
      ed.keyBinding.$handlers.forEach(handler => handler['commandKeyBinding'] = {})
    },
               1)
  },
             1)

  //// remove all bindings attempts

  if (0) {
    ed.setValue('', -1 /* go start after */)
    ed.renderer.once('afterRender', () => {
      d('afterRender $emacsModeHandler')
      d(ed.$emacsModeHandler)
      d(ed['$emacsModeHandler'])

      //ed.commands.commandKeyBinding = {}
      //ed.keyBinding.$defaultHandler.commandKeyBinding = {}
      /*
        let all = ed.commands.byName
        ed.commands.removeCommands(all)
        for (cm in all)
        ed.commands.addCommand(cm)
      */
      ed.keyBinding.$handlers.forEach(handler => handler['commandKeyBinding'] = {})
    })
  }

  //d("$emacsModeHandler")
  //d(ed.$emacsModeHandler)

  //ed.commands.removeCommand("splitline", 1) // remove c-o
  //let command = ed.commands.byName.splitline
  //ed.commands.removeCommand(command)
  //ed.commands.addCommand(command)

  //ed.commands.removeCommand("keyboardQuit", 1) // remove c-g
  //command = ed.commands.byName.keyboardQuit
  //ed.commands.removeCommand(command)
  //ed.commands.addCommand(command)

  /*
  ed.commands.bindKey("Ctrl-A", null)
  ed.commands.bindKey("Ctrl-E", null)
  ed.commands.bindKey("Ctrl-F", null)
  ed.commands.bindKey("Ctrl-B", null)
  ed.commands.bindKey("Ctrl-N", null)
  ed.commands.bindKey("Ctrl-O", null)
  */

  //// sync attempts

  /* cursor pos is per pane
  ed.session.selection.on('changeCursor', e => {
    let pos

    d("changeCursor from " + p.id)
    pos = ed.getCursorPosition()
    Pane.XXsync(p, p2 => {
      if (p2.view.ed)
        p2.view.ed.moveCursorToPosition(pos)
    })
  })
  */

  if (0)
    // problem is that this change made in other panes emits a 'change', which tries to update this pane, so it recurses.
    //
    // would need to somehow have a change id shared between panes
    ed.session.on('change', delta => {
      // delta.start, delta.end, delta.lines, delta.action
      //d('change ' + delta.id + ' from ' + p.id)
      d(delta)
      if (delta.id) {
        if (delta.action == 'insert')
          Pane.XXsync('Xp', p2 => {
            if (p2.view.ed) {
              if (p2.lastChange >= delta.id)
                return
              d('  to ' + p2.id)
              p2.lastChange = delta.id
              p2.view.ed.moveCursorToPosition(delta.start)
              delta.lines.forEach(line => p2.view.ed.session.insert(p2.view.ed.getCursorPosition(), line))
            }
          })

      }
      else {
        // why id missing?
      }
    })

  //// handlers

  ed.on('focus', () => {
    //d("ed foc")
    //d("foc $emacsModeHandler")
    //d(ed.$emacsModeHandler)
    Pane.focusView(view, 1)
  })

  ed.on('change', () => {
    if (view.ready) {
      //d("modified")
      buf.modified = 1
      Ed.setIcon(buf, '.edMl-mod', 'save', 'save')
    }
  })

  //// load file

  function modeFromFirstLine
  (text) {
    let mode

    //d(d.data.slice(0, 100))
    if (text.startsWith('#!/bin/sh'))
      mode = 'ace/mode/sh'
    else if (text.startsWith('#!/bin/bash'))
      mode = 'ace/mode/sh'
    else if (text.startsWith('#!/usr/bin/env node'))
      mode = 'ace/mode/javascript'
    else if (text.startsWith('diff --git '))
      mode = 'ace/mode/diff'
    return mode
  }

  if ((typeof text == 'string') || text instanceof String) {
    let mode

    d('given mode: ' + modeWhenText)
    mode = modeFromFirstLine(text) || modeWhenText
    d('chose mode: ' + ed.getOption('mode'))
    Ed.setIcon(buf, '.edMl-type', Icon.mode(mode.split('/').pop())?.name, 'describe buffer')
    ed.session.setMode(mode)
    if (ed.getOption('mode') == 'ace/mode/javascript')
      ed.session.$worker?.send('changeOptions', [ { asi: true } ]) // lint allow trailing ;
    if (lineNum)
      //ed.renderer.once("afterRender", () => recenter(view))
      ed.gotoLine(lineNum, 0)

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
        Mess.toss('Wace viewinit: ' + err.message)
        return
      }

      if (data.realpath) {
        let real

        real = Loc.make(data.realpath)
        buf.dir = real.dirname
        buf.file = real.filename
        Ed.setMlDir(buf, buf.dir)
      }

      mode = Modelist.getModeForPath(path)?.mode
      //d("mode offered: " + mode)
      if ((mode == 0) || (mode == 'ace/mode/text'))
        mode = modeFromFirstLine(data.data) || mode

      ed.session.setMode(mode)
      d('chose mode: ' + mode)
      Ed.setIcon(buf, '.edMl-type', Icon.mode(mode.split('/').pop())?.name, 'describe buffer')

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

      if (ed.getOption('mode') == 'ace/mode/javascript')
        ed.session.$worker?.send('changeOptions', [ { asi: true } ]) // lint allow trailing ;

      ed.setValue(data.data, -1 /* go start after */)
      if (lineNum)
        ed.gotoLine(lineNum, 0)
        //ed.renderer.once("afterRender", () => recenter(view))
        //setTimeout(() => recenter(view))

      ed.session.getUndoManager().reset()

      ed.on('input', () => {
        if (ed.session.getUndoManager().isClean()) {
          view.buf.modified = 0
          Ed.setIcon(view.buf, '.edMl-mod', 'blank')
        }
      })

      Css.enable(view.ele)
      view.ready = 1
    })
    return
  }

  Css.enable(view.ele)
  view.ready = 1
}

export
function viewReopen
(view) {
  if (0)
    view.ed.resize()
}

export
function viewCopy
(to, from, lineNum) {
  viewInit(to, from.ed.getValue(), from.ed.getOption('mode'), lineNum)
}

function lineAt
(view, pos) {
  let l, r

  l = view.ed.session.getLine(pos.row)
  r = ace.Range.fromPoints({ row: pos.row, column: 0 },
                           { row: pos.row, column: l.length })
  return view.ed.session.getTextRange(r) || ''
}

function line
(view) {
  return lineAt(view, view.ed.getCursorPosition())
}

// pos here is bred pos (vs ace pos)
export
function vsetPos
(view, pos, reveal) {
  // simple because they're compatible
  return vsetBep(view, pos, reveal)
}

export
function ensurePointVisible
(view) {
  view.ed.renderer.scrollCursorIntoView()
}

export
function makeBep
(view,
 row, // 0 indexed
 col) { // 0 indexed
  return { row: row, column: col + 1 }
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
  return view.ed.getCursorPosition()
}

// 0 indexed
export
function bepRow
(view, bep) {
  return bep.row
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
  let row, rowLen

  row = view.ed.session.getLength() - 1
  rowLen = view.ed.session.getLine(rowLen).length
  return { row: row, column: rowLen }
}

export
function vsetBep
(view, bep, reveal) {
  d('vsetBep ' + JSON.stringify(bep))
  view.ed.moveCursorToPosition(bep)
  if (reveal)
    view.ed.renderer.scrollCursorIntoView()
  return bep
}

export
function vbepIncr
(view, bep) {
  // probably should get line length and incr col,/row
  return view.ed.session.doc.indexToPosition(view.ed.session.doc.positionToIndex(bep) + 1)
}

export
function vbepEq
(bep1, bep2) {
  return (bep1.row == bep2.row) && (bep1.column == bep2.column)
}

function vsetSel
(view, from, to, reveal) {
  d('vsetSel')
  view.ed.selection.setSelectionRange(ace.Range.fromPoints(from, to))
  if (reveal)
    view.ed.renderer.scrollCursorIntoView()
}

// pos here is bred pos (vs monaco/ace pos)
export
function bepToPos
(view, bep) {
  return Ed.makePos(bep.row, bep.column)
}

// pos here is bred pos (vs monaco/ace pos)
export
function posToBep
(view, pos) {
  return { row: pos.row, column: pos.column }
}

function excur
(view, cb) {
  let pos

  pos = view.ed.getCursorPosition()
  try {
    cb()
  }
  finally {
    view.ed.moveCursorToPosition(pos)
  }
}

export
function vlen
(view) {
  return view.ed.session.getLength()
}

export
function initModeFns
(mo) {
  function clear
  (b) {
    b.views.forEach(view => {
      if (view.ed)
        view.ed.setValue('')

    })
  }

  function clearLine
  (b) {
    b.views.forEach(view => {
      if (view.ed) {
        let start, r, l

        start = view.ed.getCursorPosition()
        l = view.ed.session.getLine(start.row)
        if (l.length) {
          r = ace.Range.fromPoints({ row: start.row, column: 0 },
                                   { row: start.row, column: l.length })
          view.ed.session.remove(r)
        }
      }
    })
  }

  function text
  (view) {
    return view.ed.getValue()
  }

  function lang
  (view) {
    return view.ed.getOption('mode')
  }

  function off
  (b, name, cb) {
    b.views.forEach(view => {
      if (view.ed)
        view.ed.session.off(name, cb)
    })
  }

  function on
  (b, name, cb) {
    b.views.forEach(view => {
      if (view.ed)
        view.ed.session.on(name, cb)
    })
  }

  mo.clear = clear
  mo.clearLine = clearLine
  mo.gotoLine = vgotoLine
  mo.lang = lang
  mo.line = line
  mo.lineAt = lineAt
  mo.lineStart = lineStart
  mo.excur = excur
  mo.off = off
  mo.on = on
  mo.prevLine = prevLine
  mo.nextLine = nextLine
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
(ed, cmd, markCmd, args) {
  if (markCmd)
    ed.execCommand(ed.session.$emacsMark ? markCmd : cmd, args)
  else
    ed.execCommand(cmd, args)
}

function vexec
(view, cmd, markCmd, args) {
  edexec(view.ed, cmd, markCmd, args)
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
  utimes(u, () => pexec(p, 'gotoright', 'selectright'))
}

export
function backward(u) {
  let p

  p = Pane.current()
  utimes(u, () => pexec(p, 'gotoleft', 'selectleft'))
}

export
function wordForward(u) {
  let p

  p = Pane.current()
  utimes(u, () => pexec(p, 'gotowordright', 'selectwordright'))
}

export
function wordBackward(u) {
  let p

  p = Pane.current()
  utimes(u, () => pexec(p, 'gotowordleft', 'selectwordleft'))
}

export
function prevLine(v, u) {
  utimes(u, () => vexec(v, 'golineup', 'selectup'))
}

export
function nextLine(v, u) {
  utimes(u, () => vexec(v, 'golinedown', 'selectdown'))
}

export
function clearSelection
(view) {
  view.ed.clearSelection()
}

export
function setMark(u) {
  let p

  p = Pane.current()
  if (u == 4) {
    let mark

    mark = p.view.ed.emacsMark()
    if (mark) {
      // region active
      p.view.ed.clearSelection()
      p.view.ed.moveCursorToPosition(mark)
      p.view.ed.session.$emacsMarkRing.pop()
    }
    else {
      mark = p.view.ed.session.$emacsMarkRing.pop()
      if (mark)
        p.view.ed.moveCursorToPosition(mark)
      else
        p.view.ed.moveCursorToPosition({ row: 0, column: 0 })
    }
  }
  else
    vexec(p.view, 'setMark')
}

export
function exchange() {
  let p, active, point, mark

  p = Pane.current()
  active = p.view.ed.emacsMark()
  if (active) {
    let sel

    sel = p.view.ed.selection
    sel.setSelectionRange(sel.getRange(),
                          sel.isBackwards() ? false : true)
    return
  }
  p.view.ed.selection.clearSelection()
  point = p.view.ed.getCursorPosition()
  mark = p.view.ed.session.$emacsMarkRing.pop()
  p.view.ed.moveCursorToPosition(mark)
  p.view.ed.session.$emacsMarkRing.push(point)
}

export
function lineStart(v) {
  vexec(v, 'gotolinestart', 'selecttolinestart')
}

export
function lineEnd() {
  exec('gotolineend', 'selecttolineend')
}

export
function bufferStart() {
  exec('gotostart', 'selecttostart')
}

export
function bufferEnd() {
  exec('gotoend', 'selecttoend')
}

export
function scrollUp() {
  exec('gotopageup', 'selectpageup')
}

export
function scrollDown() {
  exec('gotopagedown', 'selectpagedown')
}

export
function toggleOverwrite() {
  exec('overwrite')
}

export
function selectAll() {
  exec('selectall')
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

  pos = p.view.ed.getCursorPosition()
  while ((pos.row > 0) && lineIsText(p.view)) {
    prevLine(p.view)
    pos = p.view.ed.getCursorPosition()
  }

  while ((pos.row > 0) && lineIsClear(p.view)) {
    prevLine(p.view)
    pos = p.view.ed.getCursorPosition()
  }

  lineStart(p.view)
}

export
function topLevelEnd
() {
  let p, pos, end

  p = Pane.current()
  end = p.view.ed.session.getLength() - 1

  pos = p.view.ed.getCursorPosition()
  while ((pos.row < end) && lineIsText(p.view)) {
    nextLine(p.view)
    pos = p.view.ed.getCursorPosition()
  }

  while ((pos.row < end) && lineIsClear(p.view)) {
    nextLine(p.view)
    pos = p.view.ed.getCursorPosition()
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
    ed.moveCursorToPosition(pos)
  }
  else if (pos.row > last) {
    pos.row = Math.max(0, last)
    ed.moveCursorToPosition(pos)
  }
}

export
function topOfPane
() {
  let p, row

  p = Pane.current()
  row = p.view.ed.getFirstVisibleRow() // + (p.view.ed.isRowFullyVisible(row) ? 0 : 1)
  p.view.ed.navigateTo(row, 0)
}

export
function bottomOfPane
() {
  let p, row

  p = Pane.current()
  row = p.view.ed.getLastVisibleRow() // - (p.view.ed.isRowFullyVisible(row) ? 0 : 1)
  p.view.ed.navigateTo(row, 0)
}

export
function vgotoLine
(view, num) { // 1 indexed
  view.ed.gotoLine(parseInt(num))
}

export
function recenter
(view) {
  let ed

  ed = view?.ed
  if (ed) {
    let pos, h

    pos = ed.renderer.$cursorLayer.getPixelPosition()
    h = ed.renderer.$size.scrollerHeight - ed.renderer.lineHeight
    ed.session.setScrollTop(pos.top - h * 0.5)
    //ed.session.setScrollTop(pos.top)
    //ed.session.setScrollTop(pos.top - h)
  }
}

export
function cancel
() {
  exec('keyboardQuit')
  Pane.cancel()
}

export
function vsaveAs
(view, cb) {
  d('save as')
  d(view)
  d(cb)
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
  pos = view.ed.getCursorPosition()
  view.ed.setValue('')
  viewInit(view, 0, 0, pos.row + 1)
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
  let p

  p = Pane.current()
  p.view.ed.session.once('change', delta => {
    // delta.start, delta.end, delta.lines, delta.action
    d('change ' + delta.id + ' from ' + p.id)
    d(delta)
    if (delta.action == 'insert')
      p.view.sync(view => {
        if (view.ed) {
          d('  to ' + view)
          view.ed.moveCursorToPosition(delta.start)
          delta.lines.forEach(line => view.ed.session.insert(view.ed.getCursorPosition(), line))
        }
      })

    else if (delta.action == 'remove')
      p.view.sync(view => {
        if (view.ed) {
          delta('  to ' + view)
          view.ed.session.remove({ start: delta.start, end: delta.end })
        }
      })

  })
  exec('undo')
}

export
function redo
() {
  exec('redo')
}

export
function vrangeText
(view, range) {
  return view.ed.session.getTextRange(rangeOrder(range))
}

export
function makeRange
(from, to) {
  return ace.Range.fromPoints(from, to)
}

export
function rangeOrder
(range) {
  function swap
  () {
    return makeRange({ row: range.end.row, column: range.end.column },
                     { row: range.start.row, column: range.start.column })
  }

  if (range.start.row < range.end.row)
    return range

  if (range.start.row > range.end.row)
    return swap()

  // same row

  if (range.start.column <= range.end.column)
    return range

  return swap()
}

export
function rangeStartBep
(range) {
  return range.start
}

export
function rangeEndBep
(range) {
  return range.end
}

export
function setDecorMatch
() {
}

export
function setDecorAll
() {
}

export
function vfind
(view, needle, decorParent, opts) {
  let ret, initialBep, initialSel

  d('vfind ' + needle + ' decor ' + (decorParent ? 'on' : 'off'))

  initialBep = vgetBep(view)
  if (view.ed.emacsMark())
    // region active
    initialSel = view.ed.selection

  ret = view.ed.find(needle,
                     { backwards: opts.backwards,
                       wrap: 0,
                       caseSensitive: opts.caseSensitive,
                       wholeWord: 0,
                       start: initialBep,
                       regExp: Ed.bool(opts.regExp) })
  //d(ret)
  if (ret) {
    let bep

    if (opts.stayInPlace)
      return ret

    bep = opts.backwards ? ret.start : ret.end
    if (initialSel)
      vsetSel(view, initialSel.getRange().start, bep, 1)

    else
      vsetBep(view, bep, 1)
    return ret
  }
  return 0
}

function vinsert
(view, u, text) {
  let bep

  bep = vgetBep(view)
  vinsertAtAll(view, bep, u, text)
}

export
function vinsertAt
(view, from, u, text, setBep, to) {
  view.buf.views.forEach(view => {
    let end

    //d('sel before: ' + JSON.stringify(vgetBep(view)))
    for (let i = 0; i < u; i++)
      //d(b.name + ": insert: " + str)
      if (to)
        end = view.ed.session.replace(ace.Range.fromPoints(from, to), text)
      else
        end = view.ed.session.insert(from, text)

    //d('sel after: ' + JSON.stringify(vgetBep(view)))
    if (setBep)
      vsetBep(view, end, 1)
    else
      // seems only option is to mv sel when inserting (cm,mon allow leaving sel in place)
      vsetBep(view, from, 1)
  })
}

function vinsertAll
(view, u, text) {
  let bep

  bep = vgetBep(view)
  view.buf.views.forEach(v => {
    if (v.ele)
      vinsertAt(v, bep, u, text, v == view)
  })
}

function vinsertAtAll
(view, bep, u, text) {
  view.buf.views.forEach(v => {
    if (v.ele)
      vinsertAt(v, bep, u, text, v == view)
  })
}

export
function selfInsert
(u, we) {
  let char, p, pos

  if ([ 'Alt', 'Control', 'CapsLock', 'Shift' ].includes(we.key))
    return

  char = Ed.charForInsert(we)

  p = Pane.current()
  pos = p.view.ed.getCursorPosition()
  p.view.buf.views.forEach(view => {
    for (let i = 0; i < u; i++)
      view.ed.session.insert(pos, char)
  })
}

export
function quotedInsert
(u) {
  let p, pos, oldOnKeyDown

  oldOnKeyDown = globalThis.onkeydown
  p = Pane.current()
  pos = p.view.ed.getCursorPosition()
  Mess.echoMore('C-q-')
  globalThis.onkeydown = e => {
    e.preventDefault()
    if ([ 'Alt', 'Control', 'CapsLock', 'Shift' ].includes(e.key))
      return
    try {
      let char

      char = Ed.charForInsert({ e: e })
      p.view.buf.views.forEach(view => {
        for (let i = 0; i < u; i++)
          view.ed.session.insert(pos, char)
      })
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
  pos = p.view.ed.getCursorPosition()
  vexec(p.view, cmd, cmd, args)
  p.view.sync(view => {
    if (view.ed)
      excur(view, () => {
        view.ed.moveCursorToPosition(pos)
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
  pos = p.view.ed.getCursorPosition()
  orig = p.view.ed.getSelectionRange()
  p.view.ed.selection.clearSelection()
  p.view.ed.selection.selectWordRight()
  range = p.view.ed.getSelectionRange()
  str = p.view.ed.session.getTextRange(range)
  str = cb(str, p.view)
  p.view.ed.moveCursorToPosition(pos)

  // case range in each view
  p.buf.views.forEach(view => {
    let vorig

    vorig = view.ed.getSelectionRange()
    view.ed.selection.clearSelection()
    view.ed.session.replace(range, str)
    view.ed.selection.setSelectionRange(vorig)
  })

  // move point in current pane
  p.view.ed.selection.setSelectionRange(orig)
  p.view.ed.moveCursorToPosition(range.end)
}

export
function capitalizeWord() {
  caseWord((str, view) => {
    view.ed.session.nonTokenRe.lastIndex = 0
    if (view.ed.session.nonTokenRe.exec(str) === null)
      str = Buf.capitalize(str)
    else {
      let i

      i = view.ed.session.nonTokenRe.lastIndex
      str = str.slice(0, i) + Buf.capitalize(str.slice(i))
    }
    return str
  })
}

export
function newline() {
  atPos('insertstring', '\n')
}

export
function openLine() {
  atPos('splitline')
}

export
function delPrevChar() {
  atPos('backspace')
}

export
function delNextChar() {
  atPos('del')
}

export
function cutLine() {
  let p, str, start, r, l

  p = Pane.current()
  start = p.view.ed.getCursorPosition()
  l = p.view.ed.session.getLine(start.row)
  if (l.length) {
    r = ace.Range.fromPoints(start, { row: start.row, column: l.length })
    str = p.view.ed.session.getTextRange(r)
    p.view.ed.session.remove(r)
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
  ed.session.remove(rangeOrder(range))
}

export
function delNextWord
(n) {
  let p, text, range

  //atPos("killWord", "left")
  p = Pane.current()
  p.view.ed.clearSelection()
  if (n < 0)
    p.view.ed.selection.selectWordLeft()
  else
    p.view.ed.selection.selectWordRight()
  range = p.view.ed.getSelectionRange()
  text = p.view.ed.session.getTextRange(range)
  p.view.ed.clearSelection()
  if (text && text.length) {
    p.buf.views.forEach(view => {
      remove(view, range)
    })
    Cut.add(text)
  }
  return p
}

export
function indentBuffer() {
  atPos('autoindent')
}

export
function insertTwoSpaces() {
  atPos('insertstring', '  ')
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
  start = p.view.ed.getCursorPosition()
  l = p.view.ed.session.getLine(start.row)
  spRe.lastIndex = 0
  if (spRe.exec(l.slice(start.column))) {
    r = ace.Range.fromPoints(start,
                             { row: start.row,
                               column: start.column + spRe.lastIndex })
    p.view.ed.session.remove(r)
  }
  if (start.column > 0) {
    str = [ ...l.slice(0, start.column) ].reverse().join('')
    spRe.lastIndex = 0
    if (spRe.exec(str)) {
      r = ace.Range.fromPoints({ row: start.row,
                                 column: start.column - spRe.lastIndex },
                               start)
      p.view.ed.session.remove(r)
    }
  }
}

export
function yank() {
  let p, str

  p = Pane.current()
  str = Cut.nth(0)
  if (str)
    p.view.ed.onPaste(str || '')
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

export
function cut() {
  let p, str

  p = Pane.current()
  str = p.view.ed.getCopyText()
  Cut.add(str)
  vexec(p.view, 'cut')
  p.view.ed.setEmacsMark(null)
}

export
function copy() {
  let p, str

  p = Pane.current()
  vexec(p.view, 'killRingSave')
  str = p.view.ed.getCopyText()
  Cut.add(str)
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
  if (decorParent.decorMatch) {
  }
}

export
function clearDecorAll
(view, decorParent) {
  if (decorParent.decorAll) {
  }
}

export
function initComplete
() {
  let last

  function getWord
  (p) {
    let pos, pos1, word

    pos = p.view.ed.getCursorPosition()

    line = p.view.lineAt(pos)
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
    word = p.view.ed.session.getTextRange(ace.Range.fromPoints(pos1, pos))
    if (word.length == 0)
      return 0
    return word
  }

  function getRest
  (word, p, pos, phase, bufs, buf) {
    let start, end, endLen, srch

    function getBuf
    () {
      let b

      if (buf)
        return buf
      pos = { row: 0, column: 0 }
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
    (pos1, bw) {
      let s, range

      if (bw)
        range = ace.Range.fromPoints({ row: start, column: 0 }, pos1)
      else
        range = ace.Range.fromPoints(pos1, { row: end, column: endLen })
      d('search '
        + (bw ? 'backward' : 'forward')
        + ' from (' + pos1.row + ', ' + pos1.column + ')'
        + ' in range (' + range.start.row + ',' + range.start.column + ')-'
        + '(' + range.end.row + ',' + range.end.column + ')')
      s = new Search.Search()
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

      sl = view.ed.session.getLine(r.end.row)
      sl = sl.slice(r.end.column)
      d('check line: ' + sl)
      if ((sl.length == 0) || sl.startsWith(' ')) {
        srch = makeSrch(pos1, bw)
        return 0
      }
      d('found at: (' + pos1.row + ',' + pos1.column + ')')
      return { text: sl.split(' ')[0],
               pos: pos1,
               phase: phase,
               buf: buf }
    }

    phase = phase || 0
    d('word: ' + word)

    // search visible lines before
    start = p.view.ed.renderer.getFirstFullyVisibleRow()
    if (phase <= 0) {
      let r

      phase = 0
      d('= 0 search visible before')
      srch = makeSrch(pos, 1)
      while ((r = srch.find(p.view.ed.session))) {
        let pos1, ret

        pos1 = { row: r.start.row, column: r.start.column - 1 }
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
      endLen = p.view.ed.session.getLine(end.row).length
      srch = makeSrch(pos, 0)
      while ((r = srch.find(p.view.ed.session))) {
        let pos1, ret

        pos1 = { row: r.end.row, column: r.end.column }
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
      start = 0
      srch = makeSrch(pos, 1)
      while ((r = srch.find(p.view.ed.session))) {
        let pos1, ret

        pos1 = { row: r.start.row, column: r.start.column - 1 }
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
      start = 0
      end = p.view.ed.session.getLength()
      endLen = p.view.ed.session.getLine(end.row).length
      srch = makeSrch(pos, 0)
      while ((r = srch.find(p.view.ed.session))) {
        let pos1, ret

        pos1 = { row: r.end.row, column: r.end.column }
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
        start = 0
        end = view.ed.session.getLength()
        endLen = p.view.ed.session.getLine(end.row).length
        srch = makeSrch(pos, 0)
        while ((r = srch.find(view.ed.session))) {
          let pos1, ret

          pos1 = { row: r.end.row, column: r.end.column }
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
      pos = p.view.ed.getCursorPosition()
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

      r = ace.Range.fromPoints(last.start, last.end)
      p.view.ed.session.remove(r)
    }
    if (rest) {
      let point

      point = p.view.ed.getCursorPosition()
      vinsert(p.view, 1, rest.text)
      tries.push(rest.text)
      last = { tries: tries,
               bufs: bufs,
               start: point,
               end: p.view.ed.getCursorPosition(),
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
  return 'diff'
}

function insertClose
(u) {
  let p, pos

  Cmd.runMo('trim', 'ed')
  p = Pane.current()
  pos = p.view.ed.getCursorPosition()
  p.view.buf.views.forEach(view => {
    for (let i = 0; i < u; i++)
      view.ed.session.insert(pos, '}')
  })
}

export
function addModes
() {
  //d("Ed modes:")
  Modelist.modes.forEach(m => {
    let mode, exts

    function seize
    (b) {
      d(m.name + ' seizing ' + b.name)
      b.views.forEach(v => {
        if (v.ed)
          v.ed.session.setMode('ace/mode/' + m.name)
      })
    }

    function minfo
    (exts) {
      if (exts)
        return exts.map(e => Ed.mimeByExt[e]).filter(mi => mi)

      return []
    }

    exts = []
    {
      let s

      // ext1|ext2|^regex1|^regex2
      s = m.extensions.split('|')
      s.forEach(e => {
        if ((e.length == 0) || e.startsWith('^'))
          return
        exts.push(e)
      })
    }

    //d("adding mode " + m.name + " with exts: " + exts)
    mode = Mode.add(m.name, { name: m.caption,
                              viewInit: viewInit,
                              viewCopy: viewCopy,
                              initFns: Ed.initModeFns,
                              parentsForEm: 'ed',
                              exts: exts,
                              mime: minfo(exts),
                              //
                              seize: seize })

    if (m.name == 'css') {
      Cmd.add('insert }', (u,we) => insertClose(u, we, mode), mode)
      Em.on('}', 'insert }', mode)
    }
    mode.icon = Icon.mode(mode.key)
  })
  //d("Ed modes.")
}

function initLsp
() {
  let worker, provider

  worker = new globalThis.Worker(new URL('./worker.mjs', import.meta.url),
                                 { type: 'module' })
  provider = globalThis.LanguageProvider.create(worker, { functionality: { semanticTokens: true } })
  globalThis.bred.provider = provider
}

function reconfigureCursorBlink
(buf, view) {
  setBlink(view.ed, buf.opt('core.cursor.blink'))
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
}

export
function init
() {
  initLsp()
  initOpt()
}
