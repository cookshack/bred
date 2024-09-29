export
function makeErr
(err) {
  return { err: { message: err.message,
                  code: err.code } }
}

export
function errMsg
(msg) {
  return { err: { message: msg } }
}
