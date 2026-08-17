import { equal } from 'node:assert/strict'
import * as Place from '../js/place.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

globalThis.document = { dispatchEvent: () => {},
                        documentElement: { style: {} } }
globalThis.Element = class Element {}
globalThis.HTMLDocument = class HTMLDocument {}

tests = {}

test('init', 'starts empty',
     () => {
       Place.init()
       Place.init()
       equal(Place.map(p => p).length, 0)
     })

test('add', 'adds named place',
     () => {
       let found

       Place.init()
       Place.add('mark-1', '/tmp/x')
       found = Place.map(p => p).find(p => p.name == 'mark-1')
       equal(found.path, '/tmp/x')
     })

test('map', 'maps over places',
     () => {
       let names

       Place.init()
       Place.add('a', '/a')
       Place.add('b', '/b')
       names = Place.map(p => p.name)
       equal(names.join(','), 'a,b')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
