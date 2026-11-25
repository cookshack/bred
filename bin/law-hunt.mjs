#!/usr/bin/env node

// The laws harness's command line, separate from the library: a suite imports
// `law.mjs`, so a top-level CLI there deadlocked on the import cycle.
//
//   bin/law-hunt.mjs hunt test/law-loc.mjs --seeds 200 --steps 40

import { pathToFileURL } from 'node:url'

import { box, hunt } from './law.mjs'

export
function usage
() {
  console.log('usage: bin/law-hunt.mjs hunt <suite.mjs> [--seeds N] [--steps N]')
  return 2
}

export
async function cli
(argv) {
  let file, seeds, steps, suite, i, found, count

  if ((argv[ 0 ] == 'hunt') == 0)
    return usage()
  file = argv[ 1 ]
  if (file == undefined)
    return usage()

  seeds = Number(argv[ argv.indexOf('--seeds') + 1 ]) || 50
  steps = Number(argv[ argv.indexOf('--steps') + 1 ]) || 40
  suite = (await import(pathToFileURL(file).href)).suite

  if (suite == undefined) {
    console.error('law: ' + file + ' exports no `suite`')
    return 2
  }

  count = 0
  i = 1
  found = 0

  while (i <= seeds) {
    let res

    res = hunt(suite, { seed: i, steps })
    if (res.ok == 0) {
      count += 1
      if (found == 0) {
        found = 1
        console.log(box(res))
        console.log('')
      }
    }
    i += 1
  }

  console.log(count + ' finding(s) in ' + seeds + ' seeds of ' + steps + ' steps')
  return found ? 1 : 0
}

// Compare the module's own URL, not a filename: a suite imports this file, and
// a suffix test re-entered the CLI from the import.
if (process.argv[ 1 ] && (pathToFileURL(process.argv[ 1 ]).href == import.meta.url))
  process.exit(await cli(process.argv.slice(2)))

process.exit(await cli(process.argv.slice(2)))
