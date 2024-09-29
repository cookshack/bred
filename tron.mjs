export
function send
(ch, ...args) {
  globalThis.tron.send(ch, ...args)
}

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

export
function on
(ch, cb) { // (err, data)
  // setTimeout so that it runs outside the weird tron context, so that backtraces are available
  globalThis.tron.on(ch, d => setTimeout(() => cb(d.err, d)))
}
