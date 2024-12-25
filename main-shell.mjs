import { app, ipcMain, shell as Shell } from 'electron'
import { d } from './main-log.mjs'
import * as Pty from 'node-pty'
import * as U from './util.mjs'

function run
(e, ch, dir, sc, args, spec, ctx) {
  let proc, closedProc, closedErr, closedOut, sender
  let runInShell

  function close
  () {
    if (closedProc && closedErr && closedOut) {
      //ipcMain.removeAllListeners(ch)
    }
  }

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
                                 cols: cols,
                                 rows: rows,
                                 env: env,
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
      d(`${ch}: data: ${data}`)
      sender.send(ch, { stdout: data })
      closedOut = 1
      close()
    })

    proc.onExit(ret => {
      d(`${ch}: child process exited with code ${ret.exitCode}`)
      sender.send(ch, { close: 1, code: ret.exitCode })
      closedProc = 1
      close()
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
    d(`${ch}: child process caught err ${err}`)
    sender.send(ch, { err: err })
  }
}

export
function on
(e, ch, onArgs, ctx) {
  let [ clientCh, dir, sc, args, runInShell, multi ] = onArgs

  return run(e, clientCh, dir, sc, args,
             { runInShell: runInShell,
               multi: multi },
             ctx)
}

export
function onRun
(e, ch, onArgs, ctx) {
  let [ clientCh, dir, sc, args, spec ] = onArgs

  return run(e, clientCh, dir, sc, args, spec, ctx)
}

export
function onOpen
(e, ch, onArgs) {
  let [ url ] = onArgs

  Shell.openExternal(url)
}

export
function onShow
(e, ch, onArgs) {
  let [ path ] = onArgs

  Shell.showItemInFolder(U.stripFilePrefix(path))
}
