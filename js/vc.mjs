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

import * as Diff from '../lib/diff.js'

let clrs

function git
(cmd, mode, minors, afterEndPoint) {
  // these use shell1 instead of spawn1 so that .bashrc is loaded (needed eg for nvm init)
  Shell.shell1(cmd,
               { end: 1,
                 afterEndPoint },
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
        git('git stash show --no-prefix -p ' + st,
            Ed.patchModeKey(),
            [ 'equal' ],
            1) // keep point at start
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
        git(Loc.appDir().join('bin/git-stash-apply') + ' ' + st)
      else
        Mess.warn('Failed to extract stash num: ' + line)
    }
  })

  Cmd.add('stash drop', () => {
    let line

    line = Pane.current().line()
    if (line.trim().length == 0)
      Mess.say('Empty line')
    else {
      let st

      st = /[^@]+@{([^}]+)/.exec(line)[1]
      if (st && st.length)
        git(Loc.appDir().join('bin/git-stash-drop') + ' ' + st)
      else
        Mess.warn('Failed to extract stash num: ' + line)
    }
  })

  moS = Mode.add('stash', { viewInitSpec: Ed.viewInitSpec,
                            viewCopy: Ed.viewCopy,
                            initFns: Ed.initModeFns,
                            parentsForEm: 'ed' })

  Em.on('a', 'stash apply', moS)
  Em.on('d', 'stash drop', moS)
  Em.on('e', 'stash open', moS)
  Em.on('g', 'vc stash enumerate', moS)
  Em.on('Enter', 'stash open', moS)
}

export
function initCommit
() {
  let mo, hist, reErr, reFile, encoder

  function runGit
  (text) {
    let cm

    cm = text?.trim()
    if (cm == null)
      Mess.toss('Commit message missing')
    else {
      let b64

      // encode for eg ¯\_(ツ)_/¯ because btoa requires utf8.
      b64 = globalThis.btoa(String.fromCharCode(...new Uint8Array(encoder.encode(cm))))
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
                 hist },
               runGit)
  }

  encoder = new globalThis.TextEncoder()
  hist = Hist.ensure('commit')

  Cmd.add('vc commit', () => commit())

  //

  reErr = /^([^:]+):([0-9]+):([0-9]+):.*$/d
  reFile = /^([^:\s]+):([^0-9]+.*)?$/d

  mo = Mode.add('Commit Result', { viewInitSpec: Ed.viewInitSpec,
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
function applyHunkTooPrecise
(view, hunk) {
  let off

  off = hunk.oldStart
  hunk.lines.forEach(line => {
    d('off ' + off)
    d(line)
    if (line.startsWith(' '))
      off += line.length - 1 /* space */ + 1 /* nl */
    else if (line.startsWith('-')) {
      let from, to

      from = off
      to = from + line.length - 1 /* - */ + 1 /* nl */
      d('remove ' + from + '-' + to)
      Ed.Backend.vremove(view,
                         { from,
                           to })
    }
    else if (line.startsWith('+')) {
      let text

      text = line.slice(1) + '\n'
      d('insert at ' + off + ': ' + text)
      Ed.Backend.vinsertAt(view,
                           Ed.Backend.offToBep(off),
                           1,
                           text)
      off += text.length
    }
    else
      Mess.log('applyHunk: weird line: ' + line)
  })
  d('off ' + off)
}

export
function initEqual
() {
  let mo

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

      if (Ed.posRow(pos) >= end) {
        p.view.bufEnd()
        return
      }
      line = p.view.lineAt(pos)
      d(line)
      if (line.startsWith('@@')) {
        p.view.bep = Ed.posToBep(p.view, pos)
        return
      }
      Ed.posRowIncr(pos)
    }
  }

  function prevH
  () {
    let p, pos

    p = Pane.current()
    p.view.lineStart()
    p.view.linePrev()
    pos = p.view.pos
    while (1) {
      let line

      if (Ed.posRow(pos) <= 0) {
        p.view.bufStart()
        return
      }

      line = p.view.lineAt(pos)
      if (line.startsWith('@@')) {
        p.view.bep = Ed.posToBep(p.view, pos)
        return
      }
      Ed.posRowDecr(pos)
    }
  }

  function currentH
  (p) {
    let psn, count

    psn = p.view.psn
    psn.lineStart()
    count = -1
    while (1) {
      let line

      if (psn.row <= 0)
        break

      line = p.view.lineAt(psn.pos)
      if (line.startsWith('+++'))
        break
      if (line.startsWith('@@'))
        count++

      psn.linePrev()
    }
    return count
  }

  function currentOldFile
  (p) {
    let psn

    psn = p.view.psn
    psn.lineStart()
    while (1) {
      let line

      if (psn.row <= 0)
        break

      line = p.view.lineAt(psn.pos)
      if (line.startsWith('+++ '))
        return line.slice('+++ '.length)

      psn.linePrev()
    }
  }

  function applyH
  () {
    let p, patch, hunk, iHunk, file, lineNum, text

    function abs
    (f, dir, cb) { // (file)
      Tron.acmd('project.root', [ dir ]).then(data => {
        d({ data })
        if (data.dir)
          cb(Loc.make(data.dir).join(f))
        else {
          Mess.say('Outside git, using current dir')
          cb(Loc.make(dir).join(f))
        }
      })
    }

    function run
    (view, data, f, reverse) {
      Shell.runToString(p.dir,
                        'patch',
                        [ ...(reverse ? [ '--reverse' ] : []),
                          '--no-backup-if-mismatch',
                          '--force',
                          '-i', data.file, f ],
                        0,
                        (str, code) => {
                          Tron.cmd('dir.rm', [ data.dir, { recurse: 1 } ], err => {
                            if (err)
                              Mess.yell('Error deleting: ' + err.message)
                          })
                          if (code) {
                            Mess.yell('Error: ' + code + ': ' + str)
                            return
                          }
                          // revert to show changes
                          Ed.Backend.revertV(view, { lineNum })
                        })
    }

    p = Pane.current()

    // Parse the patch.

    patch = Diff.parsePatch(p.buf.text())
    d(patch)

    // Strip it down to just the hunk.

    iHunk = currentH(p)
    file = currentOldFile(p)
    d({ iHunk })
    d({ file })
    patch = patch.filter(f => f.oldFileName == file)
    if (patch.length == 0) {
      Mess.yell('Empty')
      return
    }
    if (patch.length > 1) {
      Mess.yell('Multiple entries in patch for file')
      return
    }
    hunk = patch[0].hunks[iHunk]
    patch[0].hunks = [ hunk ]
    d(patch)
    // May be wrong if file modified since patch made.
    lineNum = hunk.newStart

    // Build patch text.

    text = Diff.formatPatch(patch)
    d(text)

    // Get the actual file name.

    abs(file, p.buf.dir, file => {

      // Apply it.

      d({ file })
      // Make sure file is open
      p.open(file, null, view => {
        // Must be saved
        if (p.buf.modified)
          Mess.toss('Please save first')
        // put patch in tmp file
        Tron.acmd('file.save.tmp', [ text ]).then(data => {
          if (data.err) {
            Mess.yell('file.save.tmp: ' + data.err.message)
            return
          }
          Shell.runToString(p.dir,
                            'patch',
                            [ '--dry-run', '--reverse', '--force', '-i', data.file, file ],
                            0,
                            (str, code) => {
                              if (code == 0) {
                                Prompt.yn('Looks like hunk is already applied. Reverse it?',
                                          {},
                                          yes => yes && run(view, data, file, 1))
                                return
                              }
                              run(view, data, file)
                            })
        })
      })
    })
  }

  function prev
  (nth) {
    let b, num

    b = Pane.current().buf
    if (/^SC: .*\/git-eq$/.test(b.name))
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
    equalN(num)
  }

  function finish
  (b) {
    b.mode = Ed.patchModeKey()
    b.opts.set('core.lint.enabled', 0)
    b.addMode('equal')
    b.addMode('view')
  }

  function equalN
  (num) {
    if ((num == null) || (num < 0))
      Shell.spawn1(Loc.appDir().join('bin/git-eq'),
                   [],
                   { end: 1, afterEndPoint: 1 },
                   finish)
    else
      Shell.spawn1('git',
                   [ 'show', '--no-prefix', 'HEAD~' + num ],
                   { end: 1, afterEndPoint: 1 },
                   finish)
  }

  function equalBr
  () {
    Shell.spawn1(Loc.appDir().join('bin/git-eq-br'),
                 [],
                 { end: 1, afterEndPoint: 1 },
                 finish)
  }

  function equal
  (u) {
    if (u == 1)
      equalN()
    else
      equalBr()
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
  Cmd.add('apply hunk', () => applyH(), mo)
  Cmd.add('next hunk', () => nextH(), mo)
  Cmd.add('previous hunk', () => prevH(), mo)
  Cmd.add('next commit', () => prev(-1), mo)
  Cmd.add('previous commit', () => prev(1), mo)

  Em.on('a', 'Apply Hunk', mo)
  Em.on('e', 'Goto Source', mo)
  Em.on('g', 'Vc Equal', mo)
  Em.on('n', 'Next Hunk', mo)
  Em.on('o', 'Goto Source In Other Pane', mo)
  Em.on('p', 'Previous Hunk', mo)
  Em.on('Enter', 'Goto Source', mo)
  Em.on('>', 'Next Commit', mo)
  Em.on('<', 'Previous Commit', mo)

  Cmd.add('vc equal', equal)
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
                 b.mode = Ed.patchModeKey()
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
    Shell.run(p.dir, 'git', [ 'log' ], { buf, end: 1, afterEndPoint: 1 })
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

  mo = Mode.add('VC Log', { viewInitSpec: Ed.viewInitSpec,
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
    Shell.run(p.dir, 'git', [ 'log' ], { onStdin,
                                         onStdout })
  }

  function onStdin
  (str) {
    //d(str)
    str.split(/\r?\n/).forEach(line => {
      append(w, divCl('vc_log-line', line))
    })
  }

  function onStdout
  (str) {
    d(str)
  }

  Mode.add('Bad Idea', { viewInitSpec: refresh })

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
  (view, pos) {
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
        let text

        text = line.slice(name.length + 1)
        //d({ text })
        commit[name] = text
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
                  onStdout,
                  onStderr })
      buf.append('xx')
    }
    else
      Shell.runToString(Loc.make(file).dirname, 'git', [ 'annotate', '--line-porcelain', file ], 0, str => {
        let out, commits, rows, commit, previous

        d('VC porcelain ready')
        out = ''
        commits = []
        rows = []
        commit = {} // in case other line accidentally comes before hash
        str.split(/\r?\n/).forEach(line => {
          let m

          //d({line})
          m = line.match(/^([0-9a-f]{39,40})\s.*/)
          if (m) {
            let hash, clr

            hash = m[1]
            commit = commits.find(c => c.hash == hash)
            if (commit)
              return
            clr = clrs[commits.length % clrs.length]
            commit = { hash,
                       clr,
                       decorHash: Ed.makeDecor({ attr: { 'data-run': 'show',
                                                         'data-hash': hash } }),
                       decorHashJoin: Ed.makeDecor({ attr: { style: 'visibility: hidden;',
                                                             'data-run': 'show',
                                                             'data-hash': hash } }),
                       decorText: Ed.makeDecor({ line: 1,
                                                 attr: { style: '--background-color: ' + clr + '; --z-index: var(--z-below-activeLine);',
                                                         class: 'bred-bg vc-bg' } }) }
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
          if (line.startsWith('\t')) {
            let out1

            rows.push({ commit,
                        join: commit.hash == previous?.hash })

            previous = commit

            out1 = ((commit.hash?.slice(0, 8) || '').padStart(8, ' ')
                    + ' ' + (commit.author?.slice(0, 8) || '').padStart(8, ' ')
                    + ' ' + (commit['author-time-formatted'] || '').padStart(10, ' ')
                    + line // starts with tab
                    + '\n')
            //d(out1)
            //d(out1.split('\n').length - 1)
            out += out1
          }
        })
        //d({ commits })
        //d({ rows })
        buf.vars('VC Annotate').commits = commits
        buf.vars('VC Annotate').rows = rows
        buf.append(out, 1)
        if (pos)
          view.gotoLine(pos.lineNumber)
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

  mo = Mode.add('VC Annotate', { viewInitSpec: Ed.viewInitSpec,
                                 viewCopy: Ed.viewCopy,
                                 initFns: Ed.initModeFns,
                                 parentsForEm: 'ed',
                                 decorators: [ { regex: /^[^\t]+(\t).*$/d,
                                                 decor: [ { attr: { 'style': '--background-color: var(--clr-fill);',
                                                                    'class': 'bred-bg' } } ] },
                                               // above is hack to remove bg clr from \t
                                               { regex: /^([^\s]+).*$/d,
                                                 decor: [ { ref: getRefText } ] },
                                               { regex: /^([^\s]+)\s+([^\t]+)\t.*$/d,
                                                 decor: [ { ref: getRefHash },
                                                          { ref: getRefInfo } ] } ] })

  Cmd.add('edit', () => edit(), mo)

  Cmd.add('enter', () => enter(), mo)

  Cmd.add('show', (u, we) => show(u, we), mo)

  Cmd.add('vc annotate', () => {
    let p, pos, buf, name

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
    buf.opts.set('core.highlight.trailingWhitespace.enabled', 0)
    //buf.opts.set('core.lang', 'git log')
    buf.vars('vc').file = p.buf.path
    pos = p.view.pos
    p.setBuf(buf, {}, view => {
      buf.clear()
      refresh(view, pos)
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

  function main
  () {
    let view, range

    view = Pane.current().view
    Ed.Backend.bufferStart()
    range = Ed.vfind(view,
                     '^. +main$',
                     0,
                     { regExp: 1 })
    range = range || Ed.vfind(view,
                              '^. +master$',
                              0,
                              { regExp: 1 })
    if (range)
      Ed.Backend.lineStart(view)
    else
      Mess.yell('Missing')
  }

  function star
  () {
    let view, range

    view = Pane.current().view
    Ed.Backend.bufferStart()
    range = Ed.vfind(view,
                     '^\\*',
                     0,
                     { regExp: 1 })
    if (range)
      Ed.Backend.lineStart(view)
    else
      Mess.yell('Missing')
  }

  function sw
  () {
    let line

    line = Pane.current().line()
    if (line.startsWith('*'))
      Cmd.run('parent')
    else if (line.trim().length == 0)
      Mess.say('Empty line')
    else {
      let br

      br = line.trim()
      if (br.startsWith('remotes/')) {
        let i

        br = br.slice('remotes/'.length)

        // will fail if remote name contains slash
        i = br.indexOf('/')
        if (i >= 0)
          br = br.slice(i + 1)
      }
      git('git switch ' + br)
    }
  }

  function update
  () {
    git('git fetch --all --tags --prune')
  }

  function branch
  () {
    git('git branch --all', 'branch')
  }

  moB = Mode.add('branch', { viewInitSpec: Ed.viewInitSpec,
                             viewCopy: Ed.viewCopy,
                             initFns: Ed.initModeFns,
                             parentsForEm: 'ed' })

  Cmd.add('branch add', () => add(), moB)
  Cmd.add('branch main', () => main(), moB)
  Cmd.add('branch *', () => star(), moB)
  Cmd.add('branch switch', () => sw(), moB)
  Cmd.add('branch update', () => update(), moB)

  Em.on('+', 'branch add', moB)
  Em.on('*', 'branch *', moB)
  Em.on('g', 'vc branch', moB)
  Em.on('m', 'branch main', moB)
  Em.on('u', 'branch update', moB)
  Em.on('s', 'branch switch', moB)
  Em.on('Enter', 'branch switch', moB)

  initClrs()
  initAnnotate()
  initCommit()
  initLog()
  initLogBadIdea()
  initEqual()
  initStash()

  Cmd.add('vc branch', () => branch())
  Cmd.add('vc pull', () => git('git-pull-with-name'))
  Cmd.add('vc push', () => git('git push origin HEAD'))
  Cmd.add('vc reset', () => reset())
  Cmd.add('vc show', () => showHash())
  Cmd.add('vc stash', () => git('git stash'))
  Cmd.add('vc stash apply', () => git(Loc.appDir().join('bin/git-stash-apply')))
  Cmd.add('vc stash drop', () => git(Loc.appDir().join('bin/git-stash-drop')))
  Cmd.add('vc stash enumerate', () => git('git stash list', 'stash', [], 1))
  Cmd.add('vc stash pop', () => Shell.shell1('git-stash-pop', { end: 1 }))
  Cmd.add('vc status', () => Shell.shell1('git status', { end: 1 }))

  Em.on('C-x v a', 'vc stash apply')
  Em.on('C-x v b', 'vc branch')
  Em.on('C-x v c', 'vc commit')
  Em.on('C-x v d', 'vc stash drop')
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
