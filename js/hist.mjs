import * as Mess from './mess.mjs'
import * as Tron from './tron.mjs'
import { d } from './mess.mjs'

let hists, needSave

function get
(name) {
  return hists.find(h => h.name == name)
}

function canon
(name) {
  return name && name.trim().toLowerCase()
}

export
function ensure
(name) {
  let h

  name = canon(name)
  name?.length || Mess.toss('Name required')
  h = get(name)
  if (h)
    return h
  h = make(name)
  hists.push(h)
  d('HIST added ' + name)
  return h
}

export
function make
(name, temp) {
  let items, pos, current, save

  function next
  (buf, cleared) {
    if (items.length) {
      if (pos <= -1) {
        pos = -1
        Mess.say('End of history')
        return null
      }
      pos--
      if (pos <= -1) {
        pos = -1
        if (buf) {
          cleared || buf.clear()
          if (current)
            buf.append(current)
        }
        Mess.say('End of history')
        return current
      }
      if (buf) {
        cleared || buf.clear()
        buf.append(items[pos])
      }
      return items[pos]
    }
    Mess.say('Empty history')
    return null
  }

  function nth
  (n) { // 0 indexed
    n = n || 0
    if (items.length > n)
      return items[n]
    return null
  }

  function prev
  (buf, cleared, givenCurrent) {
    if (items.length) {
      if (pos >= items.length - 1) {
        pos = items.length - 1
        Mess.say('Start of history')
        return 0
      }
      if (pos == -1)
        if (givenCurrent == null) {
          if (buf)
            current = buf.text().trim()
        }
        else
          current = givenCurrent

      pos++
      if (buf) {
        cleared || buf.clear()
        buf.append(items[pos])
      }
      return items[pos]
    }
    Mess.say('Empty history')
    return 0
  }

  function to
  (n) {
    if (items.length == 0)
      return 0
    if ((n >= 0) && (n < items.length))
      pos = n
    else
      Mess.toss('hist.to: out of bounds')
    return items[pos]
  }

  function reset
  () {
    pos = -1
  }

  function setItems
  (array) {
    items = array
    current = 0
    reset()
    return items
  }

  save = 1
  if (temp)
    save = 0

  setItems([])

  return { get name() {
    return name
  },
           get length() {
             return items.length
           },
           get items() {
             return items
           },
           get save() {
             return save
           },
           //
           set items(array) {
             return setItems(array)
           },
           set save(val) {
             return save = val ? 1 : 0
           },
           //
           add: it => {
             if (items.length && (it == items[0])) {
               d('HIST already have ' + it)
               return
             }
             d('HIST add ' + it)
             //d({ items })
             items.unshift(it)
             if (save) {
               Tron.acmd('profile.prompt.add', [ name, it ])
               needSave = 1
             }
           },
           at: i => items[i],
           next,
           nth,
           prev,
           reset,
           to }
}

export
function saveIfNeeded
() {
  if (needSave)
    save(err => {
      if (err) {
        Mess.log(err.message)
        return
      }
      needSave = 0
    })
}

export
function save
(cb) { // (err)
  d('HIST save')
  if (hists.length)
    Tron.cmd1('profile.save',
              [ 'hists-v1', hists.filter(h => h.save).map(h => [ h.name, h.items ]) ],
              cb)
  else
    cb(0)
}

export
function init
() {
  hists = []

  Tron.acmd('profile.prompt.load').then(data => {
    data.prompts.forEach(p => {
      let h

      h = ensure(p.name)
      h.items = h.items || []
      h.items.push(p.text)
    })
  })

  setInterval(() => saveIfNeeded(),
              10 * 1000)
}
