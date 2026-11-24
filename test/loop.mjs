import { equal } from 'node:assert/strict'

import { land, matches, mergeOne } from '../bin/loop-merge.mjs'
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
  names = [ 'loop.mjs', 'loop-queue.mjs', 'loop-claims.mjs', 'loop-merge.mjs', 'loop-measure.mjs' ]
  i = 0

  while (i < names.length) {
    Fs.copyFileSync(Path.join(dirname(loopPath), names[ i ]), Path.join(dir, 'bin', names[ i ]))
    i += 1
  }

  commit(dir, 'init', 'a.txt')

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
  commit(dir, 'after the round', 'c.txt')
  out = loop(dir, [ 'status' ])

  equal(out.includes(verified), true)
  equal(out.includes('1 commit(s) since the last record'), true)
}

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
  q = { schema: 1, run: {}, items: [] }
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

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
