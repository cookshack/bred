let wins, id

export
function add
(window) {
  let win

  win = { id: id,
          //
          get body() {
            return window.document.body
          } }

  id++
  wins.push(win)
  return win
}

export
function init
() {
  wins = []
  id = 1
}
