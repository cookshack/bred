import Fs from 'node:fs'
import Path from 'node:path'
import Database from 'better-sqlite3'
import Store from 'electron-store'

let stores, profile, hist

import { d, log } from './main-log.mjs'

export
function initHist
() {
  let path, db

  function add
  (href, type) {
    d('PROFILE.HIST add ' + href + ' ' + type)
    if (href.startsWith('/'))
      href = 'file://' + href
    db.prepare('INSERT INTO urls (href, time, type) VALUES (?, ?, ?)').run(href, Date.now(), type)
  }

  function get
  () {
    let st

    // distinct hrefs with most recent access time
    st = db.prepare(`WITH ranked_table AS (SELECT *,
                                           MIN(id) OVER (PARTITION BY href ORDER BY time) AS first_occurrence_id
                                           FROM urls)
                     SELECT *
                     FROM ranked_table
                     WHERE id = first_occurrence_id
                     ORDER BY time DESC`)
    return st.all()
  }

  function suggest
  (query) {
    let st

    st = db.prepare(`SELECT *
                     FROM urls
                     WHERE type = 'url'
                     AND href LIKE ?
                     ORDER BY id DESC
                     LIMIT 10`)
    return { urls: st.all('%' + query + '%') }
  }

  path = profile.dir + '/hist.db'
  log('Opening hist: ' + path)
  db = new Database(profile.dir + '/hist.db')
  db.prepare('CREATE TABLE IF NOT EXISTS urls (id INTEGER PRIMARY KEY, href, type, time)').run()

  hist = { add,
           get,
           suggest }
}

export
function onHistAdd
(e, onArgs) {
  let [ href, type ] = onArgs

  hist.add(href, type)
}

export
function onHistGet
() {
  return hist.get()
}

export
function onHistSuggest
(e, onArgs) {
  let [ query ] = onArgs

  return hist.suggest(query)
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

export { hist, stores }
