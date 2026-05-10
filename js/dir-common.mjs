import { divCl } from './dom.mjs'
import * as DirMarked from './dir-marked.mjs'
import * as Loc from './loc.mjs'
import * as Pane from './Pane.mjs'
import * as View from './view.mjs'

export
function under
(dir, marked) {
  let divs, paths

  paths = []
  divs = marked.map(m => {
    let path

    path = Loc.make(dir).join(m.name)
    paths.push({ name: m.name, isDir: m.type == 'd', path })
    return [ divCl('float-f-name', m.name),
             divCl('float-f-path', path) ]
  })

  return { divs, paths }
}

export
function getMarked
(b) {
  let marked

  marked = b.vars('dir').marked || DirMarked.make(b)
  b.vars('dir').marked = marked
  return marked
}

export
function current
(p) {
  let view

  p = p || Pane.current()
  view = View.current(p)
  return view?.point?.over()
}

export
function abs
(to, dir) {
  if (to.startsWith('/'))
    return to
  return Loc.make(dir).join(to)
}
