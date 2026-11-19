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
let run

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

run = process.env.MAN_CORPUS ? globalThis.describe : globalThis.describe.skip

run('corpus',
    function
    () {
      globalThis.it('every installed page either refuses a known page bug or renders',
                    function
                    () {
                      let roots, pages, include, renderErrors, unknown, counts, known
                      let unexpected

                      function knownFail
                      (what) {
                        for (let i = 0; i < known.length; i++)
                          if (known[i].test(what))
                            return 1
                        return 0
                      }

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
                      known = [ /^string /,
                                /^font /,
                                /^expansion recursion$/,
                                /^It without Bl$/,
                                /^escape \\]$/,
                                /^macro (DS|DE|EQ|EN|IX|p)$/,
                                /^mso pic\.tmac$/,
                                /^character \\\(ts\)$/ ]
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
                      counts = { pages: pages.length, parsed: 0, refused: 0 }

                      pages.forEach((file, index) => {
                                      let result

                                      process.stdout.write('corpus: ' + (index + 1) + '/' +
                                                           pages.length + ' ' + file + '\n')
                                      try {
                                        result = ManParse.parse(readPage(file), { include })
                                      }
                                      catch (err) {
                                        note('read error: ' + err.message, file, 0)
                                        return
                                      }
                                      if (result.ok == 0) {
                                        counts.refused++
                                        result.fails.forEach(fail => {
                                                               if ((knownFail(fail.what) == 0) &&
                                                                   ((Path.basename(file) == 'mandoc_char.7') &&
                                                                    (fail.what.startsWith('character ')) == 0))
                                                                 note(fail.what, file, fail.line)
                                                             })
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
                              ' refused of ' + counts.pages + ' pages')
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
