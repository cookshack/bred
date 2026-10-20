export
function saveWindowState
(win, store) {
  store.set('bounds', win.getNormalBounds ? win.getNormalBounds() : win.getBounds())
  if (win.isMaximized)
    store.set('maximized', win.isMaximized())
}

export
function makeWindowState
(win, store, spec) {
  let restoring

  function save
  () {
    if (restoring == 0)
      saveWindowState(win, store)
  }

  // ignore placement events until after the saved state has been restored,
  // because some window managers move the window again while it is shown
  restoring = 1
  win.on('move', save)
  win.on('resize', save)

  return { saveNow
           () {
             saveWindowState(win, store)
           },
           restore
           () {
             let timer

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
