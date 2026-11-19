// State for the subagents a code buffer has started, and the tabs their output
// goes to. The code buffer shows the main transcript or one subagent at a time;
// the Assist sidebar lists them and switches between them.

import * as Cmd from '../../js/cmd.mjs'

import * as Ui from './ui.mjs'
import * as Util from './util.mjs'

export
function all
(buf) {
  return buf.vars('code').subagents || (buf.vars('code').subagents = new Map())
}

function head
(sub) {
  return (sub.desc ? 'Task: ' + sub.desc : 'Task')
    + ' (' + (sub.agent || 'subagent') + ' agent)'
    + (sub.status == 'done' ? ' ✔️' : (sub.status == 'error' ? ' ✘' : ''))
}

// The sidebar repaints on focus and cursor moves, so nudge it when a subagent
// appears or finishes while the code buffer has focus.
export
function repaint
() {
  if (Cmd.get('update'))
    Cmd.run('update')
}

// Register the session a subagent call started. `part` is the tool part that
// started it, absent when the child's own output arrived first.
export
function ensure
(buf, sessionID, part) {
  let before, beforePrompt, created, sub, subs

  if ((sessionID == null) || (sessionID == ''))
    return
  subs = all(buf)
  sub = subs.get(sessionID)
  if (sub == null) {
    sub = { sessionID, status: 'running' }
    subs.set(sessionID, sub)
    created = 1
  }
  before = sub.head
  beforePrompt = sub.prompt
  if (part) {
    sub.agent = Util.subagentAgent(part)
    sub.desc = part.state?.input?.description || ''
    sub.prompt = Util.subagentPrompt(part) || sub.prompt
    sub.callID = part.callID
  }
  sub.head = head(sub)
  if (created || ((before == sub.head) == 0) || ((beforePrompt == sub.prompt) == 0)) {
    buf.views.forEach(view => Ui.addOut(view, sub))
    Ui.updateOut(buf, sessionID)
    repaint()
  }
  return sub
}

// The last text a child streamed, so its result is not shown twice: the stream
// already ends with the answer the tool call reports.
export
function noteText
(buf, sessionID, text) {
  let sub

  sub = (text == null) ? 0 : all(buf).get(sessionID)
  if (sub)
    sub.lastText = text
}

export
function noteDelta
(buf, sessionID, delta) {
  let sub

  sub = (delta == null) ? 0 : all(buf).get(sessionID)
  if (sub)
    sub.lastText = (sub.lastText || '') + delta
}

// A subagent call finished: mark the tab and, when the child's stream did not
// already end with it, show the result there.
export
function finish
(buf, part, status) {
  let result, sessionID, sub

  sessionID = Util.subagentChildId(part)
  if ((sessionID == null) || (sessionID == ''))
    // The completed part does not necessarily carry the child id again, so
    // fall back to the call that started it.
    all(buf).forEach(s => {
                       if (s.callID == part.callID)
                         sessionID = s.sessionID
                     })
  if ((sessionID == null) || (sessionID == ''))
    return
  sub = all(buf).get(sessionID)
  if (sub == null)
    return
  sub.status = status
  sub.head = head(sub)
  Ui.updateOut(buf, sessionID)
  repaint()
  result = Util.subagentResult(part)
  if (result && ((sub.lastText || '').includes(result.trim()) == 0))
    Ui.appendMsg(buf, 0, result, 'result:' + sessionID, 0, { sessionID })
}
