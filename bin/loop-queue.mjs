// The loop's queue: one JSON record per item, the source of truth for what
// is ready, what is running and what is done.
//
// Imported by bin/loop.mjs (the CLI) and test/loop-state.mjs. Pure except
// load/save: no git, no agent, no filesystem beyond the one file.
//
// Interface:
//   load(file), save(file, queue)             schema 1, atomic write
//   pick(queue, { n, dirty, hot })            -> { picked, skipped }
//   finish(queue, id, hash), mark(queue, id, status)
//   check(queue)                              -> [ problem ]
//   rows(queue)                               -> { ready, next, triage, done }
//
// An item is { id, lane, status, title, files, exclusive?, proof?, doneHash?,
// notes? }. `files` is the whole ownership set; `exclusive` names a path that
// only one picked item may touch even when the two file lists differ (the
// parser file is the reason it exists). Done rows keep `files`, so the merge
// gate can diff against what the item was allowed to own.
import Fs from 'node:fs'
import Path from 'node:path'

let schema, statuses

schema = 1
statuses = [ 'ready', 'in-round', 'next', 'triage', 'done' ]

export
function empty
() {
  return { schema, run: {}, items: [] }
}

export
function load
(file) {
  let queue

  queue = JSON.parse(Fs.readFileSync(file, 'utf8'))
  if (queue.schema == schema) {
    if (Array.isArray(queue.items) == 0)
      queue.items = []
    return queue
  }
  throw new Error('queue schema ' + queue.schema + ', expected ' + schema)
}

// Write next to the file and rename, so a killed writer leaves the old queue
// rather than half of a new one.
export
function save
(file, queue) {
  let tmp

  tmp = file + '.tmp'
  Fs.mkdirSync(Path.dirname(file), { recursive: true })
  Fs.writeFileSync(tmp, JSON.stringify(queue, null, 2) + '\n')
  Fs.renameSync(tmp, file)
}

function itemOf
(queue, id) {
  return queue.items.find(item => item.id == id)
}

function touches
(item, paths) {
  let own

  own = item.files.concat(item.exclusive || [])
  return own.some(file => paths.some(other => file == other))
}

// Ready items whose files are free: disjoint from each other, from the dirty
// tree and from the files another agent touched recently. `skipped` says why,
// so the caller can print it instead of wondering.
export
function pick
(queue, opts) {
  let n, dirty, hot, picked, skipped, taken

  opts = opts || {}
  n = opts.n == undefined ? 3 : opts.n
  dirty = opts.dirty || []
  hot = opts.hot || []
  picked = []
  skipped = []
  taken = []

  queue.items.forEach(item => {
                        if (item.status == 'ready')
                          if (item.files.length == 0)
                            skipped.push({ id: item.id, why: 'no files' })
                          else if (touches(item, dirty))
                            skipped.push({ id: item.id, why: 'dirty' })
                          else if (touches(item, hot))
                            skipped.push({ id: item.id, why: 'hot' })
                          else if (touches(item, taken))
                            skipped.push({ id: item.id, why: 'overlap' })
                          else if (picked.length < n) {
                            picked.push(item)
                            taken = taken.concat(item.files, item.exclusive || [])
                          }

                      })
  return { picked, skipped }
}

export
function finish
(queue, id, hash) {
  let item

  item = itemOf(queue, id)
  if (item == undefined)
    throw new Error('no queue item ' + id)
  item.status = 'done'
  item.doneHash = hash
  return item
}

export
function mark
(queue, id, status) {
  let item

  item = itemOf(queue, id)
  if (item == undefined)
    throw new Error('no queue item ' + id)
  item.status = status
  return item
}

// The things a stale or hand-edited queue gets wrong. `load` and `save` cannot
// catch these: a duplicate id parses fine and only bites at claim time.
export
function check
(queue) {
  let problems, ids

  problems = []
  ids = []
  if (queue.schema == schema)
    queue.items.forEach(item => {
                          if (ids.includes(item.id))
                            problems.push(item.id + ': duplicate id')
                          ids.push(item.id)
                          if (statuses.includes(item.status) == 0)
                            problems.push(item.id + ': unknown status ' + item.status)
                          if (item.status == 'done' && item.doneHash == undefined)
                            problems.push(item.id + ': done without a hash')
                          if (item.status == 'done')
                            return
                          if (Array.isArray(item.files) == 0 || item.files.length == 0)
                            problems.push(item.id + ': no files')
                          item.files.forEach(file => {
                                               if (file.startsWith('/'))
                                                 problems.push(item.id + ': absolute file ' + file)
                                             })
                        })

  else
    problems.push('schema ' + queue.schema + ', expected ' + schema)
  return problems
}

export
function rows
(queue) {
  let out

  out = { ready: [], next: [], triage: [], done: [] }
  queue.items.forEach(item => {
                        if (out[item.status] == undefined)
                          out[item.status] = []
                        out[item.status].push(item)
                      })
  return out
}
