import { equal } from 'node:assert/strict'
import * as Icon from '../js/icon.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

let haveNames, imgNames

tests = {}

haveNames = [ 'arrow-down', 'arrow-left', 'arrow-right', 'arrow-up',
              'binary', 'browse', 'c_cpp', 'chat', 'clipboard', 'close',
              'config', 'css', 'dark', 'diagnostic', 'dir', 'docker',
              'dom', 'elisp', 'external', 'handwave', 'help', 'html',
              'javascript', 'json', 'light', 'lisp', 'list', 'log',
              'manpage', 'markdown', 'patch', 'perl', 'python', 'refresh',
              'robot', 'rust', 'save', 'save_edit', 'search', 'sh', 'stop',
              'tex', 'text', 'trash', 'tree', 'x', 'zig' ]
imgNames = [ 'arrow-down', 'arrow-left', 'arrow-right', 'arrow-up',
             'binary', 'browse', 'c_cpp', 'chat', 'clipboard', 'close',
             'config', 'css', 'dark', 'diagnostic', 'dir', 'docker',
             'dom', 'elisp', 'external', 'handwave', 'help', 'html',
             'javascript', 'json', 'light', 'lisp', 'list', 'log',
             'manpage', 'markdown', 'patch', 'perl', 'python', 'refresh',
             'robot', 'rust', 'save', 'save_edit', 'search', 'sh', 'stop',
             'tex', 'text', 'trash', 'tree', 'x', 'zig' ]

test('setHave', 'flips icon paths',
     () => {
       Icon.setHave(1)
       equal(Icon.path('arrow-up'), 'lib/svg/octicons/arrow-up-24.svg')
       Icon.setHave(0)
       equal(Icon.path('arrow-up'), 'img/arrow-up.svg')
     })

test('path', 'img fallback for every icon',
     () => {
       let ok

       Icon.setHave(0)
       ok = imgNames.filter(name => Icon.path(name) == 'img/' + name + '.svg')
       equal(ok.length, imgNames.length)
     })

test('path', 'lib path for every icon when have',
     () => {
       let ok

       Icon.setHave(1)
       ok = haveNames.filter(name => Icon.path(name).startsWith('lib/'))
       equal(ok.length, haveNames.length)
       Icon.setHave(0)
     })

test('path', 'lib paths specific',
     () => {
       Icon.setHave(1)
       equal(Icon.path('python'), 'lib/svg/mfixx/python.svg')
       equal(Icon.path('dark'), 'lib/svg/material-icons/dark_mode/materialiconsoutlined/24px.svg')
       equal(Icon.path('robot'), 'lib/svg/file-icons/Robots.svg')
       Icon.setHave(0)
     })

test('path', 'preferred img names ignore have',
     () => {
       Icon.setHave(1)
       equal(Icon.path('menu'), 'img/menu.svg')
       equal(Icon.path('shell'), 'img/shell.svg')
       equal(Icon.path('welcome'), 'img/welcome.svg')
       equal(Icon.path('assist'), 'img/assist.svg')
       Icon.setHave(0)
     })

test('path', 'special names',
     () => {
       equal(Icon.path('bred'), 'img/bred.svg')
       equal(Icon.path('csv'), 'img/csv.svg')
       equal(Icon.path('prompt'), 'img/prompt-square.svg')
       equal(Icon.path('warning'), 'img/warning.svg')
       equal(Icon.path('thinking.active'), 'img/thinking-active.svg')
       equal(Icon.path('thinking.zen'), 'img/thinking-zen.svg')
     })

test('path', 'letter name',
     () => equal(Icon.path('letter-x'), 'img/letter/letter-x.svg'))

test('path', 'unknown falls back to first letter',
     () => equal(Icon.path('pythonish'), 'img/letter/letter-p.svg'))

test('path', 'blank',
     () => equal(Icon.path('blank'), 'img/blank.svg'))

test('path', 'empty returns blank',
     () => equal(Icon.path(''), 'img/blank.svg'))

test('alt', 'returns name',
     () => equal(Icon.alt('python'), 'python'))

test('mode', 'maps key to name',
     () => {
       equal(Icon.mode('code').name, 'robot')
       equal(Icon.mode('css').name, 'css')
       equal(Icon.mode('plaintext').name, 'text')
       equal(Icon.mode('properties files').name, 'config')
       equal(Icon.mode('latex').name, 'tex')
     })

test('mode', 'unknown falls back to letter',
     () => equal(Icon.mode('ruby').name, 'letter-r'))

test('mode', 'empty returns 0',
     () => equal(Icon.mode(''), 0))

test('mode', 'undefined returns 0',
     () => equal(Icon.mode(), 0))

test('modePath', 'maps mode name to icon',
     () => equal(Icon.modePath('python'), 'img/python.svg'))

test('modePath', 'letter mode with blank gives blank',
     () => equal(Icon.modePath('ruby', 1), 'img/blank.svg'))

test('modePath', 'letter mode gives letter',
     () => equal(Icon.modePath('ruby'), 'img/letter/letter-r.svg'))

test('modePath', 'empty returns blank',
     () => equal(Icon.modePath(''), 'img/blank.svg'))

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
