let projects

projects = [ { main: 1, dir: '' } ]

export
function get
(path) {
  let p

  // search existing projects
  p = projects.find(p1 => path.startsWith(p1.dir))
  if (p)
    return p

  // search up the dir tree for git repos

  // fallback to the catchall project 'main'
  return projects[0]
}
