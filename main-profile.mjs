import Fs from 'node:fs'
import Path from 'node:path'
import Database from 'better-sqlite3'
import Store from 'electron-store'

let stores, profile, db

import { d, log } from './main-log.mjs'

export
function initHist
() {
  let path

  path = profile.dir + '/hist.db'
  log('Opening hist: ' + path)
  db = new Database(profile.dir + '/hist.db')
  db.prepare('CREATE TABLE IF NOT EXISTS dirs (id INTEGER PRIMARY KEY, href, time)').run()
}

export
function onHistAdd
(e, onArgs) {
  const [ href, mtype ] = onArgs

  d('PROFILE.HIST add ' + href + ' ' + mtype)
  db.prepare('INSERT INTO dirs (href, time) VALUES (?, ?)').run(href, Date.now())
}

export
function onHistGet
() {
  let st

  // distinct hrefs with most recent access time
  st = db.prepare(`WITH ranked_table AS (SELECT *,
                                         MIN(id) OVER (PARTITION BY href ORDER BY time) AS first_occurrence_id
                                         FROM dirs)
                   SELECT *
                   FROM ranked_table
                   WHERE id = first_occurrence_id
                   ORDER BY time DESC`)
  return st.all()
}

export
function name
() {
  return profile?.name
}

function getStore
(name) {
  if (name == 'frame')
    return stores.frame
  if (name == 'opt')
    return stores.opt
  if (name == 'poss')
    return stores.poss
  if (name == 'state')
    return stores.state
  if (profile.dir)
    return new Store({ name: name, cwd: profile.dir })
  throw new Error('getStore missing profile.dir')
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
    profile.dir = Path.join(dirUserData, 'profile/' + profile.name)
  else {
    console.error('Profile name must be [A-Z][a-z]+')
    console.error('  Examples: Main, Testing, Css, Logs, Browser')
    return 1
  }
  if (Fs.existsSync(profile.dir)) {
    // Existing profile.
  }
  else
    Fs.mkdirSync(profile.dir,
                 { recursive: true })

  stores = { frame: new Store({ name: 'frame', cwd: profile.dir }),
             opt: new Store({ name: 'opt', cwd: profile.dir }),
             poss: new Store({ name: 'poss', cwd: profile.dir }),
             state: new Store({ name: 'state', cwd: profile.dir }) }

  initHist()
}

export { stores }
