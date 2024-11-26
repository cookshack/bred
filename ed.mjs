import { append, button, divCl, span, img } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Cut from './cut.mjs'
import * as Em from './em.mjs'
import * as Hist from './hist.mjs'
import * as Icon from './icon.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Opt from './opt.mjs'
import * as Pane from './pane.mjs'
import * as Prompt from './prompt.mjs'
import * as theme from './theme-solarized.js'
import * as Tron from './tron.mjs'
import { d } from './mess.mjs'

import { wordChars } from './lib/unicode.mjs'
import escapeStringRegexp from './lib/escape-string-regexp.js'

import { mbe } from './json.mjs'

export let Backend
export let mimeByExt
export let viewCopy
export let viewInit
export let viewInitSpec
export let vfind
export let divW
export let emRevert
export let backend
export let ctags

let bepRow, bepCol, posRow, posCol, tokenRe, nonTokenRe

export { bepRow, bepCol, posRow, posCol, tokenRe, nonTokenRe }

mimeByExt = mbe

export
function makePos
(row, // 0 indexed (Mon is 1 indexed)
 col) { // 0 indexed (Mon is 1 indexed)
  return { get row() {
    return row
  },
           get col() {
             return col
           },
           // Mon style
           get lineNumber() {
             return row + 1
           },
           get column() {
             return col
           },
           //
           set row(val) {
             return row = val
           },
           set col(val) {
             return col = val
           },
           //
           set lineNumber(val) {
             if (val < 0)
               row = 0
             else
               row = val - 1
             return row
           },
           set column(val) {
             return col = val
           }
  }
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
(p, name, dir, file, lineNum,
 whenReady) { // (view)
  return make2(p,
               { name: name,
                 dir: dir,
                 file: file,
                 lineNum: lineNum,
                 whenReady: whenReady })
}

export
function make2
(p,
 spec, // { name, dir, file, lineNum, whenReady(view) }
 cb) { // (view)
  let m

  function makeBuf
  () {
    let icon

    icon = m && Icon.mode(m)?.name
    p.setBuf(Buf.add(spec.name || spec.file,
                     m || 'Ed',
                     divW(spec.dir,
                          spec.name || spec.file,
                          { icon: icon }),
                     spec.dir,
                     spec.file,
                     spec.lineNum),
             { lineNum: spec.lineNum,
               whenReady: spec.whenReady },
             view => {
               p.buf.icon = icon
               spec.file || (p.buf.file = spec.name)
               if (cb)
                 cb(view)
             })
  }

  if (spec.file)
    m = Backend.modeFor(spec.file)
  else if (spec.name)
    m = Backend.modeFor(spec.name)
  if (spec.file)
    spec.file = Loc.make(spec.file).removeSlash() // for name
  if (Loc.make(spec.file).filename == spec.file) {
    let exist

    spec.dir = Loc.make(spec.dir)
    spec.dir.ensureSlash()
    if (spec.file)
      exist = Buf.find(b => (b.file == spec.file) && (b.dir == spec.dir.path))
    if (exist) {
      p.setBuf(exist, { lineNum: spec.lineNum, whenReady: spec.whenReady }, cb)
      return
    }
    if (spec.lineNum === undefined) {
      let path

      spec.dir = Buf.prepDir(spec.dir)
      path = spec.dir + spec.file
      d('get pos')
      Tron.cmd1('brood.get', [ 'poss', path ], (err, resp) => {
        if (err)
          Mess.log('Error getting line num of ' + path + ', will use 1: ' + err.message)
        else if (resp.data)
          spec.lineNum = resp.data.row + 1
        d('make buf')
        makeBuf()
      })
      return
    }
    makeBuf()
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
    let code

    code = char.charCodeAt(0)
    if (code == '@'.charCodeAt(0))
      char = String.fromCharCode(0)
    else if ((code >= 'a'.charCodeAt(0)) && (code <= 'z'.charCodeAt(0)))
      char = String.fromCharCode(code - 'a'.charCodeAt(0) + 1)
    else if ((code >= 'A'.charCodeAt(0)) && (code <= '_'.charCodeAt(0))) // A .. Z [ / ] ^ _
      char = String.fromCharCode(code - '_'.charCodeAt(0) + 1)
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
  return mimeByExt[ext]?.type
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

export
function escapeForRe
(s) {
  return escapeStringRegexp(s)
}

function initLML
(mo) {
  function lml
  () {
    d('lml')
  }

  Cmd.add('list matching lines', () => lml(), mo)
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
    let p, match, prompt

    prompt = (other ? 'Keep' : 'Flush') + ' lines containing ' + (regex ? 'regex' : 'string')

    function flush
    (needle) {
      let psn, text

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
      psn = Backend.makePsn(p.view, Backend.vgetBepEnd(p.view))
      while (1) {
        psn.lineStart()
        text = Backend.lineAtBep(p.view, psn.bep)
        d('bep: ' + psn.bep)
        d('text: ' + text)
        if (match(text, needle)) {
          let start, range, atEnd

          d('remove line')
          start = psn.bep
          psn.lineEnd()
          atEnd = psn.charRight()
          range = Backend.makeRange(start, psn.bep)

          // mv back to start of line to be removed, so that psn is right
          atEnd || psn.linePrev()
          psn.lineStart()

          p.buf.views.forEach(view => {
            if (view.ele && view.ed)
              Backend.remove(view.ed, range)
          })
        }
        if (psn.charLeft())
          break
      }
    }

    p = Pane.current()
    Prompt.ask({ text: prompt,
                 hist: hist },
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
    let p

    function go
    (text) {
      let num

      num = parseInt(text)
      isNaN(num) && Mess.toss('Must be a number')
      Backend.vgotoLine(p.view, num)
      hist.add(num)
    }

    p = Pane.current()
    Prompt.ask({ text: 'goto line:',
                 hist: hist },
               go)
  }

  hist = Hist.ensure('goto line')

  Cmd.add('goto line', () => gotoLine(), mo)
}

function initQR
(mo) {
  let moQr, st, em, hist

  function replaceAll
  () {
    while (Backend.replace(st, 1, search) && Backend.find(st)) {
      // keep going
    }
  }

  function search
  () {
    d('qr [' + st.from + '] to [' + st.to + ']')
    if (Backend.find(st)) {
      let p, bs

      p = Pane.current()
      bs = p.view.ele.querySelector('.bred-qr-buttons')
      Css.expand(bs)
      Em.replace(() => [ em ])
    }
    else {
      d("that's all")
      Prompt.close()
    }
  }

  function queryDone
  () {
    let p, ww

    p = Pane.current()
    ww = p.view.ele.firstElementChild
    if (Css.has(ww.children[5], 'retracted')) {
      st.from = ww.children[1].innerText
      st.to = p.buf.text()
      hist.add({ from: st.from, to: st.to })
      search()
      return 1
    }
    return 0
  }

  function prevHist
  (nth) {
    let p, prev

    p = Pane.current()
    prev = nth < 0 ? hist.next() : hist.prev()
    if (prev) {
      let ww

      ww = p.view.ele.firstElementChild
      p.buf.clear()
      if (Css.has(ww.children[5], 'retracted'))
        p.view.insert(prev.to)
      else
        p.view.insert(prev.from)
    }
  }

  function other
  () {
    let p, ww

    p = Pane.current()
    ww = p.view.ele.firstElementChild
    if (Css.has(ww.children[5], 'retracted'))
      previous()
    else
      next()
  }

  function next
  () {
    let p, from, to

    if (queryDone())
      return
    p = Pane.current()
    from = p.buf.text()
    p.buf.clear()
    p.buf.views.forEach(view => {
      if (view.ele) {
        let ww

        ww = view.ele.firstElementChild
        Css.expand(ww.children[0])
        Css.expand(ww.children[1])
        ww.children[1].innerText = from
        ww.children[2].innerText = 'With'
        Css.retract(ww.children[4])
        Css.retract(ww.children[5])
        to = ww.children[5].innerText
      }
    })
    p.view.insert(to)
  }

  function previous
  () {
    let p, from, to

    p = Pane.current()
    to = p.buf.text()
    p.buf.clear()
    p.buf.views.forEach(view => {
      if (view.ele) {
        let ww

        ww = view.ele.firstElementChild
        from = ww.children[1].innerText
        Css.retract(ww.children[0])
        Css.retract(ww.children[1])
        ww.children[2].innerText = 'Replace'
        ww.children[5].innerText = to
        Css.expand(ww.children[4])
        Css.expand(ww.children[5])
      }
    })
    p.view.insert(from)
  }

  function divW
  () {
    return divCl('edWW float-ww bred-qr-ww',
                 [ divCl('bred-qr-text retracted', 'Replace'),
                   divCl('bred-qr-replace retracted', '', { 'data-run': 'previous' }),
                   divCl('bred-qr-text', 'Replace'),
                   divCl('bred-qr-ed',
                         [ divCl('edW float-w bred-qr-w'),
                           divCl('bred-qr-buttons retracted',
                                 [ button([ span('y', 'key'), 'es' ], { 'data-run': 'yes' }),
                                   button([ span('n', 'key'), 'o' ], { 'data-run': 'next' }),
                                   button([ span('a', 'key'), 'll' ], { 'data-run': 'all' }),
                                   button([ span('c', 'key'), 'ancel' ], { 'data-run': 'close qr' }) ]) ]),
                   divCl('bred-qr-text', 'With'),
                   divCl('bred-qr-with', '', { 'data-run': 'next' }) ])
  }

  function qr
  () {
    let p

    p = Pane.current()
    st = {}
    st.view = p.view
    hist.reset()
    st.occur = st.view.buf.opts.get('core.highlight.occurrences.enabled')
    st.view.buf.opts.set('core.highlight.occurrences.enabled', 0)
    st.p = Prompt.demandBuf(divW())
  }

  function closeQr
  () {
    st.view.buf.opts.set('core.highlight.occurrences.enabled', st.occur)
    Prompt.close()
  }

  function closeAndPassThrough
  (u, we) {
    closeQr()

    if (we.mouse) {
      let target

      target = globalThis.document.elementFromPoint(we.e.clientX, we.e.clientY)
      we.buf = Pane.holding(target)?.buf
    }
    else
      we.buf = Pane.current()?.buf
    Em.handle(we, we.buf)
  }

  moQr = Mode.add('QR', { hidePoint: 1,
                          viewInit: viewInit,
                          viewInitSpec: viewInitSpec,
                          initFns: initModeFns,
                          parentsForEm: 'ed' })

  hist = Hist.ensure('QR')

  Cmd.add('close qr', () => closeQr(), moQr)
  Cmd.add('close qr and pass through', closeAndPassThrough, moQr)

  Cmd.add('other', () => other(), moQr)
  Cmd.add('next', () => next(), moQr)
  Cmd.add('previous', () => previous(), moQr)
  Cmd.add('next history item', () => prevHist(-1), moQr)
  Cmd.add('previous history item', () => prevHist(), moQr)

  Em.on('ArrowUp', 'previous history item', moQr)
  Em.on('ArrowDown', 'next history item', moQr)
  Em.on('A-p', 'previous history item', moQr)
  Em.on('A-n', 'next history item', moQr)
  Em.on('C-g', 'close qr', moQr)
  Em.on('Escape', 'close qr', moQr)
  Em.on('C-o', 'other', moQr)
  Em.on('Enter', 'next', moQr)

  Cmd.add('yes', () => Backend.replace(st, 0, search), moQr)
  Cmd.add('all', () => replaceAll(), moQr)

  em = Em.make('QR Prompt')
  em.on('y', 'yes')
  em.on('n', 'next')
  em.on('a', 'all')
  em.on('!', 'all')
  em.on('c', 'close qr')
  Em.on('C-g', 'close qr', em)
  Em.on('Escape', 'close qr', em)
  em.otherwise = 'close qr and pass through'

  Cmd.add('query replace', () => qr(), mo)
  Cmd.add('find and replace', () => qr(), mo)
}

export
function initSearch
(mo) {
  let s, mapSearch, lastNeedle

  function cleanup
  () {
    s.st.view.buf.opts.set('core.highlight.occurrences.enabled', s.st.occur)
    Backend.clearDecorMatch(s.st.view, s.st)
    Backend.clearDecorAll(s.st.view, s.st)

    Css.show(s.st.win.echo)
    s.st.mini.remove()
    Css.remove(s.st.win.mini, 'active')
    Css.remove(s.st.win.mini, 'search')
    globalThis.onkeydown = s.st.oldOnKeyDown
    Backend.cancel()
  }

  function searchCancel
  (keepPos) {
    cleanup()
    if (keepPos) {
      s.st.view.marks.push(Backend.posToBep(s.st.view, s.st.start))
      if (s.st.needle.length)
        lastNeedle = s.st.needle
    }
    else
      Backend.vsetPos(s.st.view, s.st.start, 1)

    s.st = 0
  }

  function done
  () {
    if (s.st.needle.length)
      lastNeedle = s.st.needle

    s.st.view.marks.push(Backend.posToBep(s.st.view, s.st.start))

    cleanup()
    s.st = 0
  }

  function next
  (skipCurrent) {
    let range

    if ((s.st.needle.length == 0)
        && lastNeedle)
      s.st.needle = lastNeedle

    //vexec(s.st.v, "keyboardQuit")
    range = vfind(s.st.view,
                  s.st.needle,
                  s.st,
                  { skipCurrent: skipCurrent,
                    backwards: 0,
                    wrap: 0,
                    caseSensitive: 0,
                    wholeWord: 0,
                    regExp: 0 })
    if (range) {
      s.st.stack.push({ range: range, needle: s.st.needle, backwards: 0 })
      Css.remove(s.st.echo, 'mini-search-fail')
    }
    else
      //d("got all")
      Css.add(s.st.echo, 'mini-search-fail')

    s.st.echo.innerText = s.st.needle
  }

  function previous
  (skipCurrent) {
    let range

    //d("previous: " + s.st.needle)
    if ((s.st.needle.length == 0)
        && lastNeedle)
      s.st.needle = lastNeedle

    // seems ace keeps some state when the find is active that messes up the backward search
    //vexec(s.st.view, "keyboardQuit")
    range = vfind(s.st.view,
                  s.st.needle,
                  s.st,
                  { skipCurrent: skipCurrent,
                    backwards: 1,
                    wrap: 0,
                    caseSensitive: 0,
                    wholeWord: 0,
                    regExp: 0 })
    s.st.stack.push({ range: range, needle: s.st.needle, backwards: 1 })
    if (range)
      Css.remove(s.st.echo, 'mini-search-fail')

    else
      //d("got all")
      Css.add(s.st.echo, 'mini-search-fail')

    s.st.echo.innerText = s.st.needle
  }

  function removeOneFromSearch
  () {
    if (s.st?.stack?.length) {
      let match, oldNeedle

      s.st.stack.pop()
      if (s.st.stack.length == 0) {
        d('stack now empty')
        s.st.needle = ''
        s.st.echo.innerText = ''
        Backend.clearDecorMatch(s.st.view, s.st)
        Backend.clearDecorAll(s.st.view, s.st)
        Backend.vsetPos(s.st.view, s.st.start, 1)
        return
      }

      d(s.st.stack)
      match = s.st.stack.at(-1)
      d(match)

      oldNeedle = s.st.needle
      s.st.needle = match.needle
      s.st.echo.innerText = s.st.needle

      Backend.setDecorMatch(s.st, s.st.view, match.range)
      if (oldNeedle == s.st.needle) {
        // removed a match that was added with 'search * again', so the decor is the same
      }
      else
        Backend.setDecorAll(s.st, s.st.view, s.st.needle, { regExp: s.st.regExp, caseSensitive: s.st.caseSensitive })

      if (match.range) {
        let bep

        bep = match.backwards ? Backend.rangeStartBep(match.range) : Backend.rangeEndBep(match.range)
        Backend.vsetBep(s.st.view, bep, 1)
      }
    }
    else
      d('stack was empty')
  }

  function addCharToSearch
  (u, we) {
    if (s.st) {
      let match

      //d("adding '" + we.e.key + "'")
      s.st.needle += we.e.key
      match = s.st.stack?.at(-1)
      if (match?.range)
        if (s.st.backward) {
          let bep

          bep = Backend.rangeEndBep(match.range)
          bep = Backend.vbepIncr(s.st.view, bep)
          Backend.vsetBep(s.st.view, bep)
        }
        else
          Backend.vsetBep(s.st.view, Backend.rangeStartBep(match.range))

      if (s.st.backward)
        previous(0)
      else
        next(0)
    }
  }

  function addWordToSearch
  () {
    if (s.st) {
      let needleRe, range, match

      if (s.st.needle.length == 0)
        s.st.needle = ''

      // about to search forward
      match = s.st.stack?.at(-1)
      if (match)
        Backend.vsetBep(s.st.view, Backend.rangeStartBep(match.range))

      needleRe = escapeForRe(s.st.needle) + '[^a-zA-Z0-9]*[a-zA-Z0-9]+'
      //d("needleRe: " + needleRe)
      range = vfind(s.st.view,
                    needleRe,
                    s.st,
                    { skipCurrent: 0,
                      backwards: 0,
                      wrap: 0,
                      caseSensitive: 0,
                      wholeWord: 0,
                      regExp: 1 })
      if (range) {
        s.st.needle = Backend.vrangeText(s.st.view, range)
        s.st.stack.push({ range: range, needle: s.st.needle, backwards: 0 })
        s.st.echo.innerText = s.st.needle
      }
    }
  }

  function search
  (backward) {
    let oldOnKeyDown, p

    if (s.st) {
      s.st = 0
      return
    }

    p = Pane.current()
    if (Css.has(p.win.mini, 'active'))
      return

    s.st = { stack: [],
             caseSensitive: 0,
             regExp: 0 }
    s.st.win = p.win
    s.st.view = p.view
    s.st.needle = ''
    s.st.start = s.st.view.pos
    s.st.backward = backward

    Css.add(s.st.win.mini, 'active')
    Css.add(s.st.win.mini, 'search')
    s.st.echo = divCl('mini-echo')
    Css.hide(s.st.win.echo)
    s.st.mini = divCl('mini-search-w',
                      [ divCl('mini-icon icon-ed-search',
                              img('img/up.svg', 'Previous', 'filter-clr-nb0'),
                              { 'data-run': 'search backward again' }),
                        divCl('mini-icon icon-ed-search',
                              img('img/down.svg', 'Next', 'filter-clr-nb0'),
                              { 'data-run': 'search forward again' }),
                        divCl('mini-icon',
                              img('img/x.svg', 'X', 'filter-clr-nb0'),
                              { 'data-run': 'search cancel' }),
                        divCl('mini-icon',
                              img('img/search.svg', 'Search', 'filter-clr-nb0'),
                              { 'data-run': 'search done' }),
                        s.st.echo ])
    s.st.win.mini.firstElementChild.after(s.st.mini)

    oldOnKeyDown = globalThis.onkeydown
    s.st.oldOnKeyDown = oldOnKeyDown

    let wes

    wes = []
    s.st.occur = s.st.view.buf.opts.get('core.highlight.occurrences.enabled')
    s.st.view.buf.opts.set('core.highlight.occurrences.enabled', 0)
    globalThis.onkeydown = e => {
      let we

      if ([ 'Alt', 'Control', 'CapsLock', 'Shift' ].includes(e.key))
        // see note at top of em.look1
        return

      we = { mouse: 0, e: e }
      // if in search em then do that
      // else if in old em then cancel search and do that
      wes.push(we)
      mapSearch.look(wes, to => {
        if (to) {
          e.preventDefault()

          if (to.ons)
            // map
            return

          // cmd
          Cmd.run(to, s.st.view?.buf, 1, we)
          wes = []
          return
        }

        // empty/error
        // if in regular em then exit and run the original handler
        d('empty/error')
        Em.look(wes, 0, s.st.view?.buf, (map, to) => {
          // Simple because only want to know if there's a binding.
          if (to) { // cmd/map
            searchCancel(1)
            oldOnKeyDown(e)
          }
        })
      })
    }
  }

  s = { s: 0, // state
        search: search,
        addCharToSearch: addCharToSearch,
        addWordToSearch: addWordToSearch,
        removeCharFromSearch: removeOneFromSearch,
        next: next,
        previous: previous,
        done: done }

  mapSearch = Em.make('Ed: Search')

  Cmd.add('find', () => search(0), mo)
  Cmd.add('search forward', () => search(0), mo)
  Cmd.add('search backward', () => search(1), mo)
  Cmd.add('add char to search', addCharToSearch, mo)
  Cmd.add('add word to search', addWordToSearch, mo)
  Cmd.add('remove char from search', () => removeOneFromSearch(), mo)
  Cmd.add('search cancel', () => searchCancel(), mo)
  Cmd.add('search forward again', () => next(1), mo)
  Cmd.add('search backward again', () => previous(1), mo)
  Cmd.add('search done', () => done(), mo)

  for (let d = 32; d <= 127; d++)
    Em.on(String.fromCharCode(d), 'add char to search', mapSearch)
  Em.on('Enter', 'search done', mapSearch)
  Em.on('Backspace', 'remove char from search', mapSearch)

  Em.on('C-g', 'search cancel', mapSearch)
  Em.on('Escape', 'search cancel', mapSearch)
  Em.on('C-s', 'search forward again', mapSearch)
  Em.on('C-r', 'search backward again', mapSearch)
  Em.on('C-w', 'add word to search', mapSearch)
}

export
function patchModeName
() {
  return Backend.patchModeName()
}

export
function makeMlDir
(dir) {
  let mlDir

  mlDir = ''
  if (dir) {
    let d

    d = ''
    dir = Buf.prepDir(dir)
    mlDir = dir.split('/').map(c => {
      let r

      if (c.length == 0)
        return 0
      d = d + '/' + c
      r = span(c, { 'data-path': d, 'data-run': 'open link' })
      return [ '/', r ]
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
        append(mlDir, makeMlDir(dir))
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

function initTheme
() {
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
  theme.theme.rules.forEach(rule => {
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
  //backend = "ace"
  //backend = "monaco"
  //backend = "codemirror"

  if (backend == 'codemirror') {
    Mess.log('Backend: CodeMirror')
    load('./wodemirror.mjs')
  }
  else if (backend == 'monaco') {
    Mess.log('Backend: Monaco')
    load('./wonaco.mjs')
  }
  else if (backend == 'ace') {
    Mess.log('Backend: Ace')
    load('./wace.mjs')
  }
  else
    Mess.toss('Ed:init caller must specify backend')
}

export
function getCTag
(name) {
  return ctags.find(c => c.name == name)
}

export
function addCTags
(file) {
  let dir

  function prep
  (t) {
    t.loc = Loc.make(dir)
    t.loc.join(t.path)
    if (t.pattern) {
      if (t.pattern.startsWith('/^')
          && t.pattern.endsWith('$/'))
        t.line = t.pattern.slice(2, t.pattern.length - 2)
      else
        t.line = t.pattern
      t.regex = new RegExp('^' + escapeForRe(t.line) + '$')
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

  file = Loc.appDir().join('TAGS.mjs')
  addCTags(file)
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
    b.views.forEach(view => {
      if (view.ed) {
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
    })
  }

  function insert
  (b, str, bep) {
    b.views.forEach(view => {
      if (view.ed)
        //d(p.name + ": insert: " + str)
        Backend.vinsertAt(view, bep, 1, str)

    })
  }

  mo.append = append
  mo.bep = Backend.vgetBep
  mo.bufEnd = Backend.vbufEnd
  mo.bufStart = Backend.vbufStart
  mo.ensurePointVisible = Backend.ensurePointVisible
  mo.insert = insert
  mo.len = Backend.vlen
  mo.pos = v => Backend.bepToPos(v, Backend.vgetBep(v))
  mo.save = save

  Backend.initModeFns(mo)
}

export
function tokenAt
(x, y) {
  if (Backend.vtokenAt) {
    let p

    p = Pane.current()
    return Backend.vtokenAt(p.view, x, y)
  }
  return null
}

export
function makeDecor
(spec) {
  return Backend.makeDecor && Backend.makeDecor(spec)
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
  if (Backend.rangeEmpty(r))
    return 0
  return r
}

function transposeWords
() {
  let p, r1, r2

  p = Pane.current()
  r1 = getNextWord(p.view)
  r2 = getNextWord(p.view, -1)
  d({ r1 })
  d({ r2 })
  if (r1 && r2) {
    let t1, t2

    t1 = Backend.vrangeText(p.view, r1)
    t2 = Backend.vrangeText(p.view, r2)
    d({ t1 })
    d({ t2 })
    Backend.vreplaceAtAll(p.view, r1, t2, [ { range: r2, text: t1 } ])
    Backend.wordForward()
  }
}

function delNextWord
(u) {
  let p, bep1, bep2, range, text

  p = Pane.current()

  bep1 = Backend.vgetBep(p.view)

  Backend.clearSelection(p.view)

  vwordForward(p.view, u)

  bep2 = Backend.vgetBep(p.view)

  range = Backend.makeRange(bep1, bep2)
  text = Backend.vrangeText(p.view, range)
  if (text && text.length) {
    p.buf.views.forEach(view => {
      Backend.remove(view.ed, range)
    })
    Cut.add(text)
  }
}

function indentLineRigidly
(p, row, str, setBep) {
  let bep

  bep = Backend.makeBep(p.view, row, 0)
  d('line start: ' + bep)
  p.buf.views.forEach(view => {
    Backend.vinsertAt(view, bep, 1, str)
    if (setBep && (view == p.view)) {
      let bep2

      bep2 = Backend.bepRightOverSpace(view, bep)
      Backend.vsetBep(view, bep2)
    }
  })
}

function indentRigidly
(u) {
  let p, str, psns, rows, singleRow, region

  //d('ir')
  str = ' '.repeat(u || 1)
  //d('[' + str + ']')
  p = Pane.current()
  region = p.view.region
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
  rows = psns.map(psn => Backend.bepRow(p.view, psn.bep))
  // skip 0 len lines
  rows = rows.filter(r => Backend.rowLen(p.view, r))
  rows.forEach(line => indentLineRigidly(p, line, str, singleRow))
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
  let p, region, lines

  p = Pane.current()
  region = p.view.region
  if (region.chars)
    lines = bepRow(p.view, region.to) - bepRow(p.view, region.from) + 1
  else
    lines = 0
  Mess.say('Region has ' + lines + ' lines, ' + region.chars + ' characters')
}

function save
(u, we, cb) {
  let p, path

  function error
  (msg) {
    if (cb)
      cb(new Error(msg))
    else
      Mess.yell(msg)
  }

  p = Pane.current()

  path = Loc.make(p.view.buf.path).expand()
  Tron.cmd('file.stat', path, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // new file
        Backend.vsave(p.view, cb)
        return
      }
      error(err.message)
      return
    }
    // existing file
    if (p.view.buf.stat) {
      if (p.view.buf.stat?.mtimeMs < data.data.mtimeMs)
        Prompt.yn('File has changed on disk. Overwrite?',
                  'save',
                  yes => {
                    if (yes)
                      Backend.vsave(p.view, cb)
                  })
      else
        Backend.vsave(p.view, cb)
      return
    }
    error('Buffer missing stat')
  })
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
  let p

  p = Pane.current()
  if (u == 4)
    p?.buf?.opts.set(name, 0)
  else
    p?.buf?.opts.set(name, 1)
}

export
function init
(backend, cb) { // (err)
  let mo

  function vcall
  (cb) {
    cb(Pane.current()?.view)
  }

  d('set backend')

  ctags = []

  // these two from ace
  tokenRe = new RegExp('[' + wordChars + '\\$_]+', 'g')
  nonTokenRe = new RegExp('(?:[^' + wordChars + '\\$_]|\\s])+', 'g')

  setBackend(backend, err => {
    if (err)
      cb(err)

    bepRow = Backend.bepRow
    bepCol = Backend.bepCol
    posRow = Backend.posRow
    posCol = Backend.posCol
    viewCopy = Backend.viewCopy
    viewInit = Backend.viewInit
    viewInitSpec = Backend.viewInitSpec
    vfind = Backend.vfind
    divW = Backend.divW

    d('init theme')
    initTheme()

    emRevert = Em.make('Revert')
    emRevert.on('y', 'discard and revert')
    emRevert.on('n', 'close demand')
    Em.on('C-g', 'close demand', emRevert)
    Em.on('Escape', 'close demand', emRevert)

    d('add ed mode')
    mo = Mode.add('Ed', { hidePoint: 1,
                          viewInit: Backend.viewInit,
                          viewInitSpec: Backend.viewInitSpec,
                          viewCopy: Backend.viewCopy,
                          viewReopen: Backend.viewReopen,
                          initFns: initModeFns })

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
    Cmd.add('capitalize word', () => Backend.capitalizeWord(), mo)
    Cmd.add('lowercase word', () => Backend.caseWord(w => w.toLowerCase()), mo)
    Cmd.add('uppercase word', () => Backend.caseWord(w => w.toUpperCase()), mo)
    Cmd.add('new line', u => Backend.newline(u), mo)
    Cmd.add('forward', Backend.forward, mo)
    Cmd.add('backward', Backend.backward, mo)
    Cmd.add('cut line', () => Backend.cutLine(), mo)
    Cmd.add('group forward', Backend.groupForward, mo)
    Cmd.add('group backward', Backend.groupBackward, mo)
    Cmd.add('syntax forward', Backend.syntaxForward, mo)
    Cmd.add('syntax backward', Backend.syntaxBackward, mo)
    Cmd.add('word forward', Backend.wordForward, mo)
    Cmd.add('word backward', Backend.wordBackward, mo)
    Cmd.add('previous line', u => Backend.prevLine(Pane.current().view, u), mo)
    Cmd.add('next line', u => Backend.nextLine(Pane.current().view, u), mo)
    Cmd.add('line start', () => Backend.lineStart(Pane.current().view), mo)
    Cmd.add('line end', () => Backend.lineEnd(), mo)
    Cmd.add('buffer start', () => Backend.bufferStart(), mo)
    Cmd.add('buffer end', () => Backend.bufferEnd(), mo)
    Cmd.add('scroll up', () => Backend.scrollUp(), mo)
    Cmd.add('scroll down', () => Backend.scrollDown(), mo)
    Cmd.add('mark set', u => Backend.setMark(u), mo)
    Cmd.add('mark exchange', () => Backend.exchange(), mo)
    Cmd.add('open line', () => Backend.openLine(), mo)
    Cmd.add('cancel', () => Backend.cancel(), mo)
    Cmd.add('recenter', () => vcall(Backend.recenter), mo)
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
    Cmd.add('save', save, mo)
    Cmd.add('save as', () => Backend.vsaveAs(Pane.current()?.view), mo)
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

    Cmd.add('yank', () => Backend.yank(), mo)
    Cmd.add('yank roll', () => Backend.yankRoll(), mo)
    Cmd.add('paste', () => Backend.yank(), mo)
    Cmd.add('paste roll', () => Backend.yankRoll(), mo)
    Cmd.add('cut', () => Backend.cut(), mo)
    Cmd.add('copy', () => Backend.copy(), mo)

    Cmd.add('revert buffer', () => Backend.revert(), mo)
    Cmd.add('discard and revert', () => discardAndRevert()) // global because call from prompt area

    Em.on('Enter', 'new line', mo)
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
    for (let d = 32; d <= 127; d++)
      Em.on(String.fromCharCode(d), 'self insert', mo)

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
    Em.on('C-r', 'search backward', mo)
    Em.on('C-s', 'search forward', mo)
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

    initLML(mo)
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

/// Utils

export
function bool
(x) {
  if (x)
    return true
  return false
}

export
function defined
(arg) {
  if (arg === undefined)
    return 0
  if (arg === null)
    return 0
  return 1
}

// pass any args to this fn to prevent warnings about them
// eg catch param list requires args
export
function use
() {
}
