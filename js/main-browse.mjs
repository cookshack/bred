import { BrowserWindow, ipcMain, WebContentsView } from 'electron'
import * as U from './util.mjs'

import { d } from './main-log.mjs'

let views

function makeEventFromInput
(input) {
  return { type: input.type == 'keyDown' ? 'keyDown' : 'keyUp',
           keyCode: input.key,
           modifiers: input.modifiers,
           code: input.code,
           text: input.text,
           unmodifiedText: input.unmodifiedText,
           isAutoRepeat: input.isAutoRepeat || false }
}

export
function onOpen
(e, ch, onArgs) {
  const [ x, y, width, height, page ] = onArgs
  let view, win, id

  view = new WebContentsView()
  id = views.length
  views[id] = view
  win = BrowserWindow.fromWebContents(e.sender)
  view.webContents.on('before-input-event', (e, input) => {
    if (1) {
      let event

      d('= before-input-event')

      d(JSON.stringify(input))

      // HACK flag from onPass
      if (input.modifiers.includes('leftbuttondown')) {
        d('PASS')
        0 && U.arrRm1(input.modifiers, m => m == 'leftbuttondown')
        return
      }

      event = makeEventFromInput(input)
      d(JSON.stringify(event))

      // send event to the window's webContents
      win.webContents.sendInputEvent(event)

      // prevent webpage from getting event
      e.preventDefault()
    }
  })
  view.webContents.on('context-menu', () => {
    d('= context-menu')
    //win.webContents.sendInputEvent({ type: 'contextMenu', x: 0, y: 0 })
    win.webContents.sendInputEvent({ type: 'mouseDown', x: 0, y: 0, button: 'left', clickCount: 1 })
  })
  view.webContents.on('input-event', (event, input) => {
    //d('= input-event')
    //d(input.type)
    if ((input.type == 'keyDown') || (input.type == 'rawKeyDown')) {
      d('= input-event')
      d(JSON.stringify(input))
    }
    if (input.type == 'mouseDown') {
      d('= input-event')
      d(JSON.stringify(input))
    }
    if ((input.type == 'contextMenu')
        || ((input.type == 'mouseDown') && (event.button == 2))) {
      d('= input-event')
      d('context')
    }
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
    let focus

    focus = view.webContents.isFocused()
    win.contentView.removeChildView(view)
    view.webContents.destroy()
    views[id] = 0
    e.sender.send(ch, { wasFocused: focus })
    return
  }

  e.sender.send(ch, {})
}

export
function onPass
(e, ch, onArgs) {
  const [ id, event ] = onArgs
  let view

  d('BROWSE pass ' + id)

  // HACK flag for before-input-event
  event.modifiers.push('leftButtonDown')

  d(JSON.stringify(event))

  view = views[id]
  if (view) {
    // send event to the view's webContents
    view.webContents.sendInputEvent(event)
    e.sender.send(ch, {})
    return
  }

  e.sender.send(ch, {})
}

export
function init
() {
  views = []
}
