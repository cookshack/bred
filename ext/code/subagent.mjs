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

// The mark says what the lane is doing: a background lane is only *launched*
// when its call returns, so "running" is the truth until the child session ends.
function head
(sub) {
  return Util.subagentTitle(sub.desc || '', sub.agent || 'subagent') + ' ' + Util.subagentMark(sub.status)
}

// A lane that reported an error ends as one, not as a tick, and stays that way.
function endStatus
(sub) {
  return (sub.errored || (sub.status == 'error')) ? 'error' : 'done'
}

// Rewrite the call's Task line in the main transcript, so its mark follows the
// lane instead of staying at whatever it said when the call returned. It is
// updated in place: redrawing the call would move it to the end of the log.
function redrawCall
(buf, sub) {
  if (sub.callID)
    Ui.updateToolLabel(buf, sub.callID, Ui.subagentLaneLabel(sub))
}

// Set a lane's state, and redraw the two places it is shown: its tab head and
// the Task line it left in the main transcript.
function setStatus
(buf, sub, status) {
  if (sub.status == status)
    return
  sub.status = status
  sub.head = head(sub)
  Ui.updateOut(buf, sub.sessionID)
  redrawCall(buf, sub)
  repaint()
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
    // A live part names the call callID; a stored one only has id.
    sub.callID = part.callID || part.id
    // A background call returns as soon as the lane starts, so the call's
    // completion is not the lane's completion (see `ended`).
    sub.background = part.state?.input?.background ? 1 : sub.background
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
// already end with it, show the result there. For a background lane the call
// only launched it, so nothing is shown and the lane stays running.
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
  if (sub.background && (status == 'done')) {
    // The call means "started". A lane that was already idle when the call
    // returned is done; otherwise the child's own status says when it ends.
    sub.callDone = 1
    setStatus(buf, sub, sub.idle ? endStatus(sub) : 'running')
    return sub
  }
  setStatus(buf, sub, status)
  result = Util.subagentResult(part)
  if (result && ((sub.lastText || '').includes(result.trim()) == 0))
    Ui.appendMsg(buf, 0, result, 'result:' + sessionID, 0, { sessionID })
  return sub
}

// A background lane has ended when its child session has gone idle since the
// call returned. `session.status`'s idle comes from the execution ending, so a
// lane that is sitting on a permission or a question has not ended.
export
function ended
(sub) {
  // Idle is the end, for a background lane and a foreground one alike. Waiting
  // for the call's result as well leaves a lane that finished before (or
  // without) its result stuck as running for ever.
  return sub.idle ? 1 : 0
}

// End a lane that is known to have gone idle, e.g. a lane whose call message
// carries the idle flag but whose status event was missed.
export
function end
(buf, sessionID) {
  let sub

  sub = all(buf).get(sessionID)
  if (sub == null)
    return 0
  sub.idle = 1
  sub.busy = 0
  setStatus(buf, sub, endStatus(sub))
  return 1
}

// The child session's own status: the only end a background lane has. Returns 1
// when this status ended the lane, so the caller can stop routing its output.
export
function childStatus
(buf, sessionID, type) {
  let sub

  sub = all(buf).get(sessionID)
  if (sub == null)
    return 0
  if (type == 'busy')
    sub.busy = 1
  else if (type == 'idle') {
    sub.idle = 1
    sub.busy = 0
  }
  if (ended(sub) && ((sub.status == endStatus(sub)) == 0)) {
    setStatus(buf, sub, endStatus(sub))
    return 1
  }
  return 0
}

// A child reported an error, so the lane ends as one rather than as a tick. The
// child may have gone idle before the error arrived, hence the upgrade here.
export
function noteError
(buf, sessionID) {
  let sub

  sub = all(buf).get(sessionID)
  if (sub == null)
    return 0
  sub.errored = 1
  if (sub.status == 'done')
    setStatus(buf, sub, 'error')
  return 1
}
