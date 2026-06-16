import * as Server from './main-code-server.mjs'
import { d } from './main-log.mjs'

let servers

servers = new Map()

export
function init
() {
  d('CODE init')
  servers = new Map()
}

export
async function onSpawn
(e, ch, args) {
  let [ bufferID, workingDir, statusCh ] = args
  let name

  name = Server.containerName(bufferID)

  d('CODE spawn ' + bufferID + ' in ' + workingDir)

  e.sender.send(statusCh, { containerName: name })

  try {
    let server

    server = await Server.create({ hostname: '127.0.0.1',
                                   bufferID,
                                   workingDir,
                                   send: msg => e.sender.send(statusCh, msg),
                                   config: { logLevel: 'DEBUG',
                                             permission: { external_directory: 'allow',
                                                           read: { '/home/node/.local/share/opencode/auth.json': 'deny' },
                                                           bash: { 'docker *': 'deny',
                                                                   'podman *': 'deny',
                                                                   'docker-compose *': 'deny',
                                                                   'nerdctl *': 'deny' } } } })

    servers.set(bufferID, server)
    e.sender.send(ch, { url: server.url, containerName: name })
  }
  catch (err) {
    d('CODE spawn failed: ' + err.message)
    e.sender.send(ch, { err: { message: 'Failed to start server: ' + err.message } })
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

  for (let [ bufferID, server ] of servers) {
    d('CODE closing server for buffer ' + bufferID)
    server.close()
  }

  servers = new Map()
}
