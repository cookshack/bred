import Fs from 'node:fs'
import Path from 'node:path'
import Database from 'better-sqlite3'
import Fuse from 'fuse.js'
import Store from 'electron-store'

let stores, profile, hist, prompt

import { d, log } from './main-log.mjs'

function initPrompt
(db) {

  function add
  (name, text) {
    d('PROFILE.PROMPT add ' + text)
    db.prepare('INSERT INTO prompts (name, text, time) VALUES (?, ?, ?)')
      .run(name,
           text,
           Date.now())
    d('PROFILE.HIST added')
  }

  function load
  () {
    let st

    st = db.prepare('SELECT * FROM prompts ORDER BY id DESC')
    return { prompts: st.all() }
  }

  prompt = {
    add,
    load
  }
}

export
function initHist
() {
  let path, db

  function setDbVersion
  (ver) {
    db.prepare("INSERT INTO meta (name, value) VALUES ('db_version', ?) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value")
      .run(ver)
  }

  function add
  (href, spec) {
    let url, now

    d('PROFILE.HIST add ' + href)
    spec = spec || ''
    spec.title = spec.title || ''
    spec.type = spec.type || 'url'
    if (href.startsWith('/'))
      href = 'file://' + href
    if (spec.type == 'search')
      href = 'search://' + href
    try {
      url = new URL(href)
    }
    catch {
    }
    now = Date.now()
    db.prepare('INSERT INTO visits (type, href, title, hostname, port, pathname, search, hash, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(spec.type,
           href,
           spec.title,
           url?.hostname ?? '',
           url?.port ?? 0,
           url?.pathname ?? '',
           url?.search ?? '',
           url?.hash ?? '',
           now)
    db.prepare('INSERT INTO urls (type, href, title, hostname, port, pathname, search, hash, last, count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1) ON CONFLICT (href) DO UPDATE SET title = EXCLUDED.title, last = EXCLUDED.last, count = count + 1')
      .run(spec.type,
           href,
           spec.title,
           url?.hostname ?? '',
           url?.port ?? 0,
           url?.pathname ?? '',
           url?.search ?? '',
           url?.hash ?? '',
           now)
    d('PROFILE.HIST added')
  }

  function filter
  (query) {
    let st

    st = db.prepare(`SELECT *
                     FROM visits
                     WHERE type = 'url'
                     AND (href LIKE ? OR title LIKE ?)
                     ORDER BY id DESC
                     LIMIT 10`)
    return { urls: st.all('%' + query + '%') }
  }

  function get
  () {
    let st

    st = db.prepare('SELECT * FROM urls;')
    return st.all()
  }

  function suggest
  (query) {
    let fuse, rows, urls, tmin, tmax, fmin, fmax, weightFuse, weightTime, weightFreq

    d('SUGGEST')

    weightTime = 0.3 // recency
    weightFreq = 0.3
    weightFuse = 1 - weightTime

    // Get all the urls

    rows = get(query)

    // Fuzzy rank them

    fuse = new Fuse(rows,
                    { keys: [ 'title', 'hostname', 'port', 'pathname', 'search', 'hash' ],
                      includeScore: true,
                      threshold: 0.6,
                      distance: 100,
                      limit: 1000 })
    urls = fuse.search(query)

    // Get min and max time and freq

    tmin = fmin = -1
    tmax = fmax = 0
    urls.forEach(url => {
      if ((tmin == -1)
          || (url.item.last < tmin))
        tmin = url.item.last
      if (url.item.last > tmax)
        tmax = url.item.last

      if ((fmin == -1)
          || (url.item.count < fmin))
        fmin = url.item.count
      if (url.item.count > fmax)
        fmax = url.item.count
    })

    d(tmin)
    d(tmax)
    d(fmin)
    d(fmax)

    if ((tmin >= 0) && (tmax >= 0) && (tmax >= tmin)
        && (fmin >= 0) && (fmax >= 0) && (fmax >= fmin)) {
      // Normalize times and frequencies, give each url a composite score
      urls.forEach(url => {
        if (tmin == tmax)
          url.scoreTime = 0
        else
          url.scoreTime = (url.item.last - tmin) / (tmax - tmin)
        if (fmin == fmax)
          url.scoreFreq = 0
        else
          url.scoreFreq = (url.item.count - fmin) / (fmax - fmin)
        url.scoreFuse = (1 - url.score)
        url.scoreAll = (url.scoreFuse * weightFuse) + (url.scoreTime * weightTime) + (url.scoreFreq * weightFreq)
      })
      // Sort by the composite score
      urls.sort((u1, u2) => u2.scoreAll - u1.scoreAll)
    }

    return { urls: urls.slice(0, 10) }
  }

  path = profile.dir + '/hist.db'
  log('Opening hist: ' + path)
  db = new Database(profile.dir + '/hist.db')

  db.prepare('CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY, name, value, UNIQUE(name))').run()

  {
    let ver, row

    // Migration

    row = db.prepare("SELECT value FROM meta WHERE name = 'db_version'").get()
    ver = parseInt(row?.value || 0)
    d('Check migration...')
    d('Current version: ' + ver)
    if (ver == 0) {
      d('Migrating: 0 to 1')
      db.transaction(() => {
        db.prepare('ALTER TABLE urls RENAME TO visits').run()
        setDbVersion(1)
      })()
    }
    if (ver == 1) {
      d('Migrating: 1 to 2')
      db.transaction(() => {
        // distinct hrefs with most recent access time
        db.prepare(`WITH ranked_table AS (SELECT *,
                                          MIN(id) OVER (PARTITION BY href ORDER BY time) AS first_occurrence_id
                                          FROM visits)
                    INSERT INTO urls (type, href, title, hostname, port, pathname, search, hash, last, count)
                    SELECT type, href, title, hostname, port, pathname, search, hash, time, 1
                    FROM ranked_table
                    WHERE id = first_occurrence_id
                    ORDER BY time DESC`)
          .run()
        setDbVersion(2)
      })()
    }
    d('Check migration... done.')
  }

  db.prepare('CREATE TABLE IF NOT EXISTS urls (id INTEGER PRIMARY KEY, type, href, title, hostname, port, pathname, search, hash, last, count, UNIQUE(href))').run()
  db.prepare('CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY, type, href, title, hostname, port, pathname, search, hash, time)').run()
  db.prepare('CREATE TABLE IF NOT EXISTS prompts (id INTEGER PRIMARY KEY, name, text, time)').run()

  hist = { add,
           get,
           filter,
           suggest }

  initPrompt(db)
}

export
function onHistAdd
(e, onArgs) {
  let [ href, spec ] = onArgs

  hist.add(href, spec)
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
function onPromptAdd
(e, onArgs) {
  let [ name, text ] = onArgs

  prompt.add(name, text)
}

export
function onPromptLoad
() {
  return prompt.load()
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
    return new Store({ name, cwd: profile.dir })
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

  //d('PROFILE save ' + args[0])
  s = getStore(args[0])
  args[1].forEach(a => {
    //d('PROFILE save ' + args[0] + ': ' + a[0] + ':')
    //d(JSON.stringify(a[1]))
    s.set(a[0], a[1])
  })

  //d('PROFILE save ' + args[0] + ': done')
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
