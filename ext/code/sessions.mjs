import { append, divCl } from '../../js/dom.mjs'
import * as Buf from '../../js/buf.mjs'
import * as Cmd from '../../js/cmd.mjs'
import * as Ed from '../../js/ed.mjs'
import * as Em from '../../js/em.mjs'
import * as Mess from '../../js/mess.mjs'
import * as Mode from '../../js/mode.mjs'
import * as Pane from '../../js/pane.mjs'
import * as View from '../../js/view.mjs'
import { d } from '../../js/mess.mjs'

import * as Comm from './comm.mjs'
import * as Prompt from './prompt.mjs'
import * as Ui from './ui.mjs'
import * as Util from './util.mjs'

export
function init
(events) {
  let mo

  function viewInit
  (view, spec, cb) { // (view)
    let w

    w = view.eleOrReserved.querySelector('.code-sessions-w')
    if (w) {

      w.innerHTML = ''
      Comm.ensureClient(view.buf).then(c => c.session.list().then(sessions => {
        d({ sessions })
        append(w,
               sessions.data.filter(s => s.directory == view.buf.dir).map(s => {
                 return [ divCl('code-sessions-del', '✗',
                                { 'data-run': 'delete session',
                                  'data-session-id': s.id,
                                  'data-session-dir': s.directory }),
                          divCl('code-sessions-id', (s.id || '').replace(/^ses_/, ''),
                                { 'data-run': 'open code session',
                                  'data-session-id': s.id,
                                  'data-session-dir': s.directory }),
                          divCl('code-sessions-title', (s.title || '').split('\n')[0]) ]
               }))
      }))
    }

    if (cb)
      cb(view)
  }

  function openCodeSession
  (u, we) {
    let sessionID, sessionDir

    async function open
    () {
      let c, pane, name, buf, provider, model, variant

      pane = Pane.current()
      name = 'CO ' + sessionDir

      buf = Buf.find(b => b.name == name)
      if (buf) {
        pane.setBuf(buf)
        return
      }

      provider = Util.getProvider()
      model = Util.getModel()
      variant = Util.getVariant()

      buf = Buf.add(name, 'code', Ui.divW(sessionDir), sessionDir)
      buf.vars('code').provider = provider
      buf.vars('code').model = model
      buf.vars('code').variant = variant
      buf.vars('code').sessionID = sessionID
      buf.opt('core.lint.enabled', 1)

      try {
        c = await Comm.ensureClient(buf)
      }
      catch (err) {
        Mess.yell('Failed: ' + err.message)
        return
      }

      pane.setBuf(buf, {}, () => {
        c.session.messages({ sessionID, directory: sessionDir }).then(r => {
          d({ r })
          for (let msg of (r.data || []))
            for (let part of (msg.parts || []))
              if (part.type == 'text')
                Ui.appendMsg(buf, msg.info.role == 'user' ? 'user' : 0, part.text, part.id)
              else if (part.type == 'reasoning' && part.text)
                Ui.appendThinking(buf, part.text, part.id)
              else if (part.type == 'tool') {
                let label

                label = part.tool
                if (part.tool == 'bash' && part.state?.input?.command)
                  label += ': ' + part.state.input.command
                else if (part.state?.input?.filePath)
                  label += ' ' + Util.makeRelative(buf, part.state.input.filePath)
                else if (part.state?.input?.pattern)
                  label += ' "' + part.state.input.pattern + '"'
                else if (part.state?.input?.query)
                  label += ': ' + part.state.input.query
                else if (part.state?.input?.url)
                  label += ' ' + part.state.input.url
                Ui.appendToolMsg(buf, part.callID, label,
                                 part.state?.output || part.state?.error)
              }
        })

        buf.vars('code').firstPromptSent = 1
        Prompt.nestBuf(buf)
        Event.startSub(buf, events)
      })
    }

    sessionID = we.e.target.dataset.sessionId
    sessionDir = we.e.target.dataset.sessionDir

    open()
  }

  function deleteSession
  (u, we) {
    let sessionID, sessionDir

    sessionID = we.e.target.dataset.sessionId
    sessionDir = we.e.target.dataset.sessionDir

    Prompt.yn('Delete session ' + sessionID.replace(/^sess_/, '') + '?',
              { icon: 'trash' },
              yes => {
                if (yes)
                  Comm.ensureClient(View.current().buf)
                    .then(c => c.session.delete({ sessionID, directory: sessionDir }))
                    .then(() => {
                      View.current().buf.views.forEach(view => {
                        let w, el

                        w = view.eleOrReserved?.querySelector('.code-sessions-w')
                        el = w?.querySelector('[data-session-id="' + sessionID + '"]')
                        if (el) {
                          let i

                          i = [ ...w.children ].indexOf(el)
                          w.children[i + 2]?.remove()
                          w.children[i + 1]?.remove()
                          w.children[i].remove()
                        }
                      })
                    })
              })
  }

  mo = Mode.add('Code Sessions', { viewInit })

  Cmd.add('refresh', () => viewInit(View.current()), mo)

  Cmd.add('code sessions', () => {
    let p, name, buf

    p = Pane.current()
    name = 'Code Sessions: ' + p.dir
    buf = Buf.find(b => b.name == name)
    if (buf)
      p.setBuf(buf, {}, view => viewInit(view))
    else {
      buf = Buf.add(name, 'Code Sessions',
                    divCl('code-sessions-ww',
                          [ divCl('code-sessions-h',
                                  Ed.divMl(p.dir, 'Code Sessions',
                                           { icon: 'list' })),
                            divCl('code-sessions-w bred-surface', '') ]),
                    p.dir)
      buf.icon = 'list'
      buf.addMode('view')
      p.setBuf(buf)
    }
  })

  Cmd.add('open code session', openCodeSession, mo)

  Cmd.add('delete session', deleteSession, mo)

  Em.on('g', 'refresh', mo)
}
