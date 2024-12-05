import { BrowserWindow } from 'electron'
import { makeErr } from './main-err.mjs'
//import { d } from './main-log.mjs'

export
function onSend
(e, ch, onArgs) {
  const [ method, params ] = onArgs
  let win

  win = BrowserWindow.fromWebContents(e.sender)

  win.webContents.debugger.sendCommand(method, params || {})
    .then(() => e.sender.send(ch, {}))
    .catch(err => e.sender.send(ch, makeErr(err)))

  return ch
}
