// Measurement for the loop: one record per verified tip, taken from the tools
// that already own the numbers, so no agent types a corpus count.
//
// Imported by bin/loop.mjs (the CLI) and test/loop-measure.mjs.
//
// Interface:
//   parseAudit(text) -> { pages, parsed, refused }
//   parseDiff(text)  -> { pages, words }        one section's report
//   run(repo, { sections, exec, tip }) -> record
//   load(file), append(file, record)            doc/loop/history.jsonl
//   format(record) -> the "Current state" block
//
// The suite result is not re-run here: the merge step already ran it at the
// same tip and hands it in. `run` shells out to bin/man-audit and
// bin/man-diff in the given worktree; `exec` is injectable so the tests do not
// read the corpus.
import { execFileSync } from 'node:child_process'
import Fs from 'node:fs'
import Path from 'node:path'

let defaultSections

defaultSections = [ '1', '3', '5', '7', '8' ]

function number
(text, pattern) {
  let match

  match = pattern.exec(text)
  return match == undefined ? undefined : Number(match[1])
}

export
function parseAudit
(text) {
  return { pages: number(text, /^\s*pages\s+(\d+)/m),
           parsed: number(text, /^\s*parsed\s+(\d+)/m),
           refused: number(text, /^\s*refused\s+(\d+)/m) }
}

export
function parseDiff
(text) {
  return { pages: number(text, /^\s*pages\s+(\d+)/m),
           words: number(text, /^\s*pages with missing words\s+\d+\s+\((\d+) words total\)/m) }
}

function runner
(repo) {
  return (cmd, args) => execFileSync(cmd, args, { cwd: repo,
                                                  encoding: 'utf8',
                                                  stdio: [ 'ignore', 'pipe', 'ignore' ] })
}

export
function run
(repo, opts) {
  let exec, sections, tip, corpus, sweep

  opts = opts || {}
  exec = opts.exec || runner(repo)
  sections = opts.sections || defaultSections
  tip = opts.tip || String(exec('git', [ 'rev-parse', 'HEAD' ])).trim()
  corpus = parseAudit(String(exec(Path.join(repo, 'bin', 'man-audit'), [ '--parse' ])))
  sweep = {}
  sections.forEach(section => {
                     sweep[section] = parseDiff(String(exec(Path.join(repo, 'bin', 'man-diff'),
                                                            [ '--section', section, '--max', '0' ])))
                   })
  return { ts: new Date().toISOString(), tip, corpus, sweep }
}

export
function load
(file) {
  let text

  try {
    text = Fs.readFileSync(file, 'utf8')
  }
  catch (err) {
    if (err.code == 'ENOENT')
      return []
    throw err
  }
  return text.split('\n').filter(line => line.trim().length)
    .map(line => JSON.parse(line))
}

// One record per tip: a re-run replaces its tip's record, and an identical
// re-run writes nothing, so `loop measure` twice is a no-op.
export
function append
(file, record) {
  let records, same, text

  records = load(file)
  same = records.find(entry => entry.tip == record.tip)
  if (same && JSON.stringify(same) == JSON.stringify(record))
    return 0
  records = records.filter(entry => entry.tip == record.tip ? 0 : 1)
  records.push(record)
  text = records.map(entry => JSON.stringify(entry)).join('\n') + '\n'
  Fs.mkdirSync(Path.dirname(file), { recursive: true })
  Fs.writeFileSync(file + '.tmp', text)
  Fs.renameSync(file + '.tmp', file)
  return 1
}

function summary
(section) {
  return section.pages + 'p/' + section.words + 'w'
}

export
function format
(record) {
  let sections, parts

  sections = Object.keys(record.sweep || {})
  parts = sections.map(section => section + ':' + summary(record.sweep[section]))
  return [ 'Measured at `' + record.tip + '`:',
           '  ' + record.corpus.parsed + ' parsed, ' + record.corpus.refused +
             ' refused of ' + record.corpus.pages + ' installed pages',
           '  sweep ' + parts.join('  ') ].join('\n')
}
