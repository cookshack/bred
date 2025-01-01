import { log } from './main-log.mjs'
import { errMsg, makeErr } from './main-err.mjs'
import Fs from 'node:fs'
import Path from 'node:path'

export
function onGet
(e, ch, dir) {
  function stat
  (path) {
    let st

    st = Fs.lstatSync(path,
                      { throwIfNoEntry: false })
    if (st)
      st.link = st.isSymbolicLink()
    return st
  }

  function ok
  (data) {
    e.sender.send(ch, { data: data.map(f => ({ name: f,
                                               bak: f && f.endsWith('~'),
                                               hidden: f && f.startsWith('.'),
                                               stat: stat(Path.join(dir, f)) })) })
  }

  Fs.readdir(dir, {}, (err, data) => {
    if (err)
      if (err.code === 'ENOTDIR') {
        dir = Path.dirname(dir)
        Fs.readdir(dir, {}, (err, data) => {
          if (err)
            e.sender.send(ch, { err: err })
          else
            ok(data)
        })
      }
      else
        e.sender.send(ch, { err: err })

    else
      ok(data)
  })
}

export
function onMake
(e, ch, dir) {
  // mode will be 0777 (drwxrwxrwx)
  Fs.mkdir(dir, { recursive: true }, err => {
    if (err)
      e.sender.send(ch, { err: err })
    else
      e.sender.send(ch, {})
  })
}

export
function onRm
(e, ch, onArgs) {
  let [ path ] = onArgs

  if (path.startsWith('/'))
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
                    { type: type,
                      bak: name.endsWith('~'),
                      hidden: Path.basename(name).startsWith('.'),
                      name: name })
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
