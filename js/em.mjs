import * as Css from './css.mjs'
import * as Cmd from './cmd.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import * as U from './util.mjs'

import * as EvParser from '../lib/ev-parser.mjs'

let root, wes, ems, getActive, d

d = () => {}
//d = Mess.d

export
function init
() {
  getActive = mainGetActive
  ems = []

  reset()

  root = add('Global')
}

export
function make
(name, spec) {
  let key, ons // ebs?
  let otherwise

  function on
  (key, to) {
    ons[key] = { key, to }
  }

  function setOtherwise
  (to) {
    if (to)
      return otherwise = { to }
    return otherwise = 0
  }

  function look
  (wes, // wrapped events
   cb) { // (to)
    let to

    function look1
    (w) {
      let kb // eb?

      if (to.ons) {
      }
      else {
        Mess.warn('look1 found command before end')
        return 0
      }

      if (w.mouse) {
        d('look1  ' + w.name)
        kb = to.ons[w.name]
      }
      else {
        d('look1  ' + w.e.code + ' ' + w.e.key)

        // Have to do it this way in case capslock is set as an extra ctrl
        // in the os. If so then on down of capslock the browser sends
        // keydown event as CapsLock instead of Control.
        if (w.e.ctrlKey) {
          d('look1  ctrlKey')
          kb = to.ons['Control']
          if (kb && kb.to && kb.to.ons) {
            d('look1  Control is a map')
            to = kb.to
          }
          else if (kb && kb.to) {
            Mess.warn('Control bound to cmd')
            return 0
          }
          else
            return 0
        }

        if (w.e.altKey) {
          d('look1  altKey')
          kb = to.ons['Alt']
          if (kb && kb.to && kb.to.ons) {
            d('look1  Alt is a map')
            to = kb.to
          }
          else if (kb && kb.to) {
            Mess.warn('Alt bound to cmd')
            return 0
          }
          else
            return 0
        }

        kb = to.ons[w.e.key]
      }

      kb = kb || otherwise

      if (kb) {
        if (kb.to) {
          d('look1  kb is a ' + (kb.to.ons ? 'map' : 'cmd'))
          to = kb.to
          return 1
        }
        Mess.log('look1 ' + key + ': kb missing to')
      }

      return 0
    }

    to = { ons }
    d('look in ' + name)
    if (wes.every(look1))
      return cb(to)
    return cb()
  }

  ons = []
  key = name || ''
  if (spec && spec.length)
    key += (': ' + spec)
  else
    key += ':'

  return { key,
           name,
           spec,
           ons,
           //
           get otherwise() {
             return otherwise.to
           },
           set otherwise(to) {
             return setOtherwise(to)
           },
           //
           look,
           on }
}

export
function get
(name) {
  return ems[name]
}

export
function add
(name, spec) {
  let key

  spec = spec || ''
  key = name + spec
  if (ems[key])
    return ems[key]
  ems[key] = make(name, spec)
  return ems[key]
}

function split
(seq, to, firstEm) {
  let ret, name, spec, evs, eend

  // C-c A-g      Ctrl + c then Alt + g
  // C-C g a      Ctrl + Capital C then g then a
  // C            Capital C
  // C-A-g        C must come first

  firstEm = firstEm || root
  name = firstEm.name
  ret = [ firstEm ]
  spec = ''

  evs = EvParser.parse(seq)
  d(evs)
  eend = evs.length - 1
  for (let ei = 0; ei <= eend; ei++) {
    let keys, em

    // a, A, C-a, C-A, C-A-a, C-A-A, Backspace, C-Backspace, C-A-Backspace, -, C--, C-A--, ' ', 'C- ', 'C-A- '

    keys = evs[ei]

    if (keys.startsWith('C-A-')) {
      spec += 'C-'
      em = add(name, spec)
      ret.at(-1).on('Control', em)
      ret.push(em)
      spec += 'A-'
      em = add(name, spec)
      ret.at(-1).on('Alt', em)
      ret.push(em)
      keys = keys.slice('C-A-'.length)
    }
    else if (keys.startsWith('C-')) {
      spec += 'C-'
      em = add(name, spec)
      ret.at(-1).on('Control', em)
      ret.push(em)
      keys = keys.slice('C-'.length)
    }
    else if (keys.startsWith('A-')) {
      spec += 'A-'
      em = add(name, spec)
      ret.at(-1).on('Alt', em)
      ret.push(em)
      keys = keys.slice('A-'.length)
    }

    if (keys.length == 0)
      Mess.toss('Key ended too early (spec: ' + spec + ')')

    if ((keys.length > 1) && keys.includes('-'))
      Mess.toss('- out of place (spec: ' + spec + ')')

    if (ei == eend) {
      d('binding ' + to + ' to ' + keys + ' (' + spec + ')')
      ret.at(-1).on(keys, to)
      ret.push(keys)
      d(ret)
      return ret
    }
    spec += keys
    em = add(name, spec)
    ret.at(-1).on(keys, em)
    ret.push(em)

    spec += ' '
  }
  Mess.toss('Sequence ended too early (spec: ' + spec + ')')
  return 0
}

export
function on
(seq, to, modeOrNameOrEm) {
  let em, mo

  if (modeOrNameOrEm)
    if ((typeof modeOrNameOrEm == 'string') || modeOrNameOrEm instanceof String)
      mo = Mode.get(modeOrNameOrEm) || Mess.toss('Mode missing: ' + modeOrNameOrEm)
    else if (modeOrNameOrEm.ons)
      em = modeOrNameOrEm
    else
      mo = modeOrNameOrEm

  split(seq, to, em ? em : (mo ? mo.em : root))
}

export
function mainGetActive
(buf, targetEm) {
  let active, mo, minors

  mo = buf?.mode
  minors = buf?.minors
  active = [ root ]
  if (mo) {
    active = [ ...mo.getParentEms(), ...active ]
    if (mo.em)
      active.unshift(mo?.em)
    if (minors)
      active = [ ...minors.map(m => m.em), ...active ]
  }
  if (targetEm)
    active.unshift(targetEm)
  return active
}

export
function replace
(fn) {
  if (fn)
    getActive = fn
  else
    getActive = mainGetActive
}

export
function look
(wes, active, buf, cb) { // (em, to)
  let ret

  active ||= getActive(buf)
  for (let i = 0; (i < active.length); i++)
    if (active[i].look(wes, to => {
      d('look to: ' + to)
      if (to) {
        ret = { map: active[i], to }
        return 1
      }
      return 0
    }))
      break
  if (ret)
    cb(ret.map, ret.to)
  else
    cb()
}

export
function handle
(we, view) {
  let active, buf, targetEm

  function updateMini
  (name) {
    Mess.echoMore(name)
  }

  buf = view?.buf

  if (we.mouse) {
    // Primary (often left)
    if (we.e?.button == 0) {
      let name, run, target

      target = we.e?.target
      run = target?.dataset?.run
      if (run) {
        let p

        p = Pane.holding(target)
        if (p)
          p.focus()
        reset()
        Mess.say('')

        buf = buf || Pane.current()?.buf

        if (Css.has(target.parentNode, 'bred-context'))
          Css.remove(target.parentNode, 'bred-open')

        Css.remove(target.parentNode?.parentNode, 'bred-open')

        d('cmd on data-run: ' + run)
        Cmd.run(run, buf, Cmd.universal(run), we)
        if (target.dataset.after)
          Cmd.run(target.dataset.after, buf, 1, we)
        return
      }

      name = we.e?.target?.dataset?.em
      if (name) {
        targetEm = get(name)
        if (targetEm) {
        }
        else
          Mess.warn('target has data-em and em is missing: ' + name)
      }
    }
    // Aux (often middle/wheel)
    if (we.e?.button == 1) {
      let run, target

      target = we.e?.target
      run = target?.dataset?.runaux
      if (run) {
        let p

        p = Pane.holding(target)
        if (p)
          p.focus()
        reset()
        Mess.say('')

        buf = buf || Pane.current()?.buf

        if (Css.has(target.parentNode, 'bred-context'))
          Css.remove(target.parentNode, 'bred-open')

        Css.remove(target.parentNode?.parentNode, 'bred-open')

        d('cmd on data-runaux: ' + run)
        Cmd.run(run, buf, Cmd.universal(run), we)
        if (target.dataset.afteraux)
          Cmd.run(target.dataset.afteraux, buf, 1, we)
        return
      }
    }
  }
  else {
    if ([ 'Alt', 'Control', 'CapsLock', 'Shift' ].includes(we.e.key))
      // see note at top of look1
      return
    we.e.preventDefault()
  }

  active = getActive(buf, targetEm)

  //active.forEach(em => d(em))

  if (wes.length == 0)
    Mess.say('')

  wes.push(we)
  look(wes,
       active,
       buf,
       (map, to) => {
         d('handle to: ' + to)
         if (to) {
           we.e.preventDefault()

           if (to.ons) {
             // map
             updateMini(to.spec)
             return
           }

           // cmd
           reset()
           Mess.say('')
           Cmd.run(to, buf, Cmd.universal(to), we)
         }
         else if (0) {
           let n

           // empty/error
           n = ''
           if (we.e.ctrlKey)
             n += 'C-'
           if (we.e.altKey)
             n += 'A-'
           n += (we.mouse ? we.name : we.e.key)
           updateMini(' ' + n + ' is empty')
           reset()
         }
         else {
           let onEmpty

           if (we.mouse) {
           }
           else if (we.e.ctrlKey && (we.e.key == 'g')) {
             Pane.cancel()
             return
           }

           onEmpty = buf?.mode?.onEmEmpty
           if (onEmpty)
             onEmpty(view, wes, updateMini)
           else
             updateMini(U.shrug)

           reset()
         }
       })
}

export
function reset
() {
  wes = []
}

export
function cancel
() {
  reset()
}

export
function seqA
(cmdName, em, acc) {
  let ons

  em = em || root
  acc = acc || []
  ons = Object.values(em.ons)
  for (let i = 0; i < ons.length; i++) {
    let on

    on = ons[i]

    //d("consider " + on.key)
    //d(on)

    if (on.to == cmdName)
      // found
      //d("found")
      return [ ...acc, on.key ]

    if (on.to.ons) {
      let newAcc

      // recurse into map
      //d("recurse")
      newAcc = seqA(cmdName, on.to, [ ...acc, on.key ])
      if (newAcc)
        return newAcc
    }

    // try next
    //d("try next")
  }
  return 0
}

function seqMode
(cmdName, buf, mode) {
  let a

  //if (buf.minors)
  if (mode.em)
    a = seqA(cmdName, mode.em)
  if (a)
    return a
  if (mode.parentsForEm)
    for (let i = 0; i < mode.parentsForEm.length; i++) {
      let pmo

      pmo = Mode.get(mode.parentsForEm[i])
      if (pmo?.em)
        a = seqA(cmdName, pmo.em)
      if (a)
        return a
    }
  return seqA(cmdName)
}

export
function seq
(cmdName, buf) {
  let a

  if (buf?.mode)
    a = seqMode(cmdName, buf, buf.mode)
  else
    a = seqA(cmdName)
  if (a)
    return a.reduce((acc,cur) => {
      if (cur == 'Control')
        return acc + 'C-'
      if (cur == 'Alt')
        return acc + 'A-'
      if (cur == 'Meta')
        return acc + 'M-'
      if (cur == 'Shift')
        return acc + 'S-'
      return acc + cur + ' '
    }, '').trim()
  return 0
}
