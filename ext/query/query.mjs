import { append, divCl, img } from '../../dom.mjs'

import * as Buf from '../../buf.mjs'
import * as Css from '../../css.mjs'
import * as Cmd from '../../cmd.mjs'
import * as Ed from '../../ed.mjs'
import * as Em from '../../em.mjs'
import * as Hist from '../../hist.mjs'
import * as Mess from '../../mess.mjs'
import * as Mode from '../../mode.mjs'
import * as Opt from '../../opt.mjs'
import * as Pane from '../../pane.mjs'
import * as Prompt from '../../prompt.mjs'
import * as Shell from '../../shell.mjs'
import { d } from '../../mess.mjs'

export
function init
() {
  let hist, mo

  function divW
  (query) {
    return divCl('query-ww',
                 [ divCl('query-h', 'Query: ' + query),
                   divCl('query-w', 'Fetching...') ])
  }

  function refresh
  (view, spec, cb) {
    let w, co

    if (0) {
      w = view.ele.querySelector('.query-w')
      //w.innerHTML = 'xx'

      append(w, co)
    }

    if (cb)
      cb(view)
  }

  function first
  (v) {
    v.point.put(v.ele.querySelector('.query-item'))
  }

  function next
  (nth) {
    let h, el, v

    v = Pane.current().view
    h = v.ele.querySelector('.query-h')
    if (v.point.over(h)) {
      first(v)
      return
    }
    el = v.point.over()
    if (el) {
      let item

      if (Css.has(el, 'query-item'))
        item = el
      else
        item = el.closest('.query-item')

      if (nth == -1)
        el = item.previousElementSibling
      else
        el = item.nextElementSibling
      if (Css.has(el, 'query-item')) {
        v.point.put(el)
        return
      }
    }
    else
      first(v)
  }

  function snippet
  (item) {
    let split, date

    split = item.snippet.split(' ', 3)
    if (split && (split.length > 2) && /[0-9][0-9][0-9][0-9]/.test(split[2]))
      date = split.join(' ')
    if (date)
      return [ divCl('query-item-date', date),
               item.snippet.slice(date.length) ]
    return item.snippet
  }

  function title
  (item) {
    let favi

    try {
      let url

      url = new URL(item.link)
      favi = url.protocol + '//' + url.host + '/favicon.ico'
    }
    catch (err) {
      Ed.use(err)
    }

    if (favi)
      return [ divCl('query-item-icon',
                     img(favi, 'Icon', '', { crossorigin: 'anonymous' })),
               item.title ]
    return item.title
  }

  function search
  (buf, query) {
    fetch('https://www.googleapis.com/customsearch/v1'
          + '?cx=' + Opt.get('google.cx')
          + '&key=' + Opt.get('google.key')
          + '&q=' + query,
          { credentials: 'omit',
            redirect: 'error' })
      .then(response => {
        response.ok || Mess.toss(response.statusText)
        return response.json()
      })
      .then(data => {
        d(data)
        buf?.views.forEach(view => {
          if (view.ele) {
            let w

            w = view.ele.querySelector('.query-w')
            w.innerHTML = ''
            append(w,
                   data.items.map(item => divCl('query-item',
                                                [ divCl('query-item-t',
                                                        title(item),
                                                        { 'data-run': 'open externally',
                                                          'data-url': item.link }),
                                                  divCl('query-item-url',
                                                        item.formattedUrl),
                                                  divCl('query-item-snippet',
                                                        snippet(item)) ])))
          }
        })
      })
      .catch(error => {
        Mess.yell(error.message)
      })
  }

  /* You are an expert. Based on the following search results, please provide a summary or answer to my question:

Search Results:
1.
2.
3.

Question: ...
*/

  Cmd.add('llm', (u, we, model) => {
    model = model || Opt.get('llm.model')
    Prompt.ask({ text: 'Prompt',
                 hist: hist },
               prompt => {
                 hist.add(prompt)
                 Shell.spawn1('llm', 1, 0, [ model, prompt ], 0, buf => {
                   buf.opts.set('core.line.wrap.enabled', 1)
                   buf.opts.set('core.lint.enabled', 0)
                   buf.mode = 'richdown'
                 })
               })
  })

  Cmd.add('google', () => {
    Prompt.ask({ text: 'Query',
                 hist: hist },
               query => {
                 let p, buf

                 p = Pane.current()
                 buf = Buf.add('Query', 'Query', divW(query), p.dir)
                 hist.add(query)
                 p.setBuf(buf, {}, () => search(buf, query))
               })
  })

  hist = Hist.ensure('llm')

  mo = Mode.add('Query', { viewInitSpec: refresh })

  Cmd.add('next', () => next(), mo)
  Cmd.add('previous', () => next(-1), mo)

  Em.on('n', 'Next', mo)
  Em.on('p', 'Previous', mo)
  // should use view mode
  Em.on('q', 'bury', mo)
  Em.on('Backspace', 'scroll up', mo)
  Em.on(' ', 'scroll down', mo)
}

export
function free
() {
  Cmd.remove('google')
  Cmd.remove('llm')
  Mode.remove('Query')
}
