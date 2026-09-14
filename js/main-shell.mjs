import { app, ipcMain, shell as Shell } from 'electron'
import { makeErr } from './main-err.mjs'
import * as Pty from 'node-pty'
import * as U from './util.mjs'

import * as ShellRun from './shell-run.mjs'

function deps
() {
  return { pty: Pty,
           ipcMain,
           appPath: app.getAppPath() }
}

// ASYNC: shell - run command with default settings
export
function on
(e, ch, onArgs, ctx) {
  let [ clientCh, dir, sc, args, runInShell, multi ] = onArgs

  return ShellRun.run(deps(),
                      e, clientCh, dir, sc, args,
                      { runInShell,
                        multi },
                      ctx)
}

// ASYNC: shell - run command with custom settings
export
function onRun
(e, ch, onArgs, ctx) {
  let [ clientCh, dir, sc, args, spec ] = onArgs

  return ShellRun.run(deps(),
                      e, clientCh, dir, sc, args, spec, ctx)
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
