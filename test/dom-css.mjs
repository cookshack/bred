import { equal } from 'node:assert/strict'
import * as Css from '../js/css.mjs'
import * as Dom from '../js/dom.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name,
                      cb: () => {
                        freshDom()
                        cb()
                      } })
}

class FakeElement {
  constructor
  (tag) {
    this.tagName = (tag || 'div').toUpperCase()
    this.nodeName = this.tagName.toLowerCase()
    this.className = ''
    this.classList = this
    this.style = {}
    this.dataset = {}
    this.attributes = {}
    this.children = []
    this.childNodes = this.children
    this.dispatchEvent = () => {}
    this._classes = new Set()
    this._list = this._classes
  }

  add
  (...names) {
    names.forEach(n => {
                    this._classes.add(n)
                    this.className = [ ...this._classes ].join(' ')
                  })
    return this
  }

  remove
  (...names) {
    names.forEach(n => {
                    this._classes.delete(n)
                    this.className = [ ...this._classes ].join(' ')
                  })
    return this
  }

  contains
  (name) {
    return this._classes.has(name)
  }

  appendChild
  (child) {
    if (child && (typeof child == 'object'))
      child.parentNode = this
    this.children.push(child)
    return child
  }

  prepend
  (child) {
    this.children.unshift(child)
    return this
  }

  setAttribute
  (name, val) {
    this.attributes[name] = val
    if (name == 'disabled')
      this.disabled = val
    return val
  }

  removeAttribute
  (name) {
    delete this.attributes[name]
    if (name == 'disabled')
      delete this.disabled
  }

  setAttributeNS
  (ns, name, val) {
    this.attributes[name] = val
    return val
  }

  addEventListener
  () {
  }

  querySelector
  () {
    return 0
  }
}

FakeElement.prototype.childElementCount = 0

function freshDom
() {
  globalThis.document = { dispatchEvent: () => {},
                          documentElement: { style: {} },
                          createElement: tag => new FakeElement(tag),
                          createElementNS: (ns, tag) => new FakeElement(tag),
                          createTextNode: text => text }
  globalThis.DocumentFragment = class {
    appendChild
    (child) {
      return child
    }
  }
  globalThis.Element = FakeElement
  globalThis.HTMLDocument = class HTMLDocument {}
}

function el
() {
  return new FakeElement('div')
}

tests = {}
freshDom()

test('has', 'missing el returns 0',
     () => {
       equal(Css.has(undefined, 'x'), 0)
       equal(Css.has(0, 'x'), 0)
     })

test('has', 'checks classList',
     () => {
       let e

       e = el()
       Css.add(e, 'alpha')
       equal(Css.has(e, 'alpha'), true)
       equal(Css.has(e, 'beta'), false)
     })

test('add', 'single class',
     () => {
       let e

       e = el()
       Css.add(e, 'one')
       equal(e.classList.contains('one'), true)
     })

test('add', 'space separated classes',
     () => {
       let e

       e = el()
       Css.add(e, 'a b c')
       equal(Css.has(e, 'a'), true)
       equal(Css.has(e, 'b'), true)
       equal(Css.has(e, 'c'), true)
     })

test('add', 'cached class list',
     () => {
       let e

       e = el()
       Css.add(e, 'd e')
       Css.add(e, 'd e')
       equal(Css.has(e, 'd'), true)
       equal(Css.has(e, 'e'), true)
     })

test('add', 'empty class name no-op',
     () => {
       let e

       e = el()
       Css.add(e, '')
       equal(e._classes.size, 0)
     })

test('remove', 'removes class',
     () => {
       let e

       e = el()
       Css.add(e, 'x')
       Css.remove(e, 'x')
       equal(Css.has(e, 'x'), false)
     })

test('toggle', 'adds then removes',
     () => {
       let e

       e = el()
       equal(Css.toggle(e, 'y'), 1)
       equal(Css.has(e, 'y'), true)
       equal(Css.toggle(e, 'y'), 0)
       equal(Css.has(e, 'y'), false)
     })

test('hide', 'adds hidden',
     () => {
       let e

       e = el()
       Css.hide(e)
       equal(Css.has(e, 'hidden'), true)
       Css.show(e)
       equal(Css.has(e, 'hidden'), false)
     })

test('retract', 'adds retracted',
     () => {
       let e

       e = el()
       Css.retract(e)
       equal(Css.has(e, 'retracted'), true)
       Css.expand(e)
       equal(Css.has(e, 'retracted'), false)
     })

test('disable', 'sets inert and disabled',
     () => {
       let e

       e = el()
       Css.disable(e)
       equal(e.attributes['inert'], 1)
       equal(Css.has(e, 'disabled'), true)
     })

test('enable', 'removes inert and disabled',
     () => {
       let e

       e = el()
       Css.disable(e)
       Css.enable(e)
       equal(e.attributes['inert'], undefined)
       equal(Css.has(e, 'disabled'), false)
     })

test('disable', 'missing el throws',
     () => {
       let caught

       caught = 0
       try {
         Css.disable()
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('enable', 'missing el throws',
     () => {
       let caught

       caught = 0
       try {
         Css.enable()
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('create', 'div with class string',
     () => {
       let d

       d = Dom.create('div', 0, 'run-class')
       equal(d.tagName, 'DIV')
       equal(Css.has(d, 'run-class'), true)
     })

test('create', 'attrs object sets attributes',
     () => {
       let d

       d = Dom.create('div', 0, { 'data-x': 'v' })
       equal(d.attributes['data-x'], 'v')
     })

test('create', 'classes and attrs',
     () => {
       let d

       d = Dom.create('div', 0, 'cls', { title: 't' })
       equal(Css.has(d, 'cls'), true)
       equal(d.attributes['title'], 't')
     })

test('create', 'attrs and attrs tosses',
     () => {
       let caught

       caught = 0
       try {
         Dom.create('div', 0, { a: 1 }, { b: 2 })
       }
       catch {
         caught = 1
       }
       equal(caught, 1)
     })

test('create', 'svg uses createElementNS',
     () => {
       let s

       s = Dom.create('svg', 0, 'svg-class', { viewBox: '0 0 1 1' })
       equal(s.tagName, 'SVG')
       equal(s.attributes['viewBox'], '0 0 1 1')
     })

test('append', 'adds text and elements',
     () => {
       let d, t1, t2

       d = el()
       t1 = new FakeElement('span')
       t2 = new FakeElement('i')
       Dom.append(d, 'text', t1, [ 'x', t2 ])
       equal(d.children[0], 'text')
       equal(d.children[1], t1)
       equal(d.children.length, 3)
     })

test('append', 'number content',
     () => {
       let d

       d = el()
       Dom.append(d, 3)
       equal(d.children.length, 1)
     })

test('prepend', 'puts children first',
     () => {
       let d

       d = el()
       d.children.push('old')
       Dom.prepend(d, 'new')
       equal(d.children[0], 'new')
     })

test('div', 'creates div element',
     () => {
       let d

       d = Dom.div('content', 'c1 c2')
       equal(d.tagName, 'DIV')
       equal(Css.has(d, 'c1'), true)
       equal(Css.has(d, 'c2'), true)
     })

test('divId', 'sets id attribute',
     () => {
       let d

       d = Dom.divId('my-id', 0, 'c1')
       equal(d.attributes['id'], 'my-id')
       equal(Css.has(d, 'c1'), true)
     })

test('divIdCl', 'sets id and classes',
     () => {
       let d

       d = Dom.divIdCl('my-id', 'c1')
       equal(d.attributes['id'], 'my-id')
       equal(Css.has(d, 'c1'), true)
     })

test('divCl', 'creates div with classes',
     () => {
       let d

       d = Dom.divCl('c1 c2', 'content')
       equal(d.tagName, 'DIV')
       equal(Css.has(d, 'c1'), true)
       equal(Css.has(d, 'c2'), true)
     })

test('span', 'creates span element',
     () => {
       let s

       s = Dom.span('x', 'c1')
       equal(s.tagName, 'SPAN')
       equal(Css.has(s, 'c1'), true)
     })

test('img', 'sets src and alt',
     () => {
       let i

       i = Dom.img('/a.png', 'pic', 'c1')
       equal(i.attributes['src'], '/a.png')
       equal(i.attributes['alt'], 'pic')
       equal(Css.has(i, 'c1'), true)
     })

test('button', 'creates button element',
     () => {
       let b

       b = Dom.button('go', 'c1')
       equal(b.tagName, 'BUTTON')
       equal(Css.has(b, 'c1'), true)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
