#!/usr/bin/env node

// The unattended loop's tool. One entry point for the mechanical half of
// doc/Loop.md; the agent keeps the judgement (briefs, diagnosis, the prose of
// the record).
//
//   bin/loop.mjs status            what is running, what is next, from disk
//   bin/loop.mjs lanes-up          bring the lane worktrees to main
//   bin/loop.mjs help
//
// Two halves are owned separately, and this file only calls them, so two
// agents never edit one file:
//
//   bin/loop-queue.mjs   load(), save(), ready(), report(), check()
//   bin/loop-claims.mjs  claim(), release(), reap(), live()
//
// Neither exists yet. `status` and `lanes-up` do not need them.
//
// Everything is derived from git where git can answer. A resumed agent should
// not have to trust a paragraph written by a dead one: `status` prints the
// trailers, the last verified tip, the parked branches and the lane worktrees,
// and says plainly whether main is ahead of the record.

import { execFileSync } from 'node:child_process'
import Fs from 'node:fs'
import Path from 'node:path'
import Url from 'node:url'

let root

root = git(Path.dirname(Url.fileURLToPath(import.meta.url)), 'rev-parse', '--show-toplevel')

let loopDir

loopDir = Path.join(process.env.BRED_WORKTREE_ROOT || Path.join(root, '..'), 'bred-loop')

function git
(repo, ...argv) {
  return execFileSync('git', argv, { cwd: repo, encoding: 'utf8' }).trimEnd()
}

function tryGit
(repo, ...argv) {
  try {
    return git(repo, ...argv)
  }
  catch {
    return 0
  }
}

// git's exit status, as a boolean. `tryGit(...) == 0` cannot be used for this:
// success trims to the empty string, which is loosely equal to 0 as well.
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

// existsSync follows a symlink, so a dangling node_modules link reads as
// missing and gets re-created on every run.
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

function lines
(text) {
  return String(text || '').split('\n').filter(l => l.length > 0)
}

function main
() {
  let args

  args = process.argv.slice(2)

  switch (args[ 0 ]) {
  case 'status':
    return status()
  case 'lanes-up':
    return lanesUp()
  case undefined:
  case 'help':
  case '--help':
  case '-h':
    return help()
  default:
    console.error('loop: unknown command "' + args[ 0 ] + '"')
    return usage()
  }
}

function usage
() {
  console.log('usage: bin/loop.mjs [status|lanes-up|help]')
  return 2
}

function help
() {
  console.log('')
  console.log('bin/loop.mjs — the unattended loop\'s mechanical half')
  console.log('')
  console.log('  status      the tip, the record\'s tip, the trailers, the parked')
  console.log('              branches, the lane worktrees, and the dirty paths')
  console.log('  lanes-up    bring bred-a1..a3 to main; never resets a branch with')
  console.log('              unmerged commits; provisions node_modules and ext/*/lib')
  console.log('')
  console.log('Lane worktrees live at $BRED_WORKTREE_ROOT/bred-a<n> on')
  console.log('agent/bred-<ws8>-a<n>. The run\'s scratch state is')
  console.log('$BRED_WORKTREE_ROOT/bred-loop.')
  console.log('')
  console.log('Not yet implemented (they need loop-queue.mjs and loop-claims.mjs):')
  console.log('claim, release, reap, pick, round, measure.')
  return 0
}

function workspace
() {
  let ws

  ws = process.env.BRED_WORKSPACE || ''
  return ws.slice(0, 8) || 'local'
}

function laneRoot
() {
  return process.env.BRED_WORKTREE_ROOT || Path.join(root, '..')
}

// A round record carries `Loop-verify: <tip>`; a lane commit carries
// `Loop-item: <id>` and the loop's own commits `Loop-round: <n>`. `record` is
// the commit that carries the trailer, which is what "since the last record"
// has to count from: the record lands after the tip it verified.
function trailers
() {
  let out, blocks, i, t

  out = git(root, 'log', '-n', '80', '--format=%h%x1f%B%x1e', 'main')
  blocks = out.split('\x1e').filter(b => b.trim().length > 0)
  t = { record: 0, verified: 0, items: [], rounds: [] }
  i = 0

  while (i < blocks.length) {
    let hdr, body, m

    hdr = blocks[ i ].split('\x1f')[ 0 ].trim()
    body = blocks[ i ].split('\x1f').slice(1).join('\x1f')
    m = body.match(/^Loop-verify: ([0-9a-f]+)$/m)

    if (m && (t.record == 0)) {
      t.record = hdr
      t.verified = m[ 1 ]
    }

    t.items = t.items.concat(pick(body, 'Loop-item: '))
    t.rounds = t.rounds.concat(pick(body, 'Loop-round: '))
    i += 1
  }

  return t
}

// The lines of `body` that start with `tag`, with the tag removed.
function pick
(body, tag) {
  return (body.match(new RegExp('^' + tag + '.+$', 'gm')) || []).map(l => l.replace(tag, ''))
}

function branches
(pattern) {
  let out

  out = lines(tryGit(root, 'branch', '--list', pattern, '--format=%(refname:short)'))
  return out
}

function worktreePaths
() {
  let out

  out = lines(tryGit(root, 'worktree', 'list', '--porcelain'))
  out = out.filter(l => l.startsWith('worktree ')).map(l => l.slice(9))
  return out
}

// A worktree registration whose directory is gone. It blocks nothing except a
// `worktree add` on the same path, and it litters a long run.
function staleWorktrees
() {
  return worktreePaths().filter(p => Fs.existsSync(p) == 0)
}

function laneWorktrees
() {
  return worktreePaths().filter(p => (/bred-a[0-9]+$/.test(p)) && Fs.existsSync(p))
}

function status
() {
  let t, commit, ahead, parked, lanes, stale, dirty

  t = trailers()
  commit = git(root, 'log', '-1', '--format=%h %s', 'main')
  ahead = t.record ? Number(git(root, 'rev-list', '--count', t.record + '..main')) : -1
  parked = branches('*-r*-aborted')
  lanes = laneWorktrees()
  stale = staleWorktrees()
  dirty = git(root, 'status', '--porcelain')

  console.log('root       ' + root)
  console.log('main       ' + commit)
  if (ahead == -1)
    console.log('verified   none  (no Loop-verify trailer in the last 80 commits)')
  else
    console.log('verified   ' + t.verified + '  (' + ahead + ' commit(s) since the last record)')
  console.log('state      ' + (Fs.existsSync(loopDir) ? loopDir : loopDir + '  (missing)'))
  console.log('lanes      ' + (lanes.length > 0 ? '' : 'none'))
  lanes.forEach(p => console.log('           ' + p + '  ' + tryGit(p, 'log', '-1', '--format=%h %s')))
  console.log('stale      ' + stale.length + ' prunable registration(s)')
  console.log('parked     ' + (parked.length > 0 ? '' : 'none'))
  parked.forEach(b => console.log('           ' + b))
  if (t.items.length > 0)
    console.log('items      ' + t.items.join(' '))
  if (t.rounds.length > 0)
    console.log('rounds     ' + t.rounds.join(' '))
  console.log('dirty      ' + (dirty.length > 0 ? 'yes (uncommitted work; outside claims)' : 'no'))

  if (ahead > 0)
    console.log('\nwarning: main is ' + ahead + ' commit(s) ahead of the last verified tip.')
  if (ahead > 0)
    console.log('If that is a round, it was merged without a record: doc/Loop.md,')
  if (ahead > 0)
    console.log('"Working on a moving main".')

  return 0
}

// Never reset a branch with unmerged commits: a `reset --hard main` on a
// parked or in-flight lane silently discards its commit, which is the exact
// mistake the park-not-reset rule exists for.
function lanesUp
() {
  let tip, n

  git(root, 'worktree', 'prune')
  tip = git(root, 'rev-parse', 'main')
  n = 0

  while (n < 3) {
    let wt, br, known

    n += 1
    wt = Path.join(laneRoot(), 'bred-a' + n)
    br = 'agent/bred-' + workspace() + '-a' + n
    known = revParse(root, br)

    if (known == 0)
      git(root, 'worktree', 'add', '-b', br, wt, 'main')
    else if (laneWorktrees().includes(wt) == 0)
      git(root, 'worktree', 'add', wt, br)

    bringUp(wt, br, known, n)
    provision(wt)
    console.log('a' + n + '  ' + tryGit(wt, 'log', '-1', '--format=%h %s'))
  }

  console.log('')
  console.log('main is ' + tip + '; a lane behind it is rebased by the round step.')
  return 0
}

// Clean means no output, not exit status: `git status` succeeds either way.
// The provisioning links are excluded, since a dangling link is not work.
function cleanTree
(wt) {
  try {
    return git(wt, 'status', '--porcelain', '--', '.', ':(exclude)node_modules', ':(exclude)ext/*/lib').length == 0
  }
  catch {
    return 0
  }
}

// Reset to main only when that cannot lose a commit: the branch must already
// be an ancestor of main, and the tree must be clean.
function bringUp
(wt, br, known, lane) {
  let merged, clean

  if (known == 0)
    return
  merged = ok(root, 'merge-base', '--is-ancestor', br, 'main')
  clean = cleanTree(wt)

  if (merged && clean)
    return git(wt, 'reset', '--hard', '--quiet', 'main')
  if (merged)
    return console.log('a' + lane + '  kept     ' + br + '  (dirty tree; not reset)')
  console.log('a' + lane + '  kept     ' + br + '  (unmerged commits; not reset)')
}

// A lane worktree has no node_modules and no generated ext/*/lib; the tests
// cannot run without them. Link rather than copy, so a lane and the checkout
// always agree.
function provision
(wt) {
  let nodeModules, ext, names, i

  nodeModules = Path.join(wt, 'node_modules')

  if (exists(wt) == 0)
    return
  if (exists(nodeModules) == 0)
    link(Path.join(root, 'node_modules'), nodeModules)

  ext = Path.join(root, 'ext')
  if (Fs.existsSync(ext) == 0)
    return

  names = Fs.readdirSync(ext)

  for (i = 0; i < names.length; i += 1) {
    let src, dst

    src = Path.join(ext, names[ i ], 'lib')
    dst = Path.join(wt, 'ext', names[ i ], 'lib')
    if (Fs.existsSync(src) && exists(dst) == 0) {
      Fs.mkdirSync(Path.dirname(dst), { recursive: true })
      link(src, dst)
    }
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

process.exit(main())
