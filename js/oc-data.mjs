import Fs from 'node:fs'
import Path from 'node:path'
import { fileURLToPath } from 'node:url'

let BRED_DIR, VERSION_FILE, BASE

BRED_DIR = Path.resolve(Path.dirname(fileURLToPath(import.meta.url)), '..')
VERSION_FILE = Path.join(BRED_DIR, 'ext/code/lib/opencode/version.json')
BASE = Path.join(process.env.HOME, '.local/state/bred')

function toss
(msg) {
  throw new Error(msg)
}

function readVersion
() {
  let json

  json = JSON.parse(Fs.readFileSync(VERSION_FILE, 'utf8'))
  return json.version
}

function verParts
(v) {
  let parts

  if (v == null || v.length == 0)
    return [ 0 ]
  parts = v.split('.').map(p => parseInt(p, 10) || 0)
  return parts
}

function cmpVer
(a, b) {
  let pa, pb, n, i

  pa = verParts(a)
  pb = verParts(b)
  n = Math.max(pa.length, pb.length)
  for (i = 0; i < n; i++) {
    let da, db

    da = pa[i] || 0
    db = pb[i] || 0
    if (da < db)
      return -1
    if (da > db)
      return 1
  }
  return 0
}

function gatherCandidates
(workingDir, targetVersion) {
  let legacy, entries, out

  out = []
  legacy = Path.join(BASE, 'code-data' + workingDir)
  if (Fs.existsSync(legacy))
    out.push({ version: '0', path: legacy })
  try {
    entries = Fs.readdirSync(BASE)
  }
  catch {
    entries = []
  }
  entries.forEach(name => {
                    let prefix, ver

                    prefix = 'code-data-'
                    if (name.startsWith(prefix) == 0)
                      return
                    if (name.endsWith(workingDir) == 0)
                      return
                    ver = name.slice(prefix.length, name.length - workingDir.length)
                    if (ver == targetVersion)
                      return
                    if (ver.length == 0)
                      return
                    out.push({ version: ver, path: Path.join(BASE, name) })
                  })
  return out
}

export
function resolveDataDir
(workingDir) {
  let targetVersion, target, candidates

  workingDir || toss('workingDir required')
  (workingDir.at(0) == '/') || toss('workingDir must be absolute: ' + workingDir)

  targetVersion = readVersion()
  target = Path.join(BASE, 'code-data-' + targetVersion + workingDir)

  if (Fs.existsSync(target))
    return target

  candidates = gatherCandidates(workingDir, targetVersion)

  if (candidates.length) {
    let best

    candidates.sort((a, b) => cmpVer(a.version, b.version))
    best = pickBest(candidates, targetVersion)
    Fs.cpSync(best.path, target, { recursive: true })
  }
  else
    Fs.mkdirSync(target, { recursive: true })

  return target
}

function pickBest
(candidates, targetVersion) {
  let best

  best = null
  candidates.forEach(c => {
                       if (cmpVer(c.version, targetVersion) <= 0)
                         best = c
                     })
  if (best == null)
    best = candidates[candidates.length - 1]
  return best
}
