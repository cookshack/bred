import { log } from './main-log.mjs'
import { errMsg, makeErr } from './main-err.mjs'
import Fs from 'node:fs'
import Path from 'node:path'
import * as U from './util.mjs'

export
function onGet
(e, ch, onArgs, ctx) {
  let path

  path = onArgs
  path = U.stripFilePrefix(path)

  Fs.readFile(path, 'utf8', (err, data) => {
    if (err)
      e.sender.send(ch, { err: err })
    else {
      ctx.lsp.open(path, 'javascript', data)
      e.sender.send(ch, { data: data,
                          stat: Fs.statSync(path, { throwIfNoEntry: false }),
                          realpath: Fs.realpathSync(path) })
    }
  })
}

export
function onLn
(e, ch, onArgs) {
  let cwd, dir, absFrom, dbg, targetFile, fromFile
  let from, target

  function link
  (chdir) {
    if (Fs.statSync(from, { throwIfNoEntry: false })) {
      e.sender.send(ch, errMsg('File exists: ' + from))
      return
    }
    dbg('Fs.symlink: ' + target + ' <- ' + from)
    Fs.symlink(target,
               from,
               err => {
                 try {
                   let ret

                   ret = { ...(err ? makeErr(err) : {}),
                           cwd: process.cwd(),
                           from: from,
                           target: target,
                           absFrom: Path.join(cwd, from),
                           absTarget: Path.join(cwd, target) }
                   e.sender.send(ch, ret)
                 }
                 finally {
                   if (chdir)
                     process.chdir(chdir)
                 }
               })
  }

  // args
  //
  // ln -s target from
  //
  // the file pointed to by the symlink.
  // absolute.
  target = onArgs[0]
  // the symlink (a file that contains the target pathname).
  // absolute, or relative to target dirname
  // if ends in / takes filename of target.
  // same if basename is '..'.
  from = onArgs[1]

  dbg = () => {}
  //dbg = d
  dbg('from: ' + from)
  dbg('target: ' + target)

  // check target
  //

  if (target.startsWith('/')) {
    // ok
  }
  else {
    e.sender.send(ch, errMsg('Target path must be absolute'))
    return
  }

  // check from
  //

  fromFile = Path.basename(from)
  dbg('fromFile: ' + fromFile)

  if (fromFile == '.') {
    e.sender.send(ch, errMsg('Link to self'))
    return
  }

  targetFile = Path.basename(target)
  dbg('targetFile: ' + targetFile)

  // .. ⎘ t becomes ../t ⎘ t
  if (fromFile == '..')
    from += '/'
  // x/ ⎘ t becomes x/t ⎘ t
  if (from.endsWith('/'))
    from = Path.join(from, targetFile)

  // store the current dir (for logging and may chdir)
  //

  cwd = process.cwd()

  // absolute from
  //

  if (from.startsWith('/')) {
    link()
    return
  }

  // relative from, need to change dir
  //

  if (from.startsWith('./')
      || from.startsWith('../')) {
    // safe
  }
  else
    from = './' + from

  // change into the link dir
  dbg('from: ' + from)
  absFrom = Path.join(Path.dirname(target), from)
  dbg('absFrom: ' + absFrom)
  dir = Path.dirname(absFrom)
  dbg('dir: ' + dir)
  process.chdir(dir)
  dbg('temp cwd: ' + process.cwd())

  // make from just the file name (this is simplest)
  from = Path.basename(absFrom)
  dbg('new from: ' + from)

  // get the target path relative to the link dir (kind of the inverse of arg 'from')
  target = Path.relative(dir, target)
  dbg('new target: ' + target)
  //target = './' + Path.basename(target)

  // create link, passing flag to revert dir
  link(cwd)
}

export
function onMv
(e, ch, onArgs) {
  let [ from, to, spec ] = onArgs

  spec = spec || {}
  if (from.startsWith('/') && to.startsWith('/')) {
    if (spec.overwrite) {
      // skip check
    }
    else if (Fs.statSync(to, { throwIfNoEntry: false })) {
      e.sender.send(ch, errMsg('File exists', { exists: 1 }))
      return
    }
    Fs.renameSync(from, to)
    e.sender.send(ch, {})
    return
  }
  e.sender.send(ch, errMsg('Paths must be absolute'))
}

export
function onRm
(e, ch, onArgs) {
  let [ path ] = onArgs

  if (path.startsWith('/'))
    Fs.unlink(path, err => {
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
function onSave
(e, ch, onArgs) {
  let [ path, text ] = onArgs

  Fs.writeFile(path, text, { encoding: 'utf8' }, err => {
    if (err)
      e.sender.send(ch, { err: err })
    else
      e.sender.send(ch, { stat: Fs.statSync(path, { throwIfNoEntry: false }) })
  })
}

export
function onStat
(e, ch, onArgs) {
  Fs.lstat(onArgs, (err, data) => {
    if (err)
      e.sender.send(ch, { err: { message: err.message,
                                 code: err.code } })
    else if (data.isSymbolicLink())
      Fs.readlink(onArgs, (err, string) => {
        if (err)
          e.sender.send(ch, { err: err })
        else {
          let dest

          dest = Path.join(Path.dirname(onArgs), string)
          Fs.stat(dest, (err, data) => {
            if (err)
              e.sender.send(ch, { err: err })
            else
              e.sender.send(ch, { data: data,
                                  link: 1,
                                  dest: dest })
          })
        }
      })
    else
      e.sender.send(ch, { data: data })
  })
}

export
function onTouch
(e, ch, onArgs) {
  let now, paths

  now = new Date()
  paths = onArgs
  for (let i = 0; i < paths.length; i++)
    if (paths[i].startsWith('/'))
      Fs.utimesSync(paths[i], now, now)
    else {
      e.sender.send(ch, errMsg('Path must be absolute: ' + paths[i]))
      return
    }
  e.sender.send(ch, {})
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
                      name: name,
                      stat: Fs.statSync(path, { throwIfNoEntry: false }) })
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
