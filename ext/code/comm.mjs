import * as Tron from '../../js/tron.mjs'
import { d } from '../../js/mess.mjs'

import * as OpenCode from './lib/opencode/v2/client.js'
import * as Ui from './ui.mjs'

export
async function ensureClient
(buf) {
  let client, spawnPromise

  client = buf.vars('code').client
  if (client)
    return client

  if (buf.vars('code').spawnPromise)
    return buf.vars('code').spawnPromise

  spawnPromise = new Promise((resolve, reject) => {
                               let sent, statusCh, off

                               sent = 0

                               statusCh = 'code.spawn.status.' + buf.id
                               off = Tron.on(statusCh, (err, data) => {
                                                         if (err)
                                                           return
                                                         if (data.containerName) {
                                                           buf.vars('code').containerName = data.containerName
                                                           Ui.updateDocker(buf)
                                                         }
                                                         if (data.log) {
                                                           d(data.log)
                                                           Ui.appendMsg(buf, 0, data.log)
                                                         }
                                                       })

                               Tron.cmd('code.spawn', [ buf.id, buf.dir, statusCh ], (err, data) => {
                                                                                       d('CODE COMM code.spawn message')
                                                                                       d({ data })
                                                                                       off()

                                                                                       if (sent)
                                                                                         return

                                                                                       if (err) {
                                                                                         sent = 1
                                                                                         buf.vars('code').spawnPromise = 0
                                                                                         reject(new Error(err.message || String(err)))
                                                                                         return
                                                                                       }

                                                                                       if (data.url) {
                                                                                         sent = 1
                                                                                         // Strip trailing slash: prepDir in buf ensures the / but opencode strips
                                                                                         // the slash EXCEPT in session.list (which would compare the stored stripped
                                                                                         // dirs to the given one with the /, leading to an empty response).
                                                                                         client = OpenCode.createOpencodeClient({ baseUrl: data.url, directory: buf.dir.replace(/\/$/, '') })
                                                                                         buf.vars('code').client = client
                                                                                         buf.vars('code').serverUrl = data.url
                                                                                         buf.vars('code').containerID = data.containerID
                                                                                         buf.vars('code').spawnedBufferID = buf.id
                                                                                         Ui.updateDocker(buf)
                                                                                         buf.vars('code').spawnPromise = 0
                                                                                         resolve(client)
                                                                                       }
                                                                                     })
                             })

  buf.vars('code').spawnPromise = spawnPromise
  return spawnPromise
}
