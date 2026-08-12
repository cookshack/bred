import * as Cmd from './cmd.mjs'
import * as Diff from '../lib/diff.js'
import * as Ed from './ed.mjs'
import * as Em from './Em.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './Pane.mjs'
import * as Pos from './pos.mjs'
import * as Switch from './switch.mjs'

function text
(b) {
  let v

  v = b.anyView(1)
  if (v?.ed?.state)
    return v.ed.state.doc.toString()
  return ''
}

function headerName
(b, dir) {
  if (b.file && (b.dir == dir))
    return b.file
  return b.name
}

function linesAt
(v, row) { // { a, b } or null
  let hunk, num

  hunk = row
  while (hunk >= 0) {
    let line

    line = v.lineAt(Pos.make(hunk, 0))
    if (line.startsWith('@@'))
      break
    hunk--
  }
  if (hunk < 0)
    return null

  num = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(v.lineAt(Pos.make(hunk, 0)))
  if (num == null)
    return null

  {
    let a, b

    a = parseInt(num[1])
    b = parseInt(num[2])
    for (let r = hunk + 1; r < row; r++) {
      let line

      line = v.lineAt(Pos.make(r, 0))
      if (line.startsWith('-'))
        a++
      else if (line.startsWith('+'))
        b++
      else if (line.startsWith(' ')) {
        a++
        b++
      }
    }
    return { a, b }
  }
}

function jumpTarget
(p) { // { buf, line } or 0
  let vs

  vs = p.buf.vars('compare')
  if (vs.a) {
    let m

    m = linesAt(p.view, p.view.pos.row)
    if (m) {
      let line

      line = p.view.lineAt(p.view.pos)
      if (line.startsWith('-'))
        return { buf: vs.a, line: m.a }
      return { buf: vs.b, line: m.b }
    }
  }
  return 0
}

function goto
() {
  let p, target

  p = Pane.current()
  target = jumpTarget(p)
  if (target)
    p.setBuf(target.buf, { lineNum: target.line })
  else
    Mess.say('No change on this line')
}

function gotoOther
() {
  let p, target

  p = Pane.current()
  target = jumpTarget(p)
  if (target) {
    Pane.nextOrSplit()
    Pane.current().setBuf(target.buf, { lineNum: target.line })
  }
  else
    Mess.say('No change on this line')
}

function doCompare
(p, bufA, bufB) {
  let dir, nameA, nameB, textA, textB, diff

  dir = bufA.dir
  nameA = headerName(bufA, dir)
  nameB = headerName(bufB, dir)
  textA = text(bufA)
  textB = text(bufB)
  diff = Diff.createTwoFilesPatch(nameA,
                                  nameB,
                                  textA,
                                  textB,
                                  '',
                                  '',
                                  { context: 3 })
  if (diff.includes('@@')) {
    Ed.make(p,
            { name: 'Compare: ' + nameA + ' ↔ ' + nameB,
              dir },
            view => {
              let v

              v = view.buf.vars('compare')
              v.a = bufA
              v.b = bufB
              view.buf.mode = 'patch'
              view.buf.addMode('view')
              view.buf.addMode('equal')
              view.buf.addMode('compare')
              view.insert(diff)
              view.buf.modified = 0
            })
    return
  }
  Mess.say('Compare: buffers are identical')
}

export
function init
() {
  let mo

  mo = Mode.add('Compare')

  Cmd.add('compare buffers', () => {
                               let p, bufA

                               p = Pane.current1()
                               bufA = p.buf
                               if (bufA.anyView(1)?.ed)
                                 Switch.pick(b => doCompare(p, bufA, b))
                               else
                                 Mess.yell('Compare: not a text buffer')
                             })

  Cmd.add('compare goto', () => goto())
  Cmd.add('compare goto other pane', () => gotoOther())

  Em.on('e', 'compare goto', mo)
  Em.on('Enter', 'compare goto', mo)
  Em.on('o', 'compare goto other pane', mo)
}
