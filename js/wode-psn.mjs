import * as WodeBep from './wode-bep.mjs'
import * as WodeCommon from './wode-common.mjs'

export
function make
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

    end = WodeBep.vgetBepEnd(view)
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
    WodeCommon.spRe.lastIndex = 0
    if (WodeCommon.spRe.exec(line.text.slice(bep - line.from)))
      bep += WodeCommon.spRe.lastIndex
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

    end = WodeBep.vgetBepEnd(view)

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

  bep = bep ?? WodeBep.vgetBep(view)

  psn = { get bep
          () {
            return bep
          },
          get col
          () { // 0 indexed
            return WodeBep.bepCol(view, bep)
          },
          get eol
          () {
            return bep == view.ed.state.doc.lineAt(bep).to
          },
          get pos
          () {
            return WodeBep.bepToPos(view, bep)
          },
          get row
          () { // 0 indexed
            return WodeBep.bepRow(view, bep)
          },
          get text
          () {
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
