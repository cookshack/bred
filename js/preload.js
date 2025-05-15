const { contextBridge, ipcRenderer } = require('electron')

let ons

ons = {}

contextBridge.exposeInMainWorld('tron', {
  cmd: (name, args) => ipcRenderer.invoke('cmd', name, args),
  acmd: (name, args) => ipcRenderer.invoke('acmd', name, args),
  //
  send: (ch, ...args) => ipcRenderer.send(ch, ...args),
  // read a response
  receive: (ch, cb) => ipcRenderer.once(ch, (e, d) => cb(d)),
  on(ch, cb) {
    let w

    w = (e, d) => cb(d)
    ons.ch = ons.ch || []
    ons.ch.push({ cb, w })
    ipcRenderer.on(ch, w)
  },
  off(ch, cb) {
    if (ons[ch])
      ons[ch] = ons[ch].filter(on => {
        if (on.cb == cb) {
          ipcRenderer.off(ch, on.w)
          return 0
        }
        return 1
      })
  }
})
