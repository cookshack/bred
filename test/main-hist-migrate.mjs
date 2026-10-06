import { equal, ok } from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { migrate } from '../js/main-hist-migrate.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

// better-sqlite3 is built for Electron's ABI, so tests use node:sqlite with a
// transaction() shim to exercise the same SQL.
function transactionShim
(fn) {
  let d

  d = this
  return function
         () {
           d.exec('BEGIN')
           try {
             fn()
             d.exec('COMMIT')
           }
           catch (e) {
             d.exec('ROLLBACK')
             throw e
           }
         }
}

function db
() {
  let d

  d = new DatabaseSync(':memory:')
  d.transaction = transactionShim
  return d
}

function version
(d) {
  let row

  row = d.prepare("SELECT value FROM meta WHERE name = 'db_version'").get()
  return parseInt(row?.value || 0)
}

function tableNames
(d) {
  return d.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map(r => r.name)
}

function makeOldUrls
(d) {
  d.prepare('CREATE TABLE urls (id INTEGER PRIMARY KEY, type, href, title, hostname, port, pathname, search, hash, time)').run()
}

function makeV1
(d) {
  d.prepare('CREATE TABLE meta (id INTEGER PRIMARY KEY, name, value, UNIQUE(name))').run()
  d.prepare("INSERT INTO meta (name, value) VALUES ('db_version', 1)").run()
  d.prepare('CREATE TABLE urls (id INTEGER PRIMARY KEY, type, href, title, hostname, port, pathname, search, hash, last, count, UNIQUE(href))').run()
  d.prepare('CREATE TABLE visits (id INTEGER PRIMARY KEY, type, href, title, hostname, port, pathname, search, hash, time)').run()
}

tests = {}

test('fresh', 'migrates without error',
     () => {
       let d

       d = db()
       migrate(d)
       ok(1)
     })

test('fresh', 'creates tables',
     () => {
       let d, names

       d = db()
       migrate(d)
       names = tableNames(d)
       ok(names.includes('urls'))
       ok(names.includes('visits'))
       ok(names.includes('prompts'))
     })

test('fresh', 'sets version 2',
     () => {
       let d

       d = db()
       migrate(d)
       equal(version(d), 2)
     })

test('fresh', 'no urls or visits',
     () => {
       let d

       d = db()
       migrate(d)
       equal(d.prepare('SELECT COUNT(*) AS n FROM urls').get().n, 0)
       equal(d.prepare('SELECT COUNT(*) AS n FROM visits').get().n, 0)
     })

test('fresh', 'idempotent',
     () => {
       let d

       d = db()
       migrate(d)
       migrate(d)
       equal(version(d), 2)
     })

test('old v0', 'renames urls to visits',
     () => {
       let d, names

       d = db()
       makeOldUrls(d)
       d.prepare('INSERT INTO urls (type, href, title, time) VALUES (?, ?, ?, ?)').run('url', 'http://a', 'A', 100)
       d.prepare('INSERT INTO urls (type, href, title, time) VALUES (?, ?, ?, ?)').run('url', 'http://a', 'A', 200)
       migrate(d)
       names = tableNames(d)
       ok(names.includes('urls'))
       ok(names.includes('visits'))
       equal(d.prepare('SELECT COUNT(*) AS n FROM visits').get().n, 2)
     })

test('old v0', 'dedups urls from visits',
     () => {
       let d

       d = db()
       makeOldUrls(d)
       d.prepare('INSERT INTO urls (type, href, title, time) VALUES (?, ?, ?, ?)').run('url', 'http://a', 'A', 100)
       d.prepare('INSERT INTO urls (type, href, title, time) VALUES (?, ?, ?, ?)').run('url', 'http://b', 'B', 200)
       d.prepare('INSERT INTO urls (type, href, title, time) VALUES (?, ?, ?, ?)').run('url', 'http://a', 'A', 300)
       migrate(d)
       equal(d.prepare('SELECT COUNT(*) AS n FROM urls').get().n, 2)
       equal(version(d), 2)
     })

test('v1', 'populates urls from visits',
     () => {
       let d

       d = db()
       makeV1(d)
       d.prepare('INSERT INTO visits (type, href, title, time) VALUES (?, ?, ?, ?)').run('url', 'http://a', 'A', 100)
       d.prepare('INSERT INTO visits (type, href, title, time) VALUES (?, ?, ?, ?)').run('url', 'http://a', 'A', 200)
       d.prepare('INSERT INTO visits (type, href, title, time) VALUES (?, ?, ?, ?)').run('url', 'http://b', 'B', 300)
       migrate(d)
       equal(d.prepare('SELECT COUNT(*) AS n FROM urls').get().n, 2)
       equal(version(d), 2)
     })

test('v2', 'preserves urls data',
     () => {
       let d

       d = db()
       migrate(d)
       d.prepare('INSERT INTO urls (type, href, title, last, count) VALUES (?, ?, ?, ?, ?)').run('url', 'http://a', 'A', 100, 3)
       migrate(d)
       equal(d.prepare('SELECT COUNT(*) AS n FROM urls').get().n, 1)
       equal(d.prepare('SELECT count FROM urls').get().count, 3)
       equal(version(d), 2)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
