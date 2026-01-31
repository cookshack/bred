import * as Mess from './mess.mjs'
import * as Tron from './tron.mjs'
import { d } from './mess.mjs'

let watching

export
function watch
(buf, path) {
  if (watching.has(path))
    return

  Tron.cmd1('file.watch', [ path ], (err, ch) => {
    let off

    d('WODE 👀 watch ' + path)

    if (err) {
      Mess.log('watch failed on ' + path)
      watching.delete(path)
      return
    }

    off = Tron.on(ch, (err, data) => {
      // NB Beware of doing anything in here that modifies the file being watched,
      //    because that may cause recursive behaviour. Eg d when --logfile and
      //    log file is open in a buffer.
      console.log('WODE 👀 watch ev')
      console.log({ data })
      if (data.type == 'change') {
        if (buf.stat?.mtimeMs == data.stat?.mtimeMs)
          return
        buf.modifiedOnDisk = 1
      }
    })

    watching.set(path, off)

    buf.onRemove(() => {
      let off

      off = watching.get(path)
      if (off)
        off()
      watching.delete(path)
    })
  })
}

export
function init
() {
  watching = new Map()
}
