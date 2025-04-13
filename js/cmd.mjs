import * as Buf from './buf.mjs'
import * as Hist from './hist.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'

import getCurrentLine from '../lib/get-current-line.js'

let cmds, $universal, $last, lastFlags, flaggedDuringCmd

export let hist

export
function init
() {
  cmds = []
  lastFlags = {}
  flaggedDuringCmd = {}
  hist = Hist.ensure('cmd')
  $universal = 1
}

export
function last
() {
  return $last
}

export
function lastFlag
(name) {
  return lastFlags[name]
}

export
function flagLast
(name, val) {
  return flaggedDuringCmd[name] = val
}

export
function universal
(cmd) {
  let u

  if ((last() == 'Universal Argument') && (canon(cmd) == 'Universal Argument'))
    // let it multiply
    return $universal
  u = $universal
  $universal = 1
  return u
}

export
function setUniversal
() {
  $universal *= 4
}

export
function getMo
(name, modeName) {
  name = canon(name)
  if (modeName) {
    let mode

    mode = Mode.get(modeName)
    if (mode?.cmds && mode.cmds[name])
      return mode.cmds[name]
    /*
    if (mo.parentsForEm)
      for (let i = 0; i < mo.parentsForEm.length; i++) {
        let pmo
        pmo = Mode.get(mo.parentsForEm[i])
        if (pmo?.cmds && pmo.cmds[name])
          return pmo.cmds[name]
          }
          */
  }
  return 0
}

export
function get
(name, buf) {
  let mo

  name = canon(name)
  mo = buf?.mode
  if (mo) {
    if (buf.minors)
      for (let mi = 0; mi < buf.minors.length; mi++)
        if (buf.minors[mi].cmds && buf.minors[mi].cmds[name])
          return buf.minors[mi].cmds[name]
    if (mo.cmds && mo.cmds[name])
      return mo.cmds[name]
    if (mo.parentsForEm)
      for (let i = 0; i < mo.parentsForEm.length; i++) {
        let pmo

        pmo = Mode.get(mo.parentsForEm[i])
        if (pmo?.cmds && pmo.cmds[name])
          return pmo.cmds[name]
      }
  }
  return cmds[name]
}

export
function getAll
(buf) {
  let all

  all = Object.values(cmds)
  let mo

  mo = buf?.mode
  if (mo) {
    if (buf.minors)
      for (let mi = 0; mi < buf.minors.length; mi++)
        if (buf.minors[mi].cmds)
          all = [ ...Object.values(buf.minors[mi].cmds), ...all ]
    if (mo.cmds)
      all = [ ...Object.values(mo.cmds), ...all ]
    if (mo.parentsForEm)
      for (let i = 0; i < mo.parentsForEm.length; i++) {
        let pmo

        pmo = Mode.get(mo.parentsForEm[i])
        if (pmo?.cmds)
          all = [ ...Object.values(pmo.cmds), ...all ]
      }
  }
  return all
}

function execOrRun
(toHist, name, buf, universalArg, we, ...args) {
  let cmd

  cmd = get(name, buf)
  if (cmd) {
    if (cmd.cb) {
      flaggedDuringCmd = {}
      cmd.cb(universalArg, we, ...args)
      lastFlags = flaggedDuringCmd
      $last = cmd.name
      if (toHist)
        hist.add(cmd.name)
      return
    }
    Mess.warn('run ' + name + ': cmd missing cb (buf ' + buf?.name + ')')
    return
  }
  Mess.warn('run missing: ' + name + ' (buf ' + buf?.name + ')')
}

export
function exec
(name, buf, universalArg, we, ...args) {
  execOrRun(1, name, buf, universalArg, we, ...args)
}

export
function run
(name, buf, universalArg, we, ...args) {
  execOrRun(0, name, buf, universalArg, we, ...args)
}

export
function runMo
(name, mo, universalArg, we, ...args) {
  let cmd

  cmd = getMo(name, mo)
  if (cmd) {
    if (cmd.cb) {
      flaggedDuringCmd = {}
      cmd.cb(universalArg, we, ...args)
      lastFlags = flaggedDuringCmd
      $last = cmd.name
      return
    }
    Mess.warn('runMo missing: ' + name + '(' + mo + ')')
    return
  }
  Mess.warn('runMo ' + name + ": cmd '" + name + "' missing cb")
}

function fName
(name) {
  return name.trim().split(' ').map((w,i) => i == 0 ? w : Buf.capitalize(w)).join('')
}

export
function canon
(name) {
  // buffer end => Buffer End
  if (name)
    return name.trim().split(' ').map(w => Buf.capitalize(w)).join(' ')
  return ''
}

export
function add
(name, cb, mo) {
  let commands, fCmds

  name = canon(name)

  if (mo) {
    mo.cmds = mo.cmds || []
    commands = mo.cmds
    globalThis.modes = globalThis.modes || []
    globalThis.modes[mo] = globalThis.modes[mo] || {}
    globalThis.modes[mo].cmds = globalThis.modes[mo].cmds || []
    fCmds = globalThis.modes[mo].cmds
  }
  else {
    commands = cmds
    globalThis.cmds = globalThis.cmds || []
    fCmds = globalThis.cmds
  }

  if (commands[name])
    commands[name].cb = cb
  else
    commands[name] = { name: name,
                       mode: mo,
                       cb: cb }

  commands[name].source = getCurrentLine({ frames: 2 })

  let fname

  fname = fName(name)
  //D("cmd.add: " + (mo ? (mo.key + ": ") : "") + fname + (cb ? "" : " (to be defined)"))
  if (cb)
    //Object.defineProperty(cb, 'name', {value: fname, writable: false})
    fCmds[fname] = cb

  return commands[name]
}

export
function remove
(name) {
  let fname, fCmds

  name = canon(name)
  delete cmds[name]

  fCmds = globalThis.cmds
  fname = fName(name)
  delete fCmds[fname]
}
