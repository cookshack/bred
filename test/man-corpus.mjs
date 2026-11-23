import { equal } from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import Fs from 'node:fs'
import Path from 'node:path'
import Zlib from 'node:zlib'

import * as ManParse from '../js/man-parse.mjs'
import * as ManRender from '../js/man-render.mjs'
import { setupDom } from './dom-help.mjs'

// Render every installed page. This takes about a minute, so it only runs
// when asked: `npm run test-corpus` (or MAN_CORPUS=1 npx mocha ...).
let run, knownFails

// The viewer reads through a pty, which turns every LF into CRLF. Feed the
// parser the same bytes it would see in Bred.
function viewerText
(text) {
  return text.replace(/\r?\n/g, '\r\n')
}

function readPage
(file) {
  let buf

  buf = Fs.readFileSync(file)
  if (file.endsWith('.gz'))
    buf = Zlib.gunzipSync(buf)
  return buf.toString('utf8')
}

function manRoots
() {
  let roots, override

  override = process.env.MAN_CORPUS_ROOTS
  if (override)
    return override.split(':').filter(dir => dir && Fs.existsSync(dir))
  roots = []
  try {
    roots = execFileSync('manpath', { encoding: 'utf8',
                                      stdio: [ 'ignore', 'pipe', 'ignore' ] })
      .trim()
      .split(':')
      .filter(dir => dir && Fs.existsSync(dir))
  }
  catch {
    roots = []
  }
  if (roots.length == 0)
    roots = [ '/usr/share/man' ]
  return roots
}

function isPage
(file) {
  let name

  name = Path.basename(file).replace(/\.gz$/, '')
  return /\.[0-9][a-z]*$/.test(name) ? 1 : 0
}

function walk
(dir, out) {
  let entries

  try {
    entries = Fs.readdirSync(dir, { withFileTypes: true })
  }
  catch {
    return
  }
  entries.forEach(entry => {
                    let full

                    full = Path.join(dir, entry.name)
                    if (entry.isDirectory())
                      walk(full, out)
                    else if (/^man[0-9]/.test(Path.basename(dir)) && isPage(full) &&
                             Fs.existsSync(full))
                      out.push(full)
                  })
}

function includeLoader
(roots) {
  return target => {
           for (let i = 0; i < roots.length; i++) {
             let file, candidates

             file = Path.join(roots[i], target)
             candidates = [ file, file + '.gz' ]
             for (let at = 0; at < candidates.length; at++)
               try {
                 return readPage(candidates[at])
               }
               catch {
               }
           }
           return 0
         }
}

// Refusals the corpus is known to report. Everything else is a page bug, and
// the run fails rather than quietly passing.
knownFails = [ /^string /,
               /^font /,
               /^expansion recursion$/,
               /^It without Bl$/,
               /^escape \\]$/,
               /^macro (DS|DE|EQ|EN|IX|p)$/,
               /^mso pic\.tmac$/,
               /^character \\\(ts\)$/ ]

function knownFailure
(what) {
  for (let i = 0; i < knownFails.length; i++)
    if (knownFails[i].test(what))
      return 1
  return 0
}

// mandoc_char.7 documents every glyph in the character set, so its `character`
// refusals are its subject, not a parser bug. The exception is for that page
// only: any other page refusing a character name is a bug we must see.
function expectedRefusal
(file, what) {
  let character

  character = what.startsWith('character ') ? 1 : 0
  return ((Path.basename(file) == 'mandoc_char.7') && character) ? 1 : 0
}

function unknownRefusals
(fails, file) {
  return fails.filter(fail => (knownFailure(fail.what) == 0) &&
                              (expectedRefusal(file, fail.what) == 0))
}

// groff keeps its manual pages as build sources and bin/fetch-man-corpus
// copies them verbatim, so a downloaded page can still carry groff's
// @MAN7EXT@-style substitution markers. A title line that still has one means
// the page is a template waiting for groff's build, not a page a reader
// opens; the placeholders are not body text like the odd @NAME@ example in an
// installed page.
function sourceTemplate
(text) {
  return /^\.TH[ \t].*@[A-Za-z0-9_]+@/m.test(text) ? 1 : 0
}

// A page that is nothing but comments and one `.so target`, as man-pages
// ships man.7 in the Linux tree.
function includeOnly
(text) {
  let lines, found

  lines = text.split('\n')
  found = ''
  for (let i = 0; i < lines.length; i++) {
    let trimmed

    trimmed = lines[i].trim()
    if ((trimmed.length == 0) || trimmed.startsWith('.\\"') ||
        trimmed.startsWith("'\\\"") || trimmed.startsWith('\\#'))
      continue
    if (trimmed.startsWith('.so ') && (found.length == 0)) {
      found = trimmed.slice(4).trim()
      continue
    }
    return ''
  }
  return found
}

// An alias is a page a reader opens, unless its target is a build source.
function templateAlias
(text, include) {
  let target, included

  target = includeOnly(text)
  if (target.length == 0)
    return 0
  included = include(target)
  return ((typeof included == 'string') && (sourceTemplate(included) == 1)) ? 1 : 0
}

run = process.env.MAN_CORPUS ? globalThis.describe : globalThis.describe.skip

run('corpus',
    function
    () {
      globalThis.it('every installed page either refuses a known page bug or renders',
                    function
                    () {
                      let roots, pages, include, renderErrors, unknown, counts
                      let unexpected

                      function note
                      (what, file, line) {
                        let entry

                        entry = unexpected[what]
                        if (entry == undefined)
                          unexpected[what] = { count: 0, page: file, line }
                        unexpected[what].count++
                        unknown.push(file + ': ' + what + ' (line ' + line + ')')
                      }

                      function summarize
                      () {
                        return Object.keys(unexpected).sort().map(what => {
                                                                    let entry

                                                                    entry = unexpected[what]
                                                                    return '  ' + entry.count + '  ' + what +
                                                                            '  e.g. ' + entry.page
                                                                  }).join('\n')
                      }

                      this.timeout(600000)
                      setupDom()
                      roots = manRoots()
                      console.log('corpus: roots ' + roots.join(':'))
                      pages = []
                      roots.forEach(root => walk(root, pages))
                      if (pages.length == 0)
                        this.skip()
                      console.log('corpus: ' + pages.length + ' pages')

                      include = includeLoader(roots)
                      renderErrors = []
                      unknown = []
                      unexpected = {}
                      counts = { pages: pages.length, parsed: 0, refused: 0, skipped: 0 }

                      pages.forEach((file, index) => {
                                      let text, result

                                      // --expose-gc and a 512 MB heap keep the happy-dom
                                      // trees from piling up across thousands of pages.
                                      if (globalThis.gc && (index > 0) && ((index % 250) == 0))
                                        globalThis.gc()
                                      process.stdout.write('corpus: ' + (index + 1) + '/' +
                                                           pages.length + ' ' + file + '\n')
                                      try {
                                        text = readPage(file)
                                      }
                                      catch (err) {
                                        note('read error: ' + err.message, file, 0)
                                        return
                                      }
                                      if ((sourceTemplate(text) == 1) ||
                                          (templateAlias(text, include) == 1)) {
                                        counts.skipped++
                                        return
                                      }
                                      try {
                                        result = ManParse.parse(viewerText(text), { include })
                                      }
                                      catch (err) {
                                        note('read error: ' + err.message, file, 0)
                                        return
                                      }
                                      if (result.ok == 0) {
                                        let refusals

                                        counts.refused++
                                        refusals = unknownRefusals(result.fails, file)
                                        refusals.forEach(fail => note(fail.what, file, fail.line))
                                        return
                                      }
                                      counts.parsed++
                                      try {
                                        let out

                                        out = ManRender.render(result.doc)
                                        if (out.el == undefined)
                                          throw new Error('no element')
                                      }
                                      catch (err) {
                                        renderErrors.push(file + ': ' + err.message)
                                      }
                                    })

                      console.log('corpus: ' + counts.parsed + ' parsed, ' + counts.refused +
                              ' refused, ' + counts.skipped +
                              ' source templates skipped of ' + counts.pages + ' pages')
                      if (unknown.length)
                        console.log('corpus: unexpected constructs:\n' + summarize())
                      if (renderErrors.length)
                        console.log('corpus: render errors:\n  ' +
                                    renderErrors.slice(0, 20).join('\n  '))
                      equal(unknown.length, 0,
                            'unexpected refusals:\n' + summarize())
                      equal(renderErrors.length, 0,
                            'render errors:\n  ' + renderErrors.slice(0, 20).join('\n  '))
                    })
    })

// The refusal filter is the gate itself: a run that reports nothing proves
// nothing unless the filter is known to report a refusal on a page it does
// not recognise. These tests run in the whole suite, where the corpus does
// not.
globalThis.describe('corpus refusals',
                    function
                    () {
                      globalThis.it('an unknown refusal on a page other than mandoc_char.7 is reported',
                                    function
                                    () {
                                      let found

                                      found = unknownRefusals([ { what: 'table format without columns',
                                                                  line: 12 } ],
                                                              '/man/man3/other.3')
                                      equal(found.length, 1)
                                      equal(found[0].what, 'table format without columns')
                                      equal(found[0].line, 12)
                                    })

                      globalThis.it('the character exception covers mandoc_char.7 only',
                                    function
                                    () {
                                      let fails

                                      fails = [ { what: 'character \\(ul)', line: 1 } ]
                                      equal(unknownRefusals(fails, '/man/man7/mandoc_char.7').length, 0)
                                      equal(unknownRefusals(fails, '/man/man7/other.7').length, 1)
                                    })

                      globalThis.it('a known page bug is not reported',
                                    function
                                    () {
                                      equal(unknownRefusals([ { what: 'string AQ', line: 3 },
                                                              { what: 'font \\', line: 9 },
                                                              { what: 'mso pic.tmac', line: 11 } ],
                                                            '/man/man1/a.1').length, 0)
                                    })
                    })

function parseTable
(body) {
  return ManParse.parse('.TH T 1\n.TS\n' + body + '\n.TE\n')
}

function flat
(spans) {
  return ManParse.toText([ { kind: 'para', spans } ]).replace(/\n$/, '')
}

globalThis.describe('tbl formats',
                    function
                    () {
                      globalThis.it('an upper-case L is a left column',
                                    function
                                    () {
                                      let r, table

                                      // Linux man-pages writes `L1 Lx` for a two
                                      // column table: 1 and x are a separation and
                                      // an expansion, not part of the key.
                                      r = parseTable('L1 Lx.\n"tolower"\t-\n')
                                      table = r.doc.blocks[0]
                                      equal(r.ok, 1)
                                      equal(table.cols.length, 2)
                                      equal(table.cols[0].align, 'left')
                                      equal(table.cols[1].align, 'left')
                                      equal(flat(table.rows[0].cells[0].spans), '"tolower"')
                                      equal(flat(table.rows[0].cells[1].spans), '-')
                                    })

                      globalThis.it('upper-case C, R and N keep their alignment',
                                    function
                                    () {
                                      let r, table

                                      r = parseTable('C R N.\na\tb\tc\n')
                                      table = r.doc.blocks[0]
                                      equal(r.ok, 1)
                                      equal(table.cols.length, 3)
                                      equal(table.cols[0].align, 'center')
                                      equal(table.cols[1].align, 'right')
                                      equal(table.cols[2].align, 'right')
                                    })

                      globalThis.it('a bold upper-case key is bold',
                                    function
                                    () {
                                      let r, table

                                      r = parseTable('Lb Lb.\nSystem call\tKernel\n')
                                      table = r.doc.blocks[0]
                                      equal(table.cols.length, 2)
                                      equal(table.cols[0].bold, 1)
                                      equal(table.cols[1].bold, 1)
                                    })

                      globalThis.it('a two-line L format parses',
                                    function
                                    () {
                                      let r, table

                                      // syscalls(2) writes a header format line
                                      // and a body format line. Both used to be
                                      // refused because neither key was known.
                                      r = parseTable('Lb Lb Lb\nLw(26n)2 L  Lx.\n' +
                                                     'System call\tKernel\tNotes\n' +
                                                     'foo\t1.0\n')
                                      table = r.doc.blocks[0]
                                      equal(r.ok, 1)
                                      equal(table.rows.length, 2)
                                      equal(flat(table.rows[0].cells[0].spans), 'System call')
                                      equal(flat(table.rows[1].cells[1].spans), '1.0')
                                    })

                      globalThis.it('an unknown key character still refuses the table',
                                    function
                                    () {
                                      let r

                                      // `x` is a specifier, never a key of its own;
                                      // groff rejects this format too.
                                      r = parseTable('x x.\na\tb\n')
                                      equal(r.ok, 0)
                                      equal(r.fails[0].what, 'table format without columns')
                                    })
                    })

globalThis.describe('corpus templates',
                    function
                    () {
                      globalThis.it('a page with groff substitution markers is a source template',
                                    function
                                    () {
                                      equal(sourceTemplate('.TH groff @MAN7EXT@ "x"\ntext\n'), 1)
                                      equal(sourceTemplate('.TH ls 1\ntext\n'), 0)
                                      // A placeholder in body text is prose, as in
                                      // updmap(1)'s `string @jaEmbed@`.
                                      equal(sourceTemplate('.TH updmap 1\nstring @jaEmbed@\n'), 0)
                                    })

                      globalThis.it('an alias into a source template is skipped',
                                    function
                                    () {
                                      let include

                                      include = target => (target == 'man7/groff_man.7')
                                                ? '.TH groff_man @MAN7EXT@\ntext\n'
                                                : 0
                                      equal(templateAlias('.so man7/groff_man.7\n', include), 1)
                                      equal(templateAlias('.TH ls 1\ntext\n', include), 0)
                                    })
                    })
