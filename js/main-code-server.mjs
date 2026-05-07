import { spawn } from 'node:child_process'
import http from 'node:http'
import { d } from './main-log.mjs'

import * as LocalServer from '../lib/opencode/v2/server.js'

let useDocker

useDocker = 1

function containerName
(bufferID) {
  return 'bred-code-' + process.pid + '-' + bufferID
}

function healthCheck
(url, timeout) {
  let start, ms

  start = Date.now()
  ms = 200

  return new Promise((resolve, reject) => {
    function check
    () {
      let req

      if (Date.now() - start > timeout) {
        reject(new Error('docker health check timed out'))
        return
      }

      req = http.get(url + '/global/health', res => {
        if (res.statusCode == 200) {
          resolve()
          return
        }
        setTimeout(check, ms)
      })
      req.on('error', () => {
        setTimeout(check, ms)
      })
    }
    check()
  })
}

async function spawnDocker
(spec) {
  let name, port, workingDir, config, timeout, authPath, args

  name = containerName(spec.bufferID)
  port = spec.port
  workingDir = spec.workingDir
  config = spec.config || {}
  timeout = spec.timeout || 10000
  authPath = process.env.HOME + '/.local/share/opencode/auth.json'
  args = []
  args.push('run', '-d', '--rm', '--name', name, '-p', port + ':4096', '-v', workingDir + ':' + workingDir, '-v', process.env.HOME + '/src/opencode:' + process.env.HOME + '/src/opencode:ro', '-v', authPath + ':/home/node/.local/share/opencode/auth.json:ro', '-v', process.env.HOME + '/.gitignore:/home/node/.gitignore:ro', '-e', 'OPENCODE_CONFIG_CONTENT=' + JSON.stringify(config), 'opencode-bred', 'serve', '--hostname=0.0.0.0', '--port=4096')
  if (config.logLevel)
    args.push('--log-level=' + config.logLevel)

  d('CODE SERVER docker: ' + args.join(' '))

  return new Promise((resolve, reject) => {
    let proc, output, timedOut, timer

    timedOut = 0
    proc = spawn('docker', args)
    output = ''

    timer = setTimeout(() => {
      timedOut = 1
      spawn('docker', [ 'stop', name ])
      reject(new Error('Timeout waiting for docker container to start after ' + timeout + 'ms'))
    }, timeout)

    proc.stdout.on('data', chunk => {
      output += chunk.toString()
    })

    proc.stderr.on('data', chunk => {
      output += chunk.toString()
    })

    proc.on('close', code => {
      let url, containerID

      if (timedOut)
        return

      if (code) {
        clearTimeout(timer)
        reject(new Error('docker run failed with code ' + code + ': ' + output))
        return
      }

      containerID = output.trim()
      url = 'http://127.0.0.1:' + port

      d('CODE SERVER docker container ' + containerID + ' on ' + url)

      healthCheck(url, timeout)
        .then(() => {
          clearTimeout(timer)
          d('CODE SERVER docker container healthy')
          resolve({ url,
                    close
                    () {
                      d('CODE SERVER docker stop ' + name)
                      spawn('docker', [ 'stop', name ])
                    } })
        })
        .catch(err => {
          clearTimeout(timer)
          d('CODE SERVER docker health check failed: ' + err.message)
          spawn('docker', [ 'stop', name ])
          reject(err)
        })
    })

    proc.on('error', err => {
      if (timedOut)
        return
      clearTimeout(timer)
      reject(err)
    })
  })
}

async function spawnLocal
(spec) {
  return LocalServer.createOpencodeServer({ hostname: spec.hostname || '127.0.0.1',
                                            port: spec.port,
                                            config: spec.config,
                                            timeout: spec.timeout })
}

export
async function create
(spec) {
  if (useDocker)
    return spawnDocker(spec)
  return spawnLocal(spec)
}
