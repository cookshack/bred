import { equal } from 'node:assert/strict'
import * as Cmd from '../js/cmd.mjs'
import * as Css from '../js/css.mjs'
import * as Frame from '../js/frame.mjs'
import * as Pane from '../js/Pane.mjs'
import * as Shell from '../js/shell.mjs'
import { setupPanes, wait, setBuf, fileBuf } from './pane-helpers.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

// runs a shell command in a buffer, resolving once the view is ready
function run
(sc, spec) {
  spec = { end: 1, ...spec }
  return new Promise(res => Shell.shell1(sc, spec, buf => res(buf)))
}

function text
(buf) {
  return viewText(buf.views[0])
}

function viewText
(view) {
  return view.ed.state.doc.toString()
}

function busy
(buf) {
  let el

  el = buf.views[0].ele.querySelector('.shell-exit-w')
  return Css.has(el, 'shell-busy') ? 1 : 0
}

function mlBusy
(buf) {
  return buf.views[0].ele.querySelector('.ml-busy').innerText
}

function exitDir
(buf) {
  return buf.views[0].ele.querySelector('.shell-exit-dir').textContent
}

// emit a shell event; the tron wrapper handles it in a timeout
async function emit
(panes, ch, data) {
  panes.shellChans[ch](data)
  await wait(10)
}

function rand
(state) {
  state.n = ((state.n * 1103515245) + 12345) % 2147483648
  return state.n
}

tests = {}

test('run', 'stdout then close updates buf and clears busy',
     async () => {
       let buf, ch, panes

       panes = setupPanes()
       buf = await run('echo hi')
       ch = buf.vars('Shell').ch
       equal(busy(buf), 1)

       await emit(panes, ch, { stdout: 'hi\n' })
       equal(text(buf).includes('hi'), true)

       await emit(panes, ch, { close: 1, code: 0 })
       equal(buf.vars('shell').code, 0)
       equal(busy(buf), 0)
     })

test('run', 'close without output, non-zero code',
     async () => {
       let buf, ch, panes

       panes = setupPanes()
       buf = await run('false')
       ch = buf.vars('Shell').ch

       await emit(panes, ch, { close: 1, code: 3 })
       equal(buf.vars('shell').code, 3)
       equal(busy(buf), 0)
     })

test('run', 'stderr is appended',
     async () => {
       let buf, ch, panes

       panes = setupPanes()
       buf = await run('echo hi')
       ch = buf.vars('Shell').ch

       await emit(panes, ch, { stderr: 'oops\n' })
       equal(text(buf).includes('oops'), true)

       await emit(panes, ch, { close: 1, code: 0 })
     })

test('run', 'late output after close is ignored',
     async () => {
       let buf, ch, h, panes

       panes = setupPanes()
       buf = await run('echo hi')
       ch = buf.vars('Shell').ch
       h = panes.shellChans[ch]

       await emit(panes, ch, { stdout: 'before\n' })
       await emit(panes, ch, { close: 1, code: 0 })
       h({ stdout: 'after\n' })
       await wait(10)

       equal(text(buf).includes('before'), true)
       equal(text(buf).includes('after'), false)
     })

// A buffer can be shown in more than one pane (eg after running a line in
// another pane and later running the same command normally). The pane the
// user is watching must get the output itself; other views catch up by peer
// sync, otherwise they show the exit code before any of the output.
test('view', 'output reaches the focused view',
     async () => {
       let buf, ch, panes

       panes = setupPanes()
       // let the panes' initial boot views finish before adding another view
       await wait(50)
       buf = await run('echo hi')
       ch = buf.vars('Shell').ch

       await setBuf(panes.pA, buf)
       panes.pA.focus()
       equal(buf.views.length, 2)

       await emit(panes, ch, { stdout: 'hi\n' })
       await emit(panes, ch, { close: 1, code: 0 })

       equal(viewText(panes.pA.view).includes('hi'), true)
       equal(panes.pA.view.ele.querySelector('.shell-exit-status').textContent, '✅ 0')
       equal(buf.views[0].ele.querySelector('.shell-exit-status').textContent, '✅ 0')
     })

// A view created after the command finished (eg a split) clones the buffer
// template, so the template must carry the real exit code, not BUSY.
test('view', 'a view created after the command finished shows its exit code',
     async () => {
       let buf, ch, panes

       panes = setupPanes()
       await wait(50)
       buf = await run('echo hi')
       ch = buf.vars('Shell').ch
       await emit(panes, ch, { stdout: 'hi\n' })
       await emit(panes, ch, { close: 1, code: 0 })

       await setBuf(panes.pA, buf)
       equal(buf.views.length, 2)
       equal(panes.pA.view.ele.querySelector('.shell-exit-status').textContent, '✅ 0')
       equal(buf.views[0].ele.querySelector('.shell-exit-status').textContent, '✅ 0')
     })

// The channel guard is only set once the view is ready, so two invocations
// in the same tick must not start two processes on one buffer.
test('run', 'two quick invocations start only one run',
     async () => {
       let buf, calls, orig

       setupPanes()
       await wait(50)
       calls = []
       orig = globalThis.tron.cmd
       globalThis.tron.cmd = async (name, args) => {
                               if (name == 'shell.run')
                                 calls.push(args[0])
                               return orig(name, args)
                             }
       try {
         let start

         start = run('echo hi')
         // invoke again before the first one's view is ready
         Shell.shell1('echo hi', { end: 1 })
         buf = await start
       }
       finally {
         globalThis.tron.cmd = orig
       }

       equal(calls.length, 1, 'only one run should start')
       equal(buf.views.length, 1)
     })

// rerunning with g starts a new process on the same buffer, so the exit bar
// must go back to busy instead of keeping the previous run's code
test('rerun', 'rerunning via g resets the exit bar to busy',
     async () => {
       let buf, ch, panes, view

       panes = setupPanes()
       await wait(50)
       buf = await run('echo hi')
       ch = buf.vars('Shell').ch
       view = buf.views[0]

       await emit(panes, ch, { close: 1, code: 3 })
       equal(busy(buf), 0)
       equal(view.ele.querySelector('.shell-exit-status').textContent, '❌ 3')

       // type g in the exited shell buffer, then answer the rerun confirm
       Cmd.runMo('self insert', 'Shell', 1, { e: { key: 'g' } })
       await wait(20)
       equal(view.ele.querySelector('.bred-confirm-w') == null, false)
       Cmd.run('nested yes', buf)
       await wait(20)

       equal(buf.vars('shell').code, null)
       equal(busy(buf), 1, 'exit bar should be busy during the rerun')
     })

// switching away closes (stashes) the buf's view, so output and the exit
// marker must still be applied to the stashed view/doc, not dropped
test('switch', 'output and close while buffer is not displayed are kept',
     async () => {
       let buf, ch, other, panes

       panes = setupPanes()
       buf = await run('echo hi')
       ch = buf.vars('Shell').ch

       other = fileBuf('switch-away.txt')
       await setBuf(panes.pB, other)
       equal(buf.views[0].ele == null, true, 'view should be stashed while away')

       await emit(panes, ch, { stdout: 'hi\n' })
       await emit(panes, ch, { close: 1, code: 0 })

       await setBuf(panes.pB, buf)

       equal(busy(buf), 0)
       equal(mlBusy(buf), 'exit 0')
       equal(buf.vars('shell').code, 0)
       equal(text(buf).includes('hi'), true)
     })

test('switch', 'insert (non-end) output while buffer is not displayed is kept',
     async () => {
       let buf, ch, other, panes

       panes = setupPanes()
       buf = await run('echo hi', { end: 0 })
       ch = buf.vars('Shell').ch

       other = fileBuf('switch-insert.txt')
       await setBuf(panes.pB, other)

       await emit(panes, ch, { stdout: 'hi\n' })
       await emit(panes, ch, { close: 1, code: 0 })

       await setBuf(panes.pB, buf)

       equal(busy(buf), 0)
       equal(text(buf).includes('hi'), true)
     })

test('switch', 'error while buffer is not displayed clears busy',
     async () => {
       let buf, ch, other, panes

       panes = setupPanes()
       buf = await run('echo hi')
       ch = buf.vars('Shell').ch

       other = fileBuf('switch-err.txt')
       await setBuf(panes.pB, other)

       await emit(panes, ch, { stderr: 'oops\n' })
       await emit(panes, ch, { err: new Error('spawn failed') })

       await setBuf(panes.pB, buf)

       equal(busy(buf), 0)
       equal(text(buf).includes('oops'), true)
     })

test('run', 'spawn error clears busy',
     async () => {
       let buf, ch, panes

       panes = setupPanes()
       buf = await run('echo hi')
       ch = buf.vars('Shell').ch

       await emit(panes, ch, { err: new Error('spawn failed') })
       equal(busy(buf), 0)
     })

test('run', 'rerunning reuses the buf and ignores the old channel',
     async () => {
       let buf, ch1, ch2, h1, panes

       panes = setupPanes()
       buf = await run('echo hi')
       ch1 = buf.vars('Shell').ch
       h1 = panes.shellChans[ch1]

       await emit(panes, ch1, { close: 1, code: 0 })

       buf = await run('echo hi')
       ch2 = buf.vars('Shell').ch
       equal(ch2 == ch1, false)
       equal(busy(buf), 1)

       h1({ stdout: 'stale\n' })
       await wait(10)
       equal(text(buf).includes('stale'), false)

       await emit(panes, ch2, { close: 1, code: 0 })
       equal(buf.vars('shell').code, 0)
       equal(busy(buf), 0)
     })

test('remove', 'removing a running buf exits the current channel',
     async () => {
       let oldSend, sends

       setupPanes()
       oldSend = globalThis.tron.send
       sends = []
       globalThis.tron.send = (ch2, data) => sends.push({ ch: ch2, data })
       try {
         let buf, ch

         buf = await run('echo hi')
         ch = buf.vars('Shell').ch

         buf.remove()

         equal(sends.length, 1)
         equal(sends[0].ch, ch)
         equal(sends[0].data.exit, 1)
       }
       finally {
         globalThis.tron.send = oldSend
       }
     })

test('remove', 'rerun then remove exits only the current channel',
     async () => {
       let oldSend, panes, sends

       panes = setupPanes()
       oldSend = globalThis.tron.send
       sends = []
       globalThis.tron.send = (ch2, data) => sends.push({ ch: ch2, data })
       try {
         let buf

         buf = await run('echo hi')
         await emit(panes, buf.vars('Shell').ch, { close: 1, code: 0 })

         buf = await run('echo hi')
         buf.remove()

         equal(sends.length, 1)
         equal(sends[0].ch, buf.vars('Shell').ch)
       }
       finally {
         globalThis.tron.send = oldSend
       }
     })

test('run', 'random event orders keep text consistent',
     async () => {
       let seed

       for (seed = 1; seed <= 20; seed++)
         await trial(seed)
     })

// deterministic version of the e2e large-output check: drive the renderer with
// known chunks so completeness does not depend on pty read timing
test('run', 'large output arrives complete',
     async () => {
       let buf, ch, i, j, panes

       panes = setupPanes()
       buf = await run('echo big')
       ch = buf.vars('Shell').ch
       for (i = 1; i <= 100000; i += 5000) {
         let piece

         piece = ''
         for (j = i; j < (i + 5000); j++)
           piece += j + '\n'
         await emit(panes, ch, { stdout: piece })
       }
       await emit(panes, ch, { close: 1, code: 0 })

       equal(text(buf).includes('100000\n'), true)
       equal(text(buf).split('\n').length, 100001)
       equal(busy(buf), 0)
     })

async function trial
(seed) {
  let buf, ch, closed, expected, h, panes, r, state

  panes = setupPanes()
  buf = await run('echo fuzz')
  ch = buf.vars('Shell').ch
  h = panes.shellChans[ch]
  expected = ''
  closed = 0

  r = { n: seed }
  state = [ 'a', 'b', 'close', 'stale' ]
  for (let i = state.length - 1; i > 0; i--) {
    let j, tmp

    j = rand(r) % (i + 1)
    tmp = state[i]
    state[i] = state[j]
    state[j] = tmp
  }

  for (let e of state) {
    if (e == 'close') {
      h({ close: 1, code: 0 })
      closed = 1
    }
    else {
      h({ stdout: e + '\n' })
      if (closed == 0)
        expected += e + '\n'
    }
    await wait(5)
  }

  equal(text(buf), expected)
  equal(busy(buf), 0)
}

test('switch', 'showing the buffer refreshes the exit dir',
     async () => {
       let buf, panes

       panes = setupPanes()
       buf = await run('ls')
       buf.views[0].ele.querySelector('.shell-exit-dir').textContent = '/stale'
       buf.dir = '/tmp/fresh'
       await setBuf(panes.pB, buf)
       equal(exitDir(buf), '/tmp/fresh')
     })

test('reuse', 'reused command buffer shows the new dir in the exit bar',
     async () => {
       let b1, b2, buf, buf2, ch, panes

       panes = setupPanes()
       b1 = fileBuf('dir-one.txt')
       b2 = fileBuf('dir-two.txt')

       await setBuf(panes.pB, b1)
       panes.pB.buf.dir = '/tmp/one'
       buf = await run('ls')
       equal(exitDir(buf), '/tmp/one')

       ch = buf.vars('Shell').ch
       await emit(panes, ch, { close: 1, code: 0 })

       await setBuf(panes.pB, b2)
       panes.pB.buf.dir = '/tmp/two'
       buf2 = await run('ls')
       equal(buf2 == buf, true, 'command buffer should be reused')
       equal(exitDir(buf), '/tmp/two')
     })

test('reuse', 'reused command buffer shows the new dir in every pane showing it',
     async () => {
       let b1, b2, buf, buf2, ch, panes, viewA, viewB

       panes = setupPanes()
       b1 = fileBuf('dir-one.txt')
       b2 = fileBuf('dir-two.txt')

       await setBuf(panes.pB, b1)
       panes.pB.buf.dir = '/tmp/one'
       buf = await run('ls')
       viewB = buf.views[0]
       equal(exitDir(buf), '/tmp/one')

       ch = buf.vars('Shell').ch
       await emit(panes, ch, { close: 1, code: 0 })

       // keep the shell buffer visible in pB while running the same command
       // from another pane pointed at a different dir
       await setBuf(panes.pA, b2)
       panes.pA.buf.dir = '/tmp/two'
       panes.pA.focus()
       buf2 = await run('ls')
       equal(buf2 == buf, true, 'command buffer should be reused')
       equal(exitDir(buf), '/tmp/two')
       viewA = panes.pA.view
       equal(viewA?.ele?.querySelector('.shell-exit-dir').textContent, '/tmp/two')
       equal(viewB.eleOrReserved.querySelector('.shell-exit-dir').textContent, '/tmp/two')
     })

test('reuse', 'runs in the invoking frame dir, not frame1 dir',
     async () => {
       let b1, b2, buf, fr, panes, pr

       panes = setupPanes()
       b1 = fileBuf('frame1.txt')
       b2 = fileBuf('right.txt')

       await setBuf(panes.pB, b1)
       panes.pB.buf.dir = '/tmp/one'

       fr = Frame.add(panes.frame.tab, { width: 25 })
       pr = Pane.current(fr)
       await setBuf(pr, b2)
       pr.buf.dir = '/tmp/two'
       pr.focus()

       buf = await run('ls')
       equal(exitDir(buf), '/tmp/two')
     })

test('dir', 'an explicit spec dir wins over the invoking pane dir',
     async () => {
       let buf, f, panes

       panes = setupPanes()
       f = fileBuf('invoking.txt')
       await setBuf(panes.pB, f)
       panes.pB.buf.dir = '/tmp/invoking'

       buf = await run('ls', { dir: '/tmp/explicit' })
       equal(exitDir(buf), '/tmp/explicit')
     })

function mochaIt
(cb) {
  return function
         () {
           this.timeout(10000)
           return cb()
         }
}

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     mochaIt(t.cb)))))
