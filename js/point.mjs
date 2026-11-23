import * as Mess from './mess.mjs'

let d

d = () => {}
//d = Mess.d

export
function make
(elePane, elePoint) {
  let walker, pos, blockTags

  function checkText
  (t) {
    if (/\S/.test(t.wholeText)) {
      d('Accept: ' + t.wholeText)
      return globalThis.NodeFilter.FILTER_ACCEPT
    }
    return globalThis.NodeFilter.FILTER_SKIP
  }

  // The nearest block element a text node is rendered in, or 0 when the node
  // is loose in the pane and is therefore its own run. Text is split into
  // nodes wherever an inline element starts or ends, so a phrase that reads
  // continuously (the usual bold word in a man page) can span several nodes;
  // search a block's whole text instead and map a hit back to node offsets.
  function blockOf
  (node) {
    let el

    el = node.parentNode
    while (el)
      if (el == elePane)
        return 0
      else if (blockTags.includes(el.nodeName))
        return el
      else
        el = el.parentNode
    return 0
  }

  // A block's rendered text and the offset of each text node in it. A <br>
  // is a line break, so a phrase cannot match through one.
  function blockText
  (el) {
    let text, nodes, w, n

    text = ''
    nodes = []
    w = globalThis.document.createTreeWalker(el,
                                             globalThis.NodeFilter.SHOW_ELEMENT
                                             | globalThis.NodeFilter.SHOW_TEXT,
                                             { acceptNode: t => ((t.nodeName == '#text')
                                                                 || (t.nodeName == 'BR'))
                                               ? globalThis.NodeFilter.FILTER_ACCEPT
                                               : globalThis.NodeFilter.FILTER_SKIP })
    while ((n = w.nextNode()))
      if (n.nodeName == 'BR')
        text += '\n'
      else {
        nodes.push({ node: n, start: text.length })
        text += n.wholeText
      }
    return { el, text, nodes }
  }

  // Where character i of a run's text is.
  function bepAt
  (nodes, i) {
    let k

    k = nodes.length - 1
    while (k && (nodes[k].start > i))
      k--
    return { node: nodes[k].node, offset: i - nodes[k].start }
  }

  function startOf
  (nodes, node) {
    let i

    i = nodes.length - 1
    while (i)
      if (nodes[i].node == node)
        break
      else
        i--
    return nodes[i].start
  }

  function ensureInView
  () {
    function inView
    () {
      let rpaneW, rpoint

      rpaneW = elePane.parentNode.getBoundingClientRect()
      rpoint = elePoint.getBoundingClientRect()
      return rpoint.top >= rpaneW.top
        && rpoint.left >= rpaneW.left
        && rpoint.bottom <= rpaneW.bottom
        && rpoint.right <= rpaneW.right
    }

    function topmostInView
    () {
      let tops, highests, all, rpaneW

      highests = []
      rpaneW = elePane.parentNode.getBoundingClientRect()

      if (0) {
        let atPoints

        // try every element under the top left point, and all their children
        atPoints = globalThis.document.elementsFromPoint(0, rpaneW.y + globalThis.scrollTop)
        all = [ ...atPoints ]
        atPoints.forEach(e => {
                           all = [ ...all, ...[ ...e.children ] ]
                         })
      }

      all = elePane.querySelector('.bred-surface')
      if (all) {
        let l0, l1

        l0 = [ ...all.children ]
        l1 = []
        l0.forEach(ch => l1 = [ ...l1, ...[ ...ch.children ] ])
        all = [ ...l0, ...l1 ]
      }
      else
        all = []

      tops = all.filter(ch => {
                          let r, offset

                          if (ch.innerText.length == 0)
                            return 0
                          r = ch.getBoundingClientRect()
                          offset = r.top - rpaneW.top
                          //Mess.D("try:")
                          //Mess.D(ch)
                          //Mess.D("offset " + offset)
                          if (offset < 0)
                            return 0
                          if ((highests.length == 0)
            || (highests[0].offset == offset)) {
                            highests.push({ offset, r, ch })
                            return 1
                          }
                          if (highests[0].offset > offset) {
                            highests = [ { offset, r, ch } ]
                            return 1
                          }
                          return 0
                        })
      if (0)
        d(tops)
      if (highests.length)
        return highests[0].ch // should sort for leftmost
      return 0
    }

    //Mess.D('ensure')
    if (inView())
      return

    {
      //Mess.D('move to')
      let topmost

      topmost = topmostInView()
      //Mess.D('topmost:')
      //Mess.D(topmost)
      if (topmost)
        put(topmost, 1)
    }
  }

  function getNext
  () {
    let n

    n = walker.nextNode()
    while (n && (checkText(n) == globalThis.NodeFilter.FILTER_SKIP))
      n = walker.nextNode()
    if (n)
      pos = 0
    return n
  }

  function getPrevious
  () {
    let n

    n = walker.previousNode()
    while (n && (checkText(n) == globalThis.NodeFilter.FILTER_SKIP))
      n = walker.previousNode()
    if (n)
      pos = n.wholeText.length - 1
    return n
  }

  function forward
  () {
    d('pf')
    if (walker.currentNode) {
      let len

      len = walker.currentNode.wholeText.length
      if (len && ((len - 1) > pos)) {
        pos++
        sync()
        return
      }
      getNext()
      sync()
    }
  }

  function backward
  () {
    d('pb')
    if (walker.currentNode) {
      let len

      len = walker.currentNode.wholeText.length
      if (len && pos && (len >= pos)) {
        pos--
        sync()
        return
      }
      getPrevious()
      sync()
    }
  }

  function lineEnd
  () {
    if (walker.currentNode) {
      let len

      len = walker.currentNode.wholeText.length
      if (len && ((len - 1) > pos)) {
        pos = len - 1
        sync()
        return
      }
      getNext()
      len = walker.currentNode.wholeText.length
      if (len)
        pos = len - 1
      sync()
    }
  }

  function lineStart
  () {
    if (walker.currentNode) {
      let len

      len = walker.currentNode.wholeText.length
      if (len && pos && (len >= pos)) {
        pos = 0
        sync()
        return
      }
      getPrevious()
      pos = 0
      sync()
    }
  }

  function lineNext
  () {
    if (walker.currentNode) {
      let curr, n, ra

      ra = globalThis.document.createRange()
      ra.setStart(walker.currentNode, pos)
      ra.setEnd(walker.currentNode, pos + 1)
      curr = ra.getBoundingClientRect()

      while ((n = getNext())) {
        let r

        ra = globalThis.document.createRange()
        ra.setStart(walker.currentNode, pos)
        ra.setEnd(walker.currentNode, pos + 1)
        r = ra.getBoundingClientRect()
        if (r.y >= (curr.y + curr.height))
          break
      }
      if (n)
        pos = 0
      sync()
    }
  }

  function linePrev
  () {
    if (walker.currentNode) {
      let curr, n, ra

      ra = globalThis.document.createRange()
      ra.setStart(walker.currentNode, pos)
      ra.setEnd(walker.currentNode, pos + 1)
      curr = ra.getBoundingClientRect()

      while ((n = getPrevious())) {
        let r

        ra = globalThis.document.createRange()
        ra.setStart(walker.currentNode, pos)
        ra.setEnd(walker.currentNode, pos + 1)
        r = ra.getBoundingClientRect()
        if ((r.y + r.height) <= curr.y)
          break
      }
      if (n)
        pos = 0
      sync()
    }
  }

  function bufEnd
  () {
    while (getNext());
    if (walker.currentNode) {
      let len

      len = walker.currentNode.wholeText.length
      if (len)
        pos = len - 1
    }
    sync()
  }

  function bufStart
  () {
    init()
  }

  function intersects
  (r1, r2) {
    let yes

    yes = ((r1.right >= r2.left)
           && (r1.left <= r2.right)
           && (r1.bottom >= r2.top)
           && (r1.top <= r2.bottom))
    return yes
  }

  function over
  (element) {
    let rp

    rp = elePoint.getBoundingClientRect()
    if (element)
      return intersects(element.getBoundingClientRect(), rp)
    return globalThis.document.elementFromPoint(rp.x + 2, rp.y + 2)
  }

  function elText
  (element) {
    let text

    if (element.nodeName == '#text')
      text = element
    else {
      let w2

      w2 = globalThis.document.createTreeWalker(element, globalThis.NodeFilter.SHOW_TEXT)
      if (w2.nextNode())
        text = w2.currentNode
    }
    return text
  }

  function put
  (element, skipScroll) {
    if (element) {
      let text

      text = elText(element)
      if (text) {
        let w2, n

        w2 = globalThis.document.createTreeWalker(elePane, globalThis.NodeFilter.SHOW_TEXT)
        while ((n = w2.nextNode()))
          //D("try " + n.wholeText)
          if (n == text) {
            //D("yes")
            walker = w2
            pos = 0
            sync(skipScroll)
            break
          }

      }
    }
  }

  function bep
  () {
    if (walker.currentNode)
      return { node: walker.currentNode, offset: pos }
    return 0
  }

  function setAt
  ({ node, offset }) {
    if (node?.isConnected) {
      let w2, n

      w2 = globalThis.document.createTreeWalker(elePane, globalThis.NodeFilter.SHOW_TEXT)
      while ((n = w2.nextNode()))
        if (n == node) {
          let len

          walker = w2
          len = node.wholeText.length
          pos = offset
          if (len == 0)
            pos = 0
          else if (pos > (len - 1))
            pos = len - 1
          sync()
          return 1
        }
    }
    return 0
  }

  function stale
  () {
    if (walker.currentNode)
      if (walker.currentNode.isConnected)
        return 0
    return 1
  }

  // nearest scrollable container between the text and the pane,
  // so matches can be scrolled into the visible region
  function scrollerOf
  (text) {
    let n, sc

    n = text?.parentNode
    sc = 0
    while (n) {
      let st

      if (n == elePane)
        break
      st = globalThis.getComputedStyle(n)
      if (st && [ 'auto', 'scroll', 'overlay' ].includes(st.overflowY))
        sc = n
      n = n.parentNode
    }
    return sc
  }

  // A match is a range with a bep at each end, so its two ends may be in
  // different nodes when the phrase crosses an inline element. Forward
  // searches leave the point after the match, backward ones at its start,
  // which is what the editor backend does.
  function found
  (run, i, len, backwards) {
    let startBep, endBep, last

    startBep = bepAt(run.nodes, i)
    // the end is exclusive, but stays in the node of the last matched
    // character so the point lands there
    last = bepAt(run.nodes, i + (len ? len - 1 : 0))
    endBep = { node: last.node,
               offset: last.offset + (len ? 1 : 0) }
    walker.currentNode = backwards ? startBep.node : endBep.node
    pos = backwards ? startBep.offset : endBep.offset
    if (pos >= walker.currentNode.wholeText.length)
      pos = walker.currentNode.wholeText.length - 1
    sync()
    return { startBep,
             endBep,
             text: run.text.slice(i, i + len) }
  }

  // The last regexp match that starts before `before`, because the engine
  // only scans forwards. A zero-length match leaves lastIndex alone, so step
  // past it by hand.
  function lastMatch
  (re, text, before) {
    let i, len, m

    i = -1
    len = 0
    re.lastIndex = 0
    while ((m = re.exec(text))) {
      if (m.index >= before)
        break
      i = m.index
      len = m[0].length
      if (m[0].length == 0)
        re.lastIndex = m.index + 1
    }
    return { i, len }
  }

  function search
  (str,
   // { backwards,
   //   caseSensitive,
   //   regExp,
   //   skipCurrent,
   //   wrap,
   //   stayInPlace }
   spec) {
    let startNode, startPos, needle, block, re

    d('psr')
    spec = spec || {}
    if (stale()) {
      // the DOM changed (eg agent streaming), re-walk from the top
      init()
      if (walker.currentNode == 0)
        return 0
    }
    startNode = walker.currentNode
    startPos = pos
    needle = spec.caseSensitive ? str : str.toLowerCase()
    re = 0
    if (spec.regExp && str.length)
      try {
        // `i` does the case folding the literal path does with toLowerCase
        re = new RegExp(str, spec.caseSensitive ? 'g' : 'gi')
      }
      catch {
        // An invalid pattern is a miss, not an exception through Cmd.run.
        walker.currentNode = startNode
        pos = startPos
        return 0
      }
    block = 0
    while (walker.currentNode) {
      let i, len, run, base, hay

      run = 0
      if (str.length) {
        let el

        // Search the whole block the point is in, so a phrase can cross the
        // nodes an inline element splits it into.
        el = blockOf(walker.currentNode)
        if (el) {
          if (block?.el == el)
            run = block
          else {
            block = blockText(el)
            run = block
          }
          base = startOf(run.nodes, walker.currentNode)
        }
      }
      if (run == 0) {
        // No block around the node: it is a run of its own.
        run = { text: walker.currentNode.wholeText,
                nodes: [ { node: walker.currentNode, start: 0 } ] }
        base = 0
      }
      if (run.lower == undefined)
        run.lower = run.text.toLowerCase()
      hay = spec.caseSensitive ? run.text : run.lower
      len = needle.length

      d('ST ' + needle)
      d('VS ' + hay)
      d('pos ' + pos)

      if (re) {
        // A regexp needle (C-w's word search) is matched by the engine, and
        // the `i` flag folds case, so match the run's real text.
        hay = run.text
        if (spec.backwards)
          ({ i, len } = lastMatch(re, hay, base + pos))
        else {
          let m

          re.lastIndex = base + pos
          m = re.exec(hay)
          i = m ? m.index : -1
          len = m ? m[0].length : 0
        }
      }
      else if (spec.backwards)
        i = (base + pos) ? hay.lastIndexOf(needle, base + pos - 1) : -1
      else
        i = hay.indexOf(needle, base + pos)
      if (i >= 0) {
        if (spec.skipCurrent && (i == (base + pos))) {
          // re-searching, past the current match
          pos = pos + 1
          continue
        }
        return found(run, i, len, spec.backwards)
      }
      if (spec.backwards ? getPrevious() : getNext())
        continue
      walker.currentNode = startNode
      pos = startPos
      return 0
    }
  }

  function sync
  (skipScroll) {
    if (walker.currentNode?.wholeText) {
      let ra, re

      d('sync at ' + pos + ': ' + walker.currentNode.wholeText)
      d(walker.currentNode)
      ra = globalThis.document.createRange()
      ra.setStart(walker.currentNode, pos)
      ra.setEnd(walker.currentNode,
                walker.currentNode.wholeText.length == 0 ? pos : pos + 1)
      re = ra.getBoundingClientRect()
      if (re) {
        let eleRe, wantScroll

        wantScroll = (skipScroll == 1) ? 0 : 1
        if (wantScroll) {
          let sc

          sc = scrollerOf(walker.currentNode)
          if (sc) {
            let rs, h, cy, delta, half

            rs = sc.getBoundingClientRect()
            h = rs.bottom - rs.top
            half = h / 2
            cy = rs.top + half
            delta = Math.round(re.y - cy)
            if (delta) {
              sc.scrollTop += delta
              re = ra.getBoundingClientRect()
            }
          }
        }

        eleRe = elePane.getBoundingClientRect()
        elePoint.style.top = (re.y - eleRe.y) + 'px'
        elePoint.nextElementSibling.style.top = (re.y - eleRe.y) + 'px' // the line
        //point.ele.style.top = (0) + "px"
        elePoint.style.left = (re.x - eleRe.x) + 'px'
        if (skipScroll)
          return
        elePoint.scrollIntoView({ block: 'center', inline: 'nearest' })
      }
      else
        Mess.warn('sync missing re')
      return
    }
    d('sync empty')
  }

  function init
  () {
    walker = globalThis.document.createTreeWalker(elePane,
                                                  globalThis.NodeFilter.SHOW_TEXT)
    getNext()
    sync()
  }

  // One rendered run for the reader: text inside any of these is a single
  // block however many inline elements split the nodes (see blockOf).
  blockTags = [ 'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL',
                'DT', 'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM',
                'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'LI', 'MAIN',
                'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TBODY', 'TD',
                'TFOOT', 'TH', 'THEAD', 'TR', 'UL' ]

  return { get ele
           () {
             return elePoint
           },
           //
           set ele
           (e) {
             return elePoint = e
           },
           set elePane
           (e) {
             return elePane = e
           },
           //
           over,
           backward,
           ensureInView,
           forward,
           init,
           lineEnd,
           lineStart,
           bufEnd,
           bufStart,
           lineNext,
           linePrev,
           put,
           bep,
           setAt,
           search,
           sync }
}
