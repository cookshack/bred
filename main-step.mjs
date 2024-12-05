import { BrowserWindow } from 'electron'
import { makeErr } from './main-err.mjs'
import { d } from './main-log.mjs'

export
function onSend
(e, ch, onArgs) {
  const [ method, params ] = onArgs
  let win

  win = BrowserWindow.fromWebContents(e.sender)

  d('Step.send')
  d('method ' + method)

  win.webContents.debugger.sendCommand(method, params || {})
    .then(() => e.sender.send(ch, {}))
    .catch(err => {
      d('ERR ' + err.message)
      e.sender.send(ch, makeErr(err))
    })

  return ch
}
