import { equal } from 'node:assert/strict'
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
  let dir

  dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'bred-loop-'))
  git(dir, [ 'init', '-q', '-b', 'main' ])
  git(dir, [ 'config', 'user.email', 'loop@test' ])
  git(dir, [ 'config', 'user.name', 'loop test' ])
  git(dir, [ 'config', 'commit.gpgsign', 'false' ])
  Fs.mkdirSync(Path.join(dir, 'bin'))
  Fs.copyFileSync(loopPath, Path.join(dir, 'bin', 'loop.mjs'))
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

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
