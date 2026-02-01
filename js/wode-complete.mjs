import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Ed from './ed.mjs'
import * as Mess from './mess.mjs'
import * as Pane from './pane.mjs'
import * as Wode from './wode.mjs'
import * as WodeRange from './wode-range.mjs'
import { d } from './mess.mjs'

function charAt
(view, bep) {
  return view.ed.state.sliceDoc(bep, bep + 1)
}

function bottomPos
(view) {
  return Wode.bepToPos(view, Wode.bottomBep(view))
}

function endPos
(view) {
  return Wode.bepToPos(view, Wode.vendBep(view))
}

function topRow
(view) {
  let bep, l

  bep = Wode.topBep(view)
  l = view.ed.state.doc.lineAt(bep)
  if (l)
    return l.number - 1
  return 0
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

    pos = Wode.vgetPos(view)
    if (opts.start)
      // have to change cursor because vfind searches from cursor
      Wode.vsetPos(view, opts.start)
    range = Wode.vfind(view, opts.needle, 0, opts)
    if (range) {
      opts.start = range.end // for next time
      if (opts.range) {
        if (opts.range.contains(range.start)) {
          Wode.vsetPos(view, pos)
          return range
        }
        Wode.vsetPos(view, pos)
        return 0
      }
    }
    Wode.vsetPos(view, pos)
    return range
  }
  return { set,
           find }
}

export
function init
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

    bep = Wode.vgetBep(p.view)
    start = Wode.vlineStart(p.view, bep)

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
    word = WodeRange.make(p.view, bep1, bep).text
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
        range = WodeRange.fromPoints(view, Ed.makePos(startRow, 0), pos1)
      else
        range = WodeRange.fromPoints(view, pos1, Ed.makePos(end, endLen))
      d({ range })
      d(range.end)
      d(Wode.posRow(range.end))
      d('search for ' + word + ' '
        + (bw ? 'backward' : 'forward')
        + ' from (' + Wode.posRow(pos1) + ', ' + Wode.posCol(pos1) + ')'
        + ' in range (' + Wode.posRow(range.start) + ',' + Wode.posCol(range.start) + ')-'
        + '(' + Wode.posRow(range.end) + ',' + Wode.posCol(range.end) + ')')
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

      text = r.text
      d({ pos1 })
      d('pack text: [' + text + ']')
      d('found at: (' + Wode.posRow(pos1) + ',' + Wode.posCol(pos1) + ')')
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
        pos1 = r.start
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
      endLen = Wode.lineAt(p.view, Ed.makePos(end, 0)).length
      d({ endLen })
      srch = makeSrch(p.view, pos, 0, topRow(p.view), end, endLen)
      while ((r = srch.find())) {
        let pos1

        pos1 = r.end
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

        pos1 = r.start
        return pack(p.view, r, pos1, 1, phase)
      }
    }

    // search buffer after
    if (phase <= 3) {
      let r, end, endLen

      phase = 3
      d('== 3 search current buffer after')
      end = endPos(p.view).row
      endLen = Wode.lineAt(p.view, Ed.makePos(end, 0)).length
      srch = makeSrch(p.view, pos, 0, 0, end, endLen)
      while ((r = srch.find())) {
        let pos1

        pos1 = r.end
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
        endLen = Wode.lineAt(view, Ed.makePos(end, 0)).length
        srch = makeSrch(view, pos, 0, 0, end, endLen)
        while ((r = srch.find())) {
          let pos1

          pos1 = r.end
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
      pos = Wode.vgetPos(p.view)
      word = getWord(p)
      phase = 0
      tries = []
      bufs = []
      buf = 0
      orig = Wode.vgetBep(p.view)
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

      r = WodeRange.make(p.view, last.orig, Wode.posToBep(p.view, last.end))
      d('remove from ' + r.from + ' to ' + r.to)
      r.remove()
    }
    if (rest) {
      let point

      d(rest)
      point = Wode.vgetPos(p.view)
      Wode.vsetBep(p.view, orig)
      Wode.vinsert1(p.view, 1, rest.text)
      tries.push(rest.text)
      if (rest.ctag)
        ctags++
      last = { tries,
               bufs,
               orig,
               start: point,
               end: Wode.vgetPos(p.view),
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
