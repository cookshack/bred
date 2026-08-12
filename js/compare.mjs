import * as Cmd from './cmd.mjs'
import * as Diff from '../lib/diff.js'
import * as Ed from './ed.mjs'
import * as Mess from './mess.mjs'
import * as Pane from './Pane.mjs'
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
  Cmd.add('compare buffers', () => {
                               let p, bufA

                               p = Pane.current1()
                               bufA = p.buf
                               if (bufA.anyView(1)?.ed)
                                 Switch.pick(b => doCompare(p, bufA, b))
                               else
                                 Mess.yell('Compare: not a text buffer')
                             })
}
