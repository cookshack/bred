import { equal } from 'node:assert/strict'
import * as Config from '../js/main-code-config.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

tests = {}

test('providers', 'shortens the pre-response timeout',
     () => {
       let i, ids, providers

       providers = Config.providers()
       ids = [ 'goat', 'openrouter', 'deepinfra' ]
       for (i = 0; i < ids.length; i++)
         equal(providers[ids[i]].settings.headerTimeout, 60000, ids[i] + ' needs a short header timeout')
     })

test('build', 'keeps the existing config and adds the providers',
     () => {
       let config

       config = Config.build([], '/w')
       equal(config.websearch.provider, 'exa')
       equal(config.permission.external_directory, 'allow')
       equal(config.permission.bash['docker *'], 'deny')
       equal(config.providers.goat.settings.headerTimeout, 60000)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
