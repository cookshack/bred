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

    console.log('PRELOAD ' + ch + ' on')

    w = (e, d) => cb(d)

    ons[ch] = ons[ch] || []
    ons[ch].push({ cb, w })

    ipcRenderer.on(ch, w)

    return () => {
      console.log('PRELOAD ' + ch + ' off')

      ons[ch] = ons[ch].filter(on => {
        if (on.w == w) {
          console.log('PRELOAD match')
          ipcRenderer.off(ch, on.w)
          return 0
        }
        return 1
      })

      if (ons[ch].length)
        console.log('PRELOAD ' + ch + ' now has ' + ons[ch].length + ' handlers')
      else {
        delete ons[ch]
        console.log('PRELOAD ' + ch + ' removed')
      }
    }
  },
  // For performance analysis
  perf() {
    return { ons }
  }
})
