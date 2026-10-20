import { equal } from 'node:assert/strict'
import * as Clip from '../js/main-clipboard.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function fakeClipboard
() {
  let clip

  clip = { writes: [],
           selectionWrites: [],
           text: 'hello',
           writeText: async text => {
             clip.writes.push(text)
           },
           readText: async () => clip.text }
  clip.selection = { writeText: async text => {
    clip.selectionWrites.push(text)
  } }
  return clip
}

tests = {}

test('writeClipboard', 'writes the normal clipboard',
     async () => {
       let clip

       clip = fakeClipboard()
       await Clip.writeClipboard(clip, 'x', 0)

       equal(clip.writes.join(','), 'x')
       equal(clip.selectionWrites.length, 0)
     })

test('writeClipboard', 'writes the selection clipboard on linux',
     async () => {
       let clip

       clip = fakeClipboard()
       await Clip.writeClipboard(clip, 'x', 1)

       equal(clip.writes.length, 0)
       equal(clip.selectionWrites.join(','), 'x')
     })

test('writeClipboard', 'falls back when selection is unavailable',
     async () => {
       let clip

       clip = fakeClipboard()
       delete clip.selection
       await Clip.writeClipboard(clip, 'x', 1)

       equal(clip.writes.join(','), 'x')
     })

test('readClipboard', 'returns text',
     async () => {
       let clip

       clip = fakeClipboard()
       equal(await Clip.readClipboard(clip), 'hello')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
