import { BrowserWindow, ipcMain, WebContentsView } from 'electron'
import { d } from './main-log.mjs'

let views

export
function onOpen
(e, ch, onArgs) {
  const [ x, y, width, height, page ] = onArgs
  let view, win, id

  view = new WebContentsView()
  id = views.length
  views[id] = view
  win = BrowserWindow.fromWebContents(e.sender)
  view.webContents.on('before-input-event', (event, input) => {
    // send event to the window's webContents
    win.webContents.sendInputEvent({ type: input.type == 'keyDown' ? 'keyDown' : 'keyUp',
                                     keyCode: input.key,
                                     modifiers: input.modifiers,
                                     code: input.code,
                                     isAutoRepeat: input.isAutoRepeat || false,
                                     text: input.text,
                                     unmodifiedText: input.unmodifiedText })
    // prevent webpage from getting event
    event.preventDefault()
  })
  view.webContents.on('context-menu', () => {
    d('context-menu')
    //win.webContents.sendInputEvent({ type: 'contextMenu', x: 0, y: 0 })
    win.webContents.sendInputEvent({ type: 'mouseDown', x: 0, y: 0, button: 'left', clickCount: 1 })
  })
  view.webContents.on('input-event', (event, input) => {
    //d('input-event')
    //d(input.type)
    if ((input.type == 'keyDown') || (input.type == 'rawKeyDown')) {
      d(input.type)
      d(e.key)
    }
    if (input.type == 'mouseDown') {
      d('mouseDown')
      d(event.button)
      d(JSON.stringify(event))
    }
    if ((input.type == 'contextMenu')
        || ((input.type == 'mouseDown') && (event.button == 2)))
      d('context')
  })
  view.webContents.loadURL(page)
  win.contentView.addChildView(view)
  view.setBounds({ x: x, y: y, width: width, height: height }) // safeDialogs, autoplayPolicy, navigateOnDragDrop, spellcheck
  view.setBackgroundColor('white')
  //view.setAutoResize({ width: true, height: true })

  ipcMain.on(ch, (e, x, y, width, height) => {
    // using d messed up values
    //view.setBounds({ x: d.x, y: d.y, width: d.width, height: d.height })
    view.setBounds({ x: x, y: y, width: width, height: height })
  })

  e.sender.send(ch, { id: id })
}

export
function onClose
(e, ch, onArgs) {
  const [ id ] = onArgs
  let view, win

  d('BROWSE close ' + id)

  view = views[id]
  win = BrowserWindow.fromWebContents(e.sender)
  if (view) {
    win.contentView.removeChildView(view)
    view.webContents.destroy()
    views[id] = 0
  }

  e.sender.send(ch, {})
}

export
function init
() {
  views = []
}
