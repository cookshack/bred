import * as Server from '../lib/opencode/server.js'
import Net from 'node:net'
import { d } from './main-log.mjs'

let servers

servers = new Map()

async function isPortInUse
(port) {
  return new Promise(resolve => {
    let timedOut

    setTimeout(() => {
      timedOut = 1
      resolve(1)
    }, 1000)

    const server = Net.createServer()
    server.once('error', err => {
      if (timedOut)
        return
      if (err.code === 'EADDRINUSE')
        resolve(1)
      else
        resolve(0)
    })
    server.once('listening', () => {
      if (timedOut) {
        server.close()
        return
      }
      server.close()
      resolve(0)
    })
    server.listen(port, '127.0.0.1')
  })
}

async function getFreePort
() {
  let port

  port = 4096
  while (1)
    if (servers.has(port) || await isPortInUse(port))
      port++
    else
      return port
}

export
function init
() {
  d('CODE init')
  servers = new Map()
}

export
async function onSpawn
(e, args) {
  let [ bufferID, workingDir ] = args
  let port

  port = await getFreePort()

  d('CODE spawn ' + bufferID + ' on port ' + port + ' in ' + workingDir)

  try {
    let server

    server = await Server.createOpencodeServer({ hostname: '127.0.0.1',
                                                 port,
                                                 config: { root: workingDir,
                                                           logLevel: 'DEBUG' },
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
function onClose
(e, args) {
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

export
function closeAll
() {
  d('CODE closing ' + servers.size + ' servers')

  for (const [ bufferID, server ] of servers) {
    d('CODE closing server for buffer ' + bufferID)
    server.close()
  }

  servers = new Map()
}
