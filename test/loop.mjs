import { equal } from 'node:assert/strict'

import * as Claims from '../bin/loop-claims.mjs'
import * as Measure from '../bin/loop-measure.mjs'
import * as Queue from '../bin/loop-queue.mjs'
import { land, matches, mergeOne, mergeRound, provision } from '../bin/loop-merge.mjs'
import { spawnSync } from 'node:child_process'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The loop tool is the loop's memory, so its safety rules are tested against a
// real repository rather than described in prose: a lane with an unmerged
// commit must never be reset, and neither must a dirty one.

let tests

tests = {}

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

let loopPath

loopPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'loop.mjs')

function git
(dir, args) {
  let res

  res = spawnSync('git', args, { cwd: dir, encoding: 'utf8' })
  equal(res.status, 0, 'git ' + args.join(' ') + ': ' + res.stderr)
  return res.stdout.trim()
}

function commit
(dir, name, file) {
  Fs.writeFileSync(Path.join(dir, file), name + '\n')
  git(dir, [ 'add', file ])
  git(dir, [ 'commit', '-qm', name ])
  return git(dir, [ 'rev-parse', 'HEAD' ])
}

function loop
(dir, args) {
  let res, env

  env = { ...process.env, BRED_WORKTREE_ROOT: Path.join(dir, 'wt'), BRED_WORKSPACE: 'test1234' }
  res = spawnSync('node', [ Path.join(dir, 'bin', 'loop.mjs') ].concat(args), { cwd: dir, encoding: 'utf8', env })
  equal(res.status, 0, 'loop ' + args.join(' ') + ': ' + res.stderr)
  return res.stdout
}

// A repository with the tool committed, one config per test.
function repo
() {
  let dir, names, i

  dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'bred-loop-'))
  git(dir, [ 'init', '-q', '-b', 'main' ])
  git(dir, [ 'config', 'user.email', 'loop@test' ])
  git(dir, [ 'config', 'user.name', 'loop test' ])
  git(dir, [ 'config', 'commit.gpgsign', 'false' ])
  Fs.mkdirSync(Path.join(dir, 'bin'))
  names = [ 'loop.mjs', 'loop-clock.mjs', 'loop-queue.mjs', 'loop-claims.mjs', 'loop-merge.mjs',
            'loop-measure.mjs' ]
  i = 0

  while (i < names.length) {
    Fs.copyFileSync(Path.join(dirname(loopPath), names[ i ]), Path.join(dir, 'bin', names[ i ]))
    i += 1
  }

  Fs.mkdirSync(Path.join(dir, 'doc', 'loop'), { recursive: true })
  Fs.writeFileSync(Path.join(dir, 'doc', 'loop', 'queue.json'),
                   JSON.stringify({ schema: 1,
                                    run: { start: '2020-01-01T00:00:00Z',
                                           deadline: '2099-01-01T00:00:00Z',
                                           stopNew: '2099-01-01T00:00:00Z',
                                           state: 'active' },
                                    items: [] }, null, 2) + '\n')
  commit(dir, 'init', 'a.txt')
  commit(dir, 'queue', 'doc/loop/queue.json')

  return dir
}

function lane
(dir, n) {
  return Path.join(dir, 'wt', 'bred-a' + n)
}

function withRepo
(cb) {
  return wrapper.bind(0, cb)
}

function wrapper
(cb) {
  let dir

  dir = repo()
  try {
    cb(dir)
  }
  finally {
    Fs.rmSync(dir, { recursive: true, force: true })
  }
}

function createsLanes
(dir) {
  let tip

  tip = git(dir, [ 'rev-parse', 'main' ])
  loop(dir, [ 'lanes-up' ])
  for (let n = 1; n <= 3; n += 1)
    equal(git(lane(dir, n), [ 'rev-parse', 'HEAD' ]), tip)
  equal(Fs.existsSync(Path.join(lane(dir, 1), 'a.txt')), true)
}

test('lanes-up', 'creates three lane worktrees at main', withRepo(createsLanes))

function resetsCleanLane
(dir) {
  let behind

  loop(dir, [ 'lanes-up' ])
  behind = commit(dir, 'later', 'b.txt')
  loop(dir, [ 'lanes-up' ])
  equal(git(lane(dir, 1), [ 'rev-parse', 'HEAD' ]), behind)
}

test('lanes-up', 'brings a clean lane that is behind main up to main', withRepo(resetsCleanLane))

function keepsUnmerged
(dir) {
  let work, out

  loop(dir, [ 'lanes-up' ])
  work = commit(lane(dir, 1), 'lane work', 'lane.txt')
  commit(dir, 'main moves', 'main.txt')
  out = loop(dir, [ 'lanes-up' ])

  equal(git(lane(dir, 1), [ 'rev-parse', 'HEAD' ]), work)
  equal(out.includes('unmerged commits; not reset'), true)
}

test('lanes-up', 'never resets a lane with an unmerged commit', withRepo(keepsUnmerged))

function keepsDirty
(dir) {
  let out

  loop(dir, [ 'lanes-up' ])
  Fs.writeFileSync(Path.join(lane(dir, 2), 'dirty.txt'), 'work\n')
  commit(dir, 'main moves', 'main.txt')
  out = loop(dir, [ 'lanes-up' ])

  equal(Fs.existsSync(Path.join(lane(dir, 2), 'dirty.txt')), true)
  equal(out.includes('dirty tree; not reset'), true)
}

test('lanes-up', 'never resets a lane with a dirty tree', withRepo(keepsDirty))

function namesLanes
(dir) {
  let out

  loop(dir, [ 'lanes-up' ])
  out = loop(dir, [ 'status' ])
  equal(out.includes('verified   none'), true)
  equal(out.includes('bred-a1'), true)
}

test('status', 'names the lanes and says there is no verified tip', withRepo(namesLanes))

function countsSince
(dir) {
  let out, verified

  verified = git(dir, [ 'rev-parse', 'main' ])
  git(dir, [ 'commit', '-q', '--allow-empty', '-m', 'doc: round 1\n\nLoop-round: 1\nLoop-verify: ' + verified ])
  git(dir, [ 'commit', '-q', '--allow-empty', '-m', 'man: a lane commit\n\nLoop-item: p9' ])
  out = loop(dir, [ 'status' ])

  equal(out.includes(verified), true)
  equal(out.includes('1 lane commit(s) since the last record'), true)
}

// A queue or record commit is not an unrecorded round, which is what counting
// distance rather than substance used to report.
function docOnlyAfter
(dir) {
  let out, verified

  verified = git(dir, [ 'rev-parse', 'main' ])
  git(dir, [ 'commit', '-q', '--allow-empty', '-m', 'doc: round 1\n\nLoop-round: 1\nLoop-verify: ' + verified ])
  Fs.mkdirSync(Path.join(dir, 'doc'), { recursive: true })
  Fs.writeFileSync(Path.join(dir, 'doc', 'note.md'), 'x\n')
  git(dir, [ 'add', 'doc/note.md' ])
  git(dir, [ 'commit', '-qm', 'doc: a note' ])
  out = loop(dir, [ 'status' ])

  equal(out.includes('no lane commits since the last record'), true)
}

test('status', 'a doc-only commit after the record is not an unrecorded round', withRepo(docOnlyAfter))

test('status', 'counts the commits since the last Loop-verify trailer', withRepo(countsSince))

function matchGlobs
() {
  equal(matches('js/wode*.mjs', 'js/wode-view.mjs'), true)
  equal(matches('js/wode*.mjs', 'js/wode.mjs'), true)
  equal(matches('js/wode*.mjs', 'js/view.mjs'), false)
  equal(matches('js/man.mjs', 'js/man.mjs'), true)
  equal(matches('js/man.mjs', 'js/man-parse.mjs'), false)
}

test('merge', 'a file-set pattern is a glob, not a prefix', matchGlobs)

function laneSetup
(dir, name, files) {
  let wt, branch, i

  branch = 'agent/bred-test1234-' + name
  wt = Path.join(dir, 'wt', 'bred-' + name)
  git(dir, [ 'worktree', 'add', '-b', branch, wt, 'main' ])
  i = 0

  while (i < files.length) {
    Fs.mkdirSync(Path.dirname(Path.join(wt, files[ i ])), { recursive: true })
    Fs.writeFileSync(Path.join(wt, files[ i ]), 'x\n')
    i += 1
  }

  git(wt, [ 'add' ].concat(files))
  git(wt, [ 'commit', '-qm', 'lane work' ])
  return { id: 'p1', lane: name, branch, files, proof: 'test -f allowed.js' }
}

function mergeOpts
(dir) {
  return { laneRoot: Path.join(dir, 'wt'), logDir: Path.join(dir, 'lo'), round: 1, timeoutMs: 30000 }
}

function mergesClean
(dir) {
  let row, res

  git(dir, [ 'branch', 'work', 'main' ])
  row = laneSetup(dir, 'a1', [ 'allowed.js', 'test/allowed.mjs' ])
  res = mergeOne(dir, row, 'work', mergeOpts(dir))

  equal(res.ok, 1, res.problems.join('; '))
  equal(git(dir, [ 'rev-parse', 'work' ]), git(dir, [ 'rev-parse', row.branch ]))
  equal(res.notes.includes('red: red'), true)
}

test('merge', 'a lane that is red at base and green after the rebase merges', withRepo(mergesClean))

function parksOutside
(dir) {
  let row, res, problems

  git(dir, [ 'branch', 'work', 'main' ])
  row = laneSetup(dir, 'a1', [ 'allowed.js', 'other.js' ])
  row.files = [ 'allowed.js' ]
  res = mergeOne(dir, row, 'work', mergeOpts(dir))
  problems = res.problems.join('; ')

  equal(res.parked, 1)
  equal(problems.includes('outside its file set: other.js'), true)
  equal(problems.includes('aborted'), true)
  equal(Fs.existsSync(Path.join(dir, 'lo', 'p1.patch')), true)
  equal(git(dir, [ 'rev-parse', 'work' ]), git(dir, [ 'rev-parse', 'main' ]))
}

test('merge', 'a file outside the queue row parks the lane and keeps a patch', withRepo(parksOutside))

function parksNotRed
(dir) {
  let row, res

  git(dir, [ 'branch', 'work', 'main' ])
  row = laneSetup(dir, 'a1', [ 'allowed.js', 'test/allowed.mjs' ])
  row.proof = 'true'
  res = mergeOne(dir, row, 'work', mergeOpts(dir))

  equal(res.parked, 1)
  equal(res.problems.join('; ').includes('not red'), true)
}

test('merge', 'a proof that passes at base is not a red and parks', withRepo(parksNotRed))

function landsWork
(dir) {
  let row, res, tip

  row = laneSetup(dir, 'a2', [ 'b.js' ])
  tip = git(dir, [ 'rev-parse', row.branch ])
  git(dir, [ 'branch', 'work', tip ])
  res = land(dir, { work: 'work' })

  equal(res.ok, 1, res.why)
  equal(git(dir, [ 'rev-parse', 'main' ]), tip)
}

test('land', 'fast-forwards main to the integration branch', withRepo(landsWork))

function landRefuses
(dir) {
  let res

  git(dir, [ 'branch', 'work', 'main' ])
  commit(dir, 'main moves', 'm.txt')
  res = land(dir, { work: 'work' })

  equal(res.ok, 0)
  equal(res.why.includes('not an ancestor'), true)
}

test('land', 'refuses when main has moved off the integration branch', withRepo(landRefuses))

// The one test that runs the CLI the way the loop does, because the two bugs
// the scratch run found were wiring, not logic: `round` never passed its lanes
// to the merge, and a bare `--no-suite` was read as missing its argument.
function cliRound
(dir) {
  let q, wt, out, tip, rec

  Fs.mkdirSync(Path.join(dir, 'doc', 'loop'), { recursive: true })
  Fs.writeFileSync(Path.join(dir, '.gitignore'), 'node_modules\next/*/lib\n')
  q = { schema: 1,
        run: { start: '2020-01-01T00:00:00Z',
               deadline: '2099-01-01T00:00:00Z',
               stopNew: '2099-01-01T00:00:00Z',
               state: 'active' },
        items: [] }
  q.items.push({ id: 'p1', lane: 'a1', status: 'ready', title: 'smoke', files: [ 'allowed.js', 'test/allowed.mjs' ], proof: 'test -f allowed.js' })
  Fs.writeFileSync(Path.join(dir, 'doc', 'loop', 'queue.json'), JSON.stringify(q))
  git(dir, [ 'add', '-A' ])
  git(dir, [ 'commit', '-qm', 'queue' ])

  loop(dir, [ 'lanes-up' ])
  wt = Path.join(dir, 'wt', 'bred-a1')
  Fs.mkdirSync(Path.join(wt, 'test'), { recursive: true })
  Fs.writeFileSync(Path.join(wt, 'allowed.js'), 'x\n')
  Fs.writeFileSync(Path.join(wt, 'test', 'allowed.mjs'), 'x\n')
  git(wt, [ 'add', '-A' ])
  git(wt, [ 'commit', '-qm', 'lane work' ])

  out = loop(dir, [ 'round', '1', '--items', 'p1', '--no-suite' ])
  equal(out.includes('merged   p1'), true)
  tip = git(dir, [ 'rev-parse', 'loop/r1' ])
  equal(tip, git(dir, [ 'rev-parse', 'agent/bred-test1234-a1' ]))

  rec = Path.join(dir, 'rec')
  git(dir, [ 'worktree', 'add', '-q', rec, 'loop/r1' ])
  Fs.writeFileSync(Path.join(rec, 'round-1.md'), '# smoke\n')
  git(rec, [ 'add', '-A' ])
  git(rec, [ 'commit', '-qm', 'doc: round 1\n\nLoop-round: 1\nLoop-verify: ' + tip ])
  git(dir, [ 'worktree', 'remove', rec ])

  out = loop(dir, [ 'land', '1' ])
  equal(out.includes('landed'), true)
  equal(git(dir, [ 'rev-parse', 'main' ]), git(dir, [ 'rev-parse', 'loop/r1' ]))
}

test('round', 'merges, gates, records and lands one item through the CLI', withRepo(cliRound))

// The record lands after the tip it verified, so `land` must check both that
// the tip is this branch's ancestor and that nothing but docs came after it.
function landWrongTrailer
(dir) {
  let res, wt, other

  git(dir, [ 'branch', 'work', 'main' ])
  wt = Path.join(dir, 'wt', 'bred-a9')
  git(dir, [ 'worktree', 'add', '-b', 'other', wt, 'main' ])
  other = commit(wt, 'elsewhere', 'e.txt')
  res = land(dir, { work: 'work', verify: other })

  equal(res.ok, 0)
  equal(res.why.includes('not an ancestor'), true)
}

test('land', 'refuses a trailer whose tip the branch does not descend from', withRepo(landWrongTrailer))

function landCodeAfter
(dir) {
  let res, wt, verified

  verified = git(dir, [ 'rev-parse', 'main' ])
  wt = Path.join(dir, 'wt', 'bred-a8')
  git(dir, [ 'worktree', 'add', '-b', 'work', wt, 'main' ])
  commit(wt, 'code after the measurement', 'code.js')
  res = land(dir, { work: 'work', verify: verified })

  equal(res.ok, 0)
  equal(res.why.includes('more than doc/'), true)
}

test('land', 'refuses when code was committed after the verified tip', withRepo(landCodeAfter))

function roundWithPark
(dir) {
  let good, bad, res, opts

  good = laneSetup(dir, 'a1', [ 'allowed.js', 'test/allowed.mjs' ])
  bad = laneSetup(dir, 'a2', [ 'other.js' ])
  bad.files = [ 'allowed.js' ]
  opts = mergeOpts(dir)
  opts.lanes = [ good, bad ]
  opts.work = 'work'
  opts.suite = 0
  res = mergeRound(dir, opts)

  equal(res.merged.length, 1)
  equal(res.parked.length, 1)
  equal(res.ok, 1, res.problems.join('; '))
}

test('round', 'one parked lane does not make the round unlandable', withRepo(roundWithPark))

function provisionsLib
(dir) {
  Fs.mkdirSync(Path.join(dir, 'lib'), { recursive: true })
  Fs.writeFileSync(Path.join(dir, 'lib', 'gen.mjs'), 'x\n')
  Fs.mkdirSync(Path.join(dir, 'scratch'), { recursive: true })
  provision(dir, Path.join(dir, 'scratch'))

  equal(Fs.existsSync(Path.join(dir, 'scratch', 'lib', 'gen.mjs')), true)
}

test('provision', 'copies the generated lib a fresh worktree lacks', withRepo(provisionsLib))

// An expiry past due kills a lease whose pid is still alive; a fresh one keeps
// it. A dead pid is reaped regardless (see the dead-pid test below).
function leaseTtl
() {
  let dir

  dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'bred-lease-'))
  try {
    let past, future

    past = new Date(Date.now() - 60000).toISOString()
    future = new Date(Date.now() + 3600000).toISOString()
    Claims.claim(dir, 'p1', { lane: 'a1', expires: past })
    equal(Claims.reap(dir, {}).removed.length, 1)
    Claims.claim(dir, 'p2', { lane: 'a1', expires: future })
    equal(Claims.reap(dir, {}).removed.length, 0)
    equal(Claims.list(dir).length, 1)
  }
  finally {
    Fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('claim', 'an explicit expiry outranks a pid that has already exited', leaseTtl)

// A dead lane's lease used to survive reap whenever its expiry was still in the
// future, so the item stayed blocked until the lane released it by hand. The pid
// is the authority on this host; only another host's pid cannot be checked.
function deadPidReaped
() {
  let dir

  dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'bred-lease-'))
  try {
    let child, future, record

    child = spawnSync('true')
    future = new Date(Date.now() + 3600000).toISOString()
    Claims.claim(dir, 'p1', { lane: 'a1',
                              pid: child.pid,
                              host: Os.hostname(),
                              expires: future })
    record = Claims.list(dir)[ 0 ]
    equal(Claims.live(record), 0, 'a dead pid is not live')
    equal(Claims.reap(dir, {}).removed.length, 1)
    equal(Claims.list(dir).length, 0)
  }
  finally {
    Fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('claim', 'a dead pid is reaped even with a fresh expiry', deadPidReaped)

// The aggregate docs belong in the record commit; a dirty doc tree is refused
// rather than remembered. Seventeen rounds once sat uncommitted behind that.
function landDirtyDocs
(dir) {
  let res

  git(dir, [ 'branch', 'work', 'main' ])
  Fs.mkdirSync(Path.join(dir, 'doc'), { recursive: true })
  Fs.writeFileSync(Path.join(dir, 'doc', 'note.md'), 'x\n')
  res = land(dir, { work: 'work' })

  equal(res.ok, 0)
  equal(res.why.includes('doc/ is dirty'), true)
}

test('land', 'refuses while doc/ is dirty', withRepo(landDirtyDocs))

function checkFields
() {
  let q, problems

  q = { schema: 1, measures: { man: { budget: 300 } }, items: [] }
  q.items.push({ id: 'p1', status: 'ready', files: [ 'a' ], type: 'nonsense', area: 'man' })
  problems = Queue.check(q).join('; ')

  equal(problems.includes('unknown type nonsense'), true)
  equal(problems.includes('needs a budget and a population'), true)
}

test('check', 'a bad type and a measure without a population are problems', checkFields)

function checkNoArea
() {
  let q, problems

  q = { schema: 1, items: [] }
  q.items.push({ id: 'p1', status: 'ready', files: [ 'a' ] })
  problems = Queue.check(q).join('; ')

  equal(problems.includes('no area'), true)
}

test('check', 'an open item without an area is a problem', checkNoArea)

function historyPerArea
() {
  let dir

  dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'bred-hist-'))
  try {
    let file

    file = Path.join(dir, 'history.jsonl')
    Measure.append(file, { area: 'man', tip: 'abc1234', corpus: { parsed: 1 } })
    Measure.append(file, { area: 'core', tip: 'abc1234', laws: 3 })

    equal(Measure.load(file).length, 2)
  }
  finally {
    Fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('measure', 'one record per tip and area, not per tip', historyPerArea)

// The cadence: every area measured, and one area failing does not hide the
// others. The commands are scripts committed at the tip, because the measure
// runs in a worktree of that tip, not in the checkout.
function loopRaw
(dir, args) {
  let res, env

  env = { ...process.env, BRED_WORKTREE_ROOT: Path.join(dir, 'wt'), BRED_WORKSPACE: 'test1234' }
  res = spawnSync('node', [ Path.join(dir, 'bin', 'loop.mjs') ].concat(args),
                  { cwd: dir, encoding: 'utf8', env })
  return { status: res.status, out: (res.stdout || '') + (res.stderr || '') }
}

function scriptFile
(dir, name, body) {
  Fs.writeFileSync(Path.join(dir, name), '#!/bin/sh\n' + body + '\n')
  Fs.chmodSync(Path.join(dir, name), 0o755)
}

function queueWithMeasures
(dir, measures) {
  let q

  Fs.mkdirSync(Path.join(dir, 'doc', 'loop'), { recursive: true })
  q = { schema: 1, measures, items: [] }
  Fs.writeFileSync(Path.join(dir, 'doc', 'loop', 'queue.json'), JSON.stringify(q, null, 2) + '\n')
  scriptFile(dir, 'good.sh', 'echo \'{"n": 1}\'')
  scriptFile(dir, 'slow.sh', 'sleep 5')
  git(dir, [ 'add', '-A' ])
  git(dir, [ 'commit', '-qm', 'measures' ])
}

function allAreas
(dir) {
  let out, history

  queueWithMeasures(dir, { good: { budget: 60, command: './good.sh' },
                           slow: { budget: 1, command: './slow.sh' } })
  out = loopRaw(dir, [ 'measure', '--area', 'all', '--tip', 'main' ])

  equal(out.status, 1)
  equal(out.out.includes('some areas failed'), true)
  history = Fs.readFileSync(Path.join(dir, 'doc', 'loop', 'history.jsonl'), 'utf8').trim()
  equal(history.split('\n').length, 1)
  equal(JSON.parse(history).area, 'good')
  equal(JSON.parse(history).tip, git(dir, [ 'rev-parse', 'HEAD' ]))
}

test('measure', 'every area runs, and one failing does not hide another', withRepo(allAreas))

// The clock is not a reminder: a run that starts a round after stopNew is
// lying about its deadline, and the 2026-11-25 run did exactly that.
function writeRun
(dir, run) {
  let q

  Fs.mkdirSync(Path.join(dir, 'doc', 'loop'), { recursive: true })
  q = { schema: 1, run, items: [] }
  Fs.writeFileSync(Path.join(dir, 'doc', 'loop', 'queue.json'), JSON.stringify(q, null, 2) + '\n')
}

function pastRun
() {
  return { start: '2020-01-01T00:00:00Z',
           deadline: '2020-01-01T05:00:00Z',
           stopNew: '2020-01-01T04:00:00Z',
           state: 'active' }
}

function clockRefuses
(dir) {
  let res

  writeRun(dir, pastRun())
  res = loopRaw(dir, [ 'clock', '--can-start' ])
  equal(res.status, 1)
  equal(res.out.includes('can-start  0'), true)
  equal(res.out.includes('stopNew passed'), true)
}

function roundRefuses
(dir) {
  let res

  writeRun(dir, pastRun())
  res = loopRaw(dir, [ 'round', '9' ])
  equal(res.status, 1)
  equal(res.out.includes('round not started'), true)
}

function missingRefuses
(dir) {
  let res

  writeRun(dir, {})
  res = loopRaw(dir, [ 'round', '9' ])
  equal(res.status, 1)
  equal(res.out.includes('no run clock'), true)
}

// l2: a done hash must be the commit that did the work. Round 57 used a peer's
// grooming commit, which was on main while the fix sat on a lane branch that
// never merged; ancestry alone was happy. The commit's own diff must touch a
// file the row owns.
function doneQueue
(dir, touched) {
  let hash, q, row

  if (touched) {
    Fs.writeFileSync(Path.join(dir, 'work.txt'), 'x\n')
    git(dir, [ 'add', 'work.txt' ])
    git(dir, [ 'commit', '-qm', 'work\n\nLoop-item: p1' ])
  }
  hash = touched ? git(dir, [ 'rev-parse', 'HEAD' ]) : git(dir, [ 'rev-list', '--max-parents=0', 'HEAD' ])
  writeRun(dir, pastRun())
  row = { id: 'p1', area: 'man', lane: 'a1', type: 'fix', status: 'done', title: 'x', files: [ 'work.txt' ], proof: 'true', doneHash: hash }
  q = { schema: 1, run: pastRun(), items: [ row ] }
  Fs.writeFileSync(Path.join(dir, 'doc', 'loop', 'queue.json'), JSON.stringify(q, null, 2) + '\n')
}

function doneElsewhere
(dir) {
  let res

  doneQueue(dir, 0)
  res = loopRaw(dir, [ 'check' ])
  equal(res.status, 1)
  equal(res.out.includes('does not touch the item files'), true)
}

function doneTouches
(dir) {
  let res

  doneQueue(dir, 1)
  res = loopRaw(dir, [ 'check' ])
  equal(res.status, 0)
}

test('check', 'a done hash that touches none of the item files is a problem', withRepo(doneElsewhere))
test('check', 'a done hash that touches an item file is accepted', withRepo(doneTouches))

test('clock', 'clock --can-start exits 1 after stopNew', withRepo(clockRefuses))
test('clock', 'round refuses after stopNew instead of starting', withRepo(roundRefuses))
test('clock', 'round refuses when the run has no clock', withRepo(missingRefuses))

// `apply` is how a helper's proposals reach the queue: one validated write, so
// the scheduler never edits the JSON and a bad proposal leaves the file alone.

function writeRows
(dir, items) {
  let q

  q = { schema: 1,
        run: { start: '2020-01-01T00:00:00Z',
               deadline: '2099-01-01T00:00:00Z',
               stopNew: '2099-01-01T00:00:00Z',
               state: 'active' },
        items }
  Fs.mkdirSync(Path.join(dir, 'doc', 'loop'), { recursive: true })
  Fs.writeFileSync(Path.join(dir, 'doc', 'loop', 'queue.json'), JSON.stringify(q, null, 2) + '\n')
}

function queueRow
(id, patch) {
  let base

  base = { id, area: 'man', lane: 'a1', type: 'fix', status: 'next', title: 't', files: [ 'js/man-parse.mjs' ] }
  return Object.assign(base, patch)
}

function proposals
(dir, items) {
  Fs.writeFileSync(Path.join(dir, 'proposals.json'), JSON.stringify({ items }, null, 2) + '\n')
  return 'proposals.json'
}

function queueOf
(dir) {
  return JSON.parse(Fs.readFileSync(Path.join(dir, 'doc', 'loop', 'queue.json'), 'utf8'))
}

function appliesReady
(dir) {
  let one, q, res

  writeRows(dir, [ queueRow('p1') ])
  one = { id: 'p1', status: 'ready', files: [ 'js/man-parse.mjs', 'test/man-parse.mjs' ], proof: 'npx mocha --exit test/man-parse.mjs', notes: 'evidence' }
  res = loop(dir, [ 'apply', proposals(dir, [ one ]) ])
  equal(res.includes('applied  p1  ready'), true)
  q = queueOf(dir)
  equal(q.items[ 0 ].status, 'ready')
  equal(q.items[ 0 ].notes, 'evidence')
  equal(q.items[ 0 ].files.length, 2)
  equal(loop(dir, [ 'check' ]).includes('0 problem(s)'), true)
}

function applyRefusals
(dir) {
  let before, res

  writeRows(dir, [ queueRow('p1'), queueRow('d1', { status: 'done', doneHash: '1234567' }) ])
  before = Fs.readFileSync(Path.join(dir, 'doc', 'loop', 'queue.json'), 'utf8')

  res = loopRaw(dir, [ 'apply', proposals(dir, [ { id: 'nope', status: 'ready', proof: 'x' } ]) ])
  equal(res.status, 1)
  equal(res.out.includes('no such row'), true)

  res = loopRaw(dir, [ 'apply', proposals(dir, [ { id: 'd1', notes: 'x' } ]) ])
  equal(res.status, 1)
  equal(res.out.includes('done rows stay closed'), true)

  res = loopRaw(dir, [ 'apply', proposals(dir, [ { id: 'p1', status: 'ready' } ]) ])
  equal(res.status, 1)
  equal(res.out.includes('ready without a proof'), true)

  res = loopRaw(dir, [ 'apply', proposals(dir, [ { id: 'p1', files: [ '/abs' ] } ]) ])
  equal(res.status, 1)
  equal(res.out.includes('absolute file'), true)

  // A batch with one bad proposal writes none of them.
  res = loopRaw(dir, [ 'apply', proposals(dir, [ { id: 'p1', status: 'ready', proof: 'p' }, { id: 'p2', status: 'ready' } ]) ])
  equal(res.status, 1)
  equal(res.out.includes('nothing written'), true)

  equal(Fs.readFileSync(Path.join(dir, 'doc', 'loop', 'queue.json'), 'utf8'), before)
}

function appliesNew
(dir) {
  let one, q, res

  writeRows(dir, [])
  one = { id: 'p9', new: 1, area: 'man', lane: 'a1', type: 'fix', status: 'ready', title: 'new', files: [ 'js/man-parse.mjs' ], proof: 'npx mocha --exit test/man-parse.mjs' }
  res = loop(dir, [ 'apply', proposals(dir, [ one ]) ])
  q = queueOf(dir)
  equal(q.items.length, 1)
  equal(q.items[ 0 ].id, 'p9')
  equal(res.includes('applied  p9  ready'), true)

  res = loopRaw(dir, [ 'apply', proposals(dir, [ { id: 'p9', new: 1, title: 'again' } ]) ])
  equal(res.status, 1)
  equal(res.out.includes('row exists'), true)

  res = loopRaw(dir, [ 'apply', proposals(dir, [ { id: 'p10', title: 'no flag' } ]) ])
  equal(res.status, 1)
  equal(res.out.includes('no such row'), true)
}

function appliesView
(dir) {
  let file, one, text

  writeRows(dir, [ queueRow('p1') ])
  file = Path.join(dir, 'doc', 'Loop-queue.md')
  Fs.writeFileSync(file, '# Queue\n\n<!-- loop:queue -->\nold\n<!-- /loop:queue -->\n')
  one = { id: 'p1', status: 'ready', proof: 'npx mocha --exit test/man-parse.mjs' }
  loop(dir, [ 'apply', proposals(dir, [ one ]) ])
  text = Fs.readFileSync(file, 'utf8')
  equal(text.includes('old'), false)
  equal(text.includes('| p1 | man | a1 | ready |'), true)
}

test('apply', 'updates a row and keeps check clean', withRepo(appliesReady))
test('apply', 'refuses a bad proposal and writes nothing', withRepo(applyRefusals))
test('apply', 'creates a row only with new: 1 and a free id', withRepo(appliesNew))
test('apply', 'regenerates the generated view', withRepo(appliesView))

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
