import { append, divCl, img } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Hist from './hist.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import * as Recent from './recent.mjs'
import { d } from './mess.mjs'

export
function init
() {
  let mo, buf, old, under, ml, hist

  function divW
  () {
    return Ed.divW(0, 0, { extraWWCss: 'switch-ww',
                           extraWCss: 'switch-w bred-opener-w',
                           extraCo: [ divCl('switch-under'),
                                      divCl('switch-under-icon', img('img/prompt.svg', '>', 'filter-clr-nb0')) ] })
  }

  function compactPath
  (path) {
    let file, home

    file = 'file://'
    home = Loc.home() // guaranteed trailing /

    if (path.startsWith(file + home))
      return ':' + path.slice(file.length + home.length)

    if (path.startsWith(file))
      return path.slice(file.length)

    if (path.startsWith(home))
      return ':' + path.slice(home.length)

    home = home.slice(0, home.length - 1)
    if (path.startsWith(home))
      return ':' + path.slice(home.length)

    return path
  }

  function refresh
  (view) {
    let text, needles, vars, all, needle, rec, candidate, eNeedle, regex

    function match
    (name) {
      return regex.test(name)
      //return name.split(/\s+/).some(word => word.toLowerCase().startsWith(needle))
    }

    text = buf.text() || ''
    under.innerHTML = ''
    if (ml)
      ml.innerText = 'Switch to buffer'
    vars = view.buf.vars('switch')
    vars.needle = vars.needle || ''
    needles = text
    needle = text.toLowerCase()
    if (needle.length) {
      let re, split

      // 'ab j' => about.js
      split = needle.split(' ').filter(s => s.length)
      if (split.length) {
        // \p{L} is any char classified as letter in unicode
        re = Ed.escapeForRe(split[0]) + '\\p{L}*'
        for (let i = 1; i < split.length; i++)
          // so match can have any word chars then must have some other chars then must have the split
          re += '[^\\p{L}]+' + Ed.escapeForRe(split[i]) + '\\p{L}*'
        re += '.*'
        0 && d('REGEX: ' + re)
        regex = new RegExp(re, 'ui') // unicode, insensitive
      }
    }

    all = Buf.getRing()
    // put current buf at end
    if (all.length) {
      let old

      all = all.filter(b => {
        if (b.name == vars.oldBuf?.name) {
          old = b
          return 0
        }
        return 1
      })
      if (old)
        all.push(old)
    }

    Recent.get(0, (err, recents) => {

      if (err)
        Mess.toss(err)

      rec = []
      recents.forEach(r => {
        //d(r)
        if (r.href.startsWith('file://')
            || r.href.startsWith('/')) {
          let loc

          loc = Loc.make(r.href)
          rec.push({ name: loc.filename,
                     path: loc.path })
        }
      })

      if (regex) {
        all = all.filter(b => b.name.length && match(b.name, needle))
        rec = rec.filter(r => r.name.length && match(r.name, needle))
      }
      else {
        all = all.filter(b => b.name.length)
        rec = rec.filter(r => r.name.length)
      }

      if (all.length && all[0].name.length && needle.length)
        candidate = all[0]
      else if (rec.length && rec[0].name.length && needle.length)
        candidate = rec[0]

      if (candidate) {
        let common, name

        name = candidate.name
        common = Math.min(needle.length, name.length)
        if (common >= needle.length) {
          let lname, lneedle

          lname = name.toLowerCase()
          lneedle = needle.toLowerCase()
          if (lname.startsWith(lneedle))
            needle = name.slice(0, needle.length)
          else
            needle = name.slice(0, lname.indexOf(lneedle) + lneedle.length)
        }
        else
          needle = name + needle.slice(name.length)
        needles = needle
      }

      if ((all.length == 0) && (rec.length == 0))
        ml.innerText = 'Create buffer'

      eNeedle = divCl('switch-needle' + ((all.length || rec.length) ? '' : ' switch-zero'),
                      needles)

      append(under,
             divCl('switch-list',
                   [ all.map((b,i) => [ divCl('switch-name onfill' + (i == 0 ? ' selected' : ''),
                                              b.name,
                                              { 'data-id': b.id,
                                                'data-run': 'select' }),
                                        divCl('switch-mode', b.mode.key),
                                        divCl('switch-path', compactPath(b.path)) ]),
                     all.length ? eNeedle : [],
                     rec.length && [ divCl('switch-sep' + (all.length ? '' : 'top'),
                                           'Recent'),
                                     divCl('switch-mode'),
                                     divCl('switch-path') ],
                     rec.map((r,i) => [ divCl('switch-name onfill' + (((i == 0) && (all.length == 0)) ? ' selected' : ''),
                                              [ r.name,
                                                // need it here for absolute positioning
                                                (i == 0) && (all.length == 0) && eNeedle ],
                                              { 'data-run': 'open link',
                                                'data-path': r.path }),
                                        divCl('switch-mode', ''),
                                        divCl('switch-path', compactPath(r.path)) ]) ]))
    })
  }

  function first
  () {
    let p, b

    p = Pane.current()
    b = p.view.ele.querySelector('.switch-name.selected')
    return b || p.view.ele.querySelector('.switch-name')
  }

  function openId
  (p, id, text) {
    let b

    b = Buf.find(b1 => b1.id == id)
    if (b) {
      if (text.length)
        hist.add(text)
      p.setBuf(b)
    }
    else
      Mess.say('Missing buffer ' + id)
    return
  }

  function select
  (u, we) {
    let p, text

    p = Pane.current()
    text = p.buf.text()
    if (we.e.target.dataset.id)
      openId(p, we.e.target.dataset.id, text)
    else if (we.e.target.dataset.path)
      Pane.open(we.e.target.dataset.path)
  }

  function switchToSelected
  () {
    let p, text, f

    p = Pane.current()
    text = p.buf.text()
    f = first()
    if (f) {
      if (f.dataset.id)
        openId(p, f.dataset.id, text)
      else if (f.dataset.path)
        Pane.open(f.dataset.path)
      return
    }

    // create
    if (text.length) {
      hist.add(text)
      Ed.make(p, { name: text, dir: p.dir })
    }
  }

  function nextSel
  () {
    let p, name

    p = Pane.current()
    name = p.view.ele.querySelector('.switch-name.selected')
    if (name) {
      let next

      next = name
      next = next.nextElementSibling // mode
      next = next?.nextElementSibling // path
      next = next?.nextElementSibling // name
      while (next
             && (Css.has(next, 'switch-sep')
                 || Css.has(next, 'switch-needle')))
        if (Css.has(next, 'switch-needle'))
          next = next?.nextElementSibling
        else {
          next = next.nextElementSibling // mode
          next = next?.nextElementSibling // path
          next = next?.nextElementSibling // name
        }

      if (next && Css.has(next, 'switch-name')) {
        Css.remove(name, 'selected')
        Css.add(next, 'selected')
      }
    }
  }

  function prevSel
  () {
    let p, name

    p = Pane.current()
    name = p.view.ele.querySelector('.switch-name.selected')
    if (name) {
      let next

      next = name
      do {
        next = next.previousElementSibling // path
        next = next?.previousElementSibling // mode
        next = next?.previousElementSibling // name
      } while (next && Css.has(next, 'switch-sep'))
      if (next) {
        Css.remove(name, 'selected')
        Css.add(next, 'selected')
      }
    }
  }

  function sw
  () {
    let p, w, dir, needOn

    p = Pane.current()

    old = p.buf
    w = divW()
    ml = w.querySelector('.edMl')
    if (ml)
      ml.innerText = 'Switch to buffer'

    if (buf)
      buf = buf
    else {
      buf = Buf.make({ name: 'Switch',
                       modeKey: 'switch',
                       content: w,
                       dir: p.dir })
      buf.icon = 'prompt'
      needOn = 1
      buf.vars('ed').fillParent = 0
      buf.opts.set('core.autocomplete.enabled', 0)
      buf.opts.set('core.brackets.close.enabled', 0)
      buf.opts.set('core.folding.enabled', 0)
      buf.opts.set('core.line.numbers.show', 0)
      buf.opts.set('core.lint.enabled', 0)
      buf.opts.set('minimap.enabled', 0)
      hist.reset()
      buf.file = 0
      //buf.dir = 0
    }
    buf.vars('switch').oldBuf = old

    dir = p.dir
    p.setBuf(buf, {}, () => {
      // view has been created
      buf.dir = dir

      ml = p.view.ele.querySelector('.edMl')
      under = p.view.ele.querySelector('.switch-under')
      if (under) {
        refresh(p.view)
        if (needOn)
          buf.on('change', () => {
            refresh(p.view)
          })
      }
      else
        Mess.toss('under missing')
    })
  }

  hist = Hist.ensure('switch')

  mo = Mode.add('Switch', { hidePoint: 1,
                            viewInitSpec: Ed.viewInitSpec,
                            initFns: Ed.initModeFns,
                            parentsForEm: 'ed' })

  Cmd.add('next', () => hist.next(buf), mo)
  Cmd.add('previous', () => hist.prev(buf), mo)
  Cmd.add('next selection', () => nextSel(), mo)
  Cmd.add('previous selection', () => prevSel(), mo)
  Cmd.add('select', select, mo)
  Cmd.add('switch to selected buffer', () => switchToSelected(), mo)

  Em.on('Enter', 'switch to selected buffer', mo)

  Em.on('A-n', 'Next', mo)
  Em.on('A-p', 'Previous', mo)

  Em.on('ArrowDown', 'Next Selection', mo)
  Em.on('ArrowUp', 'Previous Selection', mo)
  Em.on('C-g', 'Close Buffer', mo)
  Em.on('Escape', 'Close Buffer', mo)
  Em.on('C-n', 'Next Selection', mo)
  Em.on('C-p', 'Previous Selection', mo)
  Em.on('C-s', 'Idle', mo)
  Em.on('C-r', 'Idle', mo)

  Cmd.add('switch to buffer', () => sw())

  Em.on('C-x b', 'switch to buffer')
}
