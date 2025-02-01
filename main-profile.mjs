import Store from 'electron-store'

let stores

function getStore
(name) {
  if (name == 'frame')
    return stores.frame
  if (name == 'poss')
    return stores.poss
  if (name == 'state')
    return stores.state
  return new Store({ name: name, cwd: 'brood' })
}

export
function onGet
(e, file, name) {
  let s

  s = getStore(file)
  return { data: s.get(name) }
}

export
function onLoad
(e, ch, name) {
  let s

  s = getStore(name)
  e.sender.send(ch, { data: s.store })
}

export
function onSave
(e, ch, args) {
  let s

  s = getStore(args[0])
  args[1].forEach(a => {
    s.set(a[0], a[1])
  })
  return {}
}

export
function onSet
(e, file, name, value) {
  let s

  s = getStore(file)
  s.set(name, value)
  return {}
}

export
function init
(profile) {
  stores = { frame: new Store({ name: 'frame', cwd: profile.dir }),
             poss: new Store({ name: 'poss', cwd: profile.dir }),
             state: new Store({ name: 'state', cwd: profile.dir }) }
}

export { stores }
