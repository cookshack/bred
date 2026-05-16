import Fs from 'node:fs'
import http from 'node:http'
import { spawn } from 'node:child_process'
import * as U from './util.mjs'
import { d } from './main-log.mjs'

import * as LocalServer from '../lib/opencode/v2/server.js'

let useDocker

useDocker = 1

function containerName
(bufferID) {
  return 'bred-code-' + process.pid + '-' + bufferID
}

function dataDir
(workingDir) {
  return process.env.HOME + '/.local/state/bred/code-data' + workingDir
}

function mountArgs
(workingDir, authPath) {
  let home

  home = process.env.HOME
  return [ '-v', workingDir + ':' + workingDir,
           '-v', home + '/fresh/main:' + home + '/fresh/main',
           '-v', home + '/src/opencode:' + home + '/src/opencode:ro',
           '-v', authPath + ':/home/node/.local/share/opencode/auth.json:ro',
           '-v', home + '/.gitignore:/home/node/.gitignore:ro',
           '-v', dataDir(workingDir) + ':/home/node/.local/share/opencode' ]
}

function containerRunning
(name) {
  return new Promise(resolve => {
    let proc, output

    proc = spawn('docker', [ 'inspect', '--format={{.State.Status}}', name ])
    output = ''
    proc.stdout.on('data', chunk => {
      output += chunk.toString()
    })
    proc.stderr.on('data', chunk => {
      output += chunk.toString()
    })
    proc.on('close', code => {
      if (code) {
        resolve(0)
        return
      }
      resolve(output.trim() == 'running')
    })
    proc.on('error', () => resolve(0))
  })
}

function healthCheck
(url, timeout, cName) {
  let start, ms, attempts

  start = Date.now()
  ms = 200
  attempts = 0

  return new Promise((resolve, reject) => {
    async function check
    () {
      let req

      attempts++

      if (Date.now() - start > timeout) {
        reject(new Error('docker health check timed out'))
        return
      }

      if (attempts % 10 == 0) {
        let running

        running = await containerRunning(cName)
        if (running == 0) {
          reject(new Error('docker container exited during health check'))
          return
        }
      }

      d('CODE SERVER health check ' + url)
      req = http.get(url + '/global/health', res => {
        if (res.statusCode == 200) {
          resolve()
          return
        }
        setTimeout(check, ms)
      })
      req.on('error', err => {
        d('CODE SERVER health check ERR: ' + err.message)
        setTimeout(check, ms)
      })
    }
    setTimeout(check, 1000)
  })
}

async function spawnDocker
(spec) {
  let name, port, workingDir, config, dockerTimeout, healthTimeout, authPath, args

  name = containerName(spec.bufferID)
  port = spec.port
  workingDir = spec.workingDir
  workingDir || U.toss('workingDir required')
  (workingDir.at(0) == '/') || U.toss('workingDir must be absolute: ' + workingDir)
  config = spec.config || {}
  dockerTimeout = 10000
  healthTimeout = spec.timeout || 30000
  authPath = process.env.HOME + '/.local/share/opencode/auth.json'

  Fs.mkdirSync(dataDir(workingDir), { recursive: true })

  args = []
  args.push('run', '-d', '--rm', '--name', name, '-p', port + ':4096', ...mountArgs(workingDir, authPath), '-e', 'OPENCODE_CONFIG_CONTENT=' + JSON.stringify(config), 'opencode-bred', 'serve', '--hostname=0.0.0.0', '--port=4096')
  if (config.logLevel)
    args.push('--log-level=' + config.logLevel)

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
      let url, containerID

      clearTimeout(dockerTimer)

      if (timedOut)
        return

      if (code) {
        reject(new Error('docker run failed with code ' + code + ': ' + output))
        return
      }

      containerID = output.trim()
      url = 'http://127.0.0.1:' + port

      d('CODE SERVER docker container ' + containerID + ' on ' + url)

      d('CODE SERVER running health check for ' + containerID + ' on ' + url)
      healthCheck(url, healthTimeout, name)
        .then(() => {
          d('CODE SERVER docker container healthy: ' + containerID)
          resolve({ url,
                    containerName: name,
                    close
                    () {
                      d('CODE SERVER docker stop ' + name)
                      spawn('docker', [ 'stop', name ])
                    } })
        })
        .catch(err => {
          d('CODE SERVER docker health check failed: ' + err.message)
          spawn('docker', [ 'stop', name ])
          reject(err)
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

async function spawnLocal
(spec) {
  let server

  server = await LocalServer.createOpencodeServer({ hostname: spec.hostname || '127.0.0.1',
                                                    port: spec.port,
                                                    config: spec.config,
                                                    timeout: spec.timeout })
  server.containerName = ''
  return server
}

export
async function create
(spec) {
  if (useDocker)
    return spawnDocker(spec)
  return spawnLocal(spec)
}
