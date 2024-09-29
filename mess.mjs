import * as Css from './css.mjs'
import * as Loc from './loc.mjs'
import elements from './elements.mjs'
import * as Ev from './ev.mjs'
import settings from './settings.mjs'

import callsites from './lib/callsites.mjs'

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

    return '  ' + i + ': ' + fr.getFunctionName() + ' ' + fr.getFileName() + ':' + fr.getLineNumber() + ':' + fr.getColumnNumber() + more
  }

  bt = callsites()
  say('Backtrace:')
  bt.forEach((fr, i) => say(frame(fr, i)))
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
  if (settings.throwOnWarn)
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
(type, arg) {
  let text, frame, file, line, col

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
      let s

      s = '{'
      Object.entries(ex).forEach((kv,i) => {
        let t

        if (i > 0)
          s += ','
        s += ' ' + kv[0] + ': '
        t = simple(kv[1])
        s += (t || ('<' + typeof kv[1] + '>'))
      })
      s += ' }'
      return s
    }

    return typeof ex
  }

  text = makeText(arg)

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

  {
    let m

    m = { time: now(),
          type: type,
          file: file,
          line: line,
          col: col,
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
  msg = msg || ''
  if ((typeof elements.echo !== 'undefined') && elements.echo) {
    Css.remove(elements.mini, 'yell')
    elements.echo.innerText = msg
  }
  return msg
}

export
function say
(msg) {
  msg = echoMore(msg)
  if (msg.length)
    push('say', msg)
}

export
function yell
(msg) {
  if (msg && msg.length) {
    if ((typeof elements.echo !== 'undefined') && elements.echo) {
      Css.add(elements.mini, 'yell')
      elements.echo.innerText = msg
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
