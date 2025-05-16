import { BrowserWindow } from 'electron'
import { d } from './main-log.mjs'

export
function onOn
(e, onArgs) {
  const [ text ] = onArgs
  let win, view

  win = BrowserWindow.fromWebContents(e.sender)
  view = win.bred.hover.view
  d('HOVER on')
  d(text)
  if (view) {
    // could you inject js here?
    view.webContents.loadURL('data:text/html,' + globalThis.encodeURIComponent('<html><body>' + text + '</body></html>'))
    view.setVisible(true)
  }
  else
    d('HOVER missing view')
}

export
function onOff
(e) {
  let win, view

  win = BrowserWindow.fromWebContents(e.sender)
  view = win.bred.hover.view
  d('HOVER off')
  if (view)
    view.setVisible(false)
  else
    d('HOVER missing view')
}
