import { equal } from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// A loop land already ran check and the full suite at the recorded tip, and
// `land` proved that only doc/ follows it. The post-merge hook stamps that tree
// instead of running the same two commands twice; anything else (a code change
// after the tip, a merge without the trailer, a dirty tree) keeps the full
// verify. The stamp is what the user's push later trusts, so it is tested
// against a real repository and a real ff-merge.

let tests, root

tests = {}
root = join(dirname(fileURLToPath(import.meta.url)), '..')

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function git
(dir, args) {
  let res

  res = spawnSync('git', args, { cwd: dir, encoding: 'utf8' })
  equal(res.status, 0, 'git ' + args.join(' ') + ': ' + res.stderr)
  return res.stdout.trim()
}

// A repository with the hook and the gate committed, so `git reflog` sees a
// merge and the gate is executable.
function scratch
() {
  let dir

  dir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'bred-stamp-'))
  git(dir, [ 'init', '-q', '-b', 'main' ])
  git(dir, [ 'config', 'user.email', 'stamp@test' ])
  git(dir, [ 'config', 'user.name', 'stamp test' ])
  git(dir, [ 'config', 'commit.gpgsign', 'false' ])
  Fs.writeFileSync(join(dir, '.gitignore'), '.pre-push.log\n.pre-push.stamp\n')
  Fs.writeFileSync(join(dir, 'a.txt'), 'a\n')
  Fs.mkdirSync(join(dir, 'doc'))
  Fs.writeFileSync(join(dir, 'doc', 'note.md'), 'note\n')
  Fs.mkdirSync(join(dir, 'bin'))
  Fs.mkdirSync(join(dir, '.husky'))
  Fs.copyFileSync(join(root, 'bin', 'pre-push-check'), join(dir, 'bin', 'pre-push-check'))
  Fs.copyFileSync(join(root, '.husky', 'post-merge'), join(dir, '.husky', 'post-merge'))
  Fs.chmodSync(join(dir, 'bin', 'pre-push-check'), 0o755)
  git(dir, [ 'add', '-A' ])
  git(dir, [ 'commit', '-qm', 'init' ])
  return dir
}

function hook
(dir) {
  return spawnSync('sh', [ join(dir, '.husky', 'post-merge') ], { cwd: dir, encoding: 'utf8' })
}

// One code commit, then a doc record that names it as the verified tip.
function encodeTip
(wt) {
  let tip

  Fs.writeFileSync(join(wt, 'a.txt'), 'changed\n')
  git(wt, [ 'add', 'a.txt' ])
  git(wt, [ 'commit', '-qm', 'code: the change' ])
  tip = git(wt, [ 'rev-parse', 'HEAD' ])
  Fs.appendFileSync(join(wt, 'doc', 'note.md'), 'more\n')
  git(wt, [ 'add', 'doc/note.md' ])
  git(wt, [ 'commit', '-qm', 'doc: the record', '-m', 'Loop-round: 1', '-m', 'Loop-verify: ' + tip ])
  return tip
}

function stampsLoopLand
() {
  let dir, wt

  dir = scratch()
  try {
    let res

    wt = dir + '-wt'
    git(dir, [ 'worktree', 'add', '-q', wt, '-b', 'agent/test' ])
    encodeTip(wt)
    git(dir, [ 'merge', '-q', '--ff-only', 'agent/test' ])
    res = hook(dir)
    equal(res.status, 0, res.stderr)
    equal(Fs.existsSync(join(dir, '.pre-push.stamp')), true)
    equal(res.stdout.includes('stamped'), true)

    // The user's push later runs the gate: the tree is already verified.
    res = spawnSync(join(dir, 'bin', 'pre-push-check'), [ '--full', '--quiet' ],
                    { cwd: dir, encoding: 'utf8' })
    equal(res.status, 0, res.stderr)
    equal(res.stdout.includes('tree already verified'), true)
  }
  finally {
    Fs.rmSync(dir, { recursive: true, force: true })
    Fs.rmSync(wt, { recursive: true, force: true })
  }
}

// A commit after the verified tip that touches code is not covered by the
// round's suite, so the hook must not stamp it.
function runsFullAfterCode
() {
  let dir, wt

  dir = scratch()
  try {
    let res, tip

    wt = dir + '-bad'
    git(dir, [ 'worktree', 'add', '-q', wt, '-b', 'agent/bad' ])
    tip = encodeTip(wt)
    Fs.appendFileSync(join(wt, 'a.txt'), 'later\n')
    Fs.appendFileSync(join(wt, 'doc', 'note.md'), 'later\n')
    git(wt, [ 'add', '-A' ])
    git(wt, [ 'commit', '-qm', 'later', '-m', 'Loop-verify: ' + tip ])
    git(dir, [ 'merge', '-q', '--ff-only', 'agent/bad' ])
    res = hook(dir)
    equal(res.stdout.includes('running full checks'), true)
    equal(Fs.existsSync(join(dir, '.pre-push.stamp')), false)
  }
  finally {
    Fs.rmSync(dir, { recursive: true, force: true })
    Fs.rmSync(wt, { recursive: true, force: true })
  }
}

test('land stamp', 'a loop land stamps the tree the round verified', stampsLoopLand)
test('land stamp', 'a code change after the tip still runs the full verify', runsFullAfterCode)

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
