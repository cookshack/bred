import { spawnSync } from 'node:child_process'
import Path from 'node:path'
import { d } from './main-log.mjs'

let projects

projects = [ { main: 1, dir: '' } ]

function add
(dir) {
  let p

  d('PROJ add ' + dir)

  p = { dir }

  projects.push(p)
  return p
}

export
function get
(path) {
  let p, res

  d('PROJ get ' + path)

  // search existing projects
  p = projects.find(p1 => {
    d('  ' + p1.dir)
    return p1.dir.length && path.startsWith(p1.dir)
  })
  if (p) {
    d('PROJ found in existing')
    return p
  }

  // is it in a git repo?
  res = spawnSync('git',
                  [ 'rev-parse', '--show-toplevel' ],
                  { cwd: Path.dirname(path),
                    encoding: 'utf-8' })
  d(res.error)
  if (res.error)
    // fallback to the catchall project 'main'
    return projects[0]

  return add(res.stdout.trim())
}
