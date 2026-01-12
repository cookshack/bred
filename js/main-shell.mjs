import { app, ipcMain, shell as Shell } from 'electron'
import { d } from './main-log.mjs'
import { makeErr } from './main-err.mjs'
import * as Pty from 'node-pty'
import * as U from './util.mjs'

// ASYNC: shell - spawn pty and stream output
function run
(e, ch, dir, sc, args, spec, ctx) {
  let proc, closedProc, closedErr, closedOut, sender
  let runInShell, stdoutBuffer, stderrBuffer, lastFlushTime, flushTimer

  function flushBuffers
  () {
    if (stdoutBuffer.length > 0) {
      sender.send(ch, { stdout: stdoutBuffer })
      stdoutBuffer = ''
    }
    if (stderrBuffer.length > 0) {
      sender.send(ch, { stderr: stderrBuffer })
      stderrBuffer = ''
    }
    lastFlushTime = Date.now()
  }

  function scheduleFlush
  () {
    const now = Date.now()
    const timeSinceLastFlush = now - lastFlushTime

    // Flush if enough time has passed (100ms) or if buffers are large
    if (timeSinceLastFlush > 100 || stdoutBuffer.length > 8192 || stderrBuffer.length > 8192)
      flushBuffers()
    else if (flushTimer) {
    }
    else
      // Schedule a flush for later
      flushTimer = setTimeout(() => {
        flushBuffers()
        flushTimer = null
      }, 100 - timeSinceLastFlush)
  }

  function close
  () {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    // Flush any remaining buffered data before closing
    flushBuffers()
    if (closedProc && closedErr && closedOut) {
      //ipcMain.removeAllListeners(ch)
    }
  }

  stdoutBuffer = ''
  stderrBuffer = ''
  lastFlushTime = Date.now()
  flushTimer = null
  sender = e.sender
  runInShell = spec.runInShell

  try {
    let env, cols, rows

    if (runInShell) {
      if (spec.multi)
        args = [ '-i' ]
      else
        args = [ '--init-file', app.getAppPath() + '/etc/single.bashrc', '-i' ]
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
    proc = Pty.spawn(sc, args, { cwd: dir,
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
      d(ch + ' data: ' + data)
      d(ch + ' typeof data: ' + typeof data)
      stdoutBuffer += data
      scheduleFlush()
      closedOut = 1
    })

    proc.onExit(ret => {
      d(ch + ': child process exited with code ' + ret.exitCode)
      // Ensure all buffered data is sent before closing
      flushBuffers()
      sender.send(ch, { close: 1, code: ret.exitCode })
      closedProc = 1
      close()
    })

    // seems node-pty doesn't have this
    if (0)
      proc.onError(err => {
        d(ch + ': child process error: ' + err)
        stderrBuffer += ('Process error: ' + err.message + '\n')
        scheduleFlush()
        closedErr = 1
      })

    ipcMain.on(ch, (e, data) => {
      d(ch + ': on: ' + JSON.stringify(data))
      if (data.input && data.input.length)
        proc.write(data.input)
      if (data.exit)
        process.kill(proc.pid, 'SIGHUP')
    })
  }
  catch (err) {
    d(ch + ' child process caught err ' + err)
    sender.send(ch, { err })
  }
}

// ASYNC: shell - run command with default settings
export
function on
(e, ch, onArgs, ctx) {
  let [ clientCh, dir, sc, args, runInShell, multi ] = onArgs

  return run(e, clientCh, dir, sc, args,
             { runInShell,
               multi },
             ctx)
}

// ASYNC: shell - run command with custom settings
export
function onRun
(e, ch, onArgs, ctx) {
  let [ clientCh, dir, sc, args, spec ] = onArgs

  return run(e, clientCh, dir, sc, args, spec, ctx)
}

// ASYNC: shell - open URL in external browser
export
function onOpen
(e, ch, onArgs) {
  let [ url ] = onArgs
  let sender

  sender = e.sender
  Shell.openExternal(url)
    .then(() => sender.send(ch, {}))
    .catch(err => sender.send(ch, makeErr(err)))
}

// ASYNC: shell - show file in system file manager
export
function onShow
(e, ch, onArgs) {
  let [ path ] = onArgs

  Shell.showItemInFolder(U.stripFilePrefix(path))
}
