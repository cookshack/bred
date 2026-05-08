import * as Tron from '../../js/tron.mjs'

import * as OpenCode from './lib/opencode/v2/client.js'

export
async function ensureClient
(buf) {
  let client, ret, spawnPromise

  client = buf.vars('code').client
  if (client)
    return client

  if (buf.vars('code').spawnPromise)
    return buf.vars('code').spawnPromise

  spawnPromise = Tron.acmd('code.spawn', [ buf.id, buf.dir ])
  buf.vars('code').spawnPromise = spawnPromise

  ret = await spawnPromise

  if (ret.err) {
    buf.vars('code').spawnPromise = 0
    throw new Error(ret.err.message)
  }

  // Strip trailing slash: prepDir in buf ensures the / but opencode strips
  // the slash EXCEPT in session.list (which would compare the stored stripped
  // dirs to the given one with the /, leading to an empty response).
  client = OpenCode.createOpencodeClient({ baseUrl: ret.url, directory: buf.dir.replace(/\/$/, '') })
  buf.vars('code').client = client
  buf.vars('code').serverUrl = ret.url
  buf.vars('code').spawnedBufferID = buf.id
  buf.vars('code').spawnPromise = 0
  return client
}
