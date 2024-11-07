import { append, divCl } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Em from './em.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import { d } from './mess.mjs'

export
function divW
() {
  return divCl('execute-ww', divCl('execute-w', ''))
}

export
function init
() {
  let mo, needle, callerBuf

  function refresh
  (w) {
    let all, needles

    d('needle: ' + needle)
    d(callerBuf)

    all = Cmd.getAll(callerBuf)
    if (needle.length)
      all = all.filter(cmd => {
        let s, sn

        s = cmd.name.toLowerCase().split(' ')
        sn = needle.trim().toLowerCase().split(' ')
        return sn.every((snw, i) => s[i] && s[i].startsWith(snw))
      })
    all = all.map(co => co.name)
    all.sort()
    Cmd.hist.items.slice().reverse().forEach(hi => {
      let i

      i = all.indexOf(hi)
      if (i >= 0)
        all.unshift(all.splice(i, 1)[0])
    })
    //all.forEach(co => d(co.name))

    w.innerHTML = ''

    needles = needle
    if (needle.length && all.length && all[0].length) {
      let ns

      // eg if first is "list matching lines"
      // "l m l" =>     "l    m        l    "
      ns = needle.trim().split(' ')
      //d(all[0])
      needles = all[0].split(' ').map((word, i) => {
        //d({word})
        if (ns[i])
          return Buf.capitalize(ns[i]) + ' '.repeat(word.length - ns[i].length + 1 /* for space between */)
        return ''
      })
      //d(needles)
      needles = needles.join('')
    }

    append(w,
           [ divCl('execute-needle', needles),
             ...all.map((name, i) => divCl('execute-cmd'
                                           + (i == 0 ? ' execute-cmd-current' : ''),
                                           name,
                                           { 'data-name': name,
                                             'data-run': 'select' })) ])
  }

  function viewInit
  (view) {
    let w

    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''
    needle = ''
    refresh(w)
  }

  function delPrev
  (u, we) {
    let p, w

    d('delPrev ' + we.e.key)
    p = Pane.current()
    w = p.ele.firstElementChild.firstElementChild
    if (Css.has(w, 'execute-w')) {
      needle = needle.slice(0, needle.length - 1)
      refresh(w)
    }
  }

  function selfIns
  (u, we) {
    let p, w

    d('adding ' + we.e.key)
    p = Pane.current()
    w = p.ele.firstElementChild.firstElementChild
    if (Css.has(w, 'execute-w')) {
      needle += we.e.key
      refresh(w)
    }
  }

  function next
  () {
    let p, w, current

    p = Pane.current()
    w = p.ele.firstElementChild.firstElementChild
    current = w.querySelector('.execute-cmd-current')
    if (current?.nextElementSibling) {
      Css.remove(current, 'execute-cmd-current')
      Css.add(current?.nextElementSibling, 'execute-cmd-current')
    }
  }

  function previous
  () {
    let p, w, current

    p = Pane.current()
    w = p.ele.firstElementChild.firstElementChild
    current = w.querySelector('.execute-cmd-current')
    if (current?.previousElementSibling) {
      Css.remove(current, 'execute-cmd-current')
      Css.add(current?.previousElementSibling, 'execute-cmd-current')
    }
  }

  function select
  (u, we) {
    let p, w, cb

    p = Pane.current()
    cb = p.buf.vars('execute').cb
    if (we?.e && (we.e.button == 0)) {
      let name

      name = we.e.target.dataset.name
      p.setBuf(callerBuf, null, 0, () => {
        if (cb)
          cb(name, callerBuf)
      })
      return
    }

    w = p.ele.firstElementChild.firstElementChild
    if (Css.has(w, 'execute-w')) {
      let current

      current = w.querySelector('.execute-cmd-current')
      if (current)
        p.setBuf(callerBuf, null, 0, () => {
          if (cb)
            cb(current.dataset.name, callerBuf)
        })
    }
  }

  needle = ''

  mo = Mode.add('Execute', { viewInit: viewInit })

  Cmd.add('execute', u => {
    let p, buf

    p = Pane.current()
    callerBuf = p?.buf
    buf = Buf.make('Execute', 'Execute', divW(), p.dir)
    buf.vars('execute').cb = (name, b) => Cmd.exec(name, b, u)
    p.setBuf(buf)
  })

  Cmd.add('next line', () => next(), mo)
  Cmd.add('previous line', () => previous(), mo)
  Cmd.add('select', () => select(), mo)

  Cmd.add('self insert', selfIns, mo)
  Cmd.add('delete previous char', delPrev, mo)

  Em.on('Enter', 'select', mo)
  Em.on('Backspace', 'delete previous char', mo)
  for (let d = 32; d <= 126; d++)
    Em.on(String.fromCharCode(d), 'self insert', mo)

  Em.on('C-n', 'next line', mo)
  Em.on('C-p', 'previous line', mo)

  Em.on('C-g', 'bury', mo)
  Em.on('Escape', 'bury', mo)

  Em.on('A-x', 'execute')
}
