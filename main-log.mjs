let logFn

function use
() {
}

export
function logWith
(fn) {
  logFn = fn
}

export
function log
(msg) {
  if (logFn) {
    logFn(msg)
    return
  }
  if (process.stdout?.writable)
    console.log(msg)
}

export
function d
(msg) {
  let now, date

  function pad
  (val, num) {
    return String(val).padStart(num ?? 2, '0')
  }

  date = new Date
  now = Date.now()
  try {
    if (0)
      log(Math.floor(now / 1000) + '.' + String(Math.floor(now % 1000)).padStart(3, '0') + ': ' + msg)
    log(pad(date.getHours())
        + ':' + pad(date.getMinutes())
        + ':' + pad(date.getSeconds())
        + ':' + pad(date.getMilliseconds(), 3)
        + ' ' + msg)
  }
  catch (err) {
    use(err)
  }
}
