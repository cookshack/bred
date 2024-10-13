import { append, divCl, img } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Hist from './hist.mjs'
import * as Icon from './icon.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import * as Scib from './scib.mjs'
import * as Tron from './tron.mjs'
import { d } from './mess.mjs'

let reErr, reFile

export
function divW
() {
  return Ed.divW(0, 0, { extraWWCss: 'shell-ww',
                         extraWCss: 'shell-w' })
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
  let ch, str

  ch = nextCh()
  str = ''
  d("runToString '" + sc + ' ' + args.join(' ') + "' in " + dir)

  Tron.on(ch, (err, d) => {
    let der

    der = new TextDecoder()

    if (err) {
      Mess.yell('Shell.runToString: ' + err.message)
      return
    }

    if (d.stdout)
      str += der.decode(d.stdout)
    if (d.stderr)
      str += der.decode(d.stderr)
    if (d.close !== undefined) {
      Mess.say('SC Done: ' + sc)
      if (cb)
        cb(str, d.code)
    }
  })

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
(b, dir, sc,
 // Insert at end. Only used if b.
 end,
 // For the first insert/append: if inserting at point
 // and point is at the end of the view, then point's
 // placement after the insert/append will be before
 // the added text.
 //
 // Used to prevent scroll on input, eg for c-c c (compile).
 //
 // Only used if b.
 afterEndPoint,
 args,
 runInShell,
 onStdout, // (str)
 onStderr, // (str)
 multi, // keep listening for more commands
 onClose) { // (b, code)
  let ch, bep

  ch = nextCh()
  bep = b && b.anyView().bep

  d("run '" + sc + "' [" + args + '] in ' + dir)

  Tron.on(ch, (err, data) => {
    let decoder

    decoder = new TextDecoder()
    if (err) {
      Mess.yell('Shell.run: ' + err.message)
      return
    }

    d({ data })

    if (data.stdout)
      d('OUT: ' + decoder.decode(data.stdout))
    if (data.stderr)
      d('ERR: ' + decoder.decode(data.stderr))

    if (b && data.stdout) {
      if (end)
        b.append(decoder.decode(data.stdout), afterEndPoint)
      else
        b.insert(decoder.decode(data.stdout), bep, afterEndPoint)
      afterEndPoint = 0
    }

    if (onStdout && data.stdout)
      onStdout(decoder.decode(data.stdout))

    if (b && data.stderr) {
      if (end)
        b.append(decoder.decode(data.stderr), afterEndPoint)
      else
        b.insert(decoder.decode(data.stderr), bep, afterEndPoint)
      afterEndPoint = 0
    }

    if (data.close) {
      if (b)
        b.ml.set('busy', 'exit ' + data.code)
      if (onClose)
        onClose(b, data.code)
      Mess.log('SC exit: ' + sc + ': ' + data.code)
    }

    if (onStderr && data.stderr)
      onStderr(decoder.decode(data.stderr))

    if (data.err) {
      if (b)
        b.ml.set('busy', 'exit err')
      Mess.say('SC err: ' + sc + ': ' + err.message)
    }
  })

  if (b) {
    b.ml.set('busy', 'busy')
    b.vars('Shell').ch = ch
  }

  Tron.cmd1('shell', [ ch, dir, sc, args || [], runInShell ? true : false, multi ? true : false ], (err, tch) => {
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
 end, // insert at end
 afterEndPoint, // see run
 args, hist, shell,
 multi, // keep listening for more commands
 onClose, // (buf, code)
 cb) { // (buf)
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
                 divCl('ml-name', name + (args ? (' ' + args.join(' ')) : '')),
                 divCl('ml-busy'),
                 divCl('ml-close'))
        }
      }
    }

    name = 'SC: ' + sc
    re = new RegExp(`^${Ed.escapeForRe(name)}(<[0-9]+>)?$`)
    b = Buf.find(b2 => re.test(b2.name))
    if (b) {
      b.clear()
      b.dir = dir
      b.views.forEach(view => setMl(view.ele))
    }
    else {
      let w

      w = divW()
      b = Buf.add(name, 'Shell', w, dir)
      b.icon = 'shell'
      setMl(w)
    }

    p.setBuf(b, null, null, cb)
  }

  if (hist)
    hist.add(sc)
  p = Pane.current()
  dir = Loc.make(p.buf.dir)
  dir.ensureSlash()
  dir = dir.path || Loc.home()
  addBuf(p, dir, sc,
         () => {
           run(p.buf, p.dir, sc, end, afterEndPoint, args, shell, 0, 0, multi, onClose)
           if (cb)
             cb(p.buf)
         })
}

export
function shell1
(sc, end, afterEndPoint, args, hist, multi, onClose, cb) { // (buf)
  shellOrSpawn1(sc, end, afterEndPoint, args, hist, 1, multi, onClose, cb)
}

export
function spawn1
(sc, end, afterEndPoint, args, hist, cb) { // (buf)
  shellOrSpawn1(sc, end, afterEndPoint, args, hist, 0, cb)
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
() {
  let p, psn, text, match

  p = Pane.current()
  psn = p.view.psn
  psn.lineStart()

  text = psn.text
  match = text.match(reErr)
  if (match) {
    Pane.openFile(match[1], match[2])
    return
  }

  match = text.match(reFile)
  if (match) {
    Pane.openFile(match[1])
    return
  }

  Mess.say('Move to an error line first')
}

function initCompile
() {
  let mo, buf, compileHist

  function onClose
  (buf, code) {
    let now

    now = new Date()
    buf.append('\n=== Compile exit with ' + code + ' on ' + now.toLocaleString() + '\n')
  }

  function compile
  () {
    let p, w, ml, hist, modes

    p = Pane.current()

    w = Ed.divW(0, 0, { extraWWCss: 'shell-ww',
                        extraWCss: 'shell-w',
                        extraCo: divCl('bred-filler') })
    ml = w.querySelector('.edMl')
    if (ml)
      ml.innerText = 'Compile Command:'

    if (buf) {
      buf.vars('SC').hist.reset()
      buf.dir = p.dir
    }
    else {
      buf = Buf.make('Enter Compile Command', 'SC', w, p.dir)
      compileHist.reset()
      buf.vars('SC').hist = compileHist
    }
    buf.vars('SC').afterEndPoint = 1 // initial command output goes after point if point at end
    modes = [ 'compile' /*, 'view' */ ]
    modes.push('ansi')
    buf.vars('SC').modes = modes
    buf.vars('SC').onClose = onClose
    buf.vars('ed').fillParent = 0
    buf.opts.set('core.autocomplete.enabled', 0)
    buf.opts.set('core.folding.enabled', 0)
    buf.opts.set('core.line.numbers.show', 0)
    buf.opts.set('core.lint.enabled', 0)
    buf.opts.set('core.minimap.enabled', 0)
    p.buf = buf
    buf.clear()
    hist = buf.vars('SC').hist
    if (hist.length)
      p.view.insert(hist.to(0))
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
  Cmd.add('next error', () => nextErr(1), mo)
  Cmd.add('previous error', () => nextErr(-1), mo)

  Em.on('e', 'edit', mo)
  Em.on('n', 'next error', mo)
  Em.on('p', 'previous error', mo)
  Em.on('Enter', 'edit', mo)

  // should use view mode
  Em.on('q', 'bury', mo)
  Em.on('Backspace', 'scroll up', mo)
  Em.on(' ', 'scroll down', mo)

  Cmd.add('compile', () => compile())
}

export
function init
() {
  let mo, hist

  function prep
  (p) {
    let prompt, l

    prompt = ''
    l = p.view.line
    if (l.startsWith('$ ')) {
      prompt = '$ '
      l = l.slice(2)
    }
    else if (l.startsWith('> ')) {
      prompt = '> '
      l = l.slice(2)
    }
    p.buf.clearLine()
    p.view.insert(prompt)
    return l || ''
  }

  function next
  () {
    let p

    p = Pane.current()
    prep(p)
    hist.next(p.buf, 1)
  }

  function prev
  () {
    let p

    p = Pane.current()
    hist.prev(p.buf, 1, prep(p))
  }

  function selfInsert
  (u, we) {
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
        Cmd.runMo('self insert', 'Ed', 1, { e: e })
      }
      finally {
        globalThis.window.onkeydown = oldOnKeyDown
        Mess.say()
      }
    }
  }

  function enter
  () {
    let ch, p, l, match

    p = Pane.current()
    ch = p.buf.vars('Shell').ch
    l = p.view.line

    // hack for prompt
    match = l.match(/^[^$#]*[$#] (.*)$/)
    if (match)
      l = match[1]
    else if (l.startsWith('> '))
      l = l.slice(2)

    l = l.trim()

    p.view.insert('\n')
    if (ch) {
      if (hist)
        hist.add(l)
      Tron.send(ch, { input: l + '\n' })
    }
  }

  function shell
  () {
    shell1('', 1, 0, [], null, 1)
  }

  reErr = /^([^:]+):([0-9]+):([0-9]+):.*$/d
  reFile = /^([^:\s]+):([^0-9]+.*)?$/d

  hist = Hist.ensure('shell')

  mo = Mode.add('Shell', { viewInit: Ed.viewInit,
                           viewCopy: Ed.viewCopy,
                           initFns: Ed.initModeFns,
                           parentsForEm: 'ed' })

  Cmd.add('next', () => next(), mo)
  Cmd.add('previous', () => prev(), mo)
  Cmd.add('self insert', selfInsert, mo)
  Cmd.add('quoted insert', quotedInsert, mo)
  Cmd.add('shell run', enter, mo)

  Em.on('ArrowUp', 'Previous', mo)
  Em.on('ArrowDown', 'Next', mo)
  Em.on('A-p', 'Previous', mo)
  Em.on('A-n', 'Next', mo)
  Em.on('Enter', 'shell run', mo)

  Cmd.add('shell', shell)

  Scib.init()
  initCompile()
}

export { reErr, reFile }
