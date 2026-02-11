import * as Css from './css.mjs'

export
function make
(buf) {
  let marked, items

  function hideB
  () {
    buf?.views.forEach(view => Css.hide(view?.ele?.querySelector('.dir-h-clear')))
  }

  function add
  (name, type) {
    buf?.views.forEach(view => Css.show(view?.ele?.querySelector('.dir-h-clear')))
    if (has(name))
      return
    items.push({ name, type })
  }

  function at
  (i) {
    return items.at(i)
  }

  function has
  (name) {
    return items.find(item => item.name == name)
  }

  function map
  (cb) {
    return items.map(item => cb && cb(item))
  }

  function rm
  (name) {
    items = items.filter(item => {
      if (item.name == name)
        return 0
      return 1
    })
    if (items.length == 0)
      hideB()
  }

  items = []
  marked = { add,
             at,
             has,
             map,
             rm,
             //
             get length() {
               return items.length
             } }

  hideB()

  return marked
}
