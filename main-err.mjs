export
function makeErr
(err) {
  return { err: { message: err.message,
                  code: err.code,
                  stack: err.stack } }
}

export
function errMsg
(msg, more) {
  return { err: { message: msg, ...(more || {}) } }
}
