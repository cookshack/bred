const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('tron', {
  cmd: (name, args) => ipcRenderer.invoke('cmd', name, args),
  //
  send: (ch, ...args) => ipcRenderer.send(ch, ...args),
  // read a response
  receive: (ch, cb) => ipcRenderer.once(ch, (e, d) => cb(d)),
  on: (ch, cb) => ipcRenderer.on(ch, (e, d) => cb(d))
})
