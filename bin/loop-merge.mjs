// The loop's merge step: lanes onto an integration branch, then one
// fast-forward of main. Nothing here writes to main; `land` does that, and it
// refuses a branch whose tip is not the one the suite passed.
//
// Imported by bin/loop.mjs (the CLI) and test/loop.mjs. `run` and `suite` are
// injectable so the tests do not need a corpus, a suite or a minute.
//
// Interface:
//   matches(pattern, file)                    glob-lite: * only
//   mergeOne(repo, lane, work, opts)          -> { id, ok, parked, problems, tip }
//   mergeRound(repo, opts)                    -> { ok, work, base, tip, merged,
//                                                parked, problems, suite }
//   land(repo, opts)                          -> { ok, why, tip }
//
// `lane` is a queue row: { id, lane, branch, files, proof }. `opts.laneRoot` is
// the directory lane worktrees live in; `opts.logDir` is $LOOP, where a parked
// lane's patch is written.
//
// The order inside mergeOne is deliberate:
//   1. rebase onto the integration branch
//   2. files gate against the queue row, before proving anything: a lane
//      outside its set is a dispatch failure, not a code failure
//   3. proof at base, with the lane's test files checked out, expecting failure
//   4. proof after the rebase, expecting success; a timeout is did-not-finish,
//      which is neither red nor green
//   5. fast-forward the integration branch
// Nothing is merged unless 1-4 pass, and nothing reaches main until 5 and the
// suite have.

import { execFileSync, spawnSync } from 'node:child_process'
import Fs from 'node:fs'
import Path from 'node:path'

let defaultTimeout, defaultBuffer

defaultTimeout = 15 * 60 * 1000
// The suite writes ~30,000 lines of debug; spawnSync's 1 MB default kills it
// with SIGTERM and reports ENOBUFS, which reads as a failing suite.
defaultBuffer = 64 * 1024 * 1024

function git
(repo, ...argv) {
  return execFileSync('git', argv, { cwd: repo, encoding: 'utf8' }).trimEnd()
}

function ok
(repo, ...argv) {
  try {
    git(repo, ...argv)
    return 1
  }
  catch {
    return 0
  }
}

function revParse
(repo, ref) {
  try {
    return git(repo, 'rev-parse', '--verify', '--quiet', ref)
  }
  catch {
    return 0
  }
}

function lines
(text) {
  return String(text || '').split('\n').filter(l => l.length > 0)
}

function diff
(repo, range) {
  try {
    return lines(git(repo, 'diff', '--name-only', range))
  }
  catch {
    return []
  }
}

// `js/wode*.mjs` in a queue row is a description of a file set, not a strict
// pattern, so `*` is the only thing that has to work.
export
function matches
(pattern, file) {
  let re

  re = pattern.split('*').map(p => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')
  return new RegExp('^' + re + '$').test(file)
}

export
function run
(command, cwd, opts) {
  let res, spawnOpts

  opts = opts || {}
  spawnOpts = { cwd,
                encoding: 'utf8',
                timeout: opts.timeoutMs || defaultTimeout,
                maxBuffer: opts.maxBuffer || defaultBuffer }
  res = spawnSync('bash', [ '-c', command ], spawnOpts)
  if (res.error && (res.error.code == 'ETIMEDOUT'))
    return { status: 124, out: 'timeout after ' + (opts.timeoutMs || defaultTimeout) + 'ms' }
  return { status: res.status == undefined ? 1 : res.status,
           out: (res.stdout || '') + (res.stderr || '') }
}

function exec
(opts) {
  return opts.exec || run
}

function fail
(res, why) {
  res.problems.push(why)
  res.fatal = 1
  return res
}

// The main checkout, even when `repo` is a linked worktree.
function primary
(repo) {
  let common

  try {
    common = git(repo, 'rev-parse', '--path-format=absolute', '--git-common-dir')
  }
  catch {
    return repo
  }
  return Path.dirname(common)
}

function exists
(p) {
  try {
    Fs.lstatSync(p)
    return 1
  }
  catch {
    return 0
  }
}

function link
(src, dst) {
  try {
    Fs.symlinkSync(src, dst, 'dir')
  }
  catch (e) {
    console.error('loop: ' + dst + ': cannot link: ' + e.message)
  }
}

// A fresh worktree has neither node_modules nor the generated parts of lib/
// (and ext/*/lib is generated whole). Without them `npx mocha` fails on module
// resolution, which the red gate would read as "red" and the suite as a broken
// round. lib/ is copied file by file, because its tracked sources are part of
// the lane's tree; the ignored directories are linked.
export
function provision
(repo, dir) {
  let nodeModules, lib, ext, names, i, source

  if (exists(dir) == 0)
    return
  // The generated files live in the primary checkout, not in whichever
  // worktree this was called from: `npm run check` and the suite can be run
  // from a lane, and a lane has no lib/ev-parser.mjs of its own.
  source = primary(repo)
  nodeModules = Path.join(dir, 'node_modules')
  if (exists(nodeModules) == 0)
    link(Path.join(source, 'node_modules'), nodeModules)

  lib = Path.join(source, 'lib')
  if (Fs.existsSync(lib))
    copyMissing(lib, Path.join(dir, 'lib'))

  ext = Path.join(source, 'ext')
  if (Fs.existsSync(ext) == 0)
    return

  names = Fs.readdirSync(ext)

  for (i = 0; i < names.length; i += 1) {
    let src, dst

    src = Path.join(ext, names[ i ], 'lib')
    dst = Path.join(dir, 'ext', names[ i ], 'lib')
    if (Fs.existsSync(src)) {
      // Copied, not linked: a linked ext/*/lib resolves its own relative
      // imports (`../../../../lib/@codemirror/state.js`) outside the worktree,
      // so the test and the extension get two copies of the module and
      // `instanceof` fails. Refreshed rather than filled, because these are
      // generated and a package update would otherwise leave them stale.
      Fs.rmSync(dst, { recursive: true, force: true })
      copyMissing(src, dst)
    }
  }
}

// Copy only what the worktree lacks: its own tracked files must stay its own.
// Recursive; existing files win, so a worktree's own tracked sources are never
// overwritten. Callers that own the whole directory remove it first.
function copyMissing
(src, dst) {
  let names, i

  Fs.mkdirSync(dst, { recursive: true })
  names = Fs.readdirSync(src)
  i = 0

  while (i < names.length) {
    let from, to

    from = Path.join(src, names[ i ])
    to = Path.join(dst, names[ i ])
    if (Fs.lstatSync(from).isDirectory())
      copyMissing(from, to)
    else if (exists(to) == 0)
      Fs.copyFileSync(from, to)
    i += 1
  }
}

function laneWorktree
(opts, lane) {
  return Path.join(opts.laneRoot, 'bred-' + lane.lane)
}

// Keep the work before the branch is renamed: a branch is durable, but a
// patch is what a human can read without knowing which branch to diff.
function park
(repo, lane, work, opts, res, why) {
  let wt, aborted, patch

  res.parked = 1
  res.problems.push(why)
  wt = laneWorktree(opts, lane)
  patch = Path.join(opts.logDir || repo, lane.id + '.patch')

  try {
    Fs.mkdirSync(Path.dirname(patch), { recursive: true })
    Fs.writeFileSync(patch, git(repo, 'diff', work + '..' + lane.branch) + '\n')
    res.problems.push('patch: ' + patch)
  }
  catch (e) {
    res.problems.push('could not write the patch: ' + e.message)
  }

  aborted = lane.branch + '-r' + (opts.round || 0) + '-aborted'

  try {
    git(repo, 'branch', '-m', lane.branch, aborted)
    res.problems.push('parked branch: ' + aborted)
    if (Fs.existsSync(wt) && cleanTree(wt))
      git(wt, 'checkout', '-b', lane.branch, work)
  }
  catch (e) {
    res.problems.push('could not park the branch: ' + e.message)
  }

  return res
}

function cleanTree
(wt) {
  try {
    return git(wt, 'status', '--porcelain', '--', '.', ':(exclude)node_modules', ':(exclude)ext/*/lib').length == 0
  }
  catch {
    return 0
  }
}

export
function mergeOne
(repo, lane, work, opts) {
  let res, wt, changed, outside, tip, rebase

  opts = opts || {}
  res = { id: lane.id, ok: 0, parked: 0, problems: [], notes: [], tip: 0 }
  wt = laneWorktree(opts, lane)

  if (revParse(repo, lane.branch) == 0)
    return fail(res, 'no branch ' + lane.branch)
  if (ok(repo, 'merge-base', '--is-ancestor', lane.branch, work)) {
    res.ok = 1
    res.tip = revParse(repo, lane.branch)
    return res
  }
  if (Fs.existsSync(wt) == 0)
    return fail(res, 'no worktree at ' + wt)

  rebase = exec(opts)('git rebase ' + work, wt, opts)
  if (rebase.status && rebase.out.includes('index.lock')) {
    exec(opts)('sleep 2', wt, opts)
    rebase = exec(opts)('git rebase ' + work, wt, opts)
  }
  if (rebase.status)
    return abortPark(repo, lane, work, wt, opts, res)

  changed = diff(repo, work + '..' + lane.branch)
  outside = changed.filter(f => lane.files.some(p => matches(p, f)) == 0)
  if (outside.length > 0)
    return park(repo, lane, work, opts, res, 'outside its file set: ' + outside.join(', '))
  res.notes.push('files: ' + changed.length + ' inside the set')

  if (noProof(lane) && (opts.allowNoProof == 0))
    return park(repo, lane, work, opts, res, 'no proof command (use --allow-no-proof to merge anyway)')
  if (noProof(lane))
    res.notes.push('no proof command: gates skipped')
  else if (proofGate(repo, lane, work, wt, opts, res) == 0)
    return res

  tip = revParse(repo, lane.branch)
  if (ok(repo, 'merge-base', '--is-ancestor', work, tip) == 0)
    return fail(res, 'not a fast-forward onto ' + work)
  git(repo, 'update-ref', 'refs/heads/' + work, tip, revParse(repo, work))
  res.ok = 1
  res.tip = tip
  return res
}

// The two proof gates. Returns 1 when the lane may merge; the caller returns
// the result it parked when this returns 0.
function proofGate
(repo, lane, work, wt, opts, res) {
  let red, green

  red = redGate(repo, lane, work, opts)
  if (red.status == 'green') {
    park(repo, lane, work, opts, res, 'the proof already passes at base: not red')
    return 0
  }
  if (red.status == 'hang') {
    park(repo, lane, work, opts, res, 'the proof did not finish at base')
    return 0
  }
  res.notes.push('red: ' + red.status)

  green = exec(opts)(lane.proof, wt, opts)
  if (green.status == 124) {
    park(repo, lane, work, opts, res, 'the proof did not finish after the rebase')
    return 0
  }
  if (green.status) {
    park(repo, lane, work, opts, res, 'the proof failed after the rebase: ' + tail(green.out))
    return 0
  }
  res.notes.push('green after rebase')
  return 1
}

function noProof
(lane) {
  return (lane.proof == undefined) || (lane.proof == '')
}

function abortPark
(repo, lane, work, wt, opts, res) {
  exec(opts)('git rebase --abort', wt, opts)
  return park(repo, lane, work, opts, res, 'rebase conflict')
}

function tail
(text, n) {
  return lines(text).slice(-(n || 3)).join(' / ')
}

// The red half of "red first": the lane's test files, checked out onto the
// base, must fail there. A proof that passes at base proves nothing, and one
// that hangs is not a red either.
function redGate
(repo, lane, work, opts) {
  let scratch, tests, res

  tests = diff(repo, work + '..' + lane.branch).filter(f => f.startsWith('test/'))
  if (tests.length == 0)
    return { status: 'no-test-file' }
  scratch = Path.join(opts.logDir || repo, 'verify-red')

  try {
    if (Fs.existsSync(scratch) == 0)
      git(repo, 'worktree', 'add', '--detach', scratch, work)
    else {
      git(scratch, 'checkout', '--detach', work)
      git(scratch, 'reset', '--hard', '--quiet', work)
    }
    provision(repo, scratch)
    for (let i = 0; i < tests.length; i += 1)
      git(scratch, 'checkout', lane.branch, '--', tests[ i ])
  }
  catch (e) {
    return { status: 'error: ' + e.message }
  }

  res = exec(opts)(lane.proof, scratch, opts)
  git(scratch, 'reset', '--hard', '--quiet', work)

  if (res.status == 124)
    return { status: 'hang' }
  return { status: res.status == 0 ? 'green' : 'red' }
}

export
function mergeRound
(repo, opts) {
  let res, base

  res = { ok: 0, work: opts.work, base: 0, tip: 0, merged: [], parked: [], problems: [], suite: 0 }
  base = revParse(repo, opts.base || 'main')
  res.base = base

  if (revParse(repo, opts.work))
    git(repo, 'branch', '-f', opts.work, base)
  else
    git(repo, 'branch', opts.work, base)

  res.notes = []
  opts.lanes.forEach(lane => mergeLane(res, repo, lane, opts))

  if (opts.suite && (res.merged.length > 0)) {
    res.suite = suiteAt(repo, opts.work, opts)
    if (res.suite.ok == 0)
      res.problems.push('suite failed at ' + res.suite.tip)
  }

  res.tip = revParse(repo, opts.work)
  // A park is recorded work, not a failed round: the lanes that merged can
  // still be measured, recorded and landed, exactly as round 15 did with two.
  res.ok = (res.merged.length > 0) && ((res.fatal || 0) == 0) ? 1 : 0
  return res
}

function mergeLane
(res, repo, lane, opts) {
  let one

  one = mergeOne(repo, lane, opts.work, opts)
  res.fatal = res.fatal || one.fatal
  res.problems = res.problems.concat(one.problems.map(p => one.id + ': ' + p))
  res.notes = res.notes.concat(one.notes.map(n => one.id + ': ' + n))
  if (one.ok)
    res.merged.push(one.id)
  else if (one.parked)
    res.parked.push(one.id)
}

// The suite runs in its own worktree at the integration tip, so the checkout
// the user is editing is never touched, and the numbers stay attributed to the
// tip they were measured on.
function suiteAt
(repo, work, opts) {
  let dir, tip, provisioned, suite, check, log

  tip = revParse(repo, work)
  dir = Path.join(opts.logDir || repo, 'verify-round')
  provisioned = 0

  try {
    if (Fs.existsSync(dir) == 0)
      git(repo, 'worktree', 'add', '--detach', dir, tip)
    else {
      git(dir, 'checkout', '--detach', tip)
      git(dir, 'reset', '--hard', '--quiet', tip)
    }
    provision(repo, dir)
    provisioned = 1
  }
  catch (e) {
    return { ok: 0, tip, why: 'verify worktree: ' + e.message }
  }

  suite = exec(opts)(opts.suite, dir, opts)
  check = exec(opts)(opts.check || 'npm run check', dir, opts)
  log = Path.join(opts.logDir || repo, 'round-' + (opts.round || 0) + '-suite.log')

  try {
    Fs.mkdirSync(Path.dirname(log), { recursive: true })
    Fs.writeFileSync(log, 'suite ' + suite.status + '\n' + suite.out + '\n\ncheck ' + check.status + '\n' + check.out + '\n')
  }
  catch (e) {
    log = 'could not write the suite log: ' + e.message
  }

  return { ok: (suite.status == 0) && (check.status == 0) ? 1 : 0,
           tip,
           provisioned,
           suite: suite.status,
           check: check.status,
           log,
           out: tail(suite.out, 15) }
}

// The one move that changes main. Refuses anything but a fast-forward, and
// retries the lock once, because a user or another agent may be mid-command in
// the same checkout.
// The record lands after the tip it verified, so the commits between them must
// be documentation only. Anything else is code that no suite passed.
function docOnly
(repo, range) {
  let commits, i

  commits = lines(git(repo, 'rev-list', range))
  i = 0

  while (i < commits.length) {
    let files

    files = lines(git(repo, 'show', '--name-only', '--format=', commits[ i ]))
    if (files.some(f => f.startsWith('doc/') == 0))
      return 0
    i += 1
  }

  return 1
}

export
function land
(repo, opts) {
  let work, tip, i, why

  work = opts.work
  tip = revParse(repo, work)

  if (tip == 0)
    return { ok: 0, why: 'no branch ' + work, tip: 0 }
  if (opts.verify && (ok(repo, 'merge-base', '--is-ancestor', opts.verify, tip) == 0))
    return { ok: 0, why: 'the verified tip ' + opts.verify + ' is not an ancestor of ' + work, tip }
  if (opts.verify && (docOnly(repo, opts.verify + '..' + tip) == 0))
    return { ok: 0, why: 'commits after the verified tip change more than doc/', tip }
  if (ok(repo, 'merge-base', '--is-ancestor', 'main', tip) == 0)
    return { ok: 0, why: 'main is not an ancestor of ' + work + ': rebase and verify again', tip }

  why = 'merge failed'
  i = 0

  while (i < 2) {
    i += 1
    try {
      why = git(repo, 'merge', '--ff-only', work) || 'fast-forwarded'
      return { ok: 1, why, tip: revParse(repo, 'main') }
    }
    catch (e) {
      why = e.message
    }
    // A user or another agent may hold the index for a moment.
    exec(opts)('sleep 2', repo, opts)
  }

  return { ok: 0, why, tip }
}
