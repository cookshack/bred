import { EventEmitter } from 'node:events'
import { equal } from 'node:assert/strict'
import * as Server from '../js/main-code-server.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

// The module's seam: a spawnfn that hands back a stub process and runs steps on
// the next tick, the way node delivers a child's first output.
function fakeDocker
(steps) {
  let spawnFn

  spawnFn = (cmd, args) => {
              let proc

              spawnFn.calls.push(args)
              proc = new EventEmitter()
              proc.stdout = new EventEmitter()
              proc.stderr = new EventEmitter()
              proc.kill = () => {}
              setImmediate(() => steps(args, proc))
              return proc
            }
  spawnFn.calls = []
  return spawnFn
}

tests = {}

test('containerRunning', 'a hung inspect times out and keeps the last state',
     async () => {
       let info, spawnFn

       spawnFn = fakeDocker((args, proc) => {
                              if (args[0] == 'inspect')
                                proc.stdout.emit('data', 'starting\n')
                            })
       info = await Server.containerRunning('box', spawnFn, 20)
       equal(info.timedOut, 1)
       equal(info.running, 0)
       equal(info.error, 'starting', 'the last state seen is kept')
       equal(spawnFn.calls.some(a => a[0] == 'stop'), true, 'the wedged container is still stopped')
     })

test('containerRunning', 'a container that never answers says no output',
     async () => {
       let info

       info = await Server.containerRunning('box', fakeDocker(() => {}), 20)
       equal(info.timedOut, 1)
       equal(Server.containerFailure(info, 20), 'docker inspect did not answer within 20ms (last: no output)')
     })

test('containerFailure', 'a timeout names the wait and the last state',
     () => {
       let msg

       msg = Server.containerFailure({ timedOut: 1, running: 0, state: '', error: 'starting' }, 5000)
       equal(msg.includes('5000ms'), true, 'names the wait')
       equal(msg.includes('starting'), true, 'names the last state')
       equal(msg.includes('exited'), false, 'does not blame the container')
     })

test('containerRunning', 'an exited container reports its state, not a timeout',
     async () => {
       let info, spawnFn

       spawnFn = fakeDocker((args, proc) => {
                              if (args[0] == 'inspect') {
                                proc.stdout.emit('data', 'exited\n')
                                proc.emit('close', 0)
                              }
                            })
       info = await Server.containerRunning('box', spawnFn, 20)
       equal(info.running, 0)
       equal(info.timedOut, 0)
       equal(info.state, 'exited')
       equal(Server.containerFailure(info), 'docker container not running during health check (state: exited)')
     })

test('containerRunning', 'a running container resolves as running',
     async () => {
       let info, spawnFn

       spawnFn = fakeDocker((args, proc) => {
                              if (args[0] == 'inspect') {
                                proc.stdout.emit('data', 'running\n')
                                proc.emit('close', 0)
                              }
                            })
       info = await Server.containerRunning('box', spawnFn, 20)
       equal(info.running, 1)
       equal(info.timedOut, 0)
       equal(Server.containerFailure(info), 'docker container not running during health check (state: running)')
     })

test('containerRunning', 'a failed inspect keeps the docker error',
     async () => {
       let info, spawnFn

       spawnFn = fakeDocker((args, proc) => {
                              if (args[0] == 'inspect') {
                                proc.stderr.emit('data', 'Error: No such object: box\n')
                                proc.emit('close', 1)
                              }
                            })
       info = await Server.containerRunning('box', spawnFn, 20)
       equal(info.running, 0)
       equal(info.timedOut, 0)
       equal(info.error, 'Error: No such object: box')
       equal(Server.containerFailure(info).includes('No such object'), true)
       equal(Server.containerFailure(info).includes('exited'), false)
     })

test('containerRunning', 'a spawn failure is an inspect failure, not an exit',
     async () => {
       let info

       info = await Server.containerRunning('box',
                                            fakeDocker((args, proc) => {
                                                         if (args[0] == 'inspect')
                                                           proc.emit('error', new Error('spawn docker ENOENT'))
                                                       }),
                                            20)
       equal(info.running, 0)
       equal(info.state, '')
       equal(info.error, 'spawn docker ENOENT')
       equal(Server.containerFailure(info), 'docker inspect failed during health check: spawn docker ENOENT')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
