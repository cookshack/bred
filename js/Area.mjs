import * as Win from './win.mjs'

export { add } from './area.mjs'

export
function getByName
(win, name) {
  return win.areas.find(a => a.name == name)
}

export
function current
(win) {
  win = win || Win.current()
  return win?.currentArea
}

export
function hide
(win, name) {
  getByName(win, name)?.hide()
}

export
function show
(win, name) {
  let a

  a = getByName(win, name)
  if (a) {
    a.show()
    a.tab.frame?.pane?.focus()
  }
}

export
function init
() {
}
