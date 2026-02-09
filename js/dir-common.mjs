import { divCl } from './dom.mjs'
import * as Loc from './loc.mjs'

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
