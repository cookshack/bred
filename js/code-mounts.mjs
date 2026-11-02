import fs from 'node:fs'

function normal
(dir) {
  if (dir.at(-1) == '/')
    return dir.slice(0, -1)
  return dir
}

function labelFor
(home, src) {
  if (src.startsWith(home + '/'))
    return '~' + src.slice(home.length)
  return src
}

function refName
(home, src) {
  let rel

  rel = src
  if (src.startsWith(home + '/'))
    rel = src.slice(home.length + 1)
  return rel.split('/').join('-')
}

function argFor
(m) {
  return m.src + ':' + (m.dest || m.src) + (m.ro ? ':ro' : '')
}

// Directories the agent can see beyond the buffer's own dir. These are the
// ones offered as checkboxes on the first prompt.
function extras
(home) {
  return [ { src: home + '/fresh/main' },
           { src: home + '/src/review' },
           { src: home + '/src/review2' },
           { src: home + '/src/bred' },
           { src: home + '/src/uoc' },
           { src: home + '/src/bin' },
           { src: home + '/src/conventions' },
           { src: home + '/sessions' },
           { src: home + '/alts/main/openvas/plugins', ro: 1 },
           { src: home + '/alts/main/gvm/cert-data', ro: 1 },
           { src: home + '/alts/main/gvm/scap-data', ro: 1 },
           { src: home + '/alts/main/gvm/data-objects/gvmd/22.04', ro: 1 },
           { src: home + '/src/opencode', ro: 1 } ]
}

// Always mounted, never offered as a choice.
function infra
(home, dataDir, authPath, exists) {
  let list, configFile

  list = [ { src: home + '/.gitignore', dest: '/home/node/.gitignore', ro: 1 },
           { src: dataDir, dest: '/home/node/.local/share/opencode' },
           { src: authPath, dest: '/home/node/.local/share/opencode/auth.json', ro: 1 } ]
  configFile = home + '/.config/opencode/opencode.json'
  if (exists(configFile))
    list.push({ src: configFile, dest: '/home/node/.config/opencode/opencode.json', ro: 1 })
  return list
}

export
function candidateList
(workingDir, home, exists) {
  home = home || process.env.HOME
  exists = exists || fs.existsSync
  workingDir = normal(workingDir)
  return extras(home)
    .filter(m => exists(m.src))
    .filter(m => (m.src == workingDir) ? 0 : 1)
    .map(m => ({ path: m.src,
                 label: labelFor(home, m.src),
                 ro: m.ro || 0 }))
}

// opencode's project references, so the agent is told which extra dirs it has.
// Names must avoid slashes, whitespace, backticks and commas.
export
function references
(selected, workingDir, home, exists) {
  let refs

  home = home || process.env.HOME
  exists = exists || fs.existsSync
  workingDir = normal(workingDir)
  refs = {}
  extras(home)
    .filter(m => exists(m.src))
    .filter(m => (m.src == workingDir) ? 0 : 1)
    .filter(m => (selected == null) || selected.includes(m.src))
    .forEach(m => {
               refs[refName(home, m.src)] = { path: m.src,
                                              description: m.ro
                                                ? 'Read-only directory mounted into the agent container for this session.'
                                                : 'Writable directory mounted into the agent container for this session.' }
             })
  return refs
}

// selected == null means all extras, as before this was configurable.
export
function argList
(workingDir, dataDir, authPath, selected, home, exists) {
  let list

  home = home || process.env.HOME
  exists = exists || fs.existsSync
  workingDir = normal(workingDir)

  list = [ { src: workingDir } ]
  list.push(...extras(home)
    .filter(m => exists(m.src))
    .filter(m => (m.src == workingDir) ? 0 : 1)
    .filter(m => (selected == null) || selected.includes(m.src)))
  list.push(...infra(home, dataDir, authPath, exists))
  return list.flatMap(m => [ '-v', argFor(m) ])
}
