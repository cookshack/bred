import { d } from './main-log.mjs'

function setVersion
(db, version) {
  db.prepare("INSERT INTO meta (name, value) VALUES ('db_version', ?) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value")
    .run(version)
}

function hasTable
(db, name) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name)
}

export
function migrate
(db) {
  let row, ver

  db.prepare('CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY, name, value, UNIQUE(name))').run()

  row = db.prepare("SELECT value FROM meta WHERE name = 'db_version'").get()
  ver = parseInt(row?.value || 0)
  d('Check migration...')
  d('Current version: ' + ver)
  if (ver == 0) {
    // Version 0 is either a pre-migration db (has an old urls table) or a
    // brand new db (no tables yet). Only migrate when the old table exists.
    if (hasTable(db, 'urls')) {
      d('Migrating: 0 to 1')
      db.transaction(() => {
                       db.prepare('ALTER TABLE urls RENAME TO visits').run()
                       setVersion(db, 1)
                     })()
    }
    else {
      d('New hist database')
      setVersion(db, 1)
    }
    ver = 1
  }

  db.prepare('CREATE TABLE IF NOT EXISTS urls (id INTEGER PRIMARY KEY, type, href, title, hostname, port, pathname, search, hash, last, count, UNIQUE(href))').run()
  db.prepare('CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY, type, href, title, hostname, port, pathname, search, hash, time)').run()

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
                     setVersion(db, 2)
                   })()
  }

  db.prepare('CREATE TABLE IF NOT EXISTS prompts (id INTEGER PRIMARY KEY, name, text, time)').run()

  d('Check migration... done.')
}
