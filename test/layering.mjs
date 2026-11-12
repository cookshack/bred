import { equal, ok } from 'node:assert/strict'
import Path from 'node:path'
import Url from 'node:url'
import { check, checkFiles, roleOf } from '../bin/check-layering.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function file
(path, source) {
  return { path, source: source || '' }
}

function has
(errors, text) {
  return errors.some(e => e.includes(text))
}

tests = {}

test('role', 'names identify the layer',
     () => {
       equal(roleOf('js/main.mjs'), 'main')
       equal(roleOf('js/main-code.mjs'), 'main')
       equal(roleOf('js/common-util.mjs'), 'common')
       equal(roleOf('js/bred.mjs'), 'renderer')
       equal(roleOf('ext/code/code.mjs'), 'renderer')
       equal(roleOf('lib/thing.mjs'), 0)
     })

test('imports', 'main may import common',
     () => {
       let errors

       errors = checkFiles([ file('js/main.mjs', "import * as C from './common-x.mjs'"),
                             file('js/bred.mjs', "import * as C from './common-x.mjs'"),
                             file('js/common-x.mjs') ])
       equal(errors.length, 0, errors.join('\n'))
     })

test('imports', 'main may not import renderer',
     () => {
       let errors

       errors = checkFiles([ file('js/main.mjs', "import * as R from './renderer-x.mjs'"),
                             file('js/renderer-x.mjs') ])
       ok(has(errors, 'main code must not import renderer'))
     })

test('imports', 'renderer may import common',
     () => {
       let errors

       errors = checkFiles([ file('js/main.mjs', "import * as C from './common-x.mjs'"),
                             file('js/bred.mjs', "import * as C from './common-x.mjs'"),
                             file('js/common-x.mjs') ])
       equal(errors.length, 0, errors.join('\n'))
     })

test('imports', 'renderer may not import main',
     () => {
       let errors

       errors = checkFiles([ file('js/bred.mjs', "import * as M from './main-x.mjs'"),
                             file('js/main-x.mjs') ])
       ok(has(errors, 'renderer code must not import main'))
     })

test('imports', 'common may not import renderer',
     () => {
       let errors

       errors = checkFiles([ file('js/common-x.mjs', "import * as R from './renderer-x.mjs'"),
                             file('js/renderer-x.mjs') ])
       ok(has(errors, 'common code must not import renderer'))
     })

test('names', 'a main-only module needs the main prefix',
     () => {
       let errors

       errors = checkFiles([ file('js/main.mjs', "import * as H from './helper.mjs'"),
                             file('js/helper.mjs') ])
       ok(has(errors, 'expected main'))
     })

test('names', 'a module shared by both needs the common prefix',
     () => {
       let errors

       errors = checkFiles([ file('js/main.mjs', "import * as H from './helper.mjs'"),
                             file('js/bred.mjs', "import * as H from './helper.mjs'"),
                             file('js/helper.mjs') ])
       ok(has(errors, 'expected common'))
     })

test('names', 'a renderer-only module may not use the main prefix',
     () => {
       let errors

       errors = checkFiles([ file('js/bred.mjs', "import * as H from './main-helper.mjs'"),
                             file('js/main-helper.mjs') ])
       ok(has(errors, 'expected renderer'))
     })

test('tree', 'the current tree obeys the layers',
     () => {
       let root

       root = Path.resolve(Path.dirname(Url.fileURLToPath(import.meta.url)), '..')
       equal(check(root).length, 0, 'run bin/check-layering for details')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
