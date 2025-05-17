import { BrowserWindow } from 'electron'
import { d } from './main-log.mjs'

export
function onCss
(e, onArgs) {
  const [ fg, bg ] = onArgs
  let win, hover

  win = BrowserWindow.fromWebContents(e.sender)
  hover = win.bred.hover
  d('HOVER css')
  d(fg)
  d(bg)
  hover.fg = fg
  hover.bg = bg
}

export
function onOn
(e, onArgs) {
  const [ text ] = onArgs
  let win, hover

  win = BrowserWindow.fromWebContents(e.sender)
  hover = win.bred.hover
  d('HOVER on')
  d(text)
  if (hover)
    hover.on(text)
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
