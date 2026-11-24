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
import Os from 'node:os'
import Path from 'node:path'
import Url from 'node:url'

import * as Claims from './loop-claims.mjs'
import * as Queue from './loop-queue.mjs'

let root

root = git(Path.dirname(Url.fileURLToPath(import.meta.url)), 'rev-parse', '--show-toplevel')

let loopDir, args

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
  args = process.argv.slice(2)

  switch (args[ 0 ]) {
  case 'status':
    return status()
  case 'lanes-up':
    return lanesUp()
  case 'pick':
    return pickCmd()
  case 'claim':
    return claimCmd()
  case 'release':
    return releaseCmd()
  case 'reap':
    return reapCmd()
  case 'check':
    return checkCmd()
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
  console.log('usage: bin/loop.mjs [status|lanes-up|pick|claim|release|reap|check|help]')
  return 2
}

function option
(name) {
  let i

  i = args.indexOf(name)
  if (i < 0)
    return undefined
  return args[ i + 1 ]
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
  console.log('  pick        three disjoint items from doc/loop/queue.json, skipping')
  console.log('              dirty paths, hot files and overlaps; --n 2, --hot 0')
  console.log('  claim <id>  take an item (a lease with a pid, not a bare mkdir)')
  console.log('  release <id>, reap   give one back; reap the dead ones')
  console.log('  check       the queue against git: schema, ids, done hashes, trailers')
  console.log('')
  console.log('Lane worktrees live at $BRED_WORKTREE_ROOT/bred-a<n> on')
  console.log('agent/bred-<ws8>-a<n>. The run\'s scratch state is')
  console.log('$BRED_WORKTREE_ROOT/bred-loop.')
  console.log('')
  console.log('Not yet implemented: round (the merge), measure.')
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
  console.log('queue      ' + queueSummary())
  console.log('claims     ' + Claims.list(loopDir).length)
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

function queueFile
() {
  return Path.join(root, 'doc', 'loop', 'queue.json')
}

function loadQueue
() {
  return Queue.load(queueFile())
}

function queueSummary
() {
  let q, counts, i

  try {
    q = loadQueue()
  }
  catch {
    return 'missing ' + queueFile()
  }

  counts = {}
  i = 0

  while (i < q.items.length) {
    counts[ q.items[ i ].status ] = (counts[ q.items[ i ].status ] || 0) + 1
    i += 1
  }

  return 'ready ' + (counts.ready || 0) + ', next ' + (counts.next || 0) +
         ', triage ' + (counts.triage || 0) + ', in-round ' + (counts[ 'in-round' ] || 0) +
         ', done ' + (counts.done || 0)
}

function dirtyPaths
() {
  return lines(git(root, 'status', '--porcelain')).map(p => p.slice(3).split(' -> ').pop())
}

// A commit this loop made. Its files are not "hot": the rule exists for work
// somebody else may be in the middle of.
function isOurs
(rev) {
  return /^Loop-(item|round|verify): /m.test(git(root, 'log', '-1', '--format=%B', rev))
}

// `--hot 0` disables it. Until every lane commit carries a `Loop-item:`
// trailer, this loop's own recent commits look like somebody else's work, so
// the filter says everything is hot; the escape is honest about that.
function hotPaths
(minutes) {
  let out, blocks, i, files

  if (minutes <= 0)
    return []
  out = git(root, 'log', '--since=' + minutes + ' minutes ago', '--name-only', '--format=%x1e%h', 'main')
  blocks = out.split('\x1e').filter(b => b.trim().length > 0)
  files = []
  i = 0

  while (i < blocks.length) {
    let rev, names

    rev = lines(blocks[ i ])[ 0 ]
    names = lines(blocks[ i ]).slice(1)
    if (isOurs(rev) == 0)
      files = files.concat(names)
    i += 1
  }

  return files
}

function pickCmd
() {
  let res, n, minutes

  n = Number(option('--n') || 3)
  minutes = option('--hot')
  minutes = minutes == undefined ? 120 : Number(minutes)
  res = Queue.pick(loadQueue(), { n, dirty: dirtyPaths(), hot: hotPaths(minutes) })

  res.picked.forEach(item => console.log(item.id + '  ' + item.lane + '  ' + item.title.slice(0, 90)))
  if (res.picked.length == 0)
    console.log('nothing dispatchable')
  if (res.skipped.length == 0)
    return 0
  console.log('')
  res.skipped.forEach(s => console.log('skip  ' + s.id + '  ' + s.why))
  return 0
}

function claimCmd
() {
  let id, lane, branch, res

  id = args[ 1 ]
  if (id == undefined)
    return usage()
  lane = option('--lane') || 'a1'
  branch = option('--branch') || ('agent/bred-' + workspace() + '-' + lane)
  res = Claims.claim(loopDir, id, { lane, branch, pid: process.pid, host: Os.hostname() })

  if (res.ok == 0) {
    console.error('loop: cannot claim ' + id + ': ' + res.err)
    return 1
  }
  console.log('claimed  ' + id + '  ' + branch)
  return 0
}

function releaseCmd
() {
  let id

  id = args[ 1 ]
  if (id == undefined)
    return usage()
  Claims.release(loopDir, id)
  console.log('released ' + id)
  return 0
}

function reapCmd
() {
  let res, hours

  hours = Number(option('--max-age') || 6)
  res = Claims.reap(loopDir, { maxAgeMs: hours * 60 * 60 * 1000 })
  res.removed.forEach(c => console.log('reaped   ' + c.id + '  ' + (c.lane || '?')))
  console.log('reaped ' + res.removed.length + ', kept ' + res.kept.length)
  return 0
}

// The queue against git: its own schema, then whether each done hash exists
// and is on main, then whether a trailer names an item the queue still calls
// open. A pre-trailer round has no `Loop-item:`, so that is not a problem.
function checkHash
(item, problems) {
  if (ok(root, 'cat-file', '-e', item.doneHash) == 0)
    return problems.push(item.id + ': done:' + item.doneHash + ' does not exist')
  if (ok(root, 'merge-base', '--is-ancestor', item.doneHash, 'main') == 0)
    return problems.push(item.id + ': done:' + item.doneHash + ' is not on main')
}

function checkCmd
() {
  let q, problems, t, i

  q = loadQueue()
  problems = Queue.check(q)
  t = trailers()
  i = 0

  while (i < q.items.length) {
    let item

    item = q.items[ i ]
    if (item.status == 'done' && item.doneHash)
      checkHash(item, problems)
    else if (t.items.includes(item.id))
      problems.push(item.id + ': a Loop-item trailer exists but the queue says ' + item.status)
    i += 1
  }

  problems.forEach(p => console.log('problem  ' + p))
  console.log(problems.length + ' problem(s); ' + q.items.length + ' item(s)')
  return problems.length > 0 ? 1 : 0
}

process.exit(main())
