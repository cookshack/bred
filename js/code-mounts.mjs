import fs from 'node:fs'

// The container's home directory. Deliberately identical to the host's, so
// that ~/src/... means the same thing inside and outside the container (see
// docker/opencode/Dockerfile).
export
function containerHome
() {
  return '/home/matt'
}

// Where the agent's credentials land inside the container. main-code.mjs
// denies reads of it, so both sides share this function.
export
function containerAuthPath
() {
  return containerHome() + '/.local/share/opencode/auth.json'
}

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
// ones offered as checkboxes on the first prompt. An unticked extra is offered
// but starts off: it is only mounted when the user ticks it.
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
           { src: home + '/4', unticked: 1 },
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

  list = [ { src: home + '/.gitignore', dest: containerHome() + '/.gitignore', ro: 1 },
           { src: dataDir, dest: containerHome() + '/.local/share/opencode' },
           { src: authPath, dest: containerAuthPath(), ro: 1 } ]
  configFile = home + '/.config/opencode/opencode.json'
  if (exists(configFile))
    list.push({ src: configFile, dest: containerHome() + '/.config/opencode/opencode.json', ro: 1 })
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
                 ro: m.ro || 0,
                 unticked: m.unticked || 0 }))
}

// The mounts a candidate list starts with. Unticked extras are shown on the
// first prompt, but stay out of the container until they are ticked.
export
function defaultSelection
(candidates) {
  return candidates.filter(c => (c.unticked ? 0 : 1)).map(c => c.path)
}

function picked
(selected, m) {
  if (selected == null)
    return m.unticked ? 0 : 1
  return selected.includes(m.src)
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
    .filter(m => picked(selected, m))
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
    .filter(m => picked(selected, m)))
  list.push(...infra(home, dataDir, authPath, exists))
  return list.flatMap(m => [ '-v', argFor(m) ])
}
