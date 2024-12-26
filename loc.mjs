import * as Mess from './mess.mjs'
//import { d } from './mess.mjs'

let $appDir, $configDir, $iwd, $home, $shell

export
function appDirSet
(p) {
  $appDir = make(p)
  $appDir.ensureSlash()
}

export
function appDir
() {
  return make($appDir)
}

export
function configDirSet
(p) {
  $configDir = make(p)
  $configDir.ensureSlash()
}

export
function configDir
() {
  return make($configDir)
}

// initial working dir
export
function iwdSet
(dir) {
  $iwd = make(dir)
  $iwd.ensureSlash()
}

export
function iwd
() {
  return make($iwd)
}

export
function homeSet
(p) {
  $home = make(p).ensureSlash()
}

// guaranteed to exist and to have a trailing slash
export
function home
() {
  return $home || '/'
}

export
function shellSet
(sh) {
  $shell = sh
}

export
function shell
() {
  return $shell || 'sh'
}

export
function make
(path) {
  let expanded

  function filename
  () {
    if (path) {
      let s

      if (path.endsWith('/'))
        return 0
      s = path.split('/')
      return s.pop()
    }
    return path
  }

  // guaranteed trailing /
  function dirname
  () {
    if (path && path.length) {
      let s

      if (path.endsWith('/'))
        return path
      s = path.split('/')
      s.pop()
      if ((s.length == 1) && (s[0].length == 0))
        // /abc => /
        return '/'
      return make(s.join('/')).ensureSlash()
    }
    return path
  }

  function parent
  () {
    let s

    if (path.length == 0)
      Mess.toss('Empty path')

    // / => /
    if (path == '/') {
      path = '/'
      return path
    }

    if (path.startsWith('/')) {
      // ok
    }
    else
      Mess.toss('Need an absolute path')

    s = make(path).removeSlash().split('/')

    Mess.assert(s.length > 1)
    Mess.assert(s[0] == '')
    Mess.assert(s[1].length > 0)

    // /home => /
    if (s.length == 2) {
      path = '/'
      return path
    }

    // /home/matt => /home/
    // /usr/local/bin/bred/ = /usr/local/bin/
    s.pop()
    path = make(s.join('/')).ensureSlash()
    return path
  }

  function ensureSlash
  () {
    if (path) {
      if (path.endsWith('/'))
        return path
      if (path.endsWith(':'))
        return path
      path = path + '/'
    }
    return path
  }

  function removeSlash
  () {
    if (path && path.endsWith('/'))
      path = path.slice(0, path.length - 1)
    return path
  }

  function join
  (file) {
    if (path && file && file.length) {
      if (file.startsWith('/'))
        Mess.toss('loc.join second arg is a dir')
      ensureSlash()
      path += file
    }
    return path
  }

  function expand
  () {
    let md

    if (expanded)
      return path

    if ([ '~', ':' ].includes(path)) {
      path = home() || Mess.toss('home missing')
      expanded = 1
      return path
    }

    if (path.startsWith('~/')) {
      path = (home() || Mess.toss('home missing')) + path.slice('~/'.length)
      expanded = 1
      return path
    }

    if (path.startsWith('~'))
      Mess.toss('Please use full path instead of ~user')

    md = /([^:]*):(.*)/.exec(path)
    if (md && md.length) {
      if ([ 'home', '' ].includes(md[1])) {
        // home:..., :...
        path = (home() || Mess.toss('home missing')) + md[2]
        expanded = 1
        return path
      }

      if (md[1] == 'file') {
        // file:...
        // https://www.rfc-editor.org/rfc/rfc8089.html
        if (md[2].startsWith('//')) {
          let p

          p = md[2].slice('//'.length)
          if ((p.length > 0) && (p[0] == '/'))
            path = p
          else
            Mess.toss("'file://' must be followed by an absolute path")
        }
        else
          path = md[2]
        expanded = 1
        return path
      }

      Mess.toss('Alien path scheme: ' + md[1])
    }

    expanded = 1
    return path
  }

  function relative
  () {
    if (path && path.startsWith('/'))
      return 0
    return 1
  }

  function needsDotExpand
  () {
    if (path) {
      let s

      s = path.split('/')
      for (let i = 0; i < s.length; i++) {
        let file

        file = s[i].trim()
        if (file.length && Array.from(file).every(c => c == '.'))
          return 1
      }
    }
    return 0
  }

  if (path)
    if ((typeof path == 'string') || path instanceof String)
      path = path
    else
      path = path.path

  return { get dirname() {
    return dirname()
  },
           get filename() {
             return filename()
           },
           get length() {
             return path.length
           },
           get path() {
             return path
           },
           get relative() {
             return relative()
           },
           //
           set path(p) {
             expanded = 0; return path = p
           },
           //
           ensureSlash,
           expand,
           join,
           needsDotExpand,
           parent,
           removeSlash }
}
