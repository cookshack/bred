import * as Css from './css.mjs'
import * as Ev from './ev.mjs'
import * as Loc from './loc.mjs'
import * as Opt from './opt.mjs'
import * as Win from './win.mjs'

import callsites from '../lib/callsites.mjs'

let $messages

export
function assert
(val) {
  if (val)
    return
  yell('Error: assertion failed')
  throw new Error('Assertion failed')
}

export
function trace
(msg) {
  let bt

  function frame
  (fr, i) {
    let more

    console.log('frame ' + i)
    console.log(fr.getThis())
    console.log(fr.getFunction())

    more = '\n       ('
    more += 'isToplevel: ' + fr.isToplevel()
    more += ', isEval: ' + fr.isEval()
    more += ', isNative: ' + fr.isNative()
    more += ',\n        isConstructor: ' + fr.isConstructor()
    more += ', isAsync: ' + fr.isAsync()
    more += ', isPromiseAll: ' + fr.isPromiseAll()
    more += ',\n        promise index: ' + fr.getPromiseIndex()
    more += ', type: ' + fr.getTypeName()
    more += ', method: ' + fr.getMethodName()
    more += ')'

    return [ '  ' + i + ': ' + fr.getFunctionName() + ' ' + fr.getFileName() + ':' + fr.getLineNumber() + ':' + fr.getColumnNumber() + more,
             { file: fr.getFileName(),
               line: fr.getLineNumber(),
               col: fr.getColumnNumber() } ]
  }

  bt = callsites()
  say('Backtrace:')
  bt.forEach((fr, i) => say(...frame(fr, i)))
  say(new Error(msg).stack)
  console.trace()
}

export
function toss
(msg) {
  trace(msg)
  yell(msg)
  throw new Error(msg)
}

export
function d
(arg) {
  push('debug', arg)
  console.debug(arg)
}

export
function log
(arg) {
  push('log', arg)
  console.log(arg)
}

export
function warn
(arg) {
  console.warn(arg)
  if (Opt.get('core.throwOnWarn.enabled'))
    throw new Error(arg)
}

function now
() {
  let date

  date = new Date()
  return Math.round(date.getTime() / 1000)
}

function isElement
(el) {
  return el instanceof globalThis.Element || el instanceof globalThis.HTMLDocument
}

function push
(type, arg, spec) {
  let text, file, line, col

  function simple
  (ex) {
    if (isElement(ex))
      return '<' + ex.nodeName?.toLowerCase() + '>'
    if ((typeof ex == 'string') || ex instanceof String)
      return "'" + ex + "'"
    if (typeof ex == 'number')
      return String(ex)
    if (typeof ex == 'boolean')
      return ex ? 'true' : 'false'
    return 0
  }

  function makeText
  (ex) {
    let t

    if ((typeof ex == 'string') || ex instanceof String)
      return ex

    t = simple(ex)
    if (t)
      return t

    if (typeof ex == 'object') {
      let s, i

      s = '{'
      i = 0
      for (let key of Object.keys(ex)) {
        let t, val

        if (i > 0)
          s += ','
        s += ' ' + key + ': '
        try {
          val = ex[key]
          t = simple()
        }
        catch {
          val = '??'
          t = '??'
        }
        s += (t || ('<' + typeof val + '>'))
        i++
      }
      s += ' }'
      return s
    }

    return typeof ex
  }

  text = makeText(arg)

  if (spec) {
    file = spec.file
    line = spec.line
    col = spec.col
  }
  else {
    let frame

    frame = callsites().find(fr => {
      let loc

      loc = Loc.make(fr.getFileName())
      if (loc.filename == 'mess.mjs')
        return 0
      return 1
    })
    if (frame) {
      file = frame.getFileName()
      line = frame.getLineNumber()
      col = frame.getColumnNumber()
    }
  }

  {
    let m

    m = { time: now(),
          type,
          file,
          line,
          col,
          //
          get text() {
            return text
          } }
    $messages.push(m)
    Ev.post('Mess.push', m)
  }

  if ($messages.length > 10000)
    $messages.pop()
}

export
function echoMore
(msg) {
  let win

  msg = msg || ''
  win = Win.current()
  if (win?.echo) {
    Css.remove(win.mini, 'yell')
    win.echo.innerText = msg
  }
  return msg
}

export
function say
(msg, spec) {
  msg = echoMore(msg)
  if (msg.length)
    push('say', msg, spec)
}

export
function yell
(msg) {
  let win

  win = Win.current()
  if (msg && msg.length) {
    if (win?.echo) {
      Css.add(win.mini, 'yell')
      win.echo.innerText = msg
    }
    push('yell', msg)
    console.info('yell: ' + msg)
  }
  else
    say()
}

export
function messages
() {
  return $messages
}

function init
() {
  $messages = []
}

init()
