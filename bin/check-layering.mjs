#!/usr/bin/env node

// Enforce the three file layers:
//
//   js/main-*    main process only
//   js/common-*  used by both main and renderer
//   everything else under js/ and ext/ is renderer code
//
// Tests may import any layer. The naming check follows the import graph, so a
// main-only helper cannot quietly live under an unprefixed name.

import Fs from 'node:fs'
import Path from 'node:path'
import Url from 'node:url'

function allowed
(from, to) {
  if (from == 'common')
    return to == 'common' ? 1 : 0
  if (from == 'renderer')
    return (to == 'renderer') || (to == 'common') ? 1 : 0
  return (to == 'main') || (to == 'common') ? 1 : 0
}

export
function roleOf
(file) {
  let base, dir

  dir = Path.posix.dirname(file)
  base = Path.posix.basename(file)
  if (file == 'js/main.mjs')
    return 'main'
  if ((dir == 'js') && base.startsWith('main-'))
    return 'main'
  if ((dir == 'js') && base.startsWith('common-'))
    return 'common'
  if ((dir == 'js') && base.endsWith('.mjs'))
    return 'renderer'
  if (file.startsWith('ext/') && base.endsWith('.mjs'))
    return 'renderer'
  return 0
}

export
function imports
(source) {
  let out, re, m

  out = []
  re = /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g
  while ((m = re.exec(source)))
    out.push(m[1])
  re = /import\s+["']([^"']+)["']/g
  while ((m = re.exec(source)))
    out.push(m[1])
  return out
}

export
function resolveImport
(from, spec) {
  if (spec.startsWith('.') == 0)
    return 0
  if (spec.endsWith('.mjs') == 0)
    return 0
  return Path.posix.normalize(Path.posix.join(Path.posix.dirname(from), spec))
}

export
function checkFiles
(files) {
  let deps, errors, importers, known

  known = new Set(files.map(f => f.path))
  deps = new Map()
  errors = []
  files.forEach(f => {
                  let targets

                  targets = new Set()
                  imports(f.source).forEach(spec => {
                                              let target

                                              target = resolveImport(f.path, spec)
                                              if (target && known.has(target))
                                                targets.add(target)
                                            })
                  deps.set(f.path, targets)
                })

  deps.forEach((targets, from) => {
                 let fromRole

                 fromRole = roleOf(from)
                 if (fromRole == 0)
                   return
                 targets.forEach(to => {
                                   let toRole

                                   toRole = roleOf(to)
                                   if (toRole == 0)
                                     return
                                   if (allowed(fromRole, toRole) == 0)
                                     errors.push(from + ': ' + fromRole + ' code must not import ' + toRole + ' code (' + to + ')')
                                 })
               })

  importers = new Map()
  deps.forEach((targets, from) => {
                 let fromRole

                 fromRole = roleOf(from)
                 if (fromRole == 0)
                   return
                 targets.forEach(to => {
                                   let roles

                                   roles = importers.get(to) || new Set()
                                   roles.add(fromRole)
                                   importers.set(to, roles)
                                 })
               })

  importers.forEach((roles, file) => {
                      let actual, expected

                      actual = roleOf(file)
                      if ((actual == 0) || (file == 'js/main.mjs'))
                        return
                      if (roles.has('common') || (roles.has('main') && roles.has('renderer')))
                        expected = 'common'
                      else if (roles.has('main'))
                        expected = 'main'
                      else
                        expected = 'renderer'
                      if (actual == expected)
                        return
                      errors.push(file + ': named as ' + actual + ' code but imported by ' + [ ...roles ].sort().join('/') + ' code; expected ' + expected + ' code')
                    })

  return errors
}

function readDir
(dir, rel, files) {
  Fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
                                                         let p, r

                                                         p = Path.join(dir, e.name)
                                                         r = rel + '/' + e.name
                                                         if (e.isDirectory()) {
                                                           if ((e.name == 'lib') || (e.name == 'node_modules'))
                                                             return
                                                           readDir(p, r, files)
                                                         }
                                                         else if (e.name.endsWith('.mjs'))
                                                           files.push({ path: r, source: Fs.readFileSync(p, 'utf8') })
                                                       })
}

export
function collect
(root) {
  let files

  files = []
  Fs.readdirSync(Path.join(root, 'js')).forEach(name => {
                                                  if (name.endsWith('.mjs'))
                                                    files.push({ path: 'js/' + name,
                                                                 source: Fs.readFileSync(Path.join(root, 'js', name), 'utf8') })
                                                })
  readDir(Path.join(root, 'ext'), 'ext', files)
  return files
}

export
function check
(root) {
  return checkFiles(collect(root))
}

function main
() {
  let errors, root

  root = Path.resolve(Path.dirname(Url.fileURLToPath(import.meta.url)), '..')
  errors = check(root)
  if (errors.length == 0)
    return 0
  errors.forEach(e => console.error('layering: ' + e))
  return 1
}

if (process.argv[1] && (Path.resolve(process.argv[1]) == Url.fileURLToPath(import.meta.url)))
  process.exit(main())
