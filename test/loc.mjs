import { equal } from 'node:assert/strict'
import * as Loc from '../js/loc.mjs'

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
let _shared

_shared = globalThis.bred?._shared?.() || {}
_shared.opt = _shared.opt || { values: {}, types: {} }
globalThis.bred = { _shared: () => _shared }

tests = {}

test('make', 'filename plain',
     () => {
       equal(Loc.make('/a/b.txt').filename, 'b.txt')
     })

test('make', 'filename trailing slash returns 0',
     () => {
       equal(Loc.make('/a/').filename, 0)
     })

test('make', 'filename empty path',
     () => {
       equal(Loc.make().filename, undefined)
     })

test('make', 'dirname nested',
     () => {
       equal(Loc.make('/a/b').dirname, '/a/')
     })

test('make', 'dirname trailing slash kept',
     () => {
       equal(Loc.make('/a/b/').dirname, '/a/b/')
     })

test('make', 'dirname single component to root',
     () => {
       equal(Loc.make('/abc').dirname, '/')
     })

test('make', 'dirname empty path',
     () => {
       equal(Loc.make().dirname, undefined)
     })

test('make', 'length',
     () => {
       equal(Loc.make('/a').length, 2)
     })

test('make', 'path setter',
     () => {
       let l

       l = Loc.make('/a')
       l.path = '/b'
       equal(l.path, '/b')
     })

test('make', 'loc object input',
     () => {
       equal(Loc.make(Loc.make('/a/b')).path, '/a/b')
     })

test('ensureSlash', 'adds trailing slash',
     () => {
       equal(Loc.make('/a').ensureSlash(), '/a/')
     })

test('ensureSlash', 'keeps existing slash',
     () => {
       equal(Loc.make('/a/').ensureSlash(), '/a/')
     })

test('ensureSlash', 'colon path unchanged',
     () => {
       equal(Loc.make('C:').ensureSlash(), 'C:')
     })

test('ensureSlash', 'empty path',
     () => {
       equal(Loc.make().ensureSlash(), undefined)
     })

test('removeSlash', 'removes trailing slash',
     () => {
       equal(Loc.make('/a/').removeSlash(), '/a')
     })

test('removeSlash', 'no slash unchanged',
     () => {
       equal(Loc.make('/a').removeSlash(), '/a')
     })

test('join', 'joins file',
     () => {
       equal(Loc.make('/a').join('b'), '/a/b')
     })

test('join', 'dir second arg tosses',
     () => {
       let caught

       caught = 0
       try {
         Loc.make('/a').join('/b')
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('join', 'empty file no-op',
     () => {
       equal(Loc.make('/a').join(''), '/a')
     })

test('join', 'empty path no-op',
     () => {
       equal(Loc.make().join('x'), undefined)
     })

test('parent', 'root stays root',
     () => {
       equal(Loc.make('/').parent(), '/')
     })

test('parent', 'single component to root',
     () => {
       equal(Loc.make('/home').parent(), '/')
     })

test('parent', 'nested parent',
     () => {
       equal(Loc.make('/home/matt').parent(), '/home/')
     })

test('parent', 'trailing slash parent',
     () => {
       equal(Loc.make('/usr/local/bin/bred/').parent(), '/usr/local/bin/')
     })

test('parent', 'empty path tosses',
     () => {
       let caught

       caught = 0
       try {
         Loc.make('').parent()
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('parent', 'relative path tosses',
     () => {
       let caught

       caught = 0
       try {
         Loc.make('rel').parent()
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('expand', 'tilde is home',
     () => {
       equal(Loc.make('~').expand(), Loc.home())
     })

test('expand', 'tilde slash expands',
     () => {
       equal(Loc.make('~/x').expand(), Loc.home() + 'x')
     })

test('expand', 'colon is home',
     () => {
       equal(Loc.make(':').expand(), Loc.home())
     })

test('expand', 'home scheme',
     () => {
       equal(Loc.make('home:z').expand(), Loc.home() + 'z')
     })

test('expand', 'bare colon scheme',
     () => {
       equal(Loc.make(':z').expand(), Loc.home() + 'z')
     })

test('expand', 'file triple slash',
     () => {
       equal(Loc.make('file:///a/b').expand(), '/a/b')
     })

test('expand', 'file single slash',
     () => {
       equal(Loc.make('file:/a').expand(), '/a')
     })

test('expand', 'file host tosses',
     () => {
       let caught

       caught = 0
       try {
         Loc.make('file://host').expand()
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('expand', 'alien scheme tosses',
     () => {
       let caught

       caught = 0
       try {
         Loc.make('other:x').expand()
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('expand', 'tilde user tosses',
     () => {
       let caught

       caught = 0
       try {
         Loc.make('~user').expand()
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('expand', 'expanded flag caches',
     () => {
       let l

       Loc.homeSet('/home/user')
       l = Loc.make('~/x')
       l.expand()
       Loc.homeSet('/home/other')
       l.expand()
       equal(l.path, '/home/user/x')
       Loc.homeSet('/')
     })

test('relative', 'absolute returns 0',
     () => {
       equal(Loc.make('/a').relative, 0)
     })

test('relative', 'relative returns 1',
     () => {
       equal(Loc.make('a').relative, 1)
     })

test('needsDotExpand', 'dot file',
     () => {
       equal(Loc.make('/a/./b').needsDotExpand(), 1)
     })

test('needsDotExpand', 'dot dot file',
     () => {
       equal(Loc.make('/a/../b').needsDotExpand(), 1)
     })

test('needsDotExpand', 'plain path',
     () => {
       equal(Loc.make('/a/b').needsDotExpand(), 0)
     })

test('needsDotExpand', 'empty path',
     () => {
       equal(Loc.make().needsDotExpand(), 0)
     })

test('profile', 'set and get',
     () => {
       Loc.profileSet('prof1')
       equal(Loc.profile(), 'prof1')
     })

test('appDir', 'set and get with slash',
     () => {
       Loc.appDirSet('/usr/lib/bred')
       equal(Loc.appDir().path, '/usr/lib/bred/')
     })

test('configDir', 'set and get with slash',
     () => {
       Loc.configDirSet('/cfg')
       equal(Loc.configDir().path, '/cfg/')
     })

test('iwd', 'set and get with slash',
     () => {
       Loc.iwdSet('/iwd')
       equal(Loc.iwd().path, '/iwd/')
     })

test('home', 'default is slash',
     () => {
       equal(Loc.home(), '/')
     })

test('home', 'set ensures slash',
     () => {
       Loc.homeSet('/usr')
       equal(Loc.home(), '/usr/')
       Loc.homeSet('/')
     })

test('shell', 'default is sh',
     () => {
       equal(Loc.shell(), 'sh')
     })

test('shell', 'set and get',
     () => {
       Loc.shellSet('fish')
       equal(Loc.shell(), 'fish')
     })

test('cleanHref', 'home prefix to colon',
     () => {
       Loc.homeSet('/home/user')
       equal(Loc.cleanHref('file:///home/user/x'), ':x')
       Loc.homeSet('/')
     })

test('cleanHref', 'outside home unchanged',
     () => {
       Loc.homeSet('/home/user')
       equal(Loc.cleanHref('/other'), '/other')
       Loc.homeSet('/')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
