import * as Css from './css.mjs'
import * as Mess from './mess.mjs'
//import { d } from './mess.mjs'

let svgs

svgs = [ 'svg', 'text', 'circle', 'g', 'line', 'ellipse', 'rect', 'path', 'image' ]

export
function create
(nodeName, content, classesOrAttrs, attrs) {
  let ele, classes

  if (classesOrAttrs)
    if ((typeof classesOrAttrs == 'string') || classesOrAttrs instanceof String)
      classes = classesOrAttrs
    else {
      if (attrs)
        Mess.toss('attrs given when classesOrAttrs is attrs')
      attrs = classesOrAttrs
      classes = ''
    }


  if (svgs.includes(nodeName))
    ele = globalThis.document.createElementNS('http://www.w3.org/2000/svg', nodeName)
  else
    ele = globalThis.document.createElement(nodeName)

  Css.add(ele, classes)

  append(ele, content)

  for (let attr in attrs)
    if ([ 'svg', 'text' ].includes(nodeName))
      ele.setAttributeNS(null, attr, attrs[attr])
    else
      ele.setAttribute(attr, attrs[attr])


  return ele
}

export
function append
(parent, ...args) { // text OR element OR array of texts/elements/arrays

  for (let arg = 0; arg < args.length; arg++) {
    let content

    content = args[arg]
    if (content)
      if (Array.isArray(content)) {
        let fragment

        fragment = new globalThis.DocumentFragment()
        for (let i = 0; i < content.length; i++)
          append(fragment, content[i])
        parent.appendChild(fragment)
      }
      else if ((typeof content == 'string') || (typeof content == 'number'))
        parent.appendChild(globalThis.document.createTextNode(content))
      else
        parent.appendChild(content)

  }

  return parent
}

export
function prepend
(parent, ...children) {
  for (let i = children.length - 1; i >= 0; i--)
    parent.prepend(children[i])
  return parent
}

export
function div
(content, classes, attrs) {
  return create('div', content, classes, attrs)
}

export
function divId
(id, content, classes, attrs) {
  return create('div', content, classes, { ...(attrs || {}), id: id })
}

export
function divCl
(classes, content, attrs) {
  return div(content, classes, attrs)
}

export
function divIdCl
(id, classes, content, attrs) {
  return divId(id, content, classes, attrs)
}

export
function span
(content, classes, attrs) {
  return create('span', content, classes, attrs)
}

export
function img
(src, alt, classes, attrs) {
  return create('img', [], classes, { src: src, alt: alt, ...(attrs || {}) })
}

export
function button
(content, classes, attrs) {
  return create('button', content, classes, attrs)
}
