import * as Server from '../lib/opencode/server.js'
import { d } from './main-log.mjs'

let servers

servers = new Map()

function getFreePort() {
  let port

  port = 4096
  while (servers.has(port))
    port++
  return port
}

export
function init() {
  d('CODE init')
  servers = new Map()
}

export
async function onSpawn(e, args) {
  let [ bufferID, workingDir ] = args
  let port

  port = getFreePort()

  d('CODE spawn ' + bufferID + ' on port ' + port)

  try {
    let server

    server = await Server.createOpencodeServer({ hostname: '127.0.0.1',
                                                 port,
                                                 config: { root: workingDir },
                                                 timeout: 10000 })
    servers.set(bufferID, server)
    return { url: server.url }
  }
  catch (err) {
    d('CODE spawn failed: ' + err.message)
    return { err: { message: 'Failed to start server: ' + err.message } }
  }
}

export
function onClose(e, args) {
  let [ bufferID ] = args
  let server

  server = servers.get(bufferID)

  d('CODE close ' + bufferID)

  if (server) {
    server.close()
    servers.delete(bufferID)
  }
  return {}
}
