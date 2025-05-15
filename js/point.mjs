import * as Mess from './mess.mjs'

let d

d = () => {}
//d = Mess.d

export
function make
(elePane, elePoint) {
  let walker, pos

  function checkText
  (t) {
    if (/\S/.test(t.wholeText)) {
      d('Accept: ' + t.wholeText)
      return globalThis.NodeFilter.FILTER_ACCEPT
    }
    return globalThis.NodeFilter.FILTER_SKIP
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
      let tops, highests, atPoints, all, rpaneW

      highests = []
      rpaneW = elePane.parentNode.getBoundingClientRect()

      if (0) {
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

    //Mess.D('move to')
    let topmost

    topmost = topmostInView()
    //Mess.D('topmost:')
    //Mess.D(topmost)
    if (topmost)
      put(topmost, 1)
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

  function contains
  (r, x, y) {
    let rr, rb, yes

    //D("contains r " + x + " " + y)
    rr = r.x + r.width
    rb = r.y + r.height
    yes = (r.x <= x) && (rr >= x) && (r.y <= y) && (rb >= y)
    return yes
  }

  function over
  (element) {
    let rp

    rp = elePoint.getBoundingClientRect()
    if (element)
      return contains(element.getBoundingClientRect(), rp.x + 2, rp.y + 2)
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
          if (n === text) {
            //D("yes")
            walker = w2
            pos = 0
            sync(skipScroll)
            break
          }

      }
    }
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
    let startNode, startPos

    d('psr')
    spec = spec || {}
    walker.currentNode || Mess.toss('missing currentNode')
    startNode = walker.currentNode
    startPos = pos
    while (walker.currentNode) {
      let i, text

      if (spec.caseSensitive)
        text = walker.currentNode.wholeText
      else {
        text = walker.currentNode.wholeText.toLowerCase()
        str = str.toLowerCase()
      }

      d('ST ' + str)
      d('VS ' + text)
      d('pos ' + pos)

      if (spec.backwards)
        i = (pos == 0) ? -1 : text.lastIndexOf(str, pos - 1)
      else
        i = text.indexOf(str, pos)
      if (i >= 0) {
        pos = i + (spec.backwards ? 0 : str.length)
        if (pos >= text.length)
          pos = text.length - 1
        sync()
        return { node: walker.currentNode,
                 start: i,
                 end: i + str.length }
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
        let eleRe

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

  return { get ele() {
    return elePoint
  },
           //
           set ele(e) {
             return elePoint = e
           },
           set elePane(e) {
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
           search,
           sync }
}
