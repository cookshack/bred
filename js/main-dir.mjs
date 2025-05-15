import { d, log } from './main-log.mjs'
import { errMsg, makeErr } from './main-err.mjs'
import Fs from 'node:fs'
import Path from 'node:path'
import { spawn } from 'node:child_process'

export
function onGet
(e, ch, dir) {
  let proc, ents, groups, readyU, readyG

  function stat
  (path) {
    let st

    st = Fs.lstatSync(path,
                      { throwIfNoEntry: false })
    if (st)
      st.link = st.isSymbolicLink()
    return st
  }

  function user
  (uid) {
    let ent

    ent = ents.find(e => e[2] == uid)
    return ent?.at(0)
  }

  function group
  (gid) {
    let g

    g = groups.find(g2 => g2[2] == gid)
    return g?.at(0)
  }

  function make
  (f) {
    let st

    st = stat(Path.join(dir, f))

    return { name: f,
             bak: f && f.endsWith('~'),
             group: group(st?.gid),
             hidden: f && f.startsWith('.'),
             user: user(st?.uid),
             stat: st }
  }

  function ok
  (data) {
    e.sender.send(ch, { data: data.map(make) })
  }

  function ready
  () {
    if (readyU && readyG) {
      ents = ents.split(/\r?\n/)
      ents = ents.map(ent => ent.split(':'))
      0 && ents.forEach(e => d(e.join()))

      groups = groups.split(/\r?\n/)
      groups = groups.map(ent => ent.split(':'))
      0 && groups.forEach(e => d(e.join()))

      Fs.readdir(dir, {}, (err, data) => {
        if (err)
          if (err.code === 'ENOTDIR') {
            dir = Path.dirname(dir)
            Fs.readdir(dir, {}, (err, data) => {
              if (err)
                e.sender.send(ch, { err })
              else
                ok(data)
            })
          }
          else
            e.sender.send(ch, { err })

        else
          ok(data)
      })
    }
  }

  ////

  ents = ''
  groups = ''

  proc = spawn('getent', [ 'passwd' ], { encoding: 'utf-8' })
  if (proc.error)
    throw proc.error
  proc.stdout.on('data', data => {
    ents += data
  })
  proc.on('close', code => {
    if (code)
      e.sender.send(ch, errMsg('getent failed: ' + code))
    else {
      readyU = 1
      ready()
    }
  })

  proc = spawn('getent', [ 'group' ], { encoding: 'utf-8' })
  if (proc.error)
    throw proc.error
  proc.stdout.on('data', data => {
    groups += data
  })
  proc.on('close', code => {
    if (code)
      e.sender.send(ch, errMsg('getent group failed: ' + code))
    else {
      readyG = 1
      ready()
    }
  })
}

export
function onMake
(e, ch, dir) {
  // mode will be 0777 (drwxrwxrwx)
  Fs.mkdir(dir, { recursive: true }, err => {
    if (err)
      e.sender.send(ch, { err })
    else
      e.sender.send(ch, {})
  })
}

export
function onRm
(e, ch, onArgs) {
  let [ path, spec ] = onArgs

  if (path == '/')
    e.sender.send(ch, errMsg('Cowardly refusing to rm /'))
  else if (path.startsWith('/'))
    if (spec?.recurse)
      Fs.rm(path, { recursive: true }, err => {
        if (err) {
          e.sender.send(ch, makeErr(err))
          return
        }
        e.sender.send(ch, {})
      })
    else
      Fs.rmdir(path, err => {
        if (err) {
          e.sender.send(ch, makeErr(err))
          return
        }
        e.sender.send(ch, {})
      })
  else
    e.sender.send(ch, errMsg('Path must be absolute'))
}

export
function onWatch
(e, ch, onArgs) {
  let [ path ] = onArgs
  let watcher

  function handle
  (type, name) {
    try {
      //d('--- handle ---')
      //d('type: ' + type)
      //d('name: ' + name)
      e.sender.send(ch,
                    { type,
                      bak: name.endsWith('~'),
                      hidden: Path.basename(name).startsWith('.'),
                      name })
    }
    catch (err) {
      err.message.includes('Object has been destroyed')
        || log(err.message)
      watcher.close()
    }
  }

  if (path.startsWith('/'))
    watcher = Fs.watch(path, { recursive: false }, handle)
  else
    e.sender.send(ch, errMsg('Path must be absolute'))
}
