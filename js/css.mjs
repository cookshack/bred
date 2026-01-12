let classCache

export
function has
(el, name) {
  if (el)
    return el.classList.contains(name)
  return 0
}

export
function add
(el, name) {
  function get
  () {
    let classes

    classCache = classCache || new Map()
    classes = classCache.get(name)
    if (classes)
      return classes
    classes = name.trim().split(' ').filter(s => s.length)
    classCache.set(name, classes)
    return classes
  }

  if (el && name) {
    if (name.indexOf(' ') == -1) {
      el.classList.add(name)
      return
    }

    el.classList.add.apply(el.classList, get())
  }
}

export
function remove
(el, name) {
  if (el && name)
    el.classList.remove(name)
}

export
function toggle
(el, name) {
  if (has(el, name)) {
    remove(el, name)
    return 0
  }
  add(el, name)
  return 1
}

export
function hide
(el) {
  add(el, 'hidden')
}

export
function show
(el) {
  remove(el, 'hidden')
}

export
function retract
(el) {
  add(el, 'retracted')
}

export
function expand
(el) {
  remove(el, 'retracted')
}

export
function disable
(el) {
  if (el) {
    el.setAttribute('inert', 1)
    add(el, 'disabled')
    return
  }
  debugger
  throw new Error('missing el')
}

export
function enable
(el) {
  if (el) {
    el.removeAttribute('inert')
    remove(el, 'disabled')
    return
  }
  debugger
  throw new Error('missing el')
}
