import * as Ed from './ed.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Pane from './pane.mjs'
import * as Shell from './shell.mjs'
import * as Tron from './tron.mjs'
import { d } from './mess.mjs'

// https://www.freedesktop.org/wiki/Specifications/desktop-bookmark-spec/

function xbelPath
() {
  let path

  path = Loc.make(Loc.home())
  path.join('.local/share/recently-used.xbel')
  return path.path
}

export
async function add
(path, mtype) {
  let p

  if (mtype == 'inode/directory') {
    d('================ DIR')
    Tron.acmd('profile.hist.add', [ path, { type: 'dir' } ])
    return
  }

  p = Pane.current()
  0 && d('Recent.add: ' + path + ' ' + mtype)
  if (path.startsWith('file:///')) {
    // ok
  }
  else if (path.startsWith('/'))
    path = 'file://' + path
  else
    Mess.toss('Must be an absolute path')
  Shell.run(p.dir, Loc.appDir().join('bin/add-recent'), [ path, mtype ])
}

export
function get
(dirs, cb) { // (err, recents)
  let path, recents

  if (dirs) {
    Tron.acmd('profile.hist.get').then(data => {
      if (cb)
        cb(null, data)
    })
    return
  }

  recents = []
  path = xbelPath()
  Tron.cmd('file.get', [ path ], (err, data) => {
    let parser, xml, byType

    if (err) {
      Mess.log('path: ' + path)
      //Mess.toss(err.message)
      if (cb)
        cb(err)
      return
    }

    parser = new globalThis.DOMParser()
    xml = parser.parseFromString(data.data, 'application/xml')

    byType = xml.querySelectorAll('bookmark > info > metadata > mime-type')
    for (let i = 0; i < byType.length; i++) {
      let type, meta, info, bookmark

      type = byType[i].getAttribute('type')
      meta = byType[i].parentNode
      info = meta.parentNode
      bookmark = info.parentNode
      //d(type)
      if (Ed.supports(type))
        recents.unshift({ type,
                          visited: Date.parse(bookmark.getAttribute('visited') ?? 0),
                          href: bookmark.getAttribute('href') })
        //d("YES")
    }

    //d({ recents })
    //recents.forEach(r => d("recent: " + r.href))

    recents = recents.sort((r1,r2) => r2.visited - r1.visited)

    if (cb)
      cb(0, recents)
  })
}
