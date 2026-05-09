import { d } from './main-log.mjs'
import { errMsg } from './main-err.mjs'
import Fs from 'node:fs/promises'

export
let _internals

// Return the base permissions (ie as if setting group permissions) defined in $string at position $pos.
function parseModePerm
(string, pos) {
  let mode

  function parse
  (char) {
    if (char == 'r')
      return 0b100 // 4
    if (char == 'w')
      return 0b010 // 2
    if (char == 'x')
      return 0b001 // 1
    throw new Error('Error in permission char: ' + char)
  }

  mode = 0
  for (let i = pos; i < string.length; i++)
    mode |= parse(string[i])
  return mode
}

// Return [$mode, pos, addp], with $mode updated according to $str.
function updateMode
(mode, str, pos) {

  function updateOne
  (multiple) {
    let mode2, pos2, addp

    ([ mode2, pos2, addp ] = updateMode(mode, str, pos + 1))
    return [ addp
             ? (mode2 | (multiple * parseModePerm(str, pos2)))
             : (mode2 & ((multiple * parseModePerm(str, pos2))
                        // XOR
                        ^ 0xffffffff)),
             pos2,
             addp ]
  }

  pos = pos || 0
  mode = mode || 0

  switch (str[pos]) {
  case '+':
    return [ mode, pos + 1, 1 ]
  case '-':
    return [ mode, pos + 1 ]
  case 'u':
    return updateOne(0o100)
  case 'g':
    return updateOne(0o10)
  case 'o':
    return updateOne(0o1)
  case 'a':
    mode = updateOne(0o100)[0]
    mode = updateOne(0o10)[0]
    return updateOne(0o1)
  }
  throw Error('Error in permission char: ' + str[pos])
}

// Return $mode updated according to $str.
export
function update
(mode, str) {
  return updateMode(mode, str)[0]
}

export
async function onChmod
(e, ch, onArgs) {
  let str, stat, mode, path

  // args
  //
  // chmod a+x tmp/x

  str = onArgs[0]
  path = onArgs[1]

  // check path

  if (path.startsWith('/')) {
    // ok
  }
  else {
    e.sender.send(ch, errMsg('Path must be absolute'))
    return
  }

  // get current mode

  stat = await Fs.stat(path)

  // make updated mode

  mode = update(stat.mode, str)
  0 && d('mode: ' + mode)

  // set mode

  await Fs.chmod(path, mode)
  e.sender.send(ch, {})
}

_internals = { parseModePerm, updateMode }
