import { equal } from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import Fs from 'node:fs'
import Url from 'node:url'

import { keyOf } from '../bin/man-diff'

// keyOf is the comparison key man-diff uses, not the text it reports: a page's
// own typography must not make two spellings of the same word differ.
let tests

tests = {}

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

// The pages the fold and the join were measured on. A page test reads man(1)'s
// own output, so it needs both the page and man(1): skip where either is
// missing, and return undefined so the test can tell.
function lostOn
(file) {
  let tool

  if (Fs.existsSync(file) == 0)
    return undefined
  if (haveMan() == 0)
    return undefined
  tool = Url.fileURLToPath(new URL('../bin/man-diff', import.meta.url))
  return Number(/^lost\s+(\d+)/m.exec(execFileSync(process.execPath,
                                                   [ tool, '--page', file ],
                                                   { encoding: 'utf8' }))[1])
}

function haveMan
() {
  return spawnSync('man', [ '--version' ], { stdio: 'ignore' }).error == undefined
}

test('man-diff', 'trailing sentence punctuation is left out of the key',
     () => {
       equal(keyOf('foo.'), 'foo')
       equal(keyOf('foo;'), 'foo')
       equal(keyOf('foo.,'), 'foo')
     })

test('man-diff', 'a punctuation-only token has an empty key',
     () => {
       equal(keyOf('.'), '')
       equal(keyOf('...'), '')
     })

// A token that is only double quotes is punctuation too: mendex(1)'s value
// `"\t\t"` reaches the comparison as either `""` or `"` `"`, since groff's
// zero-width `\t` collapses the pair while our text keeps the tabs as a break.
test('man-diff', 'a quote-only token has an empty key',
     () => {
       equal(keyOf('"'), '')
       equal(keyOf('""'), '')
     })

test('man-diff', 'a typographic hyphen folds to ASCII in the key',
     () => {
       equal(keyOf('8\u2010bit'), '8-bit')
       equal(keyOf('8\u2011bit'), '8-bit')
       equal(keyOf('8\u2212bit'), '8-bit')
     })

test('man-diff', 'a page banner hyphen folds too',
     () => {
       // pcre2demo(3) prints its `// - ...` banner as `// \u2010 ...`.
       equal(keyOf('\u2010'), '-')
       equal(keyOf('\u2212'), '-')
     })

test('man-diff', 'the fold happens before the punctuation strip',
     () => {
       equal(keyOf('8\u2010bit.'), '8-bit')
     })

test('man-diff', 'an ASCII hyphen is already its own key',
     () => {
       equal(keyOf('8-bit'), '8-bit')
       equal(keyOf('-Wall'), '-Wall')
     })

test('man-diff', 'a typographic quote folds to the ASCII it came from',
     () => {
       // groff's default utf8 mapping: a backtick prints U+2018, `'` U+2019.
       equal(keyOf('\u2018pkg-config'), '`pkg-config')
       equal(keyOf('Perl\u2019s'), "Perl's")
       equal(keyOf('\u201cfoo\u201d'), '"foo"')
     })

test('man-diff', 'the quote fold happens before the punctuation strip',
     () => {
       // The apostrophe is part of the word, not a trailing sentence mark.
       equal(keyOf('wasn\u2019t.'), "wasn't")
     })

test('man-diff', 'pcre2demo(3) has no typographic-quote loss',
     function
     () {
       let lost

       lost = lostOn('/usr/share/man/man3/pcre2demo.3.gz')
       if (lost == undefined)
         return this.skip()
       equal(lost, 0)
     })

// mendex(1) writes its `indent_space` default as `"\t\t"`. groff's `\t` is
// zero width, so man(1) prints `""`; our text keeps the tabs, normal() makes
// them a space, and the pair arrives as two `"` tokens. Quote-only tokens drop
// from both sides, so the empty value loses nothing.
test('man-diff', 'mendex(1) tab-only value compares as an empty quoted value',
     function
     () {
       let lost

       lost = lostOn('/usr/share/man/man1/mendex.1.gz')
       if (lost == undefined)
         return this.skip()
       equal(lost, 0)
     })

// The source writes `byte\- and`: two words, so man(1)'s break between them is
// layout and joining it would invent "byte-and".
test('man-diff', 'an ASCII-hyphen line end at a source word boundary stays two words',
     function
     () {
       let lost

       lost = lostOn('/usr/share/man/man3/TIFFReadScanline.3tiff.gz')
       if (lost == undefined)
         return this.skip()
       equal(lost, 0)
     })

// The source .nf cell wraps "paren-" / "theses", which is one word. Our text
// keeps the cell padding as spaces, so it needs the reference's join.
test('man-diff', 'a hyphenated .nf word compares whole on both sides',
     function
     () {
       let lost

       lost = lostOn('/usr/share/man/man3/pcre2_compile.3.gz')
       if (lost == undefined)
         return this.skip()
       equal(lost, 0)
     })

// ps(1) writes its option lists with `\:` after every comma, so man(1) may
// break `-o pid,format,tname,` at the comma and print `time,cmd,` on the next
// line. The comma is inside the argument, not prose punctuation: the source
// has no space after the escape, and our text keeps the argument as one word.
// The format-specifier table also ends cells with `.BR pcpu ).`, which used to
// stay raw macro text; a cell now runs its text macros, so the page loses
// nothing.
test('man-diff', 'a comma-marked break inside an option list compares whole',
     function
     () {
       let lost

       lost = lostOn('/usr/share/man/man1/ps.1.gz')
       if (lost == undefined)
         return this.skip()
       equal(lost, 0)
     })

// dmsetup(8) marks the commas of a syntax line the same way
// (<name>,<uuid>,\:<minor>,...), so it is the second page the rule reaches.
// Its remaining losses are table and justification noise, not commas.
test('man-diff', 'a comma-marked syntax line joins without stealing prose words',
     function
     () {
       let lost

       lost = lostOn('/usr/share/man/man8/dmsetup.8.gz')
       if (lost == undefined)
         return this.skip()
       equal(lost, 5)
     })

// man(1)'s character table wraps "continuation hyphen" inside an unbordered
// tbl cell whose first column already holds "continuation", so the
// continuation "phen" starts at the cell's left edge, before the hyphenated
// token's column. man(1) is the page that owns the case.
test('man-diff', 'a wrapped word in an unbordered table cell compares whole',
     function
     () {
       let lost

       lost = lostOn('/usr/share/man/man1/man.1.gz')
       if (lost == undefined)
         return this.skip()
       equal(lost, 0)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
