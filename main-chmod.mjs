import { d } from './main-log.mjs'
import { errMsg } from './main-err.mjs'
import Fs from 'node:fs/promises'

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
  (multiple, mode, str, pos) {
    let addp

    ([ mode, pos, addp ] = updateMode(mode, str, pos + 1))
    return [ addp
             ? (mode | (multiple * parseModePerm(str, pos)))
             : (mode & ((multiple * parseModePerm(str, pos))
                        // XOR
                        ^ 0xffffffff)),
             pos,
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
    return updateOne(0o100, mode, str, pos)
  case 'g':
    return updateOne(0o10, mode, str, pos)
  case 'o':
    return updateOne(0o1, mode, str, pos)
  case 'a':
    mode = updateOne(0o100, mode, str, pos)[0]
    mode = updateOne(0o10, mode, str, pos)[0]
    return updateOne(0o1, mode, str, pos)
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
async function onFileChmod
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

export const _internals = { parseModePerm, updateMode }
