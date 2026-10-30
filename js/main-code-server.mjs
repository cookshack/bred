import http from 'node:http'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import * as U from './util.mjs'
import { d } from './main-log.mjs'

import { resolveDataDir } from './oc-data.mjs'

export
function containerName
(bufferID) {
  return 'bred-code-' + process.pid + '-' + bufferID
}

function mountArgs
(workingDir, dataDir, authPath) {
  let home, specs, configFile

  function src
  (spec) {
    return spec.split(':')[0]
  }

  home = process.env.HOME
  if (workingDir.at(-1) == '/')
    workingDir = workingDir.slice(0, -1)
  specs = [ home + '/fresh/main:' + home + '/fresh/main',
            home + '/src/review:' + home + '/src/review',
            home + '/src/review2:' + home + '/src/review2',
            home + '/src/bred:' + home + '/src/bred',
            home + '/src/uoc:' + home + '/src/uoc',
            home + '/src/bin:' + home + '/src/bin',
            home + '/src/conventions:' + home + '/src/conventions',
            home + '/sessions:' + home + '/sessions',
            home + '/alts/main/openvas/plugins:' + home + '/alts/main/openvas/plugins:ro',
            home + '/alts/main/gvm/cert-data:' + home + '/alts/main/gvm/cert-data:ro',
            home + '/alts/main/gvm/scap-data:' + home + '/alts/main/gvm/scap-data:ro',
            home + '/alts/main/gvm/data-objects/gvmd/22.04:' + home + '/alts/main/gvm/data-objects/gvmd/22.04:ro',
            home + '/src/opencode:' + home + '/src/opencode:ro',
            home + '/.gitignore:/home/node/.gitignore:ro',
            dataDir + ':/home/node/.local/share/opencode',
            authPath + ':/home/node/.local/share/opencode/auth.json:ro' ]
  configFile = home + '/.config/opencode/opencode.json'
  if (fs.existsSync(configFile))
    specs.push(configFile + ':/home/node/.config/opencode/opencode.json:ro')
  specs = specs
    .filter(s => (src(s) == workingDir) ? 0 : 1)
  return [ '-v', workingDir + ':' + workingDir,
           ...specs.flatMap(s => [ '-v', s ]) ]
}

function containerRunning
(name) {
  return new Promise(resolve => {
                       let proc, output, timedOut, timer

                       timedOut = 0
                       proc = spawn('docker', [ 'inspect', '--format={{.State.Status}}', name ])
                       output = ''

                       timer = setTimeout(() => {
                                            timedOut = 1
                                            spawn('docker', [ 'stop', name ])
                                            resolve(0)
                                          }, 5000)

                       proc.stdout.on('data', chunk => {
                                                output += chunk.toString()
                                              })
                       proc.stderr.on('data', chunk => {
                                                output += chunk.toString()
                                              })
                       proc.on('close', code => {
                                          clearTimeout(timer)
                                          if (timedOut)
                                            return
                                          if (code) {
                                            resolve(0)
                                            return
                                          }
                                          resolve(output.trim() == 'running')
                                        })
                       proc.on('error', () => {
                                          clearTimeout(timer)
                                          resolve(0)
                                        })
                     })
}

function containerPort
(name) {
  return new Promise((resolve, reject) => {
                       let proc, output, timedOut, timer

                       timedOut = 0
                       proc = spawn('docker', [ 'port', name, '4096' ])
                       output = ''

                       timer = setTimeout(() => {
                                            timedOut = 1
                                            reject(new Error('docker port timed out'))
                                          }, 5000)

                       proc.stdout.on('data', chunk => {
                                                output += chunk.toString()
                                              })
                       proc.stderr.on('data', chunk => {
                                                output += chunk.toString()
                                              })
                       proc.on('close', code => {
                                          let match, lines, line

                                          clearTimeout(timer)
                                          if (timedOut)
                                            return
                                          if (code) {
                                            reject(new Error('docker port failed with code ' + code + ': ' + output))
                                            return
                                          }
                                          lines = output.trim().split('\n')
                                          line = lines.find(l => /\d+\.\d+\.\d+\.\d+:/.test(l)) || lines[0]
                                          match = line.match(/:(\d+)/)
                                          if (match)
                                            resolve(parseInt(match[1]))
                                          else
                                            reject(new Error('failed to parse docker port from: ' + output))
                                        })
                       proc.on('error', err => {
                                          if (timedOut)
                                            return
                                          clearTimeout(timer)
                                          reject(err)
                                        })
                     })
}

function basicAuth
(password) {
  return 'Basic ' + Buffer.from('opencode:' + password).toString('base64')
}

function healthCheck
(url, timeout, cName, send, password) {
  let start, ms, attempts, headers

  start = Date.now()
  ms = 200
  attempts = 0
  headers = password ? { authorization: basicAuth(password) } : undefined

  d('CODE SERVER waiting for ' + url)
  send({ log: 'Waiting for server at ' + url })

  return new Promise((resolve, reject) => {
                       async function check
                       () {
                         let req

                         attempts++

                         if (Date.now() - start > timeout) {
                           d('CODE SERVER health check timed out')
                           reject(new Error('docker health check timed out'))
                           return
                         }

                         if (cName && attempts % 10 == 0) {
                           let running

                           running = await containerRunning(cName)
                           if (running == 0) {
                             reject(new Error('docker container exited during health check'))
                             return
                           }
                         }

                         req = http.get(url + '/api/info', { headers }, res => {
                                                                          if (res.statusCode == 200) {
                                                                            res.resume()
                                                                            d('CODE SERVER healthy ' + url)
                                                                            resolve()
                                                                            return
                                                                          }
                                                                          res.resume()
                                                                          setTimeout(check, ms)
                                                                        })
                         req.setTimeout(2000, () => {
                                                req.destroy()
                                                setTimeout(check, ms)
                                              })
                         req.on('error', err => {
                                           if (attempts == 1 || attempts % 50 == 0)
                                             d('CODE SERVER health check error: ' + err.message)
                                           setTimeout(check, ms)
                                         })
                       }
                       setTimeout(check, 1000)
                     })
}

function readAuthKeys
() {
  let file, json, out

  file = process.env.HOME + '/.local/share/opencode/auth.json'
  out = []
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'))
  }
  catch {
    return out
  }
  Object.keys(json).forEach(id => {
                              let value

                              value = json[id]
                              if (value && value.type == 'api' && value.key)
                                out.push([ id, value.key ])
                            })
  return out
}

// Fresh per-dir databases do not import the legacy auth.json credentials, so
// seed them through the server's own API. The id is stable per integration; a
// re-run after one key rotated must not leave the first-seeded key in the DB,
// so a 409 conflict drops the stale credential and re-posts the new value.
async function seedCredentials
(url, password) {
  let keys, i

  keys = readAuthKeys()
  for (i = 0; i < keys.length; i++) {
    let id, headers

    id = 'cred_legacy_' + keys[i][0].replace(/[^a-zA-Z0-9._-]/g, '_')
    headers = { 'content-type': 'application/json' }
    if (password)
      headers.authorization = basicAuth(password)
    try {
      let res

      res = await fetch(url + '/api/credential', { method: 'POST',
                                                   headers,
                                                   body: JSON.stringify({ id,
                                                                          integrationID: keys[i][0],
                                                                          label: 'API key',
                                                                          value: { type: 'key', key: keys[i][1] } }) })
      if (res.status == 409) {
        await fetch(url + '/api/credential/' + encodeURIComponent(id),
                    { method: 'DELETE',
                      headers })
        res = await fetch(url + '/api/credential', { method: 'POST',
                                                     headers,
                                                     body: JSON.stringify({ id,
                                                                            integrationID: keys[i][0],
                                                                            label: 'API key',
                                                                            value: { type: 'key', key: keys[i][1] } }) })
      }
      if (res.ok == 0)
        d('CODE SERVER credential seed failed for ' + keys[i][0] + ': ' + res.status)
    }
    catch (err) {
      d('CODE SERVER credential seed failed for ' + keys[i][0] + ': ' + err.message)
    }
  }
}

async function spawnDocker
(spec) {
  let name, workingDir, config, dockerTimeout, healthTimeout, authPath, args, dataDir, password

  spec = spec || {}
  name = containerName(spec.bufferID)
  workingDir = spec.workingDir
  workingDir || U.toss('workingDir required')
  (workingDir.at(0) == '/') || U.toss('workingDir must be absolute: ' + workingDir)
  config = spec.config || {}
  dockerTimeout = 10000
  healthTimeout = spec.timeout || 30000
  authPath = process.env.HOME + '/.local/share/opencode/auth.json'
  dataDir = resolveDataDir(workingDir)
  password = randomBytes(24).toString('base64url')

  args = []
  args.push('run', '-d', '--rm', '--name', name, '-p', '4096', ...mountArgs(workingDir, dataDir, authPath), '-e', 'EXA_API_KEY', '-e', 'OPENCODE_WEBSEARCH_PROVIDER=' + (process.env.OPENCODE_WEBSEARCH_PROVIDER || 'exa'), '-e', 'OPENCODE_ENABLE_EXA=' + (process.env.OPENCODE_ENABLE_EXA || 'true'), '-e', 'OPENCODE_LOG_LEVEL=' + (process.env.OPENCODE_LOG_LEVEL || 'DEBUG'), '-e', 'OPENCODE_PASSWORD=' + password, '-e', 'OPENCODE_CONFIG_CONTENT=' + JSON.stringify(config), 'opencode-bred', 'serve', '--hostname=0.0.0.0', '--port=4096')
  d('CODE SERVER docker: ' + args.join(' '))

  return new Promise((resolve, reject) => {
                       let proc, output, timedOut, dockerTimer

                       timedOut = 0
                       proc = spawn('docker', args)
                       output = ''

                       dockerTimer = setTimeout(() => {
                                                  timedOut = 1
                                                  spawn('docker', [ 'stop', name ])
                                                  reject(new Error('Timeout waiting for docker run after ' + dockerTimeout + 'ms'))
                                                }, dockerTimeout)

                       proc.stdout.on('data', chunk => {
                                                output += chunk.toString()
                                              })

                       proc.stderr.on('data', chunk => {
                                                output += chunk.toString()
                                              })

                       proc.on('close', code => {
                                          let containerID, logsProc

                                          function stopLogFollower
                                          () {
                                            if (logsProc) {
                                              logsProc.kill()
                                              logsProc = undefined
                                            }
                                          }

                                          function stop
                                          () {
                                            stopLogFollower()
                                            d('CODE SERVER docker stop ' + name)
                                            spawn('docker', [ 'stop', name ])
                                          }

                                          clearTimeout(dockerTimer)

                                          if (timedOut)
                                            return

                                          if (code) {
                                            reject(new Error('docker run failed with code ' + code + ': ' + output))
                                            return
                                          }

                                          containerID = output.trim()

                                          if (containerID)
                                            try {
                                              logsProc = spawn('docker', [ 'logs', '-f', name ])
                                              logsProc.stdout.on('data', chunk => {
                                                                           let text

                                                                           text = chunk.toString()
                                                                           spec.send({ log: text })
                                                                           d('CO log: ' + text)
                                                                         })
                                              logsProc.stderr.on('data', chunk => {
                                                                           let text

                                                                           text = chunk.toString()
                                                                           spec.send({ log: text })
                                                                           d('CO log: ' + text)
                                                                         })
                                              logsProc.on('error', err => {
                                                                     d('CO logs proc error: ' + err.message)
                                                                   })
                                            }
                                            catch (ex) {
                                              d('CO logs spawn failed: ' + ex.message)
                                            }

                                          d('CODE SERVER docker container ' + containerID + ' fetching assigned port')

                                          containerPort(name)
                                            .then(hostPort => {
                                                    let url

                                                    url = 'http://127.0.0.1:' + hostPort

                                                    d('CODE SERVER docker container ' + containerID + ' on ' + url)
                                                    d('CODE SERVER running health check for ' + containerID + ' on ' + url)
                                                    return healthCheck(url, healthTimeout, name, spec.send, password).then(async () => {
                                                                                                                             await seedCredentials(url, password)
                                                                                                                             return url
                                                                                                                           })
                                                  })
                                            .then(url => {
                                                    d('CODE SERVER docker container healthy: ' + containerID)
                                                    resolve({ url,
                                                              containerName: name,
                                                              containerID,
                                                              password,
                                                              close: stop })
                                                  })
                                            .catch(err => {
                                                     d('CODE SERVER docker failed: ' + err.message)
                                                     spec.send({ log: 'CO spawn failed: ' + err.message })
                                                     try {
                                                       let finalLogs

                                                       finalLogs = spawn('docker', [ 'logs', name ])
                                                       finalLogs.stdout.on('data',
                                                                           chunk => {
                                                                             spec.send({ log: chunk.toString() })
                                                                             d('CO final log: ' + chunk.toString())
                                                                           })
                                                       finalLogs.stderr.on('data',
                                                                           chunk => {
                                                                             spec.send({ log: chunk.toString() })
                                                                             d('CO final log: ' + chunk.toString())
                                                                           })
                                                       finalLogs.on('close',
                                                                    () => {
                                                                      stop()
                                                                      reject(err)
                                                                    })
                                                       finalLogs.on('error',
                                                                    () => {
                                                                      stop()
                                                                      reject(err)
                                                                    })
                                                     }
                                                     catch (ex) {
                                                       d('CO final logs spawn failed: ' + ex.message)
                                                       stop()
                                                       reject(err)
                                                     }
                                                   })
                                        })

                       proc.on('error', err => {
                                          if (timedOut)
                                            return
                                          clearTimeout(dockerTimer)
                                          reject(err)
                                        })
                     })
}

export
async function create
(spec) {
  let url

  // Dev-only seam: attach to an already-running server instead of spawning a
  // container. Used to iterate against a scoped container we start by hand.
  url = process.env.BRED_OC_SERVER_URL
  if (url) {
    let send, password

    send = spec?.send || (() => {})
    password = process.env.BRED_OC_SERVER_PASSWORD
    send({ log: 'CO attaching to external server ' + url })
    await healthCheck(url, spec?.timeout || 30000, '', send, password)
    return { url,
             containerName: '',
             containerID: '',
             password,
             close: () => {} }
  }
  return spawnDocker(spec)
}
