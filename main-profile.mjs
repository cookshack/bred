import Fs from 'node:fs'
import Path from 'node:path'
import Store from 'electron-store'

let stores, profile

export
function name
() {
  return profile?.name
}

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
(name, dirUserData) {
  profile = { name: name || 'Main' }
  if (profile.name.match(/[A-Z][a-z]+/))
    profile.dir = 'profile/' + profile.name
  else {
    console.error('Profile name must be [A-Z][a-z]+')
    console.error('  Examples: Main, Testing, Css, Logs, Browser')
    return 1
  }
  if (Fs.existsSync(profile.dir)) {
    // Existing profile.
  }
  else
    Fs.mkdirSync(Path.join(dirUserData, profile.dir),
                 { recursive: true })

  stores = { frame: new Store({ name: 'frame', cwd: profile.dir }),
             poss: new Store({ name: 'poss', cwd: profile.dir }),
             state: new Store({ name: 'state', cwd: profile.dir }) }
}

export { stores }
