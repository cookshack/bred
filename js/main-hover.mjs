import { BrowserWindow } from 'electron'
import { d } from './main-log.mjs'

export
function onOn
(e, onArgs) {
  const [ text ] = onArgs
  let win, hover

  win = BrowserWindow.fromWebContents(e.sender)
  hover = win.bred.hover
  d('HOVER on')
  d(text)
  if (hover) {
    let html

    if (text == hover.text)
      return
    // could you inject js here?
    hover.create()
    hover.text = text
    html = 'data:text/html,' + globalThis.encodeURIComponent('<html><body style="padding: 0; margin: 0; overflow: hidden;"><div style="text-wrap: nowrap; padding: 0.5rem; overflow: hidden; display: inline-block;">' + text + '</div></body></html>')
    hover.view.webContents.loadURL(html)
    hover.on()
    hover.view.webContents.executeJavaScript('[ globalThis.document.body.firstElementChild.offsetWidth, globalThis.document.body.offsetHeight ]').then(wh => {
      hover.resize(wh[0], wh[1])
    })
  }
  else
    d('HOVER missing view')
}

export
function onOff
(e) {
  let win

  win = BrowserWindow.fromWebContents(e.sender)
  d('HOVER off')
  win.bred?.hover?.off()
}
