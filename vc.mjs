import { append, divCl } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Hist from './hist.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Scib from './scib.mjs'
import * as Shell from './shell.mjs'
import * as Tron from './tron.mjs'
import { d } from './mess.mjs'

let clrs

function git
(cmd, mode, minors) {
  // these use shell1 instead of spawn1 so that .bashrc is loaded (needed eg for nvm init)
  Shell.shell1(cmd,
               { end: 1 },
               b => {
                 if (mode)
                   b.mode = mode
                 minors?.forEach(minor => b.addMode(minor))
                 b.addMode('view')
               })
}

export
function initStash
() {
  let moS

  Cmd.add('stash open', () => {
    let line

    line = Pane.current().line()
    if (line.trim().length == 0)
      Mess.say('Empty line')
    else {
      let st

      st = /[^@]+@{([^}]+)/.exec(line)[1]
      if (st && st.length)
        git('git stash show -p ' + st, Ed.patchModeName(), [ 'equal' ])
      else
        Mess.warn('Failed to extract stash num: ' + line)
    }
  })

  Cmd.add('stash apply', () => {
    let line

    line = Pane.current().line()
    if (line.trim().length == 0)
      Mess.say('Empty line')
    else {
      let st

      st = /[^@]+@{([^}]+)/.exec(line)[1]
      if (st && st.length)
        git('git-stash-apply ' + st)
      else
        Mess.warn('Failed to extract stash num: ' + line)
    }
  })

  moS = Mode.add('stash', { viewInit: Ed.viewInit,
                            viewInitSpec: Ed.viewInitSpec,
                            viewCopy: Ed.viewCopy,
                            initFns: Ed.initModeFns,
                            parentsForEm: 'ed' })

  Em.on('a', 'stash apply', moS)
  Em.on('Enter', 'stash open', moS)
}

export
function initCommit
() {
  let mo, hist, reErr, reFile

  function runGit
  (text) {
    let cm

    cm = text?.trim()
    if (cm == null)
      Mess.toss('Commit message missing')
    else {
      let b64

      b64 = globalThis.btoa(cm)
      Shell.shell1(Loc.appDir().join('bin/check-and-commit-64') + ' ' + b64,
                   { end: 1,
                     afterEndPoint: 1 },
                   rbuf => rbuf.mode = 'commit result')
      hist.add(cm)
    }
  }

  function commit
  () {
    Prompt.ask({ text: 'Commit Message:',
                 placeholder: '',
                 hist: hist },
               runGit)
  }

  hist = Hist.ensure('commit')

  Cmd.add('vc commit', () => commit())

  //

  reErr = /^([^:]+):([0-9]+):([0-9]+):.*$/d
  reFile = /^([^:\s]+):([^0-9]+.*)?$/d

  mo = Mode.add('Commit Result', { viewInit: Ed.viewInit,
                                   viewInitSpec: Ed.viewInitSpec,
                                   viewCopy: Ed.viewCopy,
                                   initFns: Ed.initModeFns,
                                   parentsForEm: 'ed',
                                   decorators: [ { regex: reErr,
                                                   decor: [ { attr: { style: 'color: var(--rule-clr-comment);',
                                                                      'data-run': 'edit' } },
                                                            { attr: { style: 'color: var(--rule-clr-comment);' } },
                                                            { attr: { style: 'color: var(--rule-clr-comment);' } } ] },
                                                 { regex: reFile,
                                                   decor: [ { attr: { style: 'color: var(--rule-clr-entity);',
                                                                      'data-run': 'edit' } } ] } ] })

  Cmd.add('edit', () => Shell.edit(), mo)
  Cmd.add('next error', () => Shell.nextErr(1), mo)
  Cmd.add('previous error', () => Shell.nextErr(-1), mo)

  Em.on('e', 'edit', mo)
  Em.on('n', 'next error', mo)
  Em.on('p', 'previous error', mo)
  Em.on('Enter', 'edit', mo)

  // should use view mode
  Em.on('q', 'bury', mo)
  Em.on('Backspace', 'scroll up', mo)
  Em.on(' ', 'scroll down', mo)
}

function gitFile
(dir, file, cb) { // (file, code)  file is absolute
  Shell.runToString(dir, 'git', [ 'rev-parse', '--show-toplevel' ], false, (root, code) => {
    if (code) {
      cb(null, code)
      return
    }
    root = Loc.make(root.trim())
    root.ensureSlash()
    root.join(file)
    cb(root.path, 0)
  })
}

export
function initEqual
() {
  let mo

  function prevH
  () {
    let p, pos

    p = Pane.current()
    p.view.lineStart()
    p.view.linePrev()
    pos = p.view.pos
    while (1) {
      let line

      if (Ed.posRow(pos) <= 0)
        return

      line = p.view.lineAt(pos)
      if (line.startsWith('@@'))
        return
      Ed.posRowDecr(pos)
      p.view.linePrev()
    }
  }

  function nextH
  () {
    let p, pos, end

    p = Pane.current()
    p.view.lineStart()
    p.view.lineNext()
    pos = p.view.pos
    end = p.view.len

    while (1) {
      let line

      d(pos)
      if (Ed.posRow(pos) >= end)
        return
      line = p.view.lineAt(pos)
      d(line)
      if (line.startsWith('@@'))
        return
      Ed.posRowIncr(pos)
      p.view.lineNext()
    }
  }

  function prev
  (nth) {
    let b, num

    b = Pane.current().buf
    if (b.name == 'SC: git-eq')
      num = -1
    else if (b.name == 'SC: git show --no-prefix')
      num = 0
    else {
      let s

      s = b.name.split('~')
      num = parseInt(s[1])
    }
    num += nth
    if (isNaN(num))
      Mess.toss('Failed to parse commit num from buf name: ' + b.name)
    equal(num)
  }

  function equal
  (num) {
    function finish
    (b) {
      b.mode = Ed.patchModeName()
      b.opts.set('core.lint.enabled', 0)
      b.addMode('equal')
      b.addMode('view')
    }

    if ((num == null) || (num < 0))
      Shell.spawn1('git-eq',
                   [],
                   { end: 1, afterEndPoint: 1 },
                   finish)
    else
      Shell.spawn1('git',
                   [ 'show', '--no-prefix', 'HEAD~' + num ],
                   { end: 1, afterEndPoint: 1 },
                   finish)
  }

  function goto
  (other) {
    let p

    p = Pane.current()
    if (other)
      Pane.nextOrSplit()

    p.view.excur(() => {
      let line, pos, lineNum, offset, first

      offset = -1 // hunk line (@@ -N,...) is 1 before line N
      pos = p.view.pos
      pos.col = 0
      first = 1
      while (1) {
        if (Ed.posRow(pos) <= 0) {
          Mess.say('Reached start of buffer')
          return
        }
        line = p.view.lineAt(pos)
        //d('EQ line: ' + line)
        if ((lineNum === undefined) && line.startsWith('@@ ')) {
          let num

          //d('hunk line: ' + line)
          num = /^@@ -[^ ]+ +\+([0-9]+)/.exec(line)
          if (num)
            num = num[1]
          if (num && num.length)
            lineNum = parseInt(num) + offset
          else
            Mess.log('failed to parse hunk line: ' + line)
        }
        if (lineNum === undefined)
          if (line.startsWith('-')) {
            // removed line
            if (first)
              // must include in count if start line is a removed line
              offset++
          }
          else
            offset++
        first = 0
        if (line.startsWith('+++ ')) {
          let loc, file

          //d('EQ file line: ' + line)
          file = line.slice(4)
          loc = Loc.make(p.buf.dir)
          loc.ensureSlash()
          loc.join(file)
          Tron.cmd('file.stat', loc.path, err => {
            if (err)
              if (err.code == 'ENOENT')
                // try relative to the current git root
                gitFile(p.buf.dir, file, repoFile => {
                  if (repoFile) {
                    d('open repoFile ' + repoFile + ' at ' + lineNum)
                    Pane.openFile(repoFile, lineNum)
                  }
                  else
                    Mess.toss('File missing')
                })
              else
                Mess.toss(err)
            else {
              d('open loc.path ' + loc.path + ' at ' + lineNum)
              Pane.openFile(loc.path, lineNum)
            }
          })
          return
        }
        Ed.posRowDecr(pos)
      }
    })
  }

  mo = Mode.add('Equal')

  Cmd.add('goto source', () => goto(), mo)
  Cmd.add('goto source in other pane', () => goto(1), mo)
  Cmd.add('next hunk', () => nextH(), mo)
  Cmd.add('previous hunk', () => prevH(), mo)
  Cmd.add('next commit', () => prev(-1), mo)
  Cmd.add('previous commit', () => prev(1), mo)

  Em.on('e', 'Goto Source', mo)
  Em.on('n', 'Next Hunk', mo)
  Em.on('o', 'Goto Source In Other Pane', mo)
  Em.on('p', 'Previous Hunk', mo)
  Em.on('Enter', 'Goto Source', mo)
  Em.on('>', 'Next Commit', mo)
  Em.on('<', 'Previous Commit', mo)

  Cmd.add('vc equal', () => equal())
}

function reset
() {
  Prompt.yn('Reset Git dir?',
            { icon: 'warning' },
            yes => yes && git('git reset HEAD~1'))
}

function showHash
(hash) {
  Shell.shell1('git show --no-prefix' + (hash ? (' ' + hash) : ''),
               { end: 1,
                 afterEndPoint: 1 },
               b => {
                 b.mode = Ed.patchModeName()
                 b.addMode('equal')
                 b.addMode('view')
               })
}

function initLog
() {
  let mo, buf

  function next
  (n) {
    let p

    if (n == 0)
      return
    p = Pane.current()
    Ed.vfind(p.view,
             '^commit [0-9a-f]+(( |\t).*)?$',
             0,
             { skipCurrent: 1,
               backwards: n < 0,
               wrap: 0,
               caseSensitive: 0,
               wholeWord: 0,
               regExp: 1 })
    Cmd.run('line start')
  }

  function refresh
  () {
    let p, dir

    p = Pane.current()
    dir = Loc.make(p.buf.dir)
    dir.ensureSlash()
    dir = dir.path || Loc.home()
    Shell.run(p.dir, 'git', [ 'log' ], { buf: buf, end: 1, afterEndPoint: 1 })
  }

  function show
  () {
    let p, l, prefix

    prefix = 'commit '
    p = Pane.current()
    while (1) {
      l = p.line()
      if (l.startsWith(prefix)) {
        showHash(l.slice(prefix.length).split(' ', 1)?.at(0))
        return
      }
      if (p.pos.row == 0)
        return
      p.view.linePrev()
    }
  }

  function click
  (u, we) {
    let tok

    tok = Ed.tokenAt(we.e.x, we.e.y)
    if (tok?.name == 'Hash')
      showHash(tok.text)
  }

  mo = Mode.add('VC Log', { viewInit: Ed.viewInit,
                            viewInitSpec: Ed.viewInitSpec,
                            viewCopy: Ed.viewCopy,
                            initFns: Ed.initModeFns,
                            parentsForEm: 'ed' })

  Cmd.add('next commit', () => next(1), mo)
  Cmd.add('previous commit', () => next(-1), mo)
  Cmd.add('show', () => show(), mo)

  Cmd.add('vc log', () => {
    let p

    p = Pane.current()
    if (buf)
      buf.dir = p.dir
    else {
      buf = Buf.add('VC Log', 'VC Log', Ed.divW(0, 0, { hideMl: 1 }), p.dir)
      buf.icon = 'log'
      //buf.addMode("view") // overrides n,p
    }
    buf.opts.set('core.lint.enabled', 0)
    buf.opts.set('minimap.enabled', 0)
    buf.opts.set('core.lang', 'git log')
    p.setBuf(buf, {}, view => {
      buf.clear()
      refresh(view)
    })
  })

  Cmd.add('click', click, mo)

  Em.on('click', 'click', mo)

  // should use view mode
  Em.on('q', 'bury', mo)
  Em.on('Backspace', 'scroll up', mo)
  Em.on(' ', 'scroll down', mo)

  Em.on('n', 'next commit', mo)
  Em.on('Tab', 'next commit', mo)
  Em.on('p', 'previous commit', mo)
  Em.on('C-Tab', 'previous commit', mo)
  Em.on('e', 'show', mo)
  Em.on('Enter', 'show', mo)
}

function initLogBadIdea
() {
  let buf, w

  // Using div 'backend' for the log. Slow when the log is large. The
  // Ed backends limit the divs to what is displayed.

  function divW
  () {
    return divCl('vc_log-ww', divCl('vc_log-w bred-surface', ''))
  }

  function refresh
  (view) {
    let p

    p = Pane.current()
    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''
    Shell.run(p.dir, 'git', [ 'log' ], { onStdin: onStdin,
                                         onStdout: onStdout })
  }

  function onStdin
  (str) {
    //d(str)
    str.split('\n').forEach(line => {
      append(w, divCl('vc_log-line', line))
    })
  }

  function onStdout
  (str) {
    d(str)
  }

  Mode.add('Bad Idea', { viewInit: refresh })

  Cmd.add('bad idea vc log', () => {
    let p

    p = Pane.current()
    if (buf)
      p.setBuf(buf, {}, view => refresh(view))
    else {
      buf = Buf.add('Bad Idea', 'Bad Idea', divW(), p.dir)
      buf.icon = 'log'
      buf.addMode('view')
      p.setBuf(buf)
    }
  })
}

function initAnnotate
() {
  let mo, decorInfoJoin

  function refresh
  (view) {
    let buf, file

    function onStdout
    (str) {
      d(str)
    }

    function onStderr
    (str) {
      Mess.say(str)
    }

    function parse
    (commit, line, name, isTime) {
      if (line.startsWith(name + ' ')) {
        commit[name] = line.slice(name.length + 1)
        if (isTime) {
          let date

          date = new Date(parseInt(commit[name]) * 1000)

          commit[name] = date
          commit[name + '-formatted'] = String(date.getFullYear()).padStart(4, ' ') + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate() + 1).padStart(2, '0')
        }
        return 1
      }
      return 0
    }

    buf = view.buf
    file = buf.vars('vc').file
    file || Mess.toss('file var missing')
    if (0) {
      Shell.run(Loc.make(file).dirname, 'git', [ 'annotate', '--line-porcelain', file ],
                { end: 1,
                  afterEndPoint: 1,
                  onStdout: onStdout,
                  onStderr: onStderr })
      buf.append('xx')
    }
    else
      Shell.runToString(Loc.make(file).dirname, 'git', [ 'annotate', '--line-porcelain', file ], 0, str => {
        let out, commits, rows, commit, previous

        out = ''
        commits = []
        rows = []
        commit = {} // in case other line accidentally comes before hash
        str.split('\n').forEach(line => {
          let m

          m = line.match(/^([0-9a-f]{39,40})\s.*/)
          if (m) {
            let hash, clr

            hash = m[1]
            commit = commits.find(c => c.hash == hash)
            if (commit)
              return
            clr = clrs[commits.length % clrs.length]
            commit = { hash: hash,
                       clr: clr,
                       decorHash: Ed.makeDecor({ attr: { 'data-run': 'show',
                                                         'data-hash': hash } }),
                       decorHashJoin: Ed.makeDecor({ attr: { style: 'visibility: hidden;',
                                                             'data-run': 'show',
                                                             'data-hash': hash } }),
                       // display,width hack so bg fills line
                       decorText: Ed.makeDecor({ attr: { style: '--background-color: ' + clr + '; display: inline-block; width: 100%; --z-index: var(--z-below-activeLine);',
                                                         class: 'bred-bg' } }) }
            commits.push(commit)
            return
          }
          if (parse(commit, line, 'author'))
            return
          if (parse(commit, line, 'author-mail'))
            return
          if (parse(commit, line, 'author-time', 1))
            return
          if (parse(commit, line, 'author-tz'))
            return
          if (parse(commit, line, 'committer'))
            return
          if (parse(commit, line, 'committer-mail'))
            return
          if (parse(commit, line, 'committer-time', 1))
            return
          if (parse(commit, line, 'committer-tz'))
            return
          if (parse(commit, line, 'summary'))
            return
          if (line.startsWith('boundary')) {
            commit.boundary = 1
            return
          }
          if (parse(commit, line, 'previous'))
            return
          if (parse(commit, line, 'filename'))
            return
          if (line.length == 0)
            return

          rows.push({ commit: commit,
                      join: commit.hash == previous?.hash })

          previous = commit

          out += ((commit.hash?.slice(0, 8) || '').padStart(8, ' ')
                  + ' ' + (commit.author?.slice(0, 8) || '').padStart(8, ' ')
                  + ' ' + (commit['author-time-formatted'] || '').padStart(10, ' ')
                  + line // starts with tab
                  + '\n')
        })
        //d({ commits })
        //d({ rows })
        buf.vars('VC Annotate').commits = commits
        buf.vars('VC Annotate').rows = rows
        buf.append(out, 1)
      })
  }

  function edit
  () {
    let p, file

    p = Pane.current()
    file = p.buf.vars('vc').file
    file || Mess.toss('file var missing')
    Pane.openFile(file, p.view?.pos?.lineNumber)
  }

  function lineCommit
  () {
    let p, row, rows, vars, index

    p = Pane.current()

    vars = p.view.buf?.vars('VC Annotate')
    rows = vars?.rows
    index = p.view?.pos?.row
    row = rows[index]
    if (row)
      return row.commit
    return 0
  }

  function show
  (u, we) {
    if (we.e.target.dataset.hash)
      showHash(we.e.target.dataset.hash)
    else {
      let hash

      hash = lineCommit()?.hash
      if (hash)
        showHash(hash)
      else
        Mess.say('Target/line missing hash')
    }
  }

  function enter
  () {
    let p, file

    p = Pane.current()
    file = p.buf.vars('vc').file
    file || Mess.toss('file var missing')
    Pane.openFile(file, p.view?.pos?.lineNumber)
  }

  function getRefHash
  (view, match, line) {
    let commit, rows, row, vars

    vars = view.buf?.vars('VC Annotate')
    rows = vars?.rows
    row = rows[line.number - 1]
    commit = row?.commit
    if (commit)
      return row.join ? commit.decorHashJoin : commit.decorHash
    return 0
  }

  function getRefInfo
  (view, match, line) {
    let commit, rows, row, vars

    vars = view.buf?.vars('VC Annotate')
    rows = vars?.rows
    row = rows[line.number - 1]
    commit = row?.commit
    if (commit)
      return row.join && decorInfoJoin
    return 0
  }

  function getRefText
  (view, match) {
    let commit, commits, vars

    vars = view.buf?.vars('VC Annotate')
    commits = vars?.commits
    commit = commits?.find(c => c.hash.startsWith(match[1]))
    if (commit)
      return commit.decorText
    return 0
  }

  decorInfoJoin = Ed.makeDecor({ attr: { style: 'visibility: hidden;' } })

  mo = Mode.add('VC Annotate', { viewInit: Ed.viewInit,
                                 viewInitSpec: Ed.viewInitSpec,
                                 viewCopy: Ed.viewCopy,
                                 initFns: Ed.initModeFns,
                                 parentsForEm: 'ed',
                                 decorators: [ { regex: /^[^\t]+(\t).*$/d,
                                                 decor: [ { attr: { 'style': '--background-color: var(--clr-fill);',
                                                                    'class': 'bred-bg' } } ] },
                                               // above is hack to remove bg clr from \t
                                               { regex: /^([^\s]+)\s+([^\t]+)(\t.*)$/d, // \t in last group so that empty lines get colored
                                                 decor: [ { ref: getRefHash },
                                                          { ref: getRefInfo },
                                                          //{ attr: { 'data-run': 'show' } },
                                                          //{ rules: [ 'comment' ] },
                                                          { ref: getRefText } ] } ] })

  Cmd.add('edit', () => edit(), mo)

  Cmd.add('enter', () => enter(), mo)

  Cmd.add('show', (u, we) => show(u, we), mo)

  Cmd.add('vc annotate', () => {
    let p, buf, name

    p = Pane.current()
    p.buf.path || Mess.toss('buffer path missing')
    name = 'Annotate: ' + p.buf.path
    if (buf)
      buf.dir = p.dir
    else {
      buf = Buf.add(name,
                    'VC Annotate',
                    Ed.divW(0, 0, { hideMl: 1 }),
                    p.dir)
      buf.icon = 'log'
      //buf.addMode("view") // overrides n,p
    }
    buf.opts.set('core.lint.enabled', 0)
    buf.opts.set('minimap.enabled', 0)
    //buf.opts.set('core.lang', 'git log')
    buf.vars('vc').file = p.buf.path
    p.setBuf(buf, {}, view => {
      buf.clear()
      refresh(view)
    })
  })

  // should use view mode but want n,p
  Em.on('q', 'bury', mo)
  Em.on('Backspace', 'scroll up', mo)
  Em.on(' ', 'scroll down', mo)

  Em.on('n', 'next line', mo)
  Em.on('p', 'previous line', mo)
  Em.on('e', 'edit', mo)
  Em.on('Enter', 'enter', mo)
  Em.on('=', 'show', mo)
}

function
initClrs
() {
  let step

  step = Math.floor(256 / 20)
  clrs = []

  // Lightness Chroma Hue  https://css.land/lch/
  // Hue 0-256 goes from Redish to Blueish. Any higher and it wraps around to Redish again.
  for (let deg = 0; deg < 256; deg += step)
    clrs.push('lch(94% 30 ' + deg + 'deg)')
}

export
function init
() {
  let moB

  function add
  () {
    Scib.scib(pane => {
      pane.view.buf.append('git checkout -b ')
    })
  }

  Cmd.add('branch main', () => {
    let view, range

    view = Pane.current().view
    Ed.Backend.bufferStart()
    range = Ed.vfind(view,
                     '^. +main$',
                     0,
                     { regExp: 1 })
    if (range)
      Ed.Backend.lineStart(view)
    else
      Mess.yell('Missing')
  })

  Cmd.add('branch update', () => {
    git('git fetch --all --tags --prune')
  })

  Cmd.add('branch switch', () => {
    let line

    line = Pane.current().line()
    if (line.startsWith('*'))
      Mess.say("That's the current branch")
    else if (line.trim().length == 0)
      Mess.say('Empty line')
    else {
      let br

      br = line.split('/').at(-1)
      git('git switch ' + br)
    }
  })

  moB = Mode.add('branch', { viewInit: Ed.viewInit,
                             viewInitSpec: Ed.viewInitSpec,
                             viewCopy: Ed.viewCopy,
                             initFns: Ed.initModeFns,
                             parentsForEm: 'ed' })

  Em.on('+', 'branch add', moB)
  Em.on('m', 'branch main', moB)
  Em.on('u', 'branch update', moB)
  Em.on('s', 'branch switch', moB)
  Em.on('Enter', 'branch switch', moB)

  Cmd.add('branch add', add, moB)

  initClrs()
  initAnnotate()
  initCommit()
  initLog()
  initLogBadIdea()
  initEqual()
  initStash()

  Cmd.add('vc branch', () => git('git branch --all', 'branch'))
  Cmd.add('vc pull', () => git('git-pull-with-name'))
  Cmd.add('vc push', () => git('git push origin HEAD'))
  Cmd.add('vc reset', () => reset())
  Cmd.add('vc show', () => showHash())
  Cmd.add('vc stash', () => git('git stash'))
  Cmd.add('vc stash apply', () => Shell.shell1('git-stash-apply', { end: 1 }))
  Cmd.add('vc stash enumerate', () => git('git stash list', 'stash'))
  Cmd.add('vc stash pop', () => Shell.shell1('git-stash-pop', { end: 1 }))
  Cmd.add('vc status', () => Shell.shell1('git status', { end: 1 }))

  Em.on('C-x v a', 'vc stash apply')
  Em.on('C-x v b', 'vc branch')
  Em.on('C-x v c', 'vc commit')
  Em.on('C-x v e', 'vc stash enumerate')
  Em.on('C-x v g', 'vc annotate')
  Em.on('C-x v i', 'vc show')
  Em.on('C-x v l', 'vc log')
  Em.on('C-x v o', 'vc stash pop')
  Em.on('C-x v p', 'vc push')
  Em.on('C-x v r', 'vc reset')
  Em.on('C-x v s', 'vc status')
  Em.on('C-x v u', 'vc pull')
  Em.on('C-x v w', 'vc stash')
  Em.on('C-x v =', 'vc equal')
}
