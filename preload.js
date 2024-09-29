const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('tron', {
  cmd: (name, args) => ipcRenderer.invoke('cmd', name, args),
  //
  send: (ch, ...args) => ipcRenderer.send(ch, ...args),
  // read a response
  receive: (ch, cb) => ipcRenderer.once(ch, (e, d) => cb(d)),
  on: (ch, cb) => ipcRenderer.on(ch, (e, d) => cb(d))
})

globalThis.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = globalThis.document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const dependency of [ 'chrome', 'node', 'electron' ])
    replaceText(`${dependency}-version`, process.versions[ dependency ])
})
