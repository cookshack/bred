//import { d } from './main-log.mjs'
import { app } from 'electron'
import { errMsg, makeErr } from './main-err.mjs'
import Fs from 'node:fs'
import Path from 'node:path'
import { spawn } from 'node:child_process'

function mandatoryExt
(name) {
  return [ 'core', 'ed' ].includes(name)
}

export
function onAdd
(e, ch, onArgs) {
  let [ name ] = onArgs
  let res, flag, dir

  function add
  () {
    flag = Path.join(dir, '.ADDED')
    Fs.open(flag, 'a', (err, fd) => {
      if (err) {
        e.sender.send(ch, makeErr(err))
        return
      }
      Fs.close(fd, err => {
        if (err)
          e.sender.send(ch, makeErr(err))
        else
          e.sender.send(ch, {})
      })
    })
  }

  if (mandatoryExt(name)) {
    e.sender.send(ch, errMsg("That's a mandatory extension"))
    return
  }

  dir = Path.join(app.getAppPath(), 'ext', name)

  flag = Path.join(dir, '.READY')
  Fs.access(flag, Fs.constants.F_OK, err => {
    if (err) {
      res = spawn('npm', [ 'install' ], { cwd: dir, encoding: 'utf-8' })
      if (res.error)
        throw res.error
      res.on('close', code => {
        if (code)
          e.sender.send(ch, errMsg('npm install failed: ' + code))
        else
          add()
      })
      return
    }
    // already installed
    add()
  })

  return ch
}

export
function onRemove
(e, ch, onArgs) {
  let [ name ] = onArgs
  let flag

  if (mandatoryExt(name)) {
    e.sender.send(ch, errMsg("That's a mandatory extension"))
    return
  }
  flag = Path.join(app.getAppPath(), 'ext', name, '.ADDED')
  Fs.unlinkSync(flag)
  e.sender.send(ch, {})
}

export
function onAll
(e, ch) {
  let dir

  function isDir
  (stat) {
    if (stat.mode & (1 << 15))
      return 0
    return 1
  }

  function added
  (dir, name) {
    if (mandatoryExt(name))
      return 1
    if (Fs.statSync(Path.join(dir, name, '.ADDED'),
                    { throwIfNoEntry: false }))
      return 1
    return 0
  }

  dir = Path.join(app.getAppPath(), 'ext')
  Fs.readdir(dir, {}, (err, data) => {
    let exts

    if (err) {
      e.sender.send(ch, { err })
      return
    }

    exts = []
    data.forEach(name => {
      let stat

      stat = Fs.statSync(Path.join(dir, name),
                         { throwIfNoEntry: false })
      if (stat && isDir(stat))
        exts.push({ name,
                    mandatory: mandatoryExt(name),
                    added: added(dir, name) })
    })
    e.sender.send(ch, { exts })
  })
}
