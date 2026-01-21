// ASYNC: IPC bridge - all calls cross to main process via Electron IPC
export
function send
(ch, ...args) {
  globalThis.tron.send(ch, ...args)
}

// ASYNC: IPC bridge - command with one-shot callback
export
function cmd1
(name, args, cb) { // (err, ch)
  globalThis.tron.cmd(name, args)
    .then(ret => {
      if (cb) setTimeout(() => cb(ret.err, ret))
    },
          err => {
            if (cb) setTimeout(() => cb(err))
          })
    .catch(err => {
      throw err
    })
}

// ASYNC: IPC bridge - command with event stream callback
export
function cmd
(name, args, cb) {

  function rec
  (ch) {
    globalThis.tron.receive(ch, d => {
      if (d.err) {
        if (cb)
          setTimeout(() => cb(d.err, d))
      }
      else {
        d.ch = ch
        if (cb)
          setTimeout(() => cb(0, d))
      }
    })
  }

  globalThis.tron.cmd(name, args).then(ch => rec(ch),
                                       err => cb(err))
}

// ASYNC: IPC bridge - async command
export
async function acmd
(name, args) {
  return await globalThis.tron.acmd(name, args)
}

// ASYNC: IPC bridge - event listener registration
export
function on
(ch, cb) { // (err, data)
  let w

  // setTimeout so that it runs outside the weird tron context, so that backtraces are available
  w = d => setTimeout(() => cb(d.err, d))
  return globalThis.tron.on(ch, w)
}
