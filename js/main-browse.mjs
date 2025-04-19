import { BrowserWindow, ipcMain, WebContentsView } from 'electron'
import * as Profile from './main-profile.mjs'
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
  views[id] = { view: view }
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
      e.sender.send(ch, { ev: 'focus' })
    }

    if ((input.type == 'contextMenu')
        || ((input.type == 'mouseDown') && (event.button == 2))) {
      d('= input-event')
      d('context')
    }
  })
  view.webContents.on('did-navigate', (event, url) => {
    view.webContents.executeJavaScript('document.title').then(title => {
      Profile.hist.add(url, { title })
      e.sender.send(ch, { ev: 'did-navigate',
                          url: url,
                          title: title })
    })
  })
  view.webContents.on('zoom-changed', (event, dir) => {
    if (dir == 'in')
      view.webContents.zoomFactor += 0.1
    else
      view.webContents.zoomFactor -= 0.1
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
function onZoom
(e, onArgs) {
  const [ id, inward ] = onArgs
  let view

  view = views[id]
  if (view)
    if (inward)
      view.view.webContents.zoomFactor += 0.1
    else
      view.view.webContents.zoomFactor -= 0.1
}

export
function onClose
(e, onArgs) {
  const [ id ] = onArgs
  let view, win

  d('BROWSE close ' + id)

  view = views[id]
  win = BrowserWindow.fromWebContents(e.sender)
  if (view) {
    let focus

    focus = view.view.webContents.isFocused()
    view.view.setVisible(false)
    if (focus) {
      win.focus()
      win.webContents.focus()
    }
    return { wasFocused: focus }
  }

  return {}
}

export
function onReload
(e, onArgs) {
  const [ id ] = onArgs
  let view

  d('BROWSE reload ' + id)

  view = views[id]
  if (view) {
    view.view.webContents.reload()
    return {}
  }
  return {}
}

export
function onReopen
(e, onArgs) {
  const [ id ] = onArgs
  let view

  d('BROWSE reopen ' + id)

  view = views[id]
  if (view) {
    view.view.setVisible(true)
    return {}
  }
  return {}
}

export
function onPass
(e, onArgs) {
  const [ id, event ] = onArgs
  let view

  d('BROWSE pass ' + id)

  // HACK flag for before-input-event
  event.modifiers.push('leftButtonDown')

  d(JSON.stringify(event))

  view = views[id]
  if (view) {
    // send event to the view's webContents
    view.view.webContents.sendInputEvent(event)
    return {}
  }

  return {}
}

export
function init
() {
  views = []
}
