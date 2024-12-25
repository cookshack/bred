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

import Ollama from './lib/ollama.js'

export
function init
() {
  let hist, mo

  function url
  (query) {
    return Opt.get('query.search.url.prefix') + globalThis.encodeURIComponent(query)
  }

  function divW
  (query) {
    return divCl('query-ww',
                 [ divCl('query-h', 'Query: ' + query),
                   divCl('query-links',
                         divCl('query-link', 'Browser', { 'data-run': 'open externally',
                                                          'data-url': url(query) })),
                   divCl('query-llm'),
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
  (dir, buf, query) {
    function add
    (buf, str) {
      buf?.views.forEach(view => {
        let l

        l = view.ele.querySelector('.query-llm')
        l.innerText = l.innerText + str
      })
    }

    fetch('https://www.googleapis.com/customsearch/v1'
          + '?cx=' + Opt.get('query.google.cx')
          + '&key=' + Opt.get('query.google.key')
          + '&q=' + query,
          { credentials: 'omit',
            redirect: 'error' })
      .then(response => {
        response.ok || Mess.toss(response.statusText)
        return response.json()
      })
      .then(data => {
        d(data)

        if (query.endsWith('?')) {
          let que

          add(buf, buf?.opt('query.model') + ' says:\n\n')

          que = 'You are an expert. Based on the following search results, please provide a summary or answer to my question:\n\n'
          que += 'Search Results:\n'

          for (let i = 0; (i < 3) && (i < data.items.length); i++)
            que += String(i + 1) + '. ' + data.items[i].title + ' (' + data.items[i].snippet + ')\n'
          que += '\nQuestion:\n' + query + '\n'

          d(que)

          Shell.run(dir, 'llm', [ buf?.opt('query.model'), que ],
                    { onStdout: str => add(buf, str),
                      onStderr: str => add(buf, str) })
        }

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

  function insert
  (dir, view, prompt) {
    let que, text, off, bep, buf

    function add
    (str) {
      d(str)
      buf.insert(str, bep)
      bep += str.length // for won,wace need something like vbepIncr(str.length) OR insert could return new bep?
    }

    text = view.buf.text()
    off = view.offset
    que = 'Provide text that matches the DESCRIPTION below, that I can insert at the specified position in the FILE below.'
    que += ' Respond only with the text that should be inserted.\n\n'
    que += '1. DESCRIPTION:\n' + prompt + '\n\n'
    que += '2. FILE:\n' + text.slice(0, off) + '[SPECIFIED POSITION]' + text.slice(off) + '\n'

    d(que)
    buf = view.buf // in case view changes, still issues if eg buf removed
    bep = view.bep
    Shell.run(dir, 'llm', [ view.buf?.opt('query.model.code') || view.buf?.opt('query.model'), que ],
              { onStdout: add,
                onStderr: add })
  }

  function fim
  (dir, view, prompt) {
    let text, off, bep, buf, gen, suffix

    function add
    (str) {
      d(str)
      buf.insert(str, bep)
      bep += str.length // for won,wace need something like vbepIncr(str.length) OR insert could return new bep?
    }

    gen = async spec => {
      let response

      response = await Ollama.generate(spec)
      for await (let part of response)
        add(part.response)
      add('\n')
    }

    text = view.buf.text()
    off = view.offset
    buf = view.buf // in case view changes, still issues if eg buf removed
    bep = view.bep

    prompt = text.slice(0, off) + '\n// please insert the following: ' + prompt + '\n'
    suffix = text.slice(off)
    d({ prompt })
    d({ suffix })
    gen({ model: view.buf?.opt('query.model.code') || view.buf?.opt('query.model'),
          prompt: prompt,
          suffix: suffix,
          stream: true,
          raw: true,
          // https://github.com/ollama/ollama/blob/main/docs/modelfile.md#valid-parameters-and-values
          options: {
            //temperature: 1 // 0..1 higher is more creative
          } })
  }

  Cmd.add('llm', (u, we, model) => {
    model = model || Opt.get('query.model')
    Prompt.ask({ text: 'Prompt',
                 hist: hist },
               prompt => {
                 hist.add(prompt)
                 Shell.spawn1('llm', [ model, prompt ], { end: 1 }, buf => {
                   buf.opts.set('core.line.wrap.enabled', 1)
                   buf.opts.set('core.lint.enabled', 0)
                   buf.mode = 'richdown'
                 })
               })
  })

  Cmd.add('llm insert', () => {
    Prompt.ask({ text: 'Describe what should be inserted',
                 hist: hist },
               prompt => {
                 let p

                 p = Pane.current()

                 hist.add(prompt)
                 prompt = prompt.trim()
                 insert(p.dir, p.view, prompt)
               })
  })

  Cmd.add('fim', () => {
    Prompt.ask({ text: 'Describe what should be inserted',
                 hist: hist },
               prompt => {
                 let p

                 p = Pane.current()

                 hist.add(prompt)
                 prompt = prompt.trim()
                 fim(p.dir, p.view, prompt)
               })
  })

  Cmd.add('google', () => {
    Prompt.ask({ text: 'Query',
                 hist: hist },
               query => {
                 let p, buf

                 p = Pane.current()
                 query = query.trim()
                 buf = Buf.add('Query', 'Query', divW(query), p.dir)
                 hist.add(query)
                 p.setBuf(buf, {}, () => search(p.dir, buf, query))
               })
  })

  hist = Hist.ensure('llm')

  Opt.declare('query.model', 'str', 'mistral')
  Opt.declare('query.search.url.prefix', 'str', 'https://google.com/search?q=')
  Opt.declare('query.google.cx', 'str', '')
  Opt.declare('query.google.key', 'str', '')

  mo = Mode.add('Query', { viewInitSpec: refresh })

  Cmd.add('next', () => next(), mo)
  Cmd.add('previous', () => next(-1), mo)

  Em.on('n', 'Next', mo)
  Em.on('p', 'Previous', mo)
  // should use view mode
  Em.on('q', 'bury', mo)
  Em.on('Backspace', 'scroll up', mo)
  Em.on(' ', 'scroll down', mo)

  Em.on('C-x i', 'llm insert', 'ed')
}

export
function free
() {
  Cmd.remove('google')
  Cmd.remove('llm')
  Mode.remove('Query')
}
