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
  let roots

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
                    else if (/^man[1-9]/.test(Path.basename(dir)))
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

                      function knownFail
                      (what) {
                        for (let i = 0; i < known.length; i++)
                          if (known[i].test(what))
                            return 1
                        return 0
                      }

                      this.timeout(600000)
                      known = [ /^string /,
                                /^font /,
                                /^It without Bl$/,
                                /^escape \\]$/,
                                /^macro (DS|DE|EQ|EN|IX|p)$/,
                                /^mso pic\.tmac$/,
                                /^character \\\(ts\)$/ ]
                      setupDom()
                      roots = manRoots()
                      pages = []
                      roots.forEach(root => walk(root, pages))
                      if (pages.length == 0)
                        this.skip()

                      include = includeLoader(roots)
                      renderErrors = []
                      unknown = []
                      counts = { pages: pages.length, parsed: 0, refused: 0 }

                      pages.forEach(file => {
                                      let result

                                      try {
                                        result = ManParse.parse(readPage(file), { include })
                                      }
                                      catch (err) {
                                        unknown.push(file + ': read error: ' + err.message)
                                        return
                                      }
                                      if (result.ok == 0) {
                                        counts.refused++
                                        result.fails.forEach(fail => {
                                                               if (knownFail(fail.what) == 0)
                                                                 unknown.push(file + ': ' + fail.what +
                                                                             ' (line ' + fail.line + ')')
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
                      equal(unknown.length, 0,
                            'unexpected refusals: ' + JSON.stringify(unknown.slice(0, 10)))
                      equal(renderErrors.length, 0,
                            'render errors: ' + JSON.stringify(renderErrors.slice(0, 10)))
                    })
    })
