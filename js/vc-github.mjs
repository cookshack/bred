import * as Mess from './mess.mjs'
import * as Opt from './opt.mjs'
import * as U from './util.mjs'

let cachedPrs

cachedPrs = {}

export
function getToken
() {
  let token

  token = Opt.get('core.vc.github.token')
  token.length || Mess.toss('core.vc.github.token not set')
  return token
}

export
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

export
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

export
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

export
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

export
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

export
function findPrNumByBranch
(ownerRepo, branchName) {
  for (let key in cachedPrs) {
    let cached

    cached = cachedPrs[key]

    if ((cached.branch == branchName) && key.startsWith(ownerRepo + '/'))
      return cached.prNum
  }
  return 0
}

export
function clearCachedPrs
() {
  cachedPrs = {}
}
