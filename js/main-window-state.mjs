function isDestroyed
(win) {
  if (win.isDestroyed)
    return win.isDestroyed()
  return 0
}

export
function saveWindowState
(win, store) {
  if (isDestroyed(win))
    return
  try {
    let bounds

    bounds = win.getNormalBounds ? win.getNormalBounds() : win.getBounds()
    store.set('bounds', bounds)
    if (win.isMaximized)
      store.set('maximized', win.isMaximized())
  }
  catch {
  }
}

export
function makeWindowState
(win, store, spec) {
  let restoring, restored

  function save
  () {
    if (restoring == 0)
      saveWindowState(win, store)
  }

  // ignore placement events until after the saved state has been restored,
  // because some window managers move the window again while it is shown
  restoring = 1
  restored = 0
  win.on('move', save)
  win.on('resize', save)

  return { saveNow
           () {
             saveWindowState(win, store)
           },
           restore
           () {
             let timer

             if (restored || isDestroyed(win))
               return
             restored = 1
             win.show()
             if (spec.maximized)
               win.maximize()
             else if (spec.bounds)
               win.setBounds(spec.bounds)
             timer = spec.setTimeout || globalThis.setTimeout
             timer(() => {
                     restoring = 0
                   }, spec.delay ?? 250)
           } }
}
