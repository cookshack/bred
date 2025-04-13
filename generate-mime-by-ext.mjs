import Fs from 'node:fs'
import { importJson } from './js/json.mjs'

importJson('../lib/mime.json').then(m => {
  let mime, mimeByExt

  mime = m.default

  mimeByExt = {}
  Object.keys(mime).forEach(type => {
    let info

    info = mime[type]
    if (info.extensions)
      info.extensions.forEach(ext => {
        if (mimeByExt[ext] == undefined)
          mimeByExt[ext] = {}
        //d("adding type " + type + " for ext " + ext)
        mimeByExt[ext] = { ext: ext, type: type, info: info }
      })
  })
  //d("mimeByExt: ")
  //d(mimeByExt)

  try {
    Fs.writeFileSync('./lib/mime-by-ext.json', JSON.stringify(mimeByExt, null, 2) + '\n')
  }
  catch (err) {
    console.error('Error: ' + err.message)
  }
})
