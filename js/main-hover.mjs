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
    let html

    // could you inject js here?
    html = 'data:text/html,' + globalThis.encodeURIComponent('<html><body style="padding: 0; margin: 0; overflow: hidden;"><div style="text-wrap: nowrap; padding: 0.5rem; overflow: hidden; display: inline-block;">' + text + '</div></body></html>')
    view.webContents.loadURL(html)
    view.setVisible(true)
    view.webContents.executeJavaScript('[ globalThis.document.body.firstElementChild.offsetWidth, globalThis.document.body.offsetHeight ]').then(wh => {
      win.bred.hover.resize(wh[0], wh[1])
    })
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
