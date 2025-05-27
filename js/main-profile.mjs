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

  function add
  (href, spec) {
    let url

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
    db.prepare('INSERT INTO urls (type, href, title, hostname, port, pathname, search, hash, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(spec.type,
           href,
           spec.title,
           url?.hostname ?? '',
           url?.port ?? 0,
           url?.pathname ?? '',
           url?.search ?? '',
           url?.hash ?? '',
           Date.now())
    d('PROFILE.HIST added')
  }

  function filter
  (query) {
    let st

    st = db.prepare(`SELECT *
                     FROM urls
                     WHERE type = 'url'
                     AND (href LIKE ? OR title LIKE ?)
                     ORDER BY id DESC
                     LIMIT 10`)
    return { urls: st.all('%' + query + '%') }
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
    let fuse, rows, urls, min, max, weightFuse, weightTime

    d('SUGGEST')

    weightTime = 0.3 // recency
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

    // Get min and max time

    min = -1
    max = 0
    urls.forEach(url => {
      if ((min == -1)
          || (url.item.time < min))
        min = url.item.time
      if (url.item.time > max)
        max = url.item.time
    })

    d(min)
    d(max)

    if ((min >= 0) && (max >= 0) && (max > min)) {
      // Normalize times, give each url a composite score
      urls.forEach(url => {
        url.scoreTime = (url.item.time - min) / (max - min)
        url.scoreFuse = (1 - url.score)
        url.scoreBred = (url.scoreFuse * weightFuse) + (url.scoreTime * weightTime)
      })
      // Sort by the composite score
      urls.sort((u1, u2) => u2.bredScore - u1.bredScore)
    }

    return { urls: urls.slice(0, 10) }
  }

  path = profile.dir + '/hist.db'
  log('Opening hist: ' + path)
  db = new Database(profile.dir + '/hist.db')
  db.prepare('CREATE TABLE IF NOT EXISTS urls (id INTEGER PRIMARY KEY, type, href, title, hostname, port, pathname, search, hash, time)').run()
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
