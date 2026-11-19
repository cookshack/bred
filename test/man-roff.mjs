import { equal } from 'node:assert/strict'
import * as Roff from '../js/man-roff.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function failNames
(scan) {
  return scan.fails.map(item => item.kind + ' ' + item.name)
}

function unresolvedNames
(scan) {
  return scan.unresolved.map(item => item.kind + ' ' + item.name)
}

tests = {}

test('scan', 'plain man page renders',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.SH NAME\nls \\- list files\n.PP\nMore text.\n')
       equal(scan.ok, 1)
       equal(scan.kind, 'man')
       equal(scan.fails.length, 0)
     })

test('scan', 'mdoc page is detected',
     () => {
       let scan

       scan = Roff.scan('.Dd January 1, 2024\n.Dt LS 1\n.Os\n.Sh NAME\n.Nm ls\n.Nd list files\n')
       equal(scan.kind, 'mdoc')
     })

test('scan', 'unknown macro fails with its line',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.SH NAME\n.wibble argument\n')
       equal(scan.ok, 0)
       equal(scan.fails.length, 1)
       equal(scan.fails[0].name, 'wibble')
       equal(scan.fails[0].cls, 'unknown')
       equal(scan.fails[0].line, 3)
     })

test('scan', 'macro defined in the page renders',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.de bP\n.IP \\(bu 4\n..\n.SH NAME\n.bP one\n.bP two\n')
       equal(scan.ok, 1)
     })

test('scan', 'defined macro used before its definition is unknown',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.bP one\n.de bP\n.IP \\(bu\n..\n')
       equal(scan.ok, 0)
       equal(failNames(scan).join(','), 'macro bP')
     })

test('scan', 'comment lines are ignored',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.\\" .wibble \\q \\!\n.SH NAME\n')
       equal(scan.ok, 1)
       equal(scan.counts.macros['wibble'], undefined)
     })

test('scan', 'mid-line comment is ignored',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.SH NAME\nsmooth \\- text \\" \\! \\q\n')
       equal(scan.ok, 1)
     })

test('scan', 'ignore block content is skipped',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.ig\n. manual comments \\q\n..\n.SH NAME\n')
       equal(scan.ok, 1)
       equal(scan.counts.macros.manual, undefined)
     })

test('scan', 'nested control characters after leading spaces still work',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.ie \\n(.g .ds Aq \\(aq\n.SH NAME\n\\*(Aqquoted\\*(Aq\n')
       equal(scan.ok, 1)
     })

test('scan', 'legacy no-break line with a dot name is ignored',
     () => {
       let scan

       scan = Roff.scan(".TH LS 1\n'.ft R\n.SH NAME\n")
       equal(scan.ok, 1)
     })

test('scan', 'brace suffixes on requests are stripped',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.if n \\{\\\n.br\\}\n.SH NAME\n')
       equal(scan.ok, 1)
     })

test('scan', 'tbl is supported',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.SH NAME\n.TS\ntab(;);\nl l.\na;b\n.TE\n')
       equal(scan.ok, 1)
     })

test('scan', 'mso is unsupported',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.mso www.tmac\n.SH NAME\n')
       equal(scan.ok, 0)
       equal(scan.fails[0].cls, 'unsupported')
     })

test('scan', 'known escapes render',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.SH NAME\n\\fBls\\fR \\- see \\(em and \\[alpha]\n')
       equal(scan.ok, 1)
     })

test('scan', 'metric escape is tolerated, not failed',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.SH NAME\na\\h\'-1p\'b\n')
       equal(scan.ok, 1)
       equal(scan.tolerated[0].name, 'h')
       equal(scan.tolerated[0].cls, 'metric')
     })

test('scan', 'unsupported escape fails',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.SH NAME\na\\!b\n')
       equal(scan.ok, 0)
       equal(failNames(scan).join(','), 'escape !')
     })

test('scan', 'unknown escape fails',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.SH NAME\na\\qb\n')
       equal(scan.ok, 0)
       equal(failNames(scan).join(','), 'escape q')
     })

test('scan', 'a dropped backslash keeps the character',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.SH NAME\nfile \\] a\n')
       equal(scan.ok, 1)
     })

test('scan', 'non-ascii after a backslash is literal',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.SH NAME\n\\能\n')
       equal(scan.ok, 1)
     })

test('scan', 'undefined string is unresolved',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.SH NAME\n\\*[NOPE]\n')
       equal(scan.ok, 0)
       equal(unresolvedNames(scan).join(','), 'string NOPE')
     })

test('scan', 'unknown register is unresolved',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.SH NAME\n\\n[nope]\n')
       equal(scan.ok, 0)
       equal(unresolvedNames(scan).join(','), 'register nope')
     })

test('scan', 'groff registers and strings are predefined',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.if \\n(.g .ds Aq \\(aq\n.SH NAME\n\\*(.T\n')
       equal(scan.ok, 1)
     })

test('scan', 'auto-increment register name skips the sign',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.SH NAME\n\\n+X\n')
       equal(scan.unresolved[0].name, 'X')
     })

test('scan', 'a page that is only an include is detected',
     () => {
       let scan

       scan = Roff.scan('.so man1/systemd.1\n')
       equal(scan.kind, 'include')
       equal(scan.include, 'man1/systemd.1')
     })

test('scan', 'include with a body is a normal page',
     () => {
       let scan

       scan = Roff.scan('.TH LS 1\n.so man1/other.1\n.SH NAME\n')
       equal(scan.kind, 'man')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
