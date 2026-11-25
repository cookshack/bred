#!/usr/bin/env node

// The editor core's measure: coverage of its modules over the core tests, and a
// bounded flake count on the timing-sensitive files. Prints one JSON record on
// stdout and nothing else, so `bin/loop.mjs measure --area core` can store it.
//
//   bin/core-measure.mjs [--runs 3] [--workers 2] [--no-coverage] [--no-flake]
//
// Coverage is a floor and an alarm, never a target: an item may not be filed on
// a coverage gap alone (the red gate refuses it anyway). Flake is the other
// number the plan gives this area, and the p50 lesson is that a flake hunt must
// state its load: runs, workers and a per-run timeout are printed with the
// result, and workers default to at most nproc-2.

import { execFileSync, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'
import Url from 'node:url'

let root, modules, tests, flaky

root = Path.dirname(Path.dirname(Url.fileURLToPath(import.meta.url)))

// The model, not the app: no DOM, no IPC, no man page. A file that reads or
// renders belongs to another area's measure.
modules = [ 'js/Buf.mjs', 'js/buf.mjs', 'js/view.mjs', 'js/pane.mjs', 'js/Pane.mjs',
            'js/frame.mjs', 'js/area.mjs', 'js/Area.mjs', 'js/em.mjs', 'js/Em.mjs',
            'js/mode.mjs', 'js/cmd.mjs', 'js/hist.mjs', 'js/point.mjs', 'js/pos.mjs',
            'js/scroll.mjs', 'js/save.mjs', 'js/loc.mjs' ]

tests = 'the fast suite (e2e excluded)'

flaky = [ 'test/wode-view-e2e.mjs', 'test/indent.mjs' ]

function pct
(part) {
  if ((part == undefined) || (part.total == 0))
    return 0
  return Math.round((part.covered / part.total) * 1000) / 10
}

// `coverage/coverage-summary.json` has one entry per file plus a `total`. Only
// the core modules count here, and their counts are summed rather than their
// percentages averaged, so a small file cannot weigh the same as a large one.
export
function summarise
(summary, wanted) {
  let files, counts, names

  files = {}
  counts = { lines: { covered: 0, total: 0 }, branches: { covered: 0, total: 0 } }
  names = Object.keys(summary)

  for (let i = 0; i < names.length; i += 1) {
    let name, hit, entry

    name = names[ i ]
    if (name == 'total')
      continue
    hit = wanted.filter(w => name.endsWith(w))
    if (hit.length == 0)
      continue
    entry = summary[ name ]
    files[ hit[ 0 ] ] = { lines: pct(entry.lines), branches: pct(entry.branches) }
    counts.lines.covered += entry.lines.covered
    counts.lines.total += entry.lines.total
    counts.branches.covered += entry.branches.covered
    counts.branches.total += entry.branches.total
  }

  return { files,
           total: { lines: pct(counts.lines), branches: pct(counts.branches) },
           modules: Object.keys(files).length,
           missing: wanted.filter(w => files[ w ] == undefined) }
}

export
function countFlake
(results) {
  let failures

  failures = results.filter(r => r.ok == 0)

  return { runs: results.length, failures: failures.length, timeouts: failures.filter(r => r.timeout).length }
}

function coverage
() {
  let file, summary

  file = Path.join(root, 'coverage', 'coverage-summary.json')
  // The fast suite, not a subset: several test files depend on the global init
  // another file performs, so a hand-picked subset runs in a different order
  // and fails. The e2e files are left out because they fail under c8's overhead
  // (p50's flake) and none of the core modules is covered by them.
  process.stderr.write('core-measure: c8 over the fast suite\n')
  execFileSync('npx', [ 'c8', '--reporter=json-summary', '--reporter=text-summary',
                        'mocha', '--exit', '--ignore', 'test/*e2e*.mjs' ],
               { cwd: root, stdio: [ 'ignore', 'ignore', 'inherit' ] })
  summary = JSON.parse(Fs.readFileSync(file, 'utf8'))

  return summarise(summary, modules)
}

// Each file runs N times, in batches of `workers`, from one bash loop: a flake
// hunt needs CPU contention (p50) but the load has to be stated and capped, so
// runs and workers are printed with the count.
function flakeBatch
(file, runs, workers, timeoutMs) {
  let script, res, lines, failures, timeouts

  script = 'for i in $(seq 1 ' + runs + '); do' +
           ' ( npx mocha --exit ' + file + ' >/dev/null 2>&1 && echo OK || echo FAIL ) &' +
           ' if (( i % ' + workers + ' == 0 )); then wait; fi; done; wait'

  res = spawnSync('bash', [ '-c', script ], { cwd: root, encoding: 'utf8', timeout: timeoutMs })
  lines = String(res.stdout || '').split('\n').filter(l => l.length > 0)
  failures = lines.filter(l => l == 'FAIL').length
  timeouts = res.status == undefined ? 1 : 0

  return { file, runs, failures, timeouts }
}

function flakeCount
(runs, workers, timeoutMs) {
  let files, i

  files = []
  i = 0

  while (i < flaky.length) {
    process.stderr.write('core-measure: ' + flaky[ i ] + ' x ' + runs + ', ' + workers + ' at a time\n')
    files.push(flakeBatch(flaky[ i ], runs, workers, timeoutMs))
    i += 1
  }

  return { runs: runs * flaky.length,
           workers,
           timeoutMs,
           files,
           failures: files.reduce((sum, f) => sum + f.failures, 0),
           timeouts: files.reduce((sum, f) => sum + f.timeouts, 0) }
}

function options
(argv) {
  let opts

  opts = {}
  opts.runs = 3
  opts.workers = Math.max(1, Math.min(4, Os.cpus().length - 2))
  opts.coverage = 1
  opts.flake = 1
  opts.timeoutMin = 3

  if (argv.includes('--runs'))
    opts.runs = Number(argv[ argv.indexOf('--runs') + 1 ]) || opts.runs
  if (argv.includes('--workers'))
    opts.workers = Number(argv[ argv.indexOf('--workers') + 1 ]) || opts.workers
  if (argv.includes('--timeout-min'))
    opts.timeoutMin = Number(argv[ argv.indexOf('--timeout-min') + 1 ]) || opts.timeoutMin
  if (argv.includes('--no-coverage'))
    opts.coverage = 0
  if (argv.includes('--no-flake'))
    opts.flake = 0

  return opts
}

function main
(argv) {
  let opts, record

  opts = options(argv)
  record = {}
  record.ts = new Date().toISOString()
  record.area = 'core'
  record.tip = execFileSync('git', [ 'rev-parse', 'HEAD' ], { cwd: root, encoding: 'utf8' }).trim()
  record.modules = modules
  record.tests = tests

  if (opts.coverage)
    record.coverage = coverage()
  if (opts.flake)
    record.flake = flakeCount(opts.runs, opts.workers, opts.timeoutMin * 60000)

  console.log(JSON.stringify(record))
  return 0
}

// Only when it is the entry point: the tests import the pure half.
if (process.argv[ 1 ] && (pathToFileURL(process.argv[ 1 ]).href == import.meta.url))
  process.exit(main(process.argv.slice(2)))
