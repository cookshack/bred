import { d } from './mess.mjs'

let places

export
function add
(name, path) {
  places.push({ name,
                path })
  d({ places })
}

export
function map
(cb) { // (place)
  return places.map(cb)
}

export
function init
() {
  places = []
}
