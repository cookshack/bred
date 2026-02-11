import { divCl } from './dom.mjs'
import * as DirMarked from './dir-marked.mjs'
import * as Loc from './loc.mjs'
import * as Pane from './pane.mjs'

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
  p = p || Pane.current()
  return p?.view?.point?.over()
}
