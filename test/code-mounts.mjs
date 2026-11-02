import { equal } from 'node:assert/strict'
import * as Mounts from '../js/code-mounts.mjs'

let tests, home

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

tests = {}
home = '/h'

test('argList', 'null selects every extra mount',
     () => {
       let args

       args = Mounts.argList('/w', '/d', '/a', null, home, () => 1)
       equal(args.includes(home + '/src/bred:' + home + '/src/bred'), true)
       equal(args.includes(home + '/src/opencode:' + home + '/src/opencode:ro'), true)
       equal(args.includes('/d:' + Mounts.containerHome() + '/.local/share/opencode'), true)
     })

test('argList', 'only the selected extras',
     () => {
       let args

       args = Mounts.argList('/w', '/d', '/a', [ home + '/src/bred' ], home, () => 1)
       equal(args.includes(home + '/src/bred:' + home + '/src/bred'), true)
       equal(args.includes(home + '/src/review:' + home + '/src/review'), false)
     })

test('argList', 'an empty selection mounts only the working dir and infra',
     () => {
       let args

       args = Mounts.argList('/w', '/d', '/a', [], home, () => 1)
       equal(args.includes('/w:/w'), true)
       equal(args.includes('/d:' + Mounts.containerHome() + '/.local/share/opencode'), true)
       equal(args.includes(home + '/src/review:' + home + '/src/review'), false)
     })

test('argList', 'the working dir is never mounted twice',
     () => {
       let args

       args = Mounts.argList(home + '/src/bred', '/d', '/a', null, home, () => 1)
       equal(args.filter(a => a == home + '/src/bred:' + home + '/src/bred').length, 1)
     })

test('argList', 'missing extras are skipped',
     () => {
       let args

       args = Mounts.argList('/w', '/d', '/a', null, home, () => 0)
       equal(args.includes(home + '/src/review:' + home + '/src/review'), false)
       equal(args.includes('/w:/w'), true)
     })

test('argList', 'a trailing slash on the working dir is normalised',
     () => {
       let args

       args = Mounts.argList('/w/', '/d', '/a', null, home, () => 1)
       equal(args.includes('/w:/w'), true)
     })

test('infra', 'state and credentials live under the container home',
     () => {
       let args

       args = Mounts.argList('/w', '/d', '/a', [], home, () => 1)
       equal(args.includes('/d:' + Mounts.containerHome() + '/.local/share/opencode'), true)
       equal(args.includes('/a:' + Mounts.containerAuthPath() + ':ro'), true)
       equal(Mounts.containerAuthPath(), Mounts.containerHome() + '/.local/share/opencode/auth.json')
     })

test('references', 'every extra mount, minus the working dir',
     () => {
       let refs

       refs = Mounts.references(null, home + '/src/bred', home, () => 1)
       equal(refs['src-review'].path, home + '/src/review')
       equal(refs['src-review'].description.includes('Writable'), true)
       equal(refs['src-bred'], undefined)
       equal(refs['src-opencode'].description.includes('Read-only'), true)
       equal(refs['alts-main-gvm-cert-data'].path, home + '/alts/main/gvm/cert-data')
     })

test('references', 'only the selected extras',
     () => {
       let refs

       refs = Mounts.references([ home + '/src/review' ], '/w', home, () => 1)
       equal(Object.keys(refs).join(','), 'src-review')
     })

test('references', 'missing dirs are skipped',
     () => {
       equal(Object.keys(Mounts.references(null, '/w', home, () => 0)).length, 0)
     })

test('candidateList', 'labels use ~ and read-only is marked',
     () => {
       let list

       list = Mounts.candidateList('/w', home, () => 1)
       equal(list[0].label.startsWith('~/'), true)
       equal(list.some(c => (c.path == home + '/src/opencode') && (c.ro == 1)), true)
     })

test('candidateList', 'the working dir is not offered',
     () => {
       let list

       list = Mounts.candidateList(home + '/src/bred', home, () => 1)
       equal(list.some(c => c.path == home + '/src/bred'), false)
     })

test('candidateList', 'missing dirs are not offered',
     () => {
       let list

       list = Mounts.candidateList('/w', home, () => 0)
       equal(list.length, 0)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
