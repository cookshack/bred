import { equal, throws } from 'node:assert/strict'
import * as Chmod from '../js/main-chmod.mjs'

let tests, parseModePerm

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

tests = {}
parseModePerm = Chmod._internals.parseModePerm

test('parseModePerm', 'rxw',
     () => equal(parseModePerm('rxw', 0),
                 0b111))

test('parseModePerm', 'wrx',
     () => equal(parseModePerm('wrx', 0),
                 0b111))

test('parseModePerm', 'wr',
     () => equal(parseModePerm('wr', 0),
                 0b110))

test('parseModePerm', 'x',
     () => equal(parseModePerm('x', 0),
                 0b1))

test('parseModePerm', 'e',
     () => throws(() => parseModePerm('e', 0)))

test('update', 'a+rwx',
     () => equal(Chmod.update(0, 'a+rwx'),
                 0b111111111))

test('update', 'a+r',
     () => equal(Chmod.update(0, 'a+r'),
                 0b100100100))

test('update', 'ugo+r',
     () => equal(Chmod.update(0, 'ugo+r'),
                 0b100100100))

test('update', 'o+r', // o for other
     () => equal(Chmod.update(0, 'o+r'),
                 0b000000100))

test('update', 'u+rx',
     () => equal(Chmod.update(0, 'u+rx'),
                 0b101000000))

test('update', 'gu+xw',
     () => equal(Chmod.update(0, 'gu+xw'),
                 0b011011000))

test('update', 'uo-x',
     () => equal(Chmod.update(0b111111111, 'uo-x'),
                 0b110111110))

test('update', 'a+rwx uo-x',
     () => equal(Chmod.update(Chmod.update(0, 'a+rwx'), 'uo-x'),
                 0b110111110))

test('update', 'u-r on 0',
     () => equal(Chmod.update(0, 'u-r'),
                 0))

/*
(update-mode (update-mode 0 'ug+r') 'u-wr')
*/

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
