import { deepEqual, equal } from 'node:assert/strict'
import Fs from 'node:fs'
import Os from 'node:os'
import Path from 'node:path'

import * as Measure from '../bin/loop-measure.mjs'

let tests, auditText, diffText

tests = {}

auditText = `
man-audit /usr/share/man  (parse)

  pages    4150   (man 4067, mdoc 83, includes 0)
  parsed   4123  (99.3%)
  refused  27
`

diffText = `
man-diff

  pages     959
  compared  955  (refused 4, too small 0)
  pages with missing words  3  (14 words total)
`

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

test('measure', 'parses the audit summary',
     () => {
       deepEqual(Measure.parseAudit(auditText), { pages: 4150, parsed: 4123, refused: 27 })
     })

test('measure', 'parses one section report',
     () => {
       deepEqual(Measure.parseDiff(diffText), { pages: 959, words: 14 })
     })

test('measure', 'run asks for the given sections and keeps the tip',
     () => {
       let calls, exec, record

       calls = []
       exec = (cmd, args) => {
                calls.push({ cmd, args })
                if (args[0] == 'rev-parse')
                  return 'abc123\n'
                if (cmd.endsWith('man-audit'))
                  return auditText
                return diffText
              }
       record = Measure.run('/repo', { exec, sections: [ '3' ] })
       equal(record.tip, 'abc123')
       deepEqual(record.corpus, { pages: 4150, parsed: 4123, refused: 27 })
       deepEqual(record.sweep, { '3': { pages: 959, words: 14 } })
       deepEqual(calls.map(call => call.args[0]), [ 'rev-parse', '--parse', '--section' ])
     })

test('measure', 'append is idempotent per tip and replaces a changed record',
     () => {
       let root, file, record, changed

       root = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'bred-loop-measure-'))
       file = Path.join(root, 'history.jsonl')
       record = { ts: '2026-11-24T00:00:00Z', tip: 'abc123', corpus: { pages: 1, parsed: 1, refused: 0 }, sweep: { '3': { pages: 1, words: 0 } } }
       equal(Measure.append(file, record), 1)
       equal(Measure.append(file, record), 0)
       changed = { ts: '2026-11-24T00:01:00Z', tip: 'abc123', corpus: { pages: 1, parsed: 1, refused: 0 }, sweep: { '3': { pages: 1, words: 2 } } }
       equal(Measure.append(file, changed), 1)
       equal(Measure.load(file).length, 1)
       deepEqual(Measure.load(file)[0].sweep['3'], { pages: 1, words: 2 })
       Fs.rmSync(root, { recursive: true, force: true })
     })

test('measure', 'format names the tip, the population and each section',
     () => {
       let text

       text = Measure.format({ tip: 'abc123', corpus: { pages: 4150, parsed: 4123, refused: 27 }, sweep: { '1': { pages: 16, words: 147 }, '3': { pages: 0, words: 0 } } })
       equal(text.includes('`abc123`'), true)
       equal(text.includes('4123 parsed, 27 refused of 4150 installed pages'), true)
       equal(text.includes('1:16p/147w'), true)
       equal(text.includes('3:0p/0w'), true)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
