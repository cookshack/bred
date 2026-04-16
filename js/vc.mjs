import { append, divCl, img } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Browse from './browse.mjs'
import * as Cmd from './cmd.mjs'
import * as Ed from './ed.mjs'
import * as Em from './em.mjs'
import * as Hist from './hist.mjs'
import * as Icon from './icon.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Pane from './pane.mjs'
import * as Prompt from './prompt.mjs'
import * as Scib from './scib.mjs'
import * as Shell from './shell.mjs'
import * as Tron from './tron.mjs'
import * as U from './util.mjs'
import { d } from './mess.mjs'

import * as Diff from '../lib/diff.js'
import * as Opt from './opt.mjs'

let clrs, cachedNotifications, cachedPrs, cachedReleases, cachedUser

function vcMl
(args, mode) {
  return divCl('ml edMl',
               [ divCl('edMl-type',
                       img(Icon.path('log'), mode, 'filter-clr-text')),
                 divCl('ml-name', 'git ' + args.join(' ')),
                 divCl('ml-busy'),
                 divCl('ml-close') ])
}

function busyCo
() {
  return '🌊 BUSY'
}

function busySet
(buf, text) {
  buf.views.forEach(view => {
    if (view.eleOrReserved) {
      let busyW

      busyW = view.eleOrReserved.querySelector('.shell-exit-w')
      if (busyW)
        busyW.innerHTML = text
    }
  })
}

function busyClose
(p, code) {
  if (code)
    busySet(p.buf, '✘ ' + code) // 🚨 ✘✘✘ 🚫 ❌
  else
    busySet(p.buf, '✔ ' + code) // 🏁 ✔✔✔ 🎉 ✅
}

function busyErr
(p, err) {
  busySet(p.buf, '☠️ ERR ' + err.message)
}

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
            'patch',
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

  moS = Mode.add('stash', { viewInit: Ed.viewInit,
                            viewCopy: Ed.viewCopy,
                            initFns: Ed.initModeFns,
                            parentsForEm: 'ed' })

  Em.on('a', 'stash apply', moS)
  Em.on('d', 'stash drop', moS)
  Em.on('e', 'stash open', moS)
  Em.on('g', 'vc stash enumerate', moS)
  Em.on('Enter', 'stash open', moS)
}

function stateClr
(state) {
  if (state == 'M')
    return '--clr-syntax3'
  if (state == 'A')
    return '--clr-syntax0'
  if (state == 'R')
    return '--clr-emph'
  if (state == 'P')
    return '--clr-syntax4'
  if (state == 'D')
    return '--clr-text'
  if (state == 'O')
    return '--clr-syntax1'
  if (state == 'C')
    return '--clr-nb2'
  return '--clr-text'
}

function getToken
() {
  let token

  token = Opt.get('core.vc.github.token')
  token.length || Mess.toss('core.vc.github.token not set')
  return token
}

function fetchArg
(method, spec) { // { lastModified, accept }}
  let headers

  spec = spec || {}
  headers = { Authorization: 'Bearer ' + getToken(),
              Accept: spec.accept || 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2026-03-10' }

  if (spec.lastModified)
    headers['If-Modified-Since'] = spec.lastModified

  return { method,
           mode: 'cors',
           cache: 'no-store',
           headers }
}

function del
(url, cb) { // (err)
  return fetch(url, fetchArg('DELETE'))
    .then(res => {
      if (res.ok) {
        cb()
        return
      }
      throw new Error('HTTP ' + res.status)
    })
    .catch(err => cb(err))
}

function get
(url,
 spec, // { lastModified, accept }
 cb) { // (err, status, data, headers)
  spec = spec || {}
  return fetch(url, fetchArg('GET', spec))
    .then(res => {
      if (res.ok) {
        if (spec.accept?.endsWith('diff'))
          res.text().then(data => cb(0, res.status, data, res.headers))
        else
          res.json().then(data => cb(0, res.status, data, res.headers))
        return
      }
      cb(new Error('HTTP ' + res.status), res.status, 0, res.headers)
    })
    .catch(err => cb(err))
}

function patch
(url, cb) { // (err)
  return fetch(url, fetchArg('PATCH'))
    .then(res => {
      if (res.ok) {
        cb()
        return
      }
      throw new Error('HTTP ' + res.status)
    })
    .catch(err => cb(err))
}

function formatDate
(str) {
  if (str?.length) {
    let date, now

    date = new Date(str)
    now = new Date()

    if (((date.getFullYear() == now.getFullYear())
         && (date.getMonth() == now.getMonth())
         && (date.getDate() == now.getDate()))
        || ((now - date) < (24 * 60 * 60 * 1000))) {
      let time

      time = String(date.getHours()).padStart(2, '0')
        + 'h' + String(date.getMinutes()).padStart(2, '0')
      return time.padEnd(16)
    }

    return date.getFullYear()
      + '-' + String(date.getMonth() + 1).padStart(2, '0')
      + '-' + String(date.getDate()).padStart(2, '0')
      + ' ' + String(date.getHours()).padStart(2, '0')
      + 'h' + String(date.getMinutes()).padStart(2, '0')
  }

  return ''
}

function getRefState
(view, match) {
  let state

  state = match[1]
  if (state)
    return Ed.makeDecor({ attr: { style: 'color: var(' + stateClr(state) + ')' } })
  return 0
}

function getRefPr
(view, match) {
  let prNum, ownerRepo

  prNum = match[2]?.trim()
  ownerRepo = match[5]
  if (ownerRepo) {
    if (prNum)
      return Ed.makeDecor({ attr: { style: 'color: var(--clr-syntax1)',
                                    'data-run': 'open externally',
                                    'data-url': 'https://github.com/' + ownerRepo + '/pull/' + prNum } })
    return {}
  }
  return 0
}

function getRefRepo
(view, match) {
  let ownerRepo

  ownerRepo = match[5]
  if (ownerRepo)
    return Ed.makeDecor({ attr: { style: 'color: var(--rule-clr-comment)',
                                  'data-run': 'open externally',
                                  'data-url': 'https://github.com/' + ownerRepo } })
  return 0
}

function getPr
(basic, ownerRepo, prNum, cb) { // (res)
  let key, cached, url

  key = ownerRepo + '/' + prNum
  cached = cachedPrs[key]
  url = 'https://api.github.com/repos/' + ownerRepo + '/pulls/' + prNum

  get(url,
      { lastModified: cached?.lastModified },
      (err, status, data, headers) => {
        if (err) {
          if (status == 304) {
            if (cached) {
              if (basic || cached.commits) {
                cb(cached)
                return
              }
              // Need to get it all
              cached.lastModified = 0
              getPr(0, ownerRepo, prNum, cb)
              return
            }
            Mess.log('VC getPr somehow got 304 with cache miss')
          }
          cb()
          return
        }

        if (data) {
          let state

          state = '?'
          if (data.merged)
            state = 'Merged'
          else if (data.review_decision == 'APPROVED')
            state = 'Approved'
          else if (data.review_decision == 'CHANGES_REQUESTED')
            state = 'Request for changes'
          else if (data.review_decision == 'PENDING')
            state = 'Pending'
          else if (data.draft)
            state = 'Draft'
          else if (data.state)
            state = U.capitalize(data.state)

          for (let k in cachedPrs)
            if (k.startsWith(ownerRepo + '/') && cachedPrs[k].branch == data.head.ref)
              delete cachedPrs[k]

          get('https://api.github.com/repos/' + ownerRepo + '/pulls/' + prNum + '/reviews',
              0,
              (err2, status2, data2, headers2) => {
                let reviews

                reviews = []
                if (data2)
                  reviews = data2.map(r => ({ body: r.body,
                                              user: r.user.login,
                                              state: r.state,
                                              submitted: r.submitted_at }))

                if (basic) {
                  cachedPrs[key] = { pr: data, state, branch: data.head.ref, prNum, lastModified: headers.get('Last-Modified'), reviews, reviewsLastModified: headers2?.get('Last-Modified') }
                  cb(cachedPrs[key])
                  return
                }

                get('https://api.github.com/repos/' + ownerRepo + '/pulls/' + prNum + '/commits',
                    0,
                    (err3, status3, data3, headers3) => {
                      let commits

                      commits = []
                      if (data3)
                        commits = data3.map(c => ({ sha: c.sha,
                                                    message: c.commit.message.split('\n')[0],
                                                    author: c.commit.author.name }))

                      get('https://api.github.com/repos/' + ownerRepo + '/pulls/' + prNum + '/comments',
                          0,
                          (err4, status4, data4, headers4) => {
                            let comments

                            comments = []
                            if (data4)
                              comments = data4.map(c => ({ body: c.body,
                                                           user: c.user.login,
                                                           created: c.created_at }))

                            cachedPrs[key] = { pr: data, state, branch: data.head.ref, prNum, lastModified: headers.get('Last-Modified'), reviews, reviewsLastModified: headers2?.get('Last-Modified'), commits, commitsLastModified: headers3?.get('Last-Modified'), comments, commentsLastModified: headers4?.get('Last-Modified') }
                            cb(cachedPrs[key])
                          })
                    })
              })
          return
        }

        cb()
      })

}

function getRelease
(ownerRepo, tag, cb) { // (res)
  let key, cached, url

  key = ownerRepo + '/' + tag
  cached = cachedReleases[key]
  url = 'https://api.github.com/repos/' + ownerRepo + '/releases/tags/' + tag

  get(url,
      { lastModified: cached?.lastModified },
      (err, status, data, headers) => {
        if (err) {
          if ((status == 304) && cached) {
            cb(cached)
            return
          }
          cb()
          return
        }

        if (data) {
          cachedReleases[key] = { release: data, lastModified: headers?.get('Last-Modified') }
          cb(cachedReleases[key])
          return
        }

        cb()
      })

}

function branchDir
(p, dir, name) {
  let path

  path = Loc.make(dir).expand()

  Shell.runToString(path, 'git', [ 'branch', '--show-current' ], 0, (out, code) => {
    let currentBranch

    d('VC ' + out)

    if (code) {
      Mess.yell('Is this a git dir? ' + path)
      return
    }

    currentBranch = out.trim()
    if (currentBranch == name) {
      Mess.say('Already in ' + name)
      Pane.openDir(path)
      return
    }

    Mess.say('Currently in ' + name)
    Shell.runToString(path, 'git', [ 'status', '--porcelain' ], 0, (out, code) => {
      d('VC ' + out)
      if (code) {
        Mess.yell('git status failed')
        return
      }
      if (out.trim().length) {
        Mess.yell('Changes in ' + currentBranch + '. Commit or stash first')
        return
      }
      Mess.say('Fetching ' + name)
      Shell.runToString(path, 'git', [ 'fetch', 'origin', name + ':' + name ], 0,
                        (out, code) => {
                          d('VC ' + out)
                          if (code) {
                            Mess.yell('Fetch failed: ' + code)
                            return
                          }
                          Mess.say('Checking out ' + name)
                          Shell.runToString(path, 'git', [ 'checkout', name ], 0,
                                            (out, code) => {
                                              d('VC ' + out)
                                              if (code) {
                                                Mess.yell('Checkout failed: ' + code)
                                                return
                                              }
                                              Mess.say('Now in ' + name)
                                              Pane.openDir(path)
                                            })
                        })
    })
  })
}

function branchOwnerRepo
(p, row, ownerRepo) {
  let dirs, dir

  dirs = Opt.get('core.vc.github.pr.dirs')
  dir = dirs && dirs[ownerRepo]
  if (dir) {
    if (row?.branch)
      branchDir(p, dir, row.branch)
    else
      Mess.yell('Branch missing')
    return
  }
  Mess.yell('Need a dir in core.vc.github.pr.dirs for ' + ownerRepo)
}

function makePrBuf
(p, num, res) {
  let title, body, text

  if (res == null) {
    Mess.yell('PR not found')
    return
  }

  title = res.pr?.title || ('PR ' + num)
  body = res.pr?.body || ''
  text = '*Branch* ' + res.branch + '\n*State*  ' + res.state + ' (' + res.pr.state + ')\n'
  text += '\n# ' + title + '\n'
  text += '\n' + body.trim() + '\n'

  if (res.commits?.length) {
    text += '\n## Commits (' + res.commits.length + ')\n'
    res.commits.forEach(c => {
      text += '\n- ' + c.sha.slice(0, 7) + ' ' + c.message + '\n'
    })
  }

  if (res.comments?.length) {
    text += '\n## Comments (' + res.comments.length + ')\n'
    res.comments.forEach(c => {
      let date

      date = formatDate(c.created)
      text += '\n**' + c.user + '** ' + date + '\n\n' + c.body + '\n'
    })
  }

  if (res.reviews?.length) {
    text += '\n## Reviews\n'
    res.reviews.forEach(r => {
      let date

      date = formatDate(r.submitted)
      text += '\n**' + r.user + '** ' + r.state + ' ' + date + '\n'
      if (r.body && r.body.length)
        text += '\n' + r.body.trim() + '\n'
    })
  }

  Ed.make(p,
          { name: 'PR ' + num,
            dir: p.dir },
          view => {
            view.buf.file = 'PR-' + num + '.md'
            view.buf.opts.set('core.lang', 'markdown')
            view.buf.addMode('view')
            view.insert(text)
            view.buf.modified = 0
          })
}

function getAndShowPr
(p, ownerRepo, num) {
  Mess.say('Fetching PR...')
  getPr(0, ownerRepo, num,
        res => {
          Mess.say('')
          if (res)
            makePrBuf(p, num, res)
          else
            Mess.yell('PR missing')
        })
}

function prEqual
(ownerRepo, prNum, p) {
  let url

  url = 'https://api.github.com/repos/' + ownerRepo + '/pulls/' + prNum + '.diff'
  d('get ' + url)
  get(url,
      { accept: 'application/vnd.github.diff' },
      (err, status, data) => {
        if (err) {
          Mess.yell('Hub: ' + err.message)
          return
        }

        Ed.make(p,
                { name: 'PR-' + prNum + '.diff',
                  dir: p.dir },
                view => {
                  view.buf.file = 'PR-' + prNum + '.diff'
                  view.buf.mode = 'patch'
                  view.buf.addMode('view')
                  view.insert(data)
                  view.buf.modified = 0
                })
      })
}

export
function initHub
() {
  let mo, buf, lastModified, commentsPerPage, cachedIssues

  function hubMl
  () {
    return divCl('ml edMl',
                 [ divCl('edMl-type',
                         img(Icon.path('list'), 'hub', 'filter-clr-text')),
                   divCl('ml-name', 'VC Hub'),
                   divCl('ml-close') ])
  }

  function findPrNumByBranch
  (ownerRepo, branch) {
    for (let key in cachedPrs) {
      let cached

      cached = cachedPrs[key]

      if ((cached.branch == branch) && key.startsWith(ownerRepo + '/'))
        return cached.prNum
    }
    return 0
  }

  function getNotifications
  (useCache, cb) {
    let url

    url = 'https://api.github.com/notifications'
    if (Opt.get('core.vc.github.notifications.all'))
      url += '?all=true'
    d('get ' + url)
    get(url,
        { lastModified: useCache && lastModified },
        (err, status, data, headers) => {
          if (err) {
            if (status == 304) {
              d('VC 304 using cached notifications')
              cb(cachedNotifications)
              return
            }
            Mess.yell('Hub: ' + err.message)
            return
          }
          if (useCache) {
            lastModified = headers.get('Last-Modified')
            for (let n of data)
              cachedNotifications.set(n.id, n)
            cb(cachedNotifications)
          }
          else
            cb(new Map(data.map(n => [ n.id, n ])))
        })
  }

  function shortReason
  (reason) {
    if (reason == 'review_requested')
      return 'review'
    if (reason == 'subscribed')
      return 'sub'
    return reason
  }

  function refresh
  (p) {
    let widths

    function pad
    (col, n, end) {
      col = col || ''
      if (end)
        return col.padEnd(widths[n])
      return col.padStart(widths[n])
    }

    function padEnd
    (col, n) {
      return pad(col, n, 1)
    }

    function makeLine
    (r) {
      return pad(r.prState.slice(0, 1), 0)
        + ' ' + pad(r.prNum, 1)
        + ' ' + padEnd(r.repo, 2)
        + ' ' + padEnd(r.reason, 3)
        + ' ' + padEnd(r.subject, 4)
        + ' ' + padEnd(r.updated, 5)
        + ' ' + pad(r.ownerRepo, 6)
        + (r.branch?.length ? (' ' + r.branch) : '')
        + (r.author?.length ? (' ' + r.author) : '')
        + (r.approvedBy?.length ? (' ' + r.approvedBy) : '')
        + '\n'
    }

    function append
    (notifs) {
      let rows, out

      rows = []
      notifs.forEach(n => {
        let url, ownerRepo, prNum, issueNum, type, tag

        ownerRepo = n.repository.full_name
        type = n.subject.type
        url = n.repository.html_url
        if (type == 'Release') {
          tag = n.subject.title
          url = url + '/releases/tag/' + tag
        }
        else if (type == 'PullRequest') {
          prNum = n.subject.url?.split('/pulls/').pop() || n.subject.latest_comment_url?.split('/pulls/').pop()
          prNum || Mess.log('VC PullRequest missing prNum')
          prNum || d({ n })
          url = url + '/pull/' + prNum
        }
        else if (type == 'Issue') {
          issueNum = n.subject.url?.split('/issues/').pop() || n.subject.latest_comment_url?.split('/issues/').pop()
          url = url + '/issues/' + issueNum
        }
        else if (type == 'Discussion') {
          issueNum = n.subject.url?.split('/discussions/').pop() || n.subject.latest_comment_url?.split('/discussions/').pop()
          url = url + '/discussions/' + issueNum
        }

        rows.push({ prNum,
                    issueNum,
                    type,
                    tag,
                    prState: '',
                    branch: '',
                    author: '',
                    approvedBy: '',
                    repo: n.repository.name,
                    subject: n.subject.title.length > 70 ? n.subject.title.slice(0, 67) + '...' : n.subject.title,
                    reason: shortReason(n.reason),
                    updated: formatDate(n.updated_at),
                    ownerRepo,
                    url,
                    id: n.id })
      })

      widths = [ 1, 4, 0, 0, 0, 16, 0, 0 ]
      rows.forEach(r => {
        widths[2] = Math.max(widths[2], r.repo.length)
        widths[3] = Math.max(widths[3], r.reason.length)
        widths[4] = Math.max(widths[4], r.subject.length)
        widths[6] = Math.max(widths[6], r.ownerRepo.length)
        widths[7] = Math.max(widths[7], r.branch.length)
      })

      out = ''
      rows.forEach(r => {
        p.buf.vars('hub').threadIds.push(r.id)
        p.buf.vars('hub').rows.push(r)
        out += makeLine(r)
      })
      p.buf.append(out, 1)
      p.view.lineStart()

      {
        let pending

        pending = rows.filter(r => r.type == 'PullRequest').length
        rows.forEach(r => {
          if (r.type == 'PullRequest')
            getPr(1, r.ownerRepo, r.prNum,
                  res => {
                    let view

                    if (res) {
                      let approvedBy

                      r.prState = res.state
                      r.branch = res.branch
                      r.author = '✎' + res.pr.user.login // 📝 too bright on dark, 🖍 too red
                      approvedBy = res.reviews?.find(rv => rv.state == 'APPROVED')
                      r.approvedBy = approvedBy ? ('✔' + approvedBy.user) : ''
                    }
                    pending--
                    if (pending)
                      return
                    // We have all PRs now.
                    view = buf?.anyView()
                    if (view) {
                      rows.forEach(r2 => widths[7] = Math.max(widths[7], r2.branch.length))
                      rows.forEach((r2, index2) => {
                        let from, range, line

                        from = Ed.posToBep(view, Ed.makePos(index2, 0))
                        range = Ed.makeRange(view,
                                             from,
                                             Ed.posToBep(view, Ed.makePos(index2 + 1, 0)))
                        range.remove()
                        line = makeLine(r2)
                        buf.insert(line, from)
                      })
                    }
                  })
        })
      }
    }

    p.buf.clear()
    p.buf.vars('hub').threadIds = []
    p.buf.vars('hub').rows = []
    getNotifications(1,
                     notifs => {
                       if (notifs.size)
                         append(notifs)
                       else
                         p.buf.append('No notifications\n', 1)
                     })
  }

  function refreshFull
  () {
    cachedNotifications = new Map()
    lastModified = 0
    cachedPrs = {}
    cachedReleases = {}
    cachedIssues = {}
    refresh(Pane.current())
  }

  function json
  () {
    let p, threadId

    p = Pane.current()
    threadId = p.view.buf.vars('hub').threadIds[p.view.pos.row]
    d('VC json ' + threadId)
    if (threadId)
      get('https://api.github.com/notifications/threads/' + threadId,
          0,
          (err, status, data) => {
            let file

            if (err) {
              Mess.yell('Hub: ' + err.message)
              return
            }

            file = 'vc-hub-' + threadId + '.json'
            Ed.make(p,
                    { name: file,
                      dir: p.dir },
                    view => {
                      view.buf.file = file
                      view.buf.opts.set('core.lang', 'json')
                      view.insert(JSON.stringify(data, null, 2))
                      view.buf.modified = 0
                    })
          })
    else
      Mess.yell('Missing thread ID')
  }

  function jsonPr
  () {
    let p, row

    p = Pane.current()
    row = p.view.buf.vars('hub').rows[p.view.pos.row] || Mess.toss('Missing row')
    if (row.type == 'PullRequest')
      if (row.ownerRepo && row.prNum)
        get('https://api.github.com/repos/' + row.ownerRepo + '/pulls/' + row.prNum,
            0,
            (err, status, data) => {
              let file

              if (err) {
                Mess.yell('Hub: ' + err.message)
                return
              }

              file = 'vc-hub-pr-' + row.prNum + '.json'
              Ed.make(p,
                      { name: file,
                        dir: p.dir },
                      view => {
                        view.buf.file = file
                        view.buf.opts.set('core.lang', 'json')
                        view.insert(JSON.stringify(data, null, 2))
                        view.buf.modified = 0
                      })
            })
      else
        Mess.yell('Missing ownerRepo or prNum')
    else
      Mess.yell('This is for PR notifications')
  }

  function markRead
  () {
    let p, row, threadId

    p = Pane.current()
    row = p.view.pos.row
    threadId = p.view.buf.vars('hub').threadIds[row]
    d('VC markRead ' + threadId)
    if (threadId)
      patch('https://api.github.com/notifications/threads/' + threadId,
            err => {
              let from, range

              if (err) {
                Mess.yell('Hub: ' + err.message)
                return
              }
              p.view.buf.vars('hub').threadIds.splice(row, 1)
              p.view.buf.vars('hub').rows.splice(row, 1)
              cachedNotifications.delete(threadId)
              from = Ed.posToBep(p.view, Ed.makePos(row, 0))
              range = Ed.makeRange(p.view, from, Ed.posToBep(p.view, Ed.makePos(row + 1, 0)))
              range.remove()
              Mess.say('Marked as read')
            })
    else
      Mess.yell('Missing thread ID')
  }

  function markDone
  () {
    function ok
    () {
      let p, row, threadId

      p = Pane.current()
      row = p.view.pos.row
      threadId = p.view.buf.vars('hub').threadIds[row]
      d('VC markDone ' + threadId)
      if (threadId)
        del('https://api.github.com/notifications/threads/' + threadId,
            err => {
              let from, range

              if (err) {
                Mess.yell('Hub: ' + err.message)
                return
              }
              p.view.buf.vars('hub').threadIds.splice(row, 1)
              p.view.buf.vars('hub').rows.splice(row, 1)
              cachedNotifications.delete(threadId)
              from = Ed.posToBep(p.view, Ed.makePos(row, 0))
              range = Ed.makeRange(p.view, from, Ed.posToBep(p.view, Ed.makePos(row + 1, 0)))
              range.remove()
              Mess.say('Marked as done')
            })
      else
        Mess.yell('Missing thread ID')
    }

    Prompt.yn('You sure? Done and read look the same in the API',
              { icon: 'warning' },
              yes => yes && ok())
  }

  function openNotification
  () {
    let p, url

    p = Pane.current()
    url = p.view.buf.vars('hub').rows[p.view.pos.row].url
    if (url)
      Tron.cmd('shell.open', [ url ], err => {
        if (err) {
          Mess.yell('shell.open: ' + err.message)
          return
        }
      })
    else if (0)
      Browse.browse(url)
    else
      Mess.yell('Missing URL')
  }

  function toggleHidden
  () {
    Opt.toggle('core.vc.github.notifications.all')
    refreshFull()
  }

  function branch
  () {
    let p, row

    p = Pane.current()
    row = p.view.buf.vars('hub').rows[p.view.pos.row]
    if (row.type == 'PullRequest') {
      if (row.ownerRepo)
        branchOwnerRepo(p, row, row.ownerRepo)
      else
        Mess.yell('Missing ownerRepo')
      return
    }
    Mess.yell('This command is for PR notifications')
  }

  function ensureMainUpToDate
  (dir, onDone) {
    Mess.say('Ensuring main is up to date')
    Shell.runToString(dir, 'git', [ 'fetch', 'origin' ], 0,
                      (out, code) => {
                        if (code) {
                          Mess.yell('Failed to fetch origin')
                          return
                        }
                        Shell.runToString(dir,
                                          'git',
                                          [ 'symbolic-ref', 'refs/remotes/origin/HEAD' ],
                                          0,
                                          (out, code) => {
                                            let defaultBranch

                                            if (code) {
                                              Mess.yell('Failed to get default branch')
                                              return
                                            }
                                            defaultBranch = out.trim().replace('refs/remotes/origin/', '')
                                            Shell.runToString(dir,
                                                              'git',
                                                              [ 'rev-parse', defaultBranch ],
                                                              0,
                                                              (out, code) => {
                                                                let localMain

                                                                if (code) {
                                                                  Mess.yell('Local ' + defaultBranch + ' missing')
                                                                  return
                                                                }
                                                                localMain = out.trim()
                                                                Shell.runToString(dir,
                                                                                  'git',
                                                                                  [ 'rev-parse', 'origin/' + defaultBranch ],
                                                                                  0,
                                                                                  (out, code) => {
                                                                                    let remoteMain

                                                                                    if (code) {
                                                                                      Mess.yell('Missing origin/' + defaultBranch)
                                                                                      return
                                                                                    }
                                                                                    remoteMain = out.trim()
                                                                                    if (localMain == remoteMain)
                                                                                      onDone()
                                                                                    else {
                                                                                      Mess.say('Updating ' + defaultBranch + ' to latest')
                                                                                      Shell.run(dir,
                                                                                                'git',
                                                                                                [ 'fetch', 'origin', defaultBranch + ':' + defaultBranch ],
                                                                                                { onClose: (b, code) => code ? Mess.yell('fetch failed') : onDone() })
                                                                                    }
                                                                                  })
                                                              })
                                          })
                      })
  }

  function review
  (u, we) {
    let p, dir

    function prompt
    (ownerRepo, prNum, branch) {
      return 'Please review https://github.com/' + ownerRepo + '/pull/' + prNum + '. The PR is on branch ' + branch + ', which I\'ve already checked out in the current directory. Focus on reviewing the changes, I will do the CI checks.'
    }

    function run
    (ownerRepo, branch, prNum) {
      Mess.say('Getting PR ' + prNum)
      getPr(0, ownerRepo, prNum,
            res => {
              if (res)
                if (res.branch == branch)
                  ensureMainUpToDate(dir,
                                     () => {
                                       Mess.say('Starting agent')
                                       Cmd.run('code', 0, 1, we, prompt(ownerRepo, prNum, branch))
                                     })
                else
                  Mess.yell('Branch ' + branch + ' (vs PR ' + res.branch + ')')
              else
                Mess.yell('getPrState failed')
            })
    }

    p = Pane.current()
    dir = p.dir
    Mess.say('Setting up branch')
    Shell.runToString(dir, 'git', [ 'branch', '--show-current' ], 0,
                      (out, code) => {
                        let branch

                        if (code) {
                          Mess.yell('Error getting current branch')
                          return
                        }
                        branch = out.trim()
                        Shell.runToString(dir, 'git', [ 'remote', 'get-url', 'origin' ], 0,
                                          (out, code) => {
                                            let remote, ownerRepo

                                            if (code) {
                                              Mess.yell('Error getting git remote')
                                              d(out)
                                              return
                                            }

                                            remote = out.trim()
                                            ownerRepo = remote.match(/[:/]([^/]+\/[^/]+)(\.git)?$/)?.[1]
                                            if (ownerRepo) {
                                              let cachedPrNum

                                              ownerRepo = ownerRepo.replace(/\.git$/, '')
                                              cachedPrNum = findPrNumByBranch(ownerRepo, branch)

                                              if (cachedPrNum)
                                                run(ownerRepo, branch, cachedPrNum)
                                              else
                                                Prompt.ask({ text: 'PR Number:' },
                                                           prNum => {
                                                             prNum = parseInt(prNum)
                                                             if (prNum)
                                                               run(ownerRepo, branch, prNum)
                                                             else
                                                               Mess.yell('Need a PR num')
                                                           })
                                              return
                                            }
                                            Mess.yell('Failed to parse owner/repo from ' + remote)
                                          })
                      })
  }

  function go
  (n) {
    if (n == 0)
      return
    if (n > 0)
      Cmd.run('next line')
    else
      Cmd.run('previous line')
  }

  function showPr
  () {
    let p, row

    p = Pane.current()
    row = p.view.buf.vars('hub').rows[p.view.pos.row]
    if (row.type == 'PullRequest')
      if (row.ownerRepo && row.prNum)
        getAndShowPr(p, row.ownerRepo, row.prNum)
      else
        Mess.yell('Missing ownerRepo or prNum')
    else
      Mess.yell('This is for PR notifications')
  }

  function showRelease
  () {
    let p, row

    p = Pane.current()
    row = p.view.buf.vars('hub').rows[p.view.pos.row]
    if (row.type == 'Release')
      if (row.ownerRepo && row.tag)
        getRelease(row.ownerRepo, row.tag,
                   res => {
                     let text

                     if (res == null) {
                       Mess.yell('Release not found')
                       return
                     }

                     text = '# ' + row.subject + '\n\n'
                     text += (res.release.body || '') + '\n\n'
                     Ed.make(p,
                             { name: 'Release ' + row.tag,
                               dir: p.dir },
                             view => {
                               view.buf.file = 'Release-' + row.tag + '.md'
                               view.buf.opts.set('core.lang', 'markdown')
                               view.buf.addMode('view')
                               view.insert(text)
                               view.buf.modified = 0
                             })
                   })
      else
        Mess.yell('Missing ownerRepo or tag')
    else
      Mess.yell('This is for Release notifications')
  }

  function getIssue
  (ownerRepo, issueNum, cb) { // (res)
    let key, cached, url

    key = ownerRepo + '/' + issueNum
    cached = cachedIssues[key]
    url = 'https://api.github.com/repos/' + ownerRepo + '/issues/' + issueNum

    get(url,
        { lastModified: cached?.lastModified },
        (err, status, data, headers) => {
          if (err) {
            if ((status == 304) && cached) {
              cb(cached)
              return
            }
            cb()
            return
          }

          if (data) {
            let commentsUrl, lastPage

            commentsUrl = 'https://api.github.com/repos/' + ownerRepo + '/issues/' + issueNum + '/comments?sort=created&per_page=' + commentsPerPage
            lastPage = parseInt(data.comments / commentsPerPage)
            lastPage += ((data.comments % commentsPerPage) ? 1 : 0)

            get(commentsUrl + '&page=' + lastPage,
                0,
                (err2, status2, data2, headers2) => {
                  let comments, moreBefore, link

                  moreBefore = 0
                  link = headers2?.get('Link')
                  if (link && link.includes('rel="prev"'))
                    moreBefore = 1
                  comments = []
                  if (data2)
                    comments = data2.map(c => ({ body: c.body,
                                                 user: c.user.login,
                                                 created: c.created_at }))

                  if ((lastPage > 1) && data2 && (data2.length < 10)) {
                    get(commentsUrl + '&page=' + (lastPage - 1),
                        0,
                        (err3, status3, data3, headers3) => {
                          link = headers3?.get('Link')
                          if (link && link.includes('rel="prev"'))
                            moreBefore = 1
                          if (data3)
                            comments = comments.concat(data3.map(c => ({ body: c.body,
                                                                         user: c.user.login,
                                                                         created: c.created_at })))

                          cachedIssues[key] = { issue: data, lastModified: headers?.get('Last-Modified'), comments, commentsLastModified: headers2?.get('Last-Modified'), moreBefore }
                          cb(cachedIssues[key])
                        })
                    return
                  }

                  cachedIssues[key] = { issue: data, lastModified: headers?.get('Last-Modified'), comments, commentsLastModified: headers2?.get('Last-Modified'), moreBefore }
                  cb(cachedIssues[key])
                })

            return
          }

          cb()
        })

  }

  function showIssue
  () {
    let p, row

    p = Pane.current()
    row = p.view.buf.vars('hub').rows[p.view.pos.row]
    if (row.type == 'Issue')
      if (row.ownerRepo && row.issueNum)
        getIssue(row.ownerRepo, row.issueNum,
                 res => {
                   let text

                   if (res == null) {
                     Mess.yell('Issue missing')
                     return
                   }

                   text = '# ' + res.issue.title + '\n\n'
                   text += (res.issue.body || '') + '\n\n'

                   if (res.comments?.length) {
                     text += '## Comments (' + res.issue.comments + ')\n\n'
                     if (res.moreBefore)
                       text += '*...showing last ' + (res.comments.length) + ' comments...*\n\n'
                     res.comments.forEach(c => {
                       let date

                       date = formatDate(c.created)
                       text += '**' + c.user + '** ' + date + '\n\n' + c.body + '\n\n'
                     })
                   }

                   Ed.make(p,
                           { name: 'Issue-' + row.issueNum + '.md',
                             dir: p.dir },
                           view => {
                             view.buf.file = 'Issue-' + row.issueNum + '.md'
                             view.buf.opts.set('core.lang', 'markdown')
                             view.buf.addMode('view')
                             view.insert(text)
                             view.buf.modified = 0
                           })
                 })
      else
        Mess.yell('Missing ownerRepo or issueNum')
    else
      Mess.yell('This is for Issue notifications')
  }

  function showDiscussion
  () {
    let p, row

    p = Pane.current()
    row = p.view.buf.vars('hub').rows[p.view.pos.row]
    if (row.type == 'Discussion')
      if (row.ownerRepo && row.issueNum)
        get('https://api.github.com/repos/' + row.ownerRepo + '/discussions/' + row.issueNum,
            0,
            (err, status, data) => {
              if (err) {
                Mess.yell('Discussion: ' + err.message)
                return
              }

              get('https://api.github.com/repos/' + row.ownerRepo + '/discussions/' + row.issueNum + '/comments',
                  0,
                  (err2, status2, data2) => {
                    let text

                    text = '# ' + data.title + '\n\n'
                    text += (data.body || '') + '\n\n'

                    if (data2?.length) {
                      text += '## Comments (' + data2.length + ')\n\n'
                      data2.forEach(c => {
                        let date

                        date = formatDate(c.created_at)
                        text += '**' + c.user.login + '** ' + date + '\n\n' + c.body + '\n\n'
                      })
                    }

                    Ed.make(p,
                            { name: 'Discussion-' + row.issueNum + '.md',
                              dir: p.dir },
                            view => {
                              view.buf.file = 'Discussion-' + row.issueNum + '.md'
                              view.buf.opts.set('core.lang', 'markdown')
                              view.buf.addMode('view')
                              view.insert(text)
                              view.buf.modified = 0
                            })
                  })
            })
      else
        Mess.yell('Missing ownerRepo or issueNum')
    else
      Mess.yell('This is for Discussion notifications')
  }

  function equal
  () {
    let p, row

    p = Pane.current()
    row = p.view.buf.vars('hub').rows[p.view.pos.row]
    if (row.type == 'PullRequest')
      if (row.ownerRepo || row.prNum)
        prEqual(row.ownerRepo, row.prNum, p)
      else
        Mess.yell('Missing ownerRepo or prNum')
    else
      Mess.yell('This is for PR notifications')
  }

  function show
  () {
    let row

    row = Pane.current().view.buf.vars('hub').rows[Pane.current().view.pos.row]
    if (row.type == 'PullRequest')
      showPr()
    else if (row.type == 'Release')
      showRelease()
    else if (row.type == 'Issue')
      showIssue()
    else if (row.type == 'Discussion')
      showDiscussion()
    else
      Mess.yell('Missing handling for type ' + row.type)
  }

  Opt.declare('core.vc.github.token', 'str', '')
  Opt.declare('core.vc.github.notifications.all', 'bool', 1)
  Opt.declare('core.vc.github.pr.dirs', 'struct', {})

  cachedIssues = {}
  cachedNotifications = new Map()
  cachedPrs = {}
  cachedReleases = {}
  commentsPerPage = 100

  mo = Mode.add('Vc Hub', { viewInit: Ed.viewInit,
                            viewCopy: Ed.viewCopy,
                            initFns: Ed.initModeFns,
                            parentsForEm: 'ed',
                            //   11 repo1 review Fix: example text 2025-01-01 owner/repo1
                            // 1234 r2    review Fix: example text 2025-01-01 owner/r2 brName
                            // 99999 r2    review Fix: example text 2025-01-01 owner/r2 branch/name Approved by u1
                            decorators: [ { regex: /^(.) (    |   \d|  \d\d| \d\d\d|\d+) (\S+)\s+(\S+).+?\s+(?:\d{4}-\d{2}-\d{2} \d{2}h\d{2}|\d{2}h\d{2} +) +(\S+\/\S+)( \S+|)( .+|)$/d,
                                            decor: [ { ref: getRefState },
                                                     { ref: getRefPr },
                                                     { ref: getRefRepo },
                                                     { attr: { style: 'color: var(--clr-syntax0)' } },
                                                     { attr: { style: 'color: var(--rule-clr-comment)' } },
                                                     { attr: { style: 'color: var(--clr-syntax1)' } },
                                                     { attr: {} } ] } ] })

  Cmd.add('branch', () => branch(), mo)
  Cmd.add('equal', () => equal(), mo)
  Cmd.add('json', () => json(), mo)
  Cmd.add('json pr', () => jsonPr(), mo)
  Cmd.add('refresh', () => refresh(Pane.current()), mo)
  Cmd.add('refresh full', () => refreshFull(), mo)
  Cmd.add('open notification', () => openNotification(), mo)
  Cmd.add('mark read', () => markRead(), mo)
  Cmd.add('mark done', () => markDone(), mo)
  Cmd.add('next notification', () => go(1), mo)
  Cmd.add('previous notification', () => go(-1), mo)
  Cmd.add('show', () => show(), mo)
  Cmd.add('show pr', () => showPr(), mo)
  Cmd.add('show release', () => showRelease(), mo)
  Cmd.add('toggle hidden', () => toggleHidden(), mo)

  // should use view mode
  Cmd.add('self insert', () => Mess.say(U.shrug), mo)
  Em.on('Enter', 'Shrug', mo)
  Em.on('Tab', 'Shrug', mo)
  Em.on('q', 'bury', mo)
  Em.on('Backspace', 'scroll up', mo)
  Em.on(' ', 'scroll down', mo)

  Em.on('Enter', 'show', mo)
  Em.on('=', 'equal', mo)
  Em.on('b', 'branch', mo)
  Em.on('d', 'mark done', mo)
  Em.on('g', 'refresh', mo)
  Em.on('G', 'refresh full', mo)
  Em.on('h', 'toggle hidden', mo)
  Em.on('j', 'json', mo)
  Em.on('J', 'vc hub json', mo)
  Em.on('n', 'next line', mo)
  Em.on('p', 'previous line', mo)
  Em.on('P', 'json pr', mo)
  Em.on('r', 'mark read', mo)
  Em.on('w', 'open notification', mo)

  Cmd.add('vc hub', () => {
    let p

    p = Pane.current()
    if (buf)
      p.setBuf(buf)
    else {
      buf = Buf.add('Vc Hub', 'Vc Hub',
                    Ed.divW(0, 0, { ml: hubMl() }),
                    p.dir)
      buf.vars('hub').threadIds = []
      buf.vars('hub').rows = []
      buf.icon = 'log'
      buf.opts.set('core.lint.enabled', 0)
      buf.opts.set('core.line.wrap.enabled', 0)
      buf.opts.set('core.line.numbers.show', 0)
      buf.opts.set('core.folding.enabled', 0)
      buf.opts.set('highlightIndent.enabled', 0)
      buf.opts.set('minimap.enabled', 0)
      buf.opts.set('ruler.enabled', 0)
      p.setBuf(buf, {}, () => refresh(p))
    }
  })

  Cmd.add('vc hub json', () => {
    getNotifications(0, data => {
      let p

      p = Pane.current()
      Ed.make(p,
              { name: 'vc-hub.json',
                dir: p.dir },
              view => {
                view.buf.file = 'vc-hub.json'
                view.buf.opts.set('core.lang', 'json')
                view.insert(JSON.stringify(data, null, 2))
                view.buf.modified = 0
              })
    })
  })

  Cmd.add('vc review', review)
}

function initPrs
() {
  let mo, buf

  function prsMl
  () {
    return divCl('ml edMl',
                 [ divCl('edMl-type',
                         img(Icon.path('log'), 'PRs', 'filter-clr-text')),
                   divCl('ml-name', 'VC PRs'),
                   divCl('ml-close') ])
  }

  function ensureUser
  (cb) {
    if (cachedUser) {
      cb(cachedUser)
      return
    }

    Mess.say('Fetching user...')
    get('https://api.github.com/user',
        0,
        (err, status, data) => {
          if (err) {
            Mess.yell('Get user: ' + err.message)
            return
          }
          cachedUser = data.login
          d('VC user: ' + cachedUser)
          Mess.say('')
          cb(cachedUser)
        })
  }

  function prsUrl
  (user) {
    return 'https://api.github.com/search/issues?q=is:pr+author:' + user + '+sort:updated-desc&per_page=50'
  }

  function refresh
  (p) {
    function refreshData
    (data) {
      let out, rows, widths

      function makeLine
      (r) {
        return r.state.slice(0, 1).padStart(widths[0])
          + ' ' + r.num.padStart(widths[1])
          + ' ' + r.repo.padEnd(widths[2])
          + ' ' + r.title.padEnd(widths[3])
          + ' ' + r.updated.padEnd(widths[4])
          + ' ' + r.ownerRepo.padStart(widths[5])
          + (r.branch?.length ? (' ' + r.branch) : '')
          + (r.author?.length ? (' ' + r.author) : '')
          + (r.approvedBy?.length ? (' ' + r.approvedBy) : '')
          + (r.comments ? (' ✉' + r.comments) : '')
          + '\n'
      }

      if (data.items.length == 0) {
        p.buf.append('Empty\n', 1)
        return
      }

      rows = data.items.map(pr => {
        let state, repo, ownerRepo, url

        url = pr.html_url
        ownerRepo = pr.repository_url?.replace('https://api.github.com/repos/', '') || ''
        state = pr.state == 'open' ? 'O' : (pr.merged ? 'M' : 'C')
        repo = ownerRepo.split('/')[1] || ''

        return {
          num: String(pr.number),
          state,
          prState: '',
          repo,
          ownerRepo,
          title: pr.title,
          updated: formatDate(pr.updated_at),
          branch: '',
          author: '',
          approvedBy: '',
          comments: 0,
          url
        }
      })

      widths = [ 1, 4, 0, 0, 0, 0 ]
      rows.forEach(r => {
        widths[2] = Math.max(widths[2], r.repo.length)
        widths[3] = Math.max(widths[3], r.title.length)
        widths[4] = Math.max(widths[4], r.updated.length)
        widths[5] = Math.max(widths[5], r.ownerRepo.length)
      })

      out = ''
      rows.forEach(r => {
        p.buf.vars('prs').rows.push(r)
        out += makeLine(r)
      })
      p.buf.append(out, 1)
      p.view.lineStart()

      rows.forEach((r, index) => {
        if (r.ownerRepo)
          getPr(0, r.ownerRepo, r.num,
                res => {
                  if (res) {
                    let approvedBy, view

                    r.prState = res.state
                    r.branch = res.branch
                    r.author = '✎' + res.pr.user.login // 📝 too bright on dark, 🖍 too red
                    approvedBy = res.reviews?.find(rv => rv.state == 'APPROVED')
                    r.approvedBy = approvedBy ? ('✔' + approvedBy.user) : ''
                    r.comments = res.comments?.length || 0
                    view = buf?.anyView()
                    if (view) {
                      let from, range, line

                      from = Ed.posToBep(view, Ed.makePos(index, 0))
                      range = Ed.makeRange(view,
                                           from,
                                           Ed.posToBep(view, Ed.makePos(index + 1, 0)))
                      range.remove()
                      line = makeLine(r)
                      buf.insert(line, from)
                    }
                  }
                })
      })
    }

    p.buf.clear()
    p.buf.vars('prs').rows = []

    ensureUser(user => get(prsUrl(user),
                           0,
                           (err, status, data) => err ? Mess.yell('PRs: ' + err.message) : refreshData(data)))
  }

  function openPr
  () {
    let p, url

    p = Pane.current()
    url = p.view.buf.vars('prs').rows[p.view.pos.row].url
    if (url)
      Tron.cmd('shell.open', [ url ], err => {
        if (err) {
          Mess.yell('shell.open: ' + err.message)
          return
        }
      })
    else
      Mess.yell('Missing URL')
  }

  function showPr
  () {
    let p, row

    p = Pane.current()
    row = p.view.buf.vars('prs').rows[p.view.pos.row]
    if (row.ownerRepo && row.num)
      getAndShowPr(p, row.ownerRepo, row.num)
    else
      Mess.yell('Missing ownerRepo or num')
  }

  function equal
  () {
    let p, row

    p = Pane.current()
    row = p.view.buf.vars('prs').rows[p.view.pos.row]
    if (row.ownerRepo || row.num)
      prEqual(row.ownerRepo, row.num, p)
    else
      Mess.yell('Missing ownerRepo or num')
  }

  function go
  (n) {
    if (n == 0)
      return
    if (n > 0)
      Cmd.run('next line')
    else
      Cmd.run('previous line')
  }

  function branch
  () {
    let p, row

    p = Pane.current()
    row = p.view.buf.vars('prs').rows[p.view.pos.row]
    if (row.ownerRepo)
      branchOwnerRepo(p, row, row.ownerRepo)
    else
      Mess.yell('Missing ownerRepo')
  }

  mo = Mode.add('VC PRs', { viewInit: Ed.viewInit,
                            viewCopy: Ed.viewCopy,
                            initFns: Ed.initModeFns,
                            parentsForEm: 'ed',
                            decorators: [ { regex: /^(.) (    |   \d|  \d\d| \d\d\d|\d+) (\S+)\s+.+\s+(\d{4}-\d{2}-\d{2} \d{2}h\d{2}|\d{2}h\d{2} +) +(\S+\/\S+)( \S+|)( .+|)$/d,
                                            decor: [ { ref: getRefState },
                                                     { ref: getRefPr },
                                                     { ref: getRefRepo },
                                                     { attr: {} },
                                                     { attr: { style: 'color: var(--rule-clr-comment)' } },
                                                     { attr: { style: 'color: var(--clr-syntax1)' } } ] } ] })

  Cmd.add('branch', () => branch(), mo)
  Cmd.add('equal', () => equal(), mo)
  Cmd.add('refresh', () => refresh(Pane.current()), mo)
  Cmd.add('open pr', () => openPr(), mo)
  Cmd.add('show pr', () => showPr(), mo)
  Cmd.add('next pr', () => go(1), mo)
  Cmd.add('previous pr', () => go(-1), mo)

  // should use view mode
  Cmd.add('self insert', () => Mess.say(U.shrug), mo)
  Em.on('Tab', 'Shrug', mo)
  Em.on('q', 'bury', mo)
  Em.on('Backspace', 'scroll up', mo)
  Em.on(' ', 'scroll down', mo)

  Em.on('Enter', 'show pr', mo)
  Em.on('=', 'equal', mo)
  Em.on('b', 'branch', mo)
  Em.on('g', 'refresh', mo)
  Em.on('J', 'vc prs json', mo)
  Em.on('n', 'next line', mo)
  Em.on('p', 'previous line', mo)
  Em.on('w', 'open pr', mo)

  Cmd.add('vc prs json', () => {
    let p

    p = Pane.current()
    ensureUser(user => get(prsUrl(user),
                           0,
                           (err, status, data) => {
                             if (err) {
                               Mess.yell('PRs: ' + err.message)
                               return
                             }
                             Ed.make(p,
                                     { name: 'vc-prs.json',
                                       dir: p.dir },
                                     view => {
                                       view.buf.file = 'vc-prs.json'
                                       view.buf.opts.set('core.lang', 'json')
                                       view.insert(JSON.stringify(data, null, 2))
                                       view.buf.modified = 0
                                     })
                           }))
  })

  Cmd.add('vc prs', () => {
    let p

    p = Pane.current()
    if (buf)
      p.setBuf(buf)
    else {
      buf = Buf.add('VC PRs', 'VC PRs',
                    Ed.divW(0, 0, { ml: prsMl() }),
                    p.dir)
      buf.vars('prs').rows = []
      buf.icon = 'log'
      buf.opts.set('core.lint.enabled', 0)
      buf.opts.set('core.line.wrap.enabled', 0)
      buf.opts.set('core.line.numbers.show', 0)
      buf.opts.set('core.folding.enabled', 0)
      buf.opts.set('highlightIndent.enabled', 0)
      buf.opts.set('minimap.enabled', 0)
      buf.opts.set('ruler.enabled', 0)
      p.setBuf(buf, {}, () => refresh(p))
    }
  })
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

  mo = Mode.add('Commit Result', { viewInit: Ed.viewInit,
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
      Ed.makeRange(view, from, to).remove()
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
    b.mode = 'patch'
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
      let pos, lineNum, offset, first

      lineNum = -1
      offset = -1 // hunk line (@@ -N,...) is 1 before line N
      pos = p.view.pos
      pos.col = 0
      first = 1
      while (1) {
        let line

        if (Ed.posRow(pos) <= 0) {
          Mess.say('Reached start of buffer')
          return
        }
        line = p.view.lineAt(pos)
        //d('EQ line: ' + line)
        if ((lineNum == -1) && line.startsWith('@@ ')) {
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
        if (lineNum == -1)
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
                 b.mode = 'patch'
                 b.addMode('equal')
                 b.addMode('view')
               })
}

function divW
(mode, args) {
  let busyW

  busyW = divCl('shell-exit-w', busyCo())
  return Ed.divW(0, 0, { ml: vcMl(args, mode),
                         extraCo: busyW })
}

function viewCopy
(to, from, lineNum, whenReady) {
  Ed.viewCopy(to,
              from,
              lineNum,
              v => {
                let busyW

                busyW = v.ele.querySelector('.shell-exit-w')
                if (busyW) {
                  let fromBusyW

                  fromBusyW = from.ele.querySelector('.shell-exit-w')
                  if (fromBusyW)
                    busyW.innerText = fromBusyW.innerText
                }
                if (whenReady)
                  whenReady(v)
              })
}

function initLog
() {
  let mo, buf, hist

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

  function oneLine
  (u, we) {
    let p

    p = Pane.current()
    if (p.buf.vars('vc log').search)
      Cmd.run('vc log search one-line', 0, 1, we, p.buf.vars('vc log').search)
    else
      Cmd.run('vc log one-line')
  }

  function refresh
  (p) {
    p.buf.clear()
    Shell.run(p.dir, 'git', p.buf.vars('vc log').args,
              { buf: p.buf,
                end: 1,
                afterEndPoint: 1,
                onClose: (buf, code) => busyClose(p, code),
                onErr: (buf, err) => busyErr(p, err) })
  }

  function show
  () {
    let p, prefix

    prefix = 'commit '
    p = Pane.current()
    while (1) {
      let l

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
                            viewCopy,
                            initFns: Ed.initModeFns,
                            parentsForEm: 'ed' })

  Cmd.add('one-line', () => oneLine(Pane.current()), mo)
  Cmd.add('refresh', () => refresh(Pane.current()), mo)
  Cmd.add('next commit', () => next(1), mo)
  Cmd.add('previous commit', () => next(-1), mo)
  Cmd.add('show', () => show(), mo)

  Cmd.add('vc log', u => {
    let args, p

    args = [ 'log' ]
    if (u == 4)
      args.push('main..HEAD')
    p = Pane.current()
    if (buf) {
      buf.dir = p.dir
      busySet(buf, busyCo())
    }
    else {
      buf = Buf.add('VC Log',
                    'VC Log',
                    divW('VC Log', args),
                    p.dir)
      buf.vars('ed').fillParent = 0
      buf.icon = 'log'
    }
    buf.vars('vc log').args = args
    buf.opts.set('core.lint.enabled', 0)
    buf.opts.set('minimap.enabled', 0)
    buf.opts.set('core.lang', 'git log')
    p.setBuf(buf, {}, () => {
      refresh(p)
    })
  })

  Cmd.add('vc log search', (u, we, term) => {
    function go
    (text) {
      if (text && text.trim().length) {
        let args, p, buf

        args = [ 'log', '-S', text ]
        p = Pane.current()
        buf = Buf.add('VC Log: ' + text,
                      'VC Log',
                      divW('VC Log', args),
                      p.dir)
        buf.vars('vc log').args = args
        buf.vars('vc log').search = text
        buf.vars('ed').fillParent = 0
        buf.icon = 'log'
        buf.opts.set('core.lint.enabled', 0)
        buf.opts.set('minimap.enabled', 0)
        buf.opts.set('core.lang', 'git log')
        hist.add(text)
        p.setBuf(buf, {}, () => {
          refresh(p)
        })
      }
    }

    if (term)
      go(term)
    else
      Prompt.ask({ text: 'VC Log Search:',
                   hist },
                 go)
  })

  hist = Hist.ensure('vc-log-search')

  Cmd.add('click', click, mo)

  Em.on('click', 'click', mo)

  // should use view mode
  Em.on('q', 'bury', mo)
  Em.on('Backspace', 'scroll up', mo)
  Em.on(' ', 'scroll down', mo)

  Em.on('g', 'refresh', mo)
  Em.on('l', 'one-line', mo)
  Em.on('L', 'refresh', mo)
  Em.on('n', 'next commit', mo)
  Em.on('Tab', 'next commit', mo)
  Em.on('p', 'previous commit', mo)
  Em.on('C-Tab', 'previous commit', mo)
  Em.on('e', 'show', mo)
  Em.on('Enter', 'show', mo)
  Em.on('=', 'show', mo)

  return hist
}

function initLogOneLine
(hist) {
  let mo, buf

  function full
  (u, we) {
    let p

    p = Pane.current()
    if (p.buf.vars('vc log one-line').search)
      Cmd.run('vc log search', 0, 1, we, p.buf.vars('vc log one-line').search)
    else
      Cmd.run('vc log')
  }

  function refresh
  (p) {
    p.buf.clear()
    Shell.run(p.dir, 'git', p.buf.vars('vc log one-line').args,
              { buf: p.buf,
                end: 1,
                afterEndPoint: 1,
                onClose: (buf, code) => busyClose(p, code),
                onErr: (buf, err) => busyErr(p, err) })
  }

  function next
  (n) {
    let p

    if (n == 0)
      return
    p = Pane.current()
    Ed.vfind(p.view,
             '^[0-9a-f]+(( |\t).*)?$',
             0,
             { skipCurrent: 1,
               backwards: n < 0,
               wrap: 0,
               caseSensitive: 0,
               wholeWord: 0,
               regExp: 1 })
    Cmd.run('line start')
  }

  function show
  () {
    let p, l, hash

    p = Pane.current()
    l = p.line()
    hash = /^([0-9a-f]+)/.exec(l)?.[1]
    if (hash)
      showHash(hash)
  }

  function showCommit
  () {
    let p, l, hash

    p = Pane.current()
    l = p.line()
    hash = /^([0-9a-f]+)/.exec(l)?.[1]
    if (hash)
      showHash(hash)
  }

  Cmd.add('vc log one-line', u => {
    let args, p

    args = [ 'log', '--oneline', '--no-decorate' ]
    if (u == 4)
      args.push('main..HEAD')
    p = Pane.current()
    if (buf) {
      buf.dir = p.dir
      busySet(buf, busyCo())
    }
    else {
      buf = Buf.add('VC Log One-Line', 'VC Log One-Line',
                    divW('VC Log One-Line', args),
                    p.dir)
      buf.vars('ed').fillParent = 0
      buf.icon = 'log'
    }
    buf.vars('vc log one-line').args = args
    buf.opts.set('core.lint.enabled', 0)
    buf.opts.set('minimap.enabled', 0)
    //buf.opts.set('core.lang', 'git log')
    buf.mode = 'VC Log One-Line'
    p.setBuf(buf, {}, () => {
      refresh(p)
    })
  })

  Cmd.add('vc log search one-line', (u, we, term) => {
    function go
    (text) {
      if (text && text.trim().length) {
        let args, p, buf

        args = [ 'log', '--oneline', '--no-decorate', '-S', text ]
        p = Pane.current()
        buf = Buf.add('VC Log1: ' + text,
                      'VC Log One-Line',
                      divW('VC Log One-Line', args),
                      p.dir)
        buf.vars('vc log one-line').search = text
        buf.vars('vc log one-line').args = args
        buf.vars('ed').fillParent = 0
        buf.icon = 'log'
        buf.opts.set('core.lint.enabled', 0)
        buf.opts.set('minimap.enabled', 0)
        //buf.opts.set('core.lang', 'git log')
        hist.add(text)
        p.setBuf(buf, {}, () => {
          refresh(p)
        })
      }
    }

    if (term)
      go(term)
    else
      Prompt.ask({ text: 'VC Log Search:',
                   hist },
                 go)
  })

  mo = Mode.add('VC Log One-Line', { viewInit: Ed.viewInit,
                                     viewCopy,
                                     initFns: Ed.initModeFns,
                                     parentsForEm: 'ed',
                                     decorators: [ { regex: /^([0-9a-f]+)/d,
                                                     decor: [ { attr: { class: 'vc_log-hash',
                                                                        'data-run': 'show' } } ] } ] })
  Cmd.add('full', () => full(Pane.current()), mo)
  Cmd.add('refresh', () => refresh(Pane.current()), mo)
  Cmd.add('next commit', () => next(1), mo)
  Cmd.add('previous commit', () => next(-1), mo)
  Cmd.add('show', () => show(), mo)
  Cmd.add('show commit', () => showCommit(), mo)

  Em.on('q', 'bury', mo)
  Em.on('Backspace', 'scroll up', mo)
  Em.on(' ', 'scroll down', mo)

  Em.on('g', 'refresh', mo)
  Em.on('l', 'refresh', mo)
  Em.on('L', 'full', mo)
  Em.on('n', 'next commit', mo)
  Em.on('Tab', 'next commit', mo)
  Em.on('p', 'previous commit', mo)
  Em.on('C-Tab', 'previous commit', mo)
  Em.on('e', 'show commit', mo)
  Em.on('Enter', 'show commit', mo)
  Em.on('=', 'show commit', mo)
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

  function viewInit
  (view, spec, cb) {
    let p

    p = Pane.current()
    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''
    Shell.run(p.dir, 'git', [ 'log' ], { onStdin,
                                         onStdout })
    if (cb)
      cb(view)
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

  Mode.add('Bad Idea', { viewInit })

  Cmd.add('bad idea vc log', () => {
    let p

    p = Pane.current()
    if (buf)
      p.setBuf(buf, {}, view => viewInit(view))
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

  mo = Mode.add('VC Annotate', { viewInit: Ed.viewInit,
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

  function mainOrMaster
  () {
    Shell.runToString(Pane.current().dir,
                      'git',
                      [ 'branch', '--list', 'main' ],
                      0,
                      out => {
                        if (out.trim())
                          git('git switch main')
                        else
                          git('git switch master')
                      })
  }

  moB = Mode.add('branch', { viewInit: Ed.viewInit,
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
  initLogOneLine(initLog())
  initLogBadIdea()
  initEqual()
  initStash()
  initHub()
  initPrs()

  Cmd.add('vc branch', () => branch())
  Cmd.add('vc main', () => mainOrMaster())
  Cmd.add('vc pull', () => git('git-pull-with-name'))
  Cmd.add('vc push', () => git('git push origin HEAD'))
  Cmd.add('vc reset', () => reset())
  Cmd.add('vc show', () => showHash())
  Cmd.add('vc stash', () => git('git stash --include-untracked'))
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
  // f
  Em.on('C-x v g', 'vc annotate')
  Em.on('C-x v h', 'vc hub')
  Em.on('C-x v H', 'vc prs')
  Em.on('C-x v i', 'vc show')
  // j
  // k
  Em.on('C-x v L', 'vc log')
  Em.on('C-x v l', 'vc log one-line')
  Em.on('C-x v m', 'vc main')
  Em.on('C-x v o', 'vc stash pop')
  Em.on('C-x v p', 'vc push')
  // q
  Em.on('C-x v r', 'vc reset')
  Em.on('C-x v R', 'vc review')
  Em.on('C-x v s', 'vc log search one-line')
  Em.on('C-x v S', 'vc log search')
  // t
  Em.on('C-x v u', 'vc pull')
  Em.on('C-x v v', 'vc status')
  Em.on('C-x v w', 'vc stash')
  // x
  // y
  // z
  Em.on('C-x v =', 'vc equal')
}
