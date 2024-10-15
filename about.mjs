import { append, div, divCl, span, img } from './dom.mjs'

import * as Buf from './buf.mjs'
import * as Bred from './bred.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Ed from './ed.mjs'
import * as Exec from './exec.mjs'
import * as Em from './em.mjs'
import * as Ev from './ev.mjs'
import * as Icon from './icon.mjs'
import * as Loc from './loc.mjs'
import * as Man from './man.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Opt from './opt.mjs'
import * as Pane from './pane.mjs'
import { Vace } from './json.mjs'
import { Vode } from './json.mjs'
import { Vonaco } from './json.mjs'
import * as Win from './win.mjs'

import * as Welcome from './welcome.mjs'
import { d } from './mess.mjs'

function divW
() {
  return divCl('mess-ww', divCl('mess-w bred-surface', ''))
}

function initAbout
() {
  function divW
  () {
    let v

    function ver
    (name, version) {
      return [ div(name), div(version || '') ]
    }

    function dir
    (name, d) {
      if (d)
        return [ div(name),
                 div(d, '',
                     { 'data-run': 'open link',
                       'data-path': d }) ]
      return []
    }

    v = Bred.version() || {}

    return divCl('bred-about-ww',
                 divCl('bred-about-w bred-surface',
                       [ divCl('bred-about-h',
                               [ div('Bred'),
                                 divCl('bred-about-i',
                                       img('img/logo.svg', 'Bred')) ]),
                         div([ span('Br', 'bold'), 'owser ', span('ed', 'bold'), 'itor thing.' ]),
                         divCl('bred-about-vw',
                               [ ver('Version', span(v.bred, 'bold')),
                                 ver('Node', v.node),
                                 ver('Electron', v.electron),
                                 ver('Chrome', v.chrome),
                                 ver('V8', v.v8),
                                 ver('Ace', Vace.version || 'missing'),
                                 ver('CodeMirror', Vode.version),
                                 ver('Monaco', Vonaco.version),
                                 ver('Backend', Ed.backend) ]),
                         divCl('bred-about-dw',
                               [ divCl('bred-about-lic-2 bred-about-w-h', 'Directories'),
                                 dir('Home', Loc.home()),
                                 dir('Init File', Loc.make(Loc.configDir()).join('init.js')),
                                 dir('Config Dir', Loc.configDir().path),
                                 dir('Initial Working Dir', Loc.iwd().path),
                                 dir('App Dir', Loc.appDir().path) ]),
                         divCl('bred-about-lic',
                               [ divCl('bred-about-lic-2 bred-about-w-h', 'Licence'),
                                 divCl('bred-about-lic-2', 'To the extent possible under law, the author(s) have dedicated all copyright and related and neighboring rights to this software to the public domain worldwide. This software is distributed without any warranty.'),
                                 dir('CC0 Dedication:', Loc.make(Loc.appDir()).join('COPYING')) ]) ]))
  }

  function addBuf
  (p) {
    let buf

    buf = Buf.add('About', 0, divW(), p.dir)
    Win.shared().about.buf = buf
    buf.addMode('view')
    buf.icon = 'bred'
    return buf
  }

  if (Win.root())
    Win.shared().about = {}

  Cmd.add('about', () => {
    let p

    p = Pane.current()
    p.setBuf(Win.shared().about.buf || addBuf(p))
  })
  Em.on('C-h C-a', 'about')
}

function initHelp
() {
  let mo

  function divW
  (p) {
    let mode, minor

    function descr
    (val) {
      let type, json

      type = typeof val
      if (type == 'number')
        return div(type + ': ' + String(val))
      if (type == 'string')
        return div(type + ': ' + val)
      if (Array.isArray(val))
        return div('Array of ' + val.length)
      if (val instanceof Set)
        return div('Set of ' + val.size)
      try {
        json = JSON.stringify(val)
      }
      catch (e) {
        Ed.use(e)
        json = '??'
      }
      return div(type + ': ' + json)
    }

    function clean
    (bufVal, val, type) {
      val = bufVal === undefined ? val : bufVal
      if (type == 'bool')
        val = val ? 'true' : 'false'
      else
        val = String(val)
      return val + ((bufVal === undefined) ? ' (inherited)' : '')
    }

    function opts
    () {
      let callerBuf

      callerBuf = Win.shared().helpBuffer.callerBuf
      return [ divCl('bold twoCol', 'Options'),
               Opt.map((name, value) => {
                 if (name.startsWith('core.')
                     || callerBuf?.minors.find(mo => name.startsWith(mo.key))) {
                   let type, run

                   type = Opt.type(name)
                   run = {}
                   if (type == 'bool')
                     run = { 'data-run': 'toggle option' }
                   value = clean(callerBuf?.opts.get(name), value, type)
                   return [ divCl('options-name', name),
                            divCl('bred-help-option',
                                  [ divCl('options-val',
                                          value,
                                          { 'data-name': name, ...run }),
                                    divCl('options-type', type) ]) ]
                 }
                 return []
               }) ]
    }

    function vars
    (v) {
      return Object.entries(v).map(kv => [ div(kv[0]), descr(kv[1]) ])
    }

    function modeVars
    () {
      let all, ret

      ret = [ divCl('bold twoCol', 'Vars') ]
      all = Object.entries(p.buf.vars()).map(kv => [ divCl('bred-help-space'),
                                                     divCl('bold twoCol', kv[0]),
                                                     vars(kv[1]) ])
      if (all.length)
        ret.push(all)
      else
        ret.push(divCl('twoCol', 'empty'))

      return ret
    }

    function path
    (p) {
      if (p)
        return div(p, '', { 'data-run': 'open link',
                            'data-path': p })
      return div()
    }

    function commentBlock
    (block) {
      if (block)
        return (block?.open || '') + ' ... ' + (block.close || '')
      return ''
    }

    function icon
    (mode) {
      return mode.icon?.name && span(img(Icon.path(mode.icon.name),
                                         Icon.alt(mode.icon.name),
                                         'filter-clr-text'),
                                     'bred-help-heading-icon')
    }

    mode = p.buf?.mode
    minor = []
    if (p.buf) {
      minor.push(div('Minor Modes'))
      if (p.buf.minors)
        minor.push(div(p.buf.minors.map(m => ' ' + m.key)))
    }
    return divCl('bred-help-ww',
                 divCl('bred-help-w bred-surface',
                       [ divCl('bred-help-h'),
                         divCl('bred-help-buf',
                               [ divCl('twoCol bred-help-heading',
                                       [ icon(mode),
                                         'Buffer Details' ]),
                                 divCl('bred-help-space'),
                                 div('Buffer Name'), div(p.buf?.name),
                                 div('Buffer File'), div(p.buf?.file),
                                 div('Buffer File Type'), div(p.buf?.fileType),
                                 div('Buffer Dir'), path(p.buf?.dir),
                                 div('Buffer Path'), path(p.buf?.path),
                                 div('Mode Name'), div(div(mode?.name, 'bred-help-mode-name')),
                                 mode && div('Mode Key'),
                                 mode && div(mode.key),
                                 mode && p.view?.lang && div('Mode Backend Lang'),
                                 mode && p.view?.lang && div(p.view.lang),
                                 mode && p.view?.langData && div('Comment Token: Line'),
                                 mode && p.view?.langData && divCl('bred-help-comment', p.view.langData?.comment?.line || ''),
                                 mode && p.view?.langData && div('Comment Token: Block'),
                                 mode && p.view?.langData && divCl('bred-help-comment', commentBlock(p.view.langData?.comment?.block)),
                                 mode && div('Mode Icon Name'),
                                 mode && div(mode.icon?.name || ''),
                                 minor,
                                 divCl('bred-help-space'),
                                 opts(),
                                 divCl('bred-help-space'),
                                 modeVars() ]) ]))
  }

  function addBuf
  () {
    let p, buf

    p = Pane.current()
    buf = Buf.add('Help: Buffer', 'Help: Buffer', divW(p), p.dir)
    Win.shared().helpBuffer.buf = buf
    buf.icon = 'help'
    buf.addMode('view')
    return buf
  }

  function toggle
  (u, we) {
    if (we.e.target.dataset.name) {
      let name, callerBuf

      name = we.e.target.dataset.name
      callerBuf = Win.shared().helpBuffer
      callerBuf?.opts.set(name, !callerBuf.opt(name))
    }
    else
      Mess.toss('missing name')
  }

  if (Win.root())
    Win.shared().helpBuffer = {}

  mo = Mode.add('Help: Buffer')

  Cmd.add('toggle option', toggle, mo)

  Cmd.add('describe buffer', () => {
    let p, buf

    p = Pane.current()
    Win.shared().helpBuffer.callerBuf = p.buf
    buf = Win.shared().helpBuffer.buf
    if (buf) {
      buf.clear()
      buf.content = divW(p)
    }
    else {
      buf = addBuf(p)
      buf.icon = 'help'
    }
    p.setBuf(buf)
  })

  Em.on('C-h b', 'describe buffer')
}

export
function initDescribeKey
() {
  let mo, mapDescribeKey, st, buf

  function source
  () {
    let p, file, line

    p = Pane.current()
    file = p.view.ele.querySelector('.describe_key-file').innerText
    line = p.view.ele.querySelector('.describe_key-line').innerText
    Pane.open(file, line)
  }

  function describeKey
  () {
    function cancel
    () {
      Css.show(st.win.echo)
      st.mini.remove()
      Css.remove(st.win.mini, 'active')
      Css.remove(st.win.mini, 'search')
      globalThis.onkeydown = st.oldOnKeyDown
    }

    function divW
    () {
      return divCl('describe_key-ww', divCl('describe_key-w bred-surface', ''))
    }

    function wesToStr
    (wes) {
      function keyStr
      (e) {
        let str

        str = ' '
        if (e.ctrlKey)
          str += 'C-'
        if (e.altKey)
          str += 'A-'
        str += (e.key || '')
        return str
      }
      return wes.reduce((acc,cur) => acc += keyStr(cur.e), '')
    }

    function refresh
    (view, to, wes) {
      let w, cmd, file, line

      w = view.ele.firstElementChild.firstElementChild
      w.innerHTML = ''
      cmd = Cmd.get(to, st.view?.buf)
      file = cmd?.source.file
      line = cmd?.source.line
      append(w,
             div('Key: '), div(wesToStr(wes)),
             div('Command: '), divCl('describe_key-cmd bold', Cmd.canon(to)),
             div('File: '), divCl('describe_key-file', file, { 'data-run': 'open link', 'data-path': file, 'data-line': line }),
             div('Line: '), divCl('describe_key-line', line))
    }

    function describe
    (to, wes) {
      let p, w

      d(to)

      p = Pane.current()

      w = divW()

      if (buf) {
        //buf.vars("SC").hist.reset()
      }
      else {
        buf = Buf.make('Describe Key', 'Describe Key', w, p.dir)
        //buf.vars("SC").hist = compileHist
        buf.addMode('view')
      }
      p.setBuf(buf, null, 0, view => refresh(view, to, wes))
    }

    {
      let p

      p = Pane.current()

      if (Css.has(p.win.mini, 'active'))
        return

      st = {}
      st.win = p.win
      st.view = p.view
    }

    Css.add(st.win.mini, 'active')
    Css.add(st.win.mini, 'search')
    st.echo = divCl('mini-echo')
    Css.hide(st.win.echo)
    st.mini = divCl('mini-search-w',
                    [ divCl('mini-icon icon-ed-search',
                            img('img/up.svg', 'Previous', 'filter-clr-nb0'),
                            { 'data-run': 'search backward again' }),
                      divCl('mini-icon icon-ed-search',
                            img('img/down.svg', 'Next', 'filter-clr-nb0'),
                            { 'data-run': 'search forward again' }),
                      divCl('mini-icon',
                            img('img/x.svg', 'X', 'filter-clr-nb0'),
                            { 'data-run': 'search cancel' }),
                      divCl('mini-icon',
                            img('img/search.svg', 'Search', 'filter-clr-nb0'),
                            { 'data-run': 'search done' }),
                      st.echo ])
    st.win.mini.firstElementChild.after(st.mini)

    st.oldOnKeyDown = globalThis.onkeydown

    let wes

    wes = []
    globalThis.onkeydown = e => {
      let we

      if ([ 'Alt', 'Control', 'CapsLock', 'Shift' ].includes(e.key))
        // see note at top of em.look1
        return

      we = { mouse: 0, e: e }
      // if in search em then do that
      // else if in old em then describe key and exit
      wes.push(we)
      mapDescribeKey.look(wes, to => {
        e.preventDefault()

        if (to) {
          if (to.ons)
            // map
            return

          // cmd
          Cmd.run(to, st.view?.buf, 1, we)
          wes = []
          return
        }

        // if in regular em then exit and run the original handler
        Em.look(wes, 0, st.view?.buf, (map, to) => {
          if (to) {
            if (to.ons)
              // map
              return
            cancel()
            d('KEY')
            describe(to, wes)
          }
          else {
            cancel()
            Mess.say('key empty')
          }
        })
      })
    }
  }

  mo = Mode.add('Describe Key')

  mapDescribeKey = Em.make('Describe Key:')

  Cmd.add('source', () => source(), mo)
  Em.on('s', 'source', mo)

  Cmd.add('describe key', () => describeKey())
  Em.on('C-h k', 'describe key')
}

export
function initDescribeCmd
() {
  let mo, buf, callerBuf

  function source
  () {
    let p, file, line

    p = Pane.current()
    file = p.view.ele.querySelector('.describe_cmd-file').innerText
    line = p.view.ele.querySelector('.describe_cmd-line').innerText
    Pane.open(file, line)
  }

  function refresh
  (view, name) {
    let w, cmd, file, line, mode

    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''
    cmd = Cmd.get(name, callerBuf)
    file = cmd?.source.file
    mode = cmd?.mode
    line = cmd?.source.line
    append(w,
           div('Command: '), divCl('describe_cmd-name bold', Cmd.canon(name)),
           div('Mode: '), divCl('describe_cmd-mode', mode?.name || 'any'),
           div('File: '), divCl('describe_cmd-file', file, { 'data-run': 'open link', 'data-path': file, 'data-line': line }),
           div('Line: '), divCl('describe_cmd-line', line))
  }

  function divW
  () {
    return divCl('describe_cmd-ww', divCl('describe_cmd-w bred-surface', ''))
  }

  function describe
  (name, mode) {
    let p, w

    d(name)

    p = Pane.current()

    w = divW()

    if (buf) {
      //buf.vars("SC").hist.reset()
    }
    else {
      buf = Buf.make('Describe Cmd', 'Describe Cmd', w, p.dir)
      //buf.vars("SC").hist = compileHist
      buf.addMode('view')
    }
    p.setBuf(buf, null, 0, view => refresh(view, name, mode))
  }

  function describeCmd
  () {
    let p, buf

    p = Pane.current()
    callerBuf = p.buf
    buf = Buf.make('Execute', 'Execute', Exec.divW(), p.dir)
    buf.vars('execute').cb = name => describe(name)
    p.setBuf(buf)
  }

  mo = Mode.add('Describe Cmd')

  Cmd.add('source', () => source(), mo)
  Em.on('s', 'source', mo)

  Cmd.add('describe command', () => describeCmd())
  Em.on('C-h c', 'describe command')
}

function initLangs
() {
  let mo

  function source
  () {
    let p, file, line

    p = Pane.current()
    file = p.view.ele.querySelector('.describe_cmd-file').innerText
    line = p.view.ele.querySelector('.describe_cmd-line').innerText
    Pane.open(file, line)
  }

  function refresh
  (view) {
    let w, frag

    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''
    frag = new globalThis.DocumentFragment()
    Ed.langs().forEach(lang =>
      append(frag,
             div(lang.name || 'ERR'),
             div(lang.module
                 && div(lang.module,
                        { 'data-run': 'open externally',
                          'data-url': 'http://npmjs.com/package/' + lang.module }))))
    append(frag, divCl('langs-end'))
    append(w, frag)
  }

  function divW
  () {
    return divCl('langs-ww', divCl('langs-w bred-surface', ''))
  }

  function langs
  () {
    let p, w, buf

    p = Pane.current()

    w = divW()

    buf = Win.shared().langs.buf
    if (buf) {
      //buf.vars("SC").hist.reset()
    }
    else {
      buf = Buf.make('Langs', 'Langs', w, p.dir)
      Win.shared().langs.buf = buf
      //buf.vars("SC").hist = compileHist
      buf.addMode('view')
    }
    p.setBuf(buf, null, 0, view => refresh(view))
  }

  if (Win.root())
    Win.shared().langs = {}

  mo = Mode.add('Langs')

  Cmd.add('source', () => source(), mo)
  Em.on('s', 'source', mo)

  Cmd.add('langs', () => langs())
}

export
function init
() {
  let mo

  function appendM
  (frag, m) {
    let date, loc, locDiv

    date = new Date(m.time * 1000)
    loc = Loc.make(m.file)
    if (loc.filename)
      locDiv = divCl('mess-loc',
                     loc.filename + ':' + m.line,
                     { 'data-run': 'open link',
                       'data-path': loc.path,
                       'data-line': m.line })
    else
      locDiv = divCl('mess-loc')
    append(frag,
           [ divCl('mess-date', String(date.getHours()).padStart(2, ' ') + 'h' + String(date.getMinutes()).padStart(2, '0')),
             locDiv,
             divCl('mess-type', m.type[0].toUpperCase()),
             divCl('mess-text mess-' + m.type, m.text) ])
  }

  function add
  (mess) {
    Win.shared().messages.buf?.views.forEach(view => {
      if (view.ele) {
        let w

        w = view.ele.firstElementChild.firstElementChild
        appendM(w, mess)
        w.scrollIntoView({ block: 'end', inline: 'nearest' })
      }
    })
  }

  function refresh
  (view) {
    let w, frag

    w = view.ele.firstElementChild.firstElementChild
    w.innerHTML = ''
    frag = new globalThis.DocumentFragment()
    Mess.messages().forEach(m => {
      appendM(frag, m)
    })
    append(w, frag)
    w.scrollIntoView({ block: 'end', inline: 'nearest' })
  }

  function addBuf
  (p) {
    let buf

    buf = Buf.add('Messages', 'Messages', divW(), p.dir)
    Win.shared().messages.buf = buf
    buf.icon = 'log'
    buf.addMode('view')
    return buf
  }

  if (Win.root())
    Win.shared().messages = {}

  Ev.on('Mess.push', e => add(e.detail))

  mo = Mode.add('Messages', { viewInit: refresh })

  Cmd.add('messages', () => {
    let p, buf

    p = Pane.current()
    buf = Win.shared().messages.buf
    if (buf)
      p.setBuf(buf, null, 0, () => refresh(p.view))
    else
      p.setBuf(addBuf(p))
  })

  Em.on('C-h s', 'messages')
  Em.on('C-h u', 'man')

  Cmd.add('refresh', () => refresh(Pane.current().view), mo)

  Em.on('g', 'refresh', mo)

  initAbout()
  initHelp()
  initDescribeCmd()
  initDescribeKey()
  initLangs()
  Welcome.init()
  Man.init()
}
