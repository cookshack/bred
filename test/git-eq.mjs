import { equal } from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parsePatch } from '../lib/diff.js'

let tests

tests = {}

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

let eqPath

eqPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'git-eq')

function git
(dir, args) {
  let res

  res = spawnSync('git', args, { cwd: dir, encoding: 'utf8' })
  equal(res.status, 0, 'git ' + args.join(' ') + ': ' + res.stderr)
  return res.stdout
}

function repo
() {
  let tmp

  tmp = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'bred-git-eq-'))
  git(tmp, [ 'init', '-q', '.' ])
  git(tmp, [ 'config', 'user.email', 'a@b' ])
  git(tmp, [ 'config', 'user.name', 'a' ])
  Fs.writeFileSync(Path.join(tmp, 'a.txt'), 'one\n')
  git(tmp, [ 'add', '.' ])
  git(tmp, [ 'commit', '-qm', 'one' ])
  Fs.writeFileSync(Path.join(tmp, 'a.txt'), 'one\ntwo\n')
  Fs.writeFileSync(Path.join(tmp, 'small.txt'), 'small untracked\n')
  // bigger than bin/git-eq's untracked limit
  Fs.writeFileSync(Path.join(tmp, 'big.log'), ('x'.repeat(90) + '\n').repeat(14000))
  return tmp
}

function run
(dir, env) {
  let res

  res = spawnSync(eqPath, [], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } })
  equal(res.status, 0, 'git-eq: ' + res.stderr)
  return res.stdout
}

test('git-eq', 'skips an oversized untracked file and keeps the rest',
     () => {
       let tmp

       tmp = repo()
       try {
         let out, entries

         out = run(tmp, {})
         equal(out.includes('small untracked'), true)
         equal(out.includes('+two'), true)
         equal(out.includes('big.log'), true, 'the skip note names the file')
         equal(out.includes('not showing 1 untracked file'), true)
         equal(out.includes('x'.repeat(50)), false, 'the big file is not diffed')
         entries = parsePatch(out).map(e => e.oldFileName)
         equal(entries.includes('a.txt'), true)
         equal(entries.includes('/dev/null'), true)
       }
       finally {
         Fs.rmSync(tmp, { recursive: true, force: true })
       }
     })

test('git-eq', 'caps the diff at a readable size',
     () => {
       let tmp

       tmp = repo()
       try {
         let out

         out = run(tmp, { BRED_DIFF_CAP: '60' })
         equal(out.includes('diff --git a/(diff truncated)'), true)
         equal(out.includes('small untracked'), false)
         equal(parsePatch(out).length > 0, true)
       }
       finally {
         Fs.rmSync(tmp, { recursive: true, force: true })
       }
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
