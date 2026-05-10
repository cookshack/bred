import { div, divCl, divIdCl } from './dom.mjs'

export
function menu0
(name, co) {
  let lower

  lower = name.toLowerCase()
  return divCl('bred-menu-item onfill',
               [ name,
                 divIdCl('bred-menu1-' + lower, 'bred-menu1', co) ],
               { 'data-run': 'open menu item', 'data-menu': 'bred-menu1-' + lower })
}

export
function item
(name, cmd, attr) {
  cmd = cmd || name.toLowerCase()
  return divCl('bred-menu1-item onfill',
               [ div(name), divCl('bred-menu-kb') ],
               { 'data-run': cmd,
                 'data-after': 'close menu',
                 ...(attr || {}) })
}

export
function line
() {
  return divCl('bred-menu1-line')
}
