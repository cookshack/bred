// Claim leases for the loop: one JSON file per item, created with O_EXCL so
// two lanes cannot take the same item, and carrying enough to reap a dead one.
//
// Imported by bin/loop.mjs (the CLI) and test/loop-state.mjs.
//
// Interface:
//   claim(root, id, { lane, branch, pid, host, expires }) -> { ok, err, claim }
//   release(root, id)
//   list(root)
//   reap(root, { maxAgeMs })                     -> { removed, kept }
//
// A claim is live when its pid is alive on this host and its expiry (if any)
// has not passed; a dead pid makes it dead at once, whatever the expiry says.
// A pid from another host means nothing here, so it falls back to its expiry,
// or maxAgeMs when it has none. A stale claim is never replaced silently: reap
// it, so the reaper's report says who lost a lane.
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

let defaultMaxAge

defaultMaxAge = 6 * 60 * 60 * 1000

function claimsDir
(root) {
  return Path.join(root, 'claims')
}

function claimFile
(root, id) {
  return Path.join(claimsDir(root), id + '.json')
}

function read
(root, id) {
  try {
    return JSON.parse(Fs.readFileSync(claimFile(root, id), 'utf8'))
  }
  catch (err) {
    if (err.code == 'ENOENT')
      return undefined
    throw err
  }
}

function alive
(pid) {
  if (pid == undefined)
    return 0
  try {
    process.kill(pid, 0)
    return 1
  }
  catch (err) {
    // EPERM means the process exists but belongs to another user
    return err.code == 'EPERM' ? 1 : 0
  }
}

// A lease whose pid cannot be checked (another host) is bounded by its expiry,
// or by maxAge when it has none.
function bounded
(record, maxAge) {
  if (record.expires)
    return Date.parse(record.expires) > Date.now() ? 1 : 0
  return (Date.now() - (record.started ? Date.parse(record.started) : 0)) < maxAge ? 1 : 0
}

export
function live
(record, opts) {
  let maxAge

  opts = opts || {}
  maxAge = opts.maxAgeMs == undefined ? defaultMaxAge : opts.maxAgeMs
  if (record == undefined)
    return 0
  if (record.host == Os.hostname()) {
    if (record.pid == undefined)
      return bounded(record, maxAge)
    // The pid is the authority on this host: a dead lane's lease is reaped even
    // with a fresh expires, which used to block the item until a hand release.
    if (alive(record.pid) == 0)
      return 0
    // A live pid still keeps the lease only to its expiry.
    if (record.expires)
      return Date.parse(record.expires) > Date.now() ? 1 : 0
    return 1
  }
  return bounded(record, maxAge)
}

export
function claim
(root, id, spec) {
  let record

  spec = spec || {}
  Fs.mkdirSync(claimsDir(root), { recursive: true })
  record = { id,
             lane: spec.lane,
             branch: spec.branch,
             pid: spec.pid == undefined ? process.pid : spec.pid,
             host: spec.host || Os.hostname(),
             started: new Date().toISOString(),
             expires: spec.expires }
  try {
    Fs.writeFileSync(claimFile(root, id), JSON.stringify(record, null, 2) + '\n',
                     { flag: 'wx' })
    return { ok: 1, claim: record }
  }
  catch (err) {
    if (err.code == 'EEXIST') {
      let existing

      existing = read(root, id)
      return { ok: 0, err: 'claimed', claim: existing, live: live(existing) }
    }
    throw err
  }
}

export
function release
(root, id) {
  try {
    Fs.unlinkSync(claimFile(root, id))
    return 1
  }
  catch (err) {
    if (err.code == 'ENOENT')
      return 0
    throw err
  }
}

export
function list
(root) {
  let dir, names

  dir = claimsDir(root)
  try {
    names = Fs.readdirSync(dir)
  }
  catch (err) {
    if (err.code == 'ENOENT')
      return []
    throw err
  }
  return names.filter(name => name.endsWith('.json'))
    .map(name => {
           try {
             return JSON.parse(Fs.readFileSync(Path.join(dir, name), 'utf8'))
           }
           catch {
             return { id: name.replace(/\.json$/, ''), broken: 1 }
           }
         })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

export
function reap
(root, opts) {
  let removed, kept

  removed = []
  kept = []
  list(root).forEach(record => {
                       if (live(record, opts))
                         kept.push(record)
                       else {
                         release(root, record.id)
                         removed.push(record)
                       }
                     })
  return { removed, kept }
}
