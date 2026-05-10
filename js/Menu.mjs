import * as Win from './win.mjs'
import { d } from './mess.mjs'

export { make } from './menu.mjs'
export { item, line, menu0 } from './menu-common.mjs'

export
function add
(parent, spec) {
  d('Ma')
  Win.current().menu.add(parent, spec)
}
