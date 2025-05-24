import { spawnSync } from 'node:child_process'
import * as Lsp from './main-lsp.mjs'
import Path from 'node:path'
import { d } from './main-log.mjs'

let projects

projects = []

function add
(dir) {
  let p

  function add
  (lang) {
    if (p.lsps && p.lsps[lang])
      return
    p.lsps = p.lsps || []
    if ([ 'c', 'javascript' ].includes(lang))
      p.lsps[lang] = Lsp.make(lang, dir)
  }

  function open
  (lang, path, bufId) {
    let lsp

    d('PROJ open ' + path)
    add(lang)
    lsp = p.lsps?.[lang]
    lsp?.open(lang, path, bufId)
  }

  d('PROJ add ' + dir)

  dir = dir || ''

  p = { add, dir, open }

  projects.push(p)
  return p
}

export
function get
(lang, path, bufId) {
  let p

  d('PROJ get ' + path)

  // search existing projects
  p = projects.find(p1 => {
    if (p1.dir.length) {
      d('  ' + p1.dir)
      return path.startsWith(p1.dir)
    }
  })
  if (p)
    d('PROJ found in existing')
  else {
    let res

    // is it in a git repo?
    res = spawnSync('git',
                    [ 'rev-parse', '--show-toplevel' ],
                    { cwd: Path.dirname(path),
                      encoding: 'utf-8' })
    if (res.error)
      d(res.error)
    if (res.error || (res.stdout.trim().length == 0))
      // fallback to the catchall project 'main'
      p = projects[0]
    else
      p = add(res.stdout.trim())
  }

  p.add(lang)

  // ensure path is open in lsp (in case init took too long for lsp.edit)
  p.open(lang, path, bufId)

  return p
}

export
function onRoot
(e, onArgs) {
  let [ dir ] = onArgs

  d('PROJ root')
  d(dir)
  return { xxx: dir }
}

export
function init
() {
  let p

  p = add()
  p.main = 1
}
