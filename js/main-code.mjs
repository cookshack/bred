import * as Server from './main-code-server.mjs'
import Database from 'better-sqlite3'
import Path from 'node:path'
import { d } from './main-log.mjs'
import { resolveDataDir } from './oc-data.mjs'

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
    e.sender.send(ch, { url: server.url, containerName: name, containerID: server.containerID })
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
function onSearchSessions
(e, args) {
  let [ dir, search ] = args
  let dataDir, db, rows

  dataDir = resolveDataDir(dir)
  db = new Database(Path.join(dataDir, 'opencode.db'))

  rows = db.prepare(`
    SELECT s.id, s.title, s.directory, s.time_created,
           (SELECT p2.data FROM part p2
            WHERE p2.session_id = s.id AND p2.data LIKE ?
            LIMIT 1) as snippet_source
    FROM session s
    WHERE s.title LIKE ?
       OR EXISTS (SELECT 1 FROM part p
                  WHERE p.session_id = s.id AND p.data LIKE ?)
    ORDER BY s.time_created DESC
    LIMIT 50
  `).all('%' + search + '%', '%' + search + '%', '%' + search + '%')

  db.close()
  return rows
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
