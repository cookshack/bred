import { append, button, img, div, divCl, span } from './dom.mjs'

import * as Bred from './bred.mjs'
import * as Buf from './buf.mjs'
import * as Cmd from './cmd.mjs'
import * as Css from './css.mjs'
import * as Icon from './icon.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Opt from './opt.mjs'
import * as Pane from './pane.mjs'
import * as Recent from './recent.mjs'
import * as Win from './win.mjs'
import { d } from './mess.mjs'

export
function init
() {
  function divW
  () {
    let w, rcs, rds, rfs, rls, version

    function short
    (href) {
      let url

      url = new URL(href)
      return url.hostname + url.pathname
    }

    rcs = divCl('bred-welcome-recent-cmds bred-welcome-recent',
                divCl('bred-welcome-rf-h', 'Recent commands'))

    {
      let hist, seen

      seen = new Set()
      hist = Cmd.hist.items
      for (let i = 1, item, cmd; i <= hist.length; i++) {
        item = hist.at(-i)
        if (item == 'Universal Argument')
          continue
        if (seen.has(item))
          continue
        cmd = Cmd.get(item)
        if (cmd) {
          seen.add(item)
          rcs.append(div(item, { 'data-run': hist.at(-i) }))
          if (seen.size == 10)
            break
        }
      }
    }

    rds = divCl('bred-welcome-recent-dirs bred-welcome-recent',
                div('Loading...'))

    rfs = divCl('bred-welcome-recent-files bred-welcome-recent',
                div('Loading...'))

    rls = divCl('bred-welcome-recent-links bred-welcome-recent',
                div('Loading...'))

    version = Bred.version()?.bred || '??'

    w = divCl('bred-welcome-ww',
              divCl('bred-welcome-w',
                    [ divCl('bred-welcome-theme',
                            [ button(img(Icon.path('light'), 'Light', 'filter-clr-text'),
                                     'buttonLight' + ((Opt.get('core.theme.mode') == 'light') ? ' retracted' : ''),
                                     { 'data-run': 'light mode' }),
                              button(img(Icon.path('dark'), 'Dark', 'filter-clr-text'),
                                     'buttonDark' + ((Opt.get('core.theme.mode') == 'light') ? '' : ' retracted'),
                                     { 'data-run': 'dark mode' }) ]),
                      divCl('bred-welcome-h',
                            [ div('Welcome') ]),
                      divCl('bred-welcome-text',
                            div('This is Bred.')),
                      divCl('bred-welcome-text',
                            div([ span('Warning:', 'bred-welcome-warning'),
                                  ' Use at your own risk! Bred is experimental, and far from stable or secure.' ])),
                      divCl('bred-welcome-text',
                            div([ span('Edit', { 'data-run': 'open file' }),
                                  ' a file. ',
                                  span('Search', { 'data-run': 'go' }),
                                  ' the web. ',
                                  span('Chat', { 'data-run': 'chat' }),
                                  ' to an AI.' ])),
                      divCl('bred-welcome-quick',
                            div([ divCl('bred-welcome-link', 'Home', { 'data-run': 'Home' }) ])),
                      divCl('bred-welcome-quick',
                            divCl('bred-welcome-recents',
                                  [ rls, rfs, rds, rcs ])),
                      divCl('bred-welcome-sett',
                            [ 'Show Welcome on start? ',
                              button('yes',
                                     'buttonY' + (Opt.get('core.welcome.enabled') ? ' on' : ''),
                                     { 'data-run': 'show welcome on start' }),
                              button('no',
                                     'buttonN' + (Opt.get('core.welcome.enabled') ? '' : ' on'),
                                     { 'data-run': 'hide welcome on start' }) ]),
                      divCl('bred-welcome-more',
                            [ div('More options.', { 'data-run': 'options' } ) ]),
                      divCl('bred-welcome-version',
                            div([ 'v', span(version, { 'data-run': 'about' } ) ])) ]))

    Recent.get(0, (err, recents) => {
      let count

      if (err) {
        Mess.log('Recent: ' + err.message)
        return
      }

      // add files to the recent list in the buf content
      count = 0
      rfs.innerHTML = ''
      append(rfs,
             divCl('bred-welcome-rf-h',
                   div('Recent files',
                       'bred-welcome-rf-h-link',
                       { 'data-run': 'open recent' })))
      recents.every(r => {
        //d(r)
        if (r.href.startsWith('file://')
            || r.href.startsWith('/')) {
          let loc

          count++
          loc = Loc.make(r.href)
          rfs.append(div(loc.filename,
                         { 'data-run': 'open link',
                           'data-runaux': 'open link in new tab',
                           'data-path': r.href }))
          return count < 10
        }
        return 1
      })

      // creating a view copies the buf content, so also add the files to contents of any open views
      Win.shared().welcome.buf.views.forEach(view => {
        if (view.ele) {
          let ele

          ele = view.ele.querySelector('.bred-welcome-recent-files')
          ele.innerHTML = ''
          append(ele,
                 [ ...rfs.children ].map(ch => ch.cloneNode(true)))
        }
      })
    })

    Recent.get(1, (err, recents) => {
      let count, lcount

      if (err) {
        Mess.log('Recent: ' + err.message)
        return
      }

      // add files to the recent list in the buf content
      count = 0
      lcount = 0
      rds.innerHTML = ''
      rls.innerHTML = ''
      append(rds, divCl('bred-welcome-rf-h', 'Recent dirs'))
      append(rls, divCl('bred-welcome-rf-h', 'Recent links'))
      recents.every(r => {
        0 && d(r)
        if (r.href.startsWith('file://')
            || r.href.startsWith('/')) {
          let loc

          count++
          loc = Loc.make(r.href)
          rds.append(div(Loc.cleanHref(loc.dirname),
                         { 'data-run': 'open link',
                           'data-runaux': 'open link in new tab',
                           'data-path': r.href }))
          return count < 10
        }
        if (r.href.startsWith('http')
                 || r.href.startsWith('https')) {
          lcount++
          rls.append(div(short(r.href),
                         { 'data-run': 'open link',
                           'data-runaux': 'open link in new tab',
                           'data-path': r.href }))
          return lcount < 10
        }
        return 1
      })

      // creating a view copies the buf content, so also add the dirs to contents of any open views
      Win.shared().welcome.buf.views.forEach(view => {
        if (view.ele) {
          let ele

          ele = view.ele.querySelector('.bred-welcome-recent-dirs')
          ele.innerHTML = ''
          append(ele,
                 [ ...rds.children ].map(ch => ch.cloneNode(true)))

          ele = view.ele.querySelector('.bred-welcome-recent-links')
          ele.innerHTML = ''
          append(ele,
                 [ ...rls.children ].map(ch => ch.cloneNode(true)))
        }
      })
    })

    return w
  }

  function addBuf
  () {
    let sh

    sh = Win.shared().welcome
    sh.buf = Buf.add('Welcome', 0, divW(), Loc.home())
    sh.buf.icon = 'welcome'
    sh.buf.addMode('view')
    return sh.buf
  }

  if (Win.root())
    Win.shared().welcome = {}

  Cmd.add('dark mode', () => {
    let buf

    buf = Win.shared().welcome.buf
    Opt.set('core.theme.mode', 'dark')
    if (buf)
      buf.views.forEach(view => {
        if (view.ele) {
          let buttonL, buttonD

          buttonL = view.ele.querySelector('.buttonLight')
          buttonD = buttonL.nextElementSibling
          Css.expand(buttonL)
          Css.retract(buttonD)
        }
      })
  })

  Cmd.add('light mode', () => {
    let buf

    buf = Win.shared().welcome.buf
    Opt.set('core.theme.mode', 'light')
    if (buf)
      buf.views.forEach(view => {
        if (view.ele) {
          let buttonL, buttonD

          buttonL = view.ele.querySelector('.buttonLight')
          buttonD = buttonL.nextElementSibling
          Css.retract(buttonL)
          Css.expand(buttonD)
        }
      })
  })

  Cmd.add('show welcome on start', () => {
    let buf

    buf = Win.shared().welcome.buf
    Opt.set('core.welcome.enabled', 1)
    if (buf)
      buf.views.forEach(view => {
        if (view.ele) {
          let buttonY, buttonN

          buttonY = view.ele.querySelector('.buttonY')
          buttonN = buttonY.nextElementSibling
          Css.remove(buttonN, 'on')
          Css.add(buttonY, 'on')
        }
      })
  })

  Cmd.add('hide welcome on start', () => {
    let buf

    buf = Win.shared().welcome.buf
    Opt.set('core.welcome.enabled', 0)
    if (buf)
      buf.views.forEach(view => {
        if (view.ele) {
          let buttonY, buttonN

          buttonY = view.ele.querySelector('.buttonY')
          buttonN = buttonY.nextElementSibling
          Css.remove(buttonY, 'on')
          Css.add(buttonN, 'on')
        }
      })
  })

  Cmd.add('welcome', () => {
    let p

    p = Pane.current()
    p.setBuf(Win.shared().welcome.buf || addBuf(p))
  })
}
