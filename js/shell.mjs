import { append, divCl, img } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Hist from './hist.mjs'
import * as Icon from './icon.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Scib from './scib.mjs'
import * as Tron from './tron.mjs'
import * as U from './util.mjs'
import { d } from './mess.mjs'

let reErr, reFile

export
function divW
() {
  let exitW

  exitW = divCl('shell-exit-w shell-busy', '⋯') // 🌀
  return Ed.divW(0, 0, { extraWWCss: 'shell-ww',
                         extraWCss: 'shell-w',
                         extraCo: exitW })
}

let chInt

chInt = 0

export
function nextCh
() {
  return 'shellCh' + chInt++
}

export
function runToString
(dir, sc, args, runInShell, cb) { // (str, code)
  let ch, str, handler

  ch = nextCh()
  str = ''
  args = args || []
  d("runToString '" + sc + ' ' + args.join(' ') + "' in " + dir)

  // Define the IPC handler so we can remove it later
  handler = (err, data) => {
    let der

    der = new TextDecoder()

    if (err) {
      Mess.yell('Shell.runToString: ' + err.message)
      // Clean up listener on error
      Tron.off(ch, handler)
      return
    }

    if (data.stdout)
      if (typeof data.stdout == 'string')
        str += data.stdout
      else
        str += der.decode(data.stdout)
    if (data.stderr)
      if (typeof data.stderr == 'string')
        str += data.stderr
      else
        str += der.decode(data.stderr)

    if (data.close === undefined) {
      // still running, do nothing
    }
    else if (cb) {
      // Invoke callback with final output and exit code
      cb(str, data.code)
      // Clean up listener after completion
      Tron.off(ch, handler)
    }
  }

  Tron.on(ch, handler)

  Tron.cmd1('shell', [ ch, dir, sc, args || [], runInShell ? true : false ], (err, tch) => {
    if (err)
      Mess.toss(err)
    if (ch == tch) {
      // good
    }
    else
      Mess.warn('tron ch should be ' + ch + ': ' + tch)
  })
}

export
function run
(dir,
 sc,
 args, // []
 // { buf, // optional
 //   end, // Insert at end. Only used if buf.
 //
 //   // For the first insert/append: if inserting at point
 //   // and point is at the end of the view, then point's
 //   // placement after the insert/append will be before
 //   // the added text.
 //
 //   // Used to prevent scroll on input, eg for c-c c (compile).
 //
 //   // Only used if buf.
 //   afterEndPoint,
 //   cols,
 //   runInShell,
 //   onStdout, // (str)
 //   onStderr, // (str)
 //   multi, // keep listening for more commands
 //   onClose // (buf, code)
 //   onErr } // (buf, err)
 spec) {
  let ch, bep, b, handler

  spec = spec || {}
  b = spec.buf
  ch = nextCh()
  bep = b && (b.anyView()?.bep || 0)

  d("run '" + sc + "' [" + args + '] in ' + dir)

  if (b) {
    b.vars('shell').sc = sc
    b.vars('shell').args = args
    b.vars('shell').spec = spec
    b.vars('shell').code = null
    b.onRemove(() => {
      d('RUN remove ch ' + ch)
      Tron.send(ch, { exit: 1 })
    })
  }

  // Define the IPC handler so we can remove it after the command finishes
  handler = (err, data) => {
    let decoder

    function decode
    (str) {
      if (typeof str == 'string')
        return str
      return decoder.decode(str)
    }

    decoder = new TextDecoder()
    if (err) {
      Mess.yell('Shell.run: ' + err.message)
      // Clean up on error
      Tron.off(ch, handler)
      return
    }

    //d({ data })

    if (0 && data.stdout)
      d('OUT: ' + decode(data.stdout))
    if (0 && data.stderr)
      d('ERR: ' + decode(data.stderr))

    if (b && data.stdout) {
      if (spec.end)
        b.append(decode(data.stdout), spec.afterEndPoint)
      else
        b.insert(decode(data.stdout), bep, spec.afterEndPoint)
      b.vars('Shell').lastLineText = b.line(-1)
      //d('lastLineText: ' + b.vars('Shell').lastLineText)
      spec.afterEndPoint = 0
    }

    if (spec.onStdout && data.stdout)
      spec.onStdout(decode(data.stdout))

    if (b && data.stderr) {
      if (spec.end)
        b.append(decode(data.stderr), spec.afterEndPoint)
      else
        b.insert(decode(data.stderr), bep, spec.afterEndPoint)
      spec.afterEndPoint = 0
    }

    if (data.close) {
      if (b) {
        b.ml.set('busy', 'exit ' + data.code)
        b.vars('shell').code = data.code
      }
      if (spec.onClose)
        spec.onClose(b, data.code)
      Mess.log('SC exit: ' + sc + ': ' + data.code)
      // Clean up listener after command finishes
      Tron.off(ch, handler)
    }

    if (spec.onStderr && data.stderr)
      spec.onStderr(decode(data.stderr))

    if (data.err) {
      if (b)
        b.ml.set('busy', 'exit err')
      if (spec.onErr)
        spec.onErr(b, err)
      Mess.say('SC err: ' + sc + ': ' + err.message)
      // Clean up on error condition as well
      Tron.off(ch, handler)
    }
  }

  Tron.on(ch, handler)

  if (b) {
    b.ml.set('busy', 'busy')
    b.vars('Shell').ch = ch
  }

  Tron.cmd1('shell.run',
            [ ch, dir, sc, args || [], { runInShell: spec.runInShell,
                                         multi: spec.multi,
                                         cols: spec.cols } ],
            (err, tch) => {
              if (err)
                Mess.toss(err)
              if (ch == tch) {
                // good
              }
              else
                Mess.warn('tron ch should be ' + ch + ': ' + tch)
            })
}

function shellOrSpawn1
(sc,
 // { end, // insert at end
 //   afterEndPoint, // see run
 //   args,
 //   hist,
 //   shell,
 //   multi, // keep listening for more commands
 //   onClose // (buf, code)
 //   onErr } // (buf, err)
 spec,
 // (buf)
 cb) {
  let p, dir

  function addBuf
  (p, dir, sc, cb) {
    let b, re, name

    function setMl
    (w) {
      if (w) {
        let ml

        ml = w.querySelector('.edMl')
        if (ml) {
          ml.innerText = ''
          append(ml,
                 divCl('edMl-type', img(Icon.path('shell'), 'Shell', 'filter-clr-text')),
                 divCl('ml-name', name),
                 divCl('ml-busy'),
                 divCl('ml-close'))
        }
      }
    }

    name = 'SC: ' + sc + (spec.args?.length ? (' ' + spec.args.join(' ')) : '')
    re = new RegExp(`^${Ed.escapeForRe(name)}(<[0-9]+>)?$`)
    b = Buf.find(b2 => re.test(b2.name))
    if (b) {
      b.dir = dir
      b.views.forEach(view => setMl(view.ele))
    }
    else {
      let w

      w = divW()
      b = Buf.add(name, 'Shell', w, dir)
      b.icon = 'shell'
      b.vars('ed').fillParent = 0
      setMl(w)
    }

    p.setBuf(b, {}, () => {
      b.clear()
      if (cb)
        cb(b)
    })
  }

  function onClose
  (b, code) {
    b.views.forEach(view => {
      if (view.ele) {
        let el

        el = view.ele.querySelector('.shell-exit-w')
        if (el) {
          Css.remove(el, 'shell-busy')
          if (code == 0)
            el.innerHTML = '✔ ' + code // 🏁 ✔✔✔ 🎉 ✅
          else
            el.innerHTML = '✘ ' + code // 🚨 ✘✘✘ 🚫 ❌
        }
      }
    })
    if (spec.onClose)
      spec.onClose(b, code)
  }

  function onErr
  (b, err) {
    b.views.forEach(view => {
      if (view.ele) {
        let el

        el = view.ele.querySelector('.shell-exit-w')
        if (el) {
          Css.remove(el, 'shell-busy')
          el.innerHTML = '☠️ ERR ' + err.message
        }
      }
    })
    if (spec.onErr)
      spec.onErr(b, err)
  }

  spec = spec || {}
  if (spec.hist)
    spec.hist.add(sc)
  p = Pane.current()
  dir = Loc.make(p.buf.dir)
  dir.ensureSlash()
  dir = dir.path || Loc.home()
  addBuf(p, dir, sc,
         buf => {
           run(dir, sc, spec.args,
               { buf,
                 cols: p.cols,
                 end: spec.end,
                 afterEndPoint: spec.afterEndPoint,
                 runInShell: spec.shell,
                 multi: spec.multi,
                 onClose,
                 onErr })
           if (cb)
             cb(buf)
         })
}

export
function shell1
(sc, spec, cb) {
  spec = spec || {}
  spec.shell = 1
  shellOrSpawn1(sc, spec, cb)
}

export
function spawn1
(sc, args, spec, cb) { // (buf)
  spec = spec || {}
  spec.shell = 0
  spec.args = args
  shellOrSpawn1(sc,
                spec,
                cb)
}

export
function nextErr
(n) {
  let p, psn, mv

  if (n == 0)
    return

  p = Pane.current()
  psn = p.view.psn
  psn.lineStart()

  if (n > 0)
    mv = psn.lineNext
  else
    mv = psn.linePrev

  while (mv())
    if (psn.text.match(reErr)) {
      p.view.bep = psn.bep
      return
    }

  if (n > 0)
    p.view.bufEnd()
  else
    p.view.bufStart()
  Mess.say("That's all")
}

export
function edit
(other) {
  let p, psn, text, match

  function abs
  (path) {
    if (p.dir && Loc.make(path).relative)
      return Loc.make(p.dir).join(path)
    return path
  }

  p = Pane.current()
  if (other)
    Pane.nextOrSplit()

  psn = p.view.psn
  psn.lineStart()

  text = U.stripAnsi(psn.text)
  match = text.match(reErr)
  if (match) {
    Pane.openFile(abs(match[1]), match[2])
    return
  }

  match = text.match(reFile)
  if (match) {
    Pane.openFile(abs(match[1]))
    return
  }

  Mess.say('Move to an error line first')
}

function initCompile
() {
  let mo, compileHist

  function onClose
  (buf, code) {
    let now

    now = new Date()
    buf.append('\n=== Compile exit with ' + code + ' on ' + now.toLocaleString() + '\n')
  }

  function runText
  (text) {
    Scib.runText(text,
                 { afterEndPoint: 1, // initial command output goes after point if point at end
                   hist: compileHist,
                   modes: [ 'compile' /*, 'view' */ ],
                   onClose })
  }

  function compile
  () {
    Prompt.ask({ text: 'Compile Command:',
                 hist: compileHist },
               runText)
  }

  compileHist = Hist.ensure('compile')

  mo = Mode.add('Compile',
                { viewInit: Ed.viewInit,
                  viewCopy: Ed.viewCopy,
                  initFns: Ed.initModeFns,
                  parentsForEm: 'ed',
                  decorators: [ { regex: reErr,
                                  decor: [ { attr: { style: 'color: var(--rule-clr-comment);',
                                                     'data-run': 'edit' } },
                                           { attr: { style: 'color: var(--rule-clr-comment);' } },
                                           { attr: { style: 'color: var(--rule-clr-comment);' } } ] },
                                { regex: reFile,
                                  decor: [ { attr: { style: 'color: var(--rule-clr-entity);',
                                                     'data-run': 'edit' } } ] } ] })

  Cmd.add('edit', () => edit(), mo)
  Cmd.add('edit in other pane', () => edit(1), mo)
  Cmd.add('next error', () => nextErr(1), mo)
  Cmd.add('previous error', () => nextErr(-1), mo)

  Em.on('e', 'edit', mo)
  Em.on('n', 'next error', mo)
  Em.on('o', 'edit in other pane', mo)
  Em.on('p', 'previous error', mo)
  Em.on('Enter', 'edit', mo)

  // should use view mode
  Em.on('q', 'bury', mo)
  Em.on('Backspace', 'scroll up', mo)
  Em.on(' ', 'scroll down', mo)

  Cmd.add('compile', () => compile())
}

export
function initJs
() {
  let hist

  hist = Hist.ensure('Js')

  Cmd.add('js', () => {
    let p

    p = Pane.current()
    Prompt.ask({ text: 'JS Expr',
                 hist },
               expr => {
                 hist.add(expr)
                 runToString(p.dir, 'node', [ '-e', 'console.log(' + expr + ')' ], 0, (str, code) => {
                   if (str) {
                     Mess.say(str.trim())
                     return
                   }
                   Mess.yell('Error: ' + code)
                 })
               })
  })
}

export
function initShell
() {
  let mo, hist

  function lineStart
  () {
    let p, l, last, prompt

    p = Pane.current()
    last = p.buf.vars('Shell').lastLineText
    //d('last: [' + last + ']')
    l = p.view.line
    //d('l: [' + l + ']')

    prompt = l.slice(0, last.length)
    p.view.lineStart()
    p.view.forward(prompt.length)
  }

  function enter
  () {
    let ch, p, l, last, input

    p = Pane.current()
    ch = p.buf.vars('Shell').ch
    last = p.buf.vars('Shell').lastLineText
    //d('last: [' + last + ']')
    l = p.view.line
    //d('l: [' + l + ']')

    input = l.slice(last.length).trim()

    p.view.lineEnd()
    p.view.insert('\n')
    if (ch) {
      let h

      h = p.buf.vars('Shell').hist || hist
      if (h)
        h.add(input)
      d('sending to ch ' + ch + ': ' + input)
      Tron.send(ch, { input: input + '\n' })
    }
  }

  function prep
  (p) {
    let prompt, l, last, input

    last = p.buf.vars('Shell').lastLineText
    //d('last: [' + last + ']')
    l = p.view.line
    //d('l: [' + l + ']')

    input = l.slice(last.length).trim()
    //d('input: [' + input + ']')
    prompt = l.slice(0, last.length)
    //d('prompt: [' + prompt + ']')

    p.buf.clearLine()
    p.view.insert(prompt)
    return input || ''
  }

  function next
  () {
    let p, h

    p = Pane.current()
    prep(p)
    h = p.buf.vars('Shell').hist || hist
    h.next(p.buf, 1)
  }

  function prev
  () {
    let p, h

    p = Pane.current()
    h = p.buf.vars('Shell').hist || hist
    h.prev(p.buf, 1, prep(p))
  }

  function rerun
  (p) {
    let sc, args, spec

    sc = p.buf.vars('shell').sc || Mess.toss('Shell command missing')
    args = p.buf.vars('shell').args
    spec = p.buf.vars('shell').spec
    p.buf.clear()
    spec.buf = p.buf
    run(p.dir, sc, args, spec)
  }

  function selfInsert
  (u, we) {
    let p

    p = Pane.current()
    if (U.defined(p.buf.vars('shell').code)) {
      let char

      char = Ed.charForInsert(we)
      if (char == 'g') {
        Prompt.yn('Rerun command?', {}, yes => yes && rerun(p))
        return
      }
      Mess.yell('Process has exited')
      return
    }
    Cmd.runMo('self insert', 'Ed', 1, we)
  }

  function quotedInsert
  () {
    let oldOnKeyDown

    oldOnKeyDown = globalThis.window.onkeydown
    Mess.echoMore('C-q-')
    globalThis.window.onkeydown = e => {
      e.preventDefault()
      if ([ 'Alt', 'Control', 'CapsLock', 'Shift' ].includes(e.key))
        return
      try {
        Cmd.runMo('self insert', 'Ed', 1, { e })
      }
      finally {
        globalThis.window.onkeydown = oldOnKeyDown
        Mess.say()
      }
    }
  }

  function shell
  () {
    shell1('', { end: 1,
                 multi: 1 })
  }

  // packages/codemirror-lang-kcl/src/index.ts:41:30 - error TS2345
  // /home/matt/fresh/main/gvmd/src/manage.h:1:1: error: unterminated comment
  reErr = /^([^:]+):([0-9]+):([0-9]*:?).*$/d
  reFile = /^([^:\s]+):([^0-9]+.*)?$/d

  hist = Hist.ensure('shell')

  mo = Mode.add('Shell', { viewInit: Ed.viewInit,
                           viewCopy: Ed.viewCopy,
                           initFns: Ed.initModeFns,
                           parentsForEm: 'ed' })

  Cmd.add('line start', () => lineStart(), mo)
  Cmd.add('next', () => next(), mo)
  Cmd.add('previous', () => prev(), mo)
  Cmd.add('self insert', selfInsert, mo)
  Cmd.add('quoted insert', quotedInsert, mo)
  Cmd.add('shell run', enter, mo)

  Em.on('ArrowUp', 'previous', mo)
  Em.on('ArrowDown', 'next', mo)
  Em.on('A-p', 'previous', mo)
  Em.on('A-n', 'next', mo)
  Em.on('Enter', 'shell run', mo)

  Cmd.add('shell', shell)
}

export
function init
() {
  initShell()
  Scib.init()
  initCompile()
  initJs()
}

export { reErr, reFile }
