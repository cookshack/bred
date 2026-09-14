import { execFileSync } from 'node:child_process'
import { d } from './main-log.mjs'

// ASYNC: shell - spawn pty and stream output
//
// deps: { pty, ipcMain, appPath }
export
function run
(deps, e, ch, dir, sc, args, spec, ctx) {
  let sender
  let runInShell, stdoutBuffer, stderrBuffer, lastFlushTime, flushTimer

  function flushBuffers
  () {
    let stdOutLen, stdErrLen

    stdOutLen = stdoutBuffer.length
    stdErrLen = stderrBuffer.length
    if (stdOutLen > 0) {
      d(ch + ' flush stdout ' + stdOutLen)
      sender.send(ch, { stdout: stdoutBuffer })
      d(ch + ' sent stdout to renderer')
      stdoutBuffer = ''
    }
    if (stdErrLen > 0) {
      d(ch + ' flush stderr ' + stdErrLen)
      sender.send(ch, { stderr: stderrBuffer })
      d(ch + ' sent stderr to renderer')
      stderrBuffer = ''
    }
    lastFlushTime = Date.now()
  }

  function scheduleFlush
  () {
    let timeSinceLastFlush

    timeSinceLastFlush = Date.now() - lastFlushTime

    // Flush if enough time has passed (100ms) or if buffers are large
    d(ch + ' scheduleFlush: timeSinceLastFlush=' + timeSinceLastFlush + ' stdOut=' + stdoutBuffer.length + ' stdErr=' + stderrBuffer.length)
    if (timeSinceLastFlush > 100 || stdoutBuffer.length > 8192 || stderrBuffer.length > 8192)
      flushBuffers()
    else if (flushTimer)
      d(ch + ' scheduleFlush: timer already scheduled')
    else
      // Schedule a flush for later
      flushTimer = setTimeout(() => {
                                d(ch + ' timer flush')
                                flushBuffers()
                                flushTimer = null
                              }, 100 - timeSinceLastFlush)
  }

  function close
  () {
    if (flushTimer) {
      d(ch + ' close: clearing timer')
      clearTimeout(flushTimer)
      flushTimer = null
    }
    // Flush any remaining buffered data before closing
    flushBuffers()
  }

  d(ch + ' run: starting')
  d(ch + ' run: cmd=' + sc + ' args=' + JSON.stringify(args))
  d(ch + ' run: dir=' + dir)

  stdoutBuffer = ''
  stderrBuffer = ''
  lastFlushTime = Date.now()
  flushTimer = null
  sender = e.sender
  runInShell = spec.runInShell

  try {
    let proc, env, cols, rows
    let exited, listening
    let killTimers

    function clearKillTimers
    () {
      killTimers.forEach(clearTimeout)
      killTimers = []
    }

    function stopListening
    () {
      if (listening) {
        deps.ipcMain.removeListener(ch, onInput)
        listening = 0
      }
    }

    function onInput
    (ev, data) {
      d(ch + ': on: ' + JSON.stringify(data))
      // ignore inputs meant for another run that reuses the channel
      if (ev.sender == sender) {
        if (data.input && data.input.length)
          proc.write(data.input)
        if (data.exit)
          interruptAndEscalate()
      }
    }

    function killFgGroup
    (sig) {
      let pgid

      try {
        pgid = parseInt(execFileSync('ps', [ '-o', 'tpgid=', '-p', String(proc.pid) ],
                                     { encoding: 'utf8' }).trim(), 10)
      }
      catch (err) {
        0 && d('tpgid lookup failed: ' + err.message)
      }
      pgid = (Number.isInteger(pgid) && pgid >= 2) ? pgid : proc.pid
      try {
        process.kill(-pgid, sig)
      }
      catch (err) {
        0 && d('kill group failed: ' + err.message)
      }
    }

    function stepInterrupt
    () {
      if (exited) return
      killFgGroup('SIGINT')
    }

    function stepHangup
    () {
      if (exited) return
      try {
        process.kill(proc.pid, 'SIGHUP')
      }
      catch (err) {
        0 && d('hangup failed: ' + err.message)
      }
    }

    function stepKill
    () {
      if (exited) return
      killFgGroup('SIGKILL')
    }

    // Behave like pressing Ctrl-C when the buffer is killed, then escalate
    // so a process that ignores SIGINT can't hang the buffer forever.
    function interruptAndEscalate
    () {
      // First the faithful Ctrl-C: the line discipline turns \x03 into
      // SIGINT for the foreground process group (only when ISIG is on).
      try {
        proc.write('\x03')
      }
      catch (err) {
        0 && d('write \\x03 failed: ' + err.message)
      }
      // Fallback SIGINT to the foreground process group: covers children
      // that put the terminal in raw mode, where \x03 is just data.
      killTimers.push(setTimeout(stepInterrupt, 1000))
      // Then hangup on the child, as a middle step.
      killTimers.push(setTimeout(stepHangup, 3000))
      // Finally force-kill the whole foreground process group.
      killTimers.push(setTimeout(stepKill, 5000))
    }

    exited = false
    listening = 0
    killTimers = []

    if (runInShell) {
      if (spec.multi)
        args = [ '-i' ]
      else
        args = [ '--init-file', deps.appPath + '/etc/single.bashrc', '-i' ]
      runInShell = sc
      //d('runInShell: ' + runInShell)
      sc = ctx.shell
    }

    env = {}
    // prevent: nvm is not compatible with the "npm_config_prefix" environment variable...
    Object.entries(process.env).forEach(kv => {
                                          if (kv[0].startsWith('npm_'))
                                            return
                                          env[kv[0]] = kv[1].slice(0)
                                        })
    env.EMACS = 't' // turns off line editing in bash
    env.TERM = 'dumb'
    //env.TERM = 'xterm'
    //env.TERM = 'xterm-256color'
    //env.COLORTERM = 'truecolor'

    //d(JSON.stringify(env, null, 2))
    d('spawn ' + sc + ' [' + args + '] in ' + dir)
    //process.stdin.setRawMode(true)
    // could be useful: const cwd = await fs.promises.readlink(`/proc/${this.#realPty.pid}/cwd`, {encoding: "utf8"})
    cols = parseInt(spec.cols ?? 10000)
    if (isNaN(cols))
      cols = 10000
    rows = parseInt(spec.rows ?? 10000)
    if (isNaN(rows))
      rows = 10000
    proc = deps.pty.spawn(sc, args, { cwd: dir,
                                      cols,
                                      rows,
                                      env,
                                      encoding: null })

    /// raw mode to prevent echo of input (bred already put the input in the buf)
    // https://github.com/Microsoft/node-pty/issues/78#issuecomment-1867116455
    //proc.write(`stty -F ${proc.ptsName} raw -echo\n`)
    // https://github.com/Microsoft/node-pty/issues/78#issuecomment-297550361
    {
      let tty, TtyWrap

      //d(proc.ptsName)
      //d(proc.fd)
      TtyWrap = process.binding('tty_wrap')
      tty = new TtyWrap.TTY(proc.fd, true)
      //d('tty.isTTY: ' + tty.isTTY)
      if (1) { // (TtyWrap.IsTTY(tty)) { // (tty.isTTY)
        0 && d('setRawMode')
        tty.setRawMode(true)
      }
    }

    if (spec.multi) {
      // want the prompt string
    }
    else
      // happens too late, need to somehow set it in .bashrc (now done in single.bashrc above)
      proc.write('export PS1=""\n')

    if (runInShell) {
      let cmd

      if (spec.multi)
        if (runInShell.length)
          cmd = runInShell + '\n'
        else
          d('runInShell empty')
      else
        cmd = runInShell + ' && exit 2>/dev/null || exit 2>/dev/null\n'
      if (cmd) {
        d('proc.write cmd: ' + cmd)
        proc.write(cmd)
      }
    }

    proc.onData(data => {
                  d(ch + ' data: ' + data.length + ' bytes')
                  d(ch + ' data: ' + data)
                  d(ch + ' typeof data: ' + typeof data)
                  stdoutBuffer += data
                  scheduleFlush()
                })

    proc.onExit(ret => {
                  d(ch + ': child process exited with code ' + ret.exitCode + ' stdOut=' + stdoutBuffer.length + ' stdErr=' + stderrBuffer.length)
                  exited = true
                  clearKillTimers()
                  stopListening()
                  // Ensure all buffered data is sent before closing
                  flushBuffers()
                  d(ch + ': sent close')
                  sender.send(ch, { close: 1, code: ret.exitCode })
                  d(ch + ': close sent, calling close()')
                  close()
                  d(ch + ': close() done')
                })

    // seems node-pty doesn't have this
    if (0)
      proc.onError(err => {
                     d(ch + ': child process error: ' + err)
                     stderrBuffer += ('Process error: ' + err.message + '\n')
                     scheduleFlush()
                   })

    deps.ipcMain.on(ch, onInput)
    listening = 1
  }
  catch (err) {
    d(ch + ' child process caught err ' + err)
    sender.send(ch, { err })
  }
}
