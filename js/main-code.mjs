import * as Server from './main-code-server.mjs'
import * as Mounts from './code-mounts.mjs'
import Database from 'better-sqlite3'
import Path from 'node:path'
import fs from 'node:fs'
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

function basicAuth
(password) {
  return 'Basic ' + Buffer.from('opencode:' + password).toString('base64')
}

export
async function onSpawn
(e, ch, args) {
  let [ bufferID, workingDir, statusCh, mounts ] = args
  let external, name

  external = process.env.BRED_OC_SERVER_URL
  name = external ? '' : Server.containerName(bufferID)

  d('CODE spawn ' + bufferID + ' in ' + workingDir)

  e.sender.send(statusCh, { containerName: name })

  try {
    let server

    //provider: { openrouter: { options: { provider: { sort: 'throughput' } } } }, // nitro, maybe expensive
    server = await Server.create({ hostname: '127.0.0.1',
                                   bufferID,
                                   workingDir,
                                   mounts,
                                   send: msg => e.sender.send(statusCh, msg),
                                   config: { websearch: { provider: 'exa' },
                                             references: Mounts.references(mounts, workingDir),
                                             permission: { external_directory: 'allow',
                                                           websearch: 'allow',
                                                           read: { [Mounts.containerAuthPath()]: 'deny' },
                                                           bash: { 'docker *': 'deny',
                                                                   'podman *': 'deny',
                                                                   'docker-compose *': 'deny',
                                                                   'nerdctl *': 'deny' } } } })

    servers.set(bufferID, server)
    e.sender.send(ch, { url: server.url,
                        containerName: server.containerName || name,
                        containerID: server.containerID,
                        auth: server.password ? basicAuth(server.password) : process.env.BRED_OC_SERVER_AUTH })
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
  let dataDir, db, rows, tbl

  dataDir = resolveDataDir(dir)
  db = new Database(Path.join(dataDir, 'opencode.db'))

  try {
    db.prepare('SELECT 1 FROM session_v2 LIMIT 1')
    tbl = 'session_v2'
  }
  catch {
    tbl = 'session'
  }

  rows = db.prepare(`
    SELECT s.id, s.title, s.directory, s.time_created, s.parent_id, s.agent,
           (SELECT m2.data FROM session_message m2
            WHERE m2.session_id = s.id AND m2.data LIKE ?
            LIMIT 1) as snippet_source
    FROM ${tbl} s
    WHERE s.title LIKE ?
       OR EXISTS (SELECT 1 FROM session_message m
                  WHERE m.session_id = s.id AND m.data LIKE ?)
    ORDER BY s.time_created DESC
    LIMIT 50
  `).all('%' + search + '%', '%' + search + '%', '%' + search + '%')

  db.close()
  return rows
}

function getGoatKey
() {
  let file, json

  file = process.env.HOME + '/.local/share/opencode/auth.json'
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'))
  }
  catch {
    return ''
  }
  return json.goat?.key || ''
}

async function billingGet
(path, key) {
  let res, text

  res = await fetch('https://api.commandcode.ai' + path,
                    { headers: { Authorization: 'Bearer ' + key },
                      signal: AbortSignal.timeout(5000) })
  text = await res.text()
  if (res.ok == 0)
    return { err: 'HTTP ' + res.status }
  return { data: JSON.parse(text) }
}

// Command Code's alpha billing endpoints, the same ones the cmd CLI uses.
// Undocumented, so the caller treats any error as "show nothing".
export
async function onUsage
() {
  let key

  key = getGoatKey()
  if (key.length == 0)
    return { err: 'no goat key' }

  try {
    let credits, subs

    credits = await billingGet('/alpha/billing/credits', key)
    if (credits.err)
      return credits
    subs = await billingGet('/alpha/billing/subscriptions', key)
    return { credits: credits.data,
             planId: subs.data?.data?.planId || '',
             periodEnd: subs.data?.data?.currentPeriodEnd || '' }
  }
  catch (err) {
    return { err: err.message }
  }
}

export
function onMounts
(e, args) {
  let [ workingDir ] = args

  return Mounts.candidateList(workingDir)
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
