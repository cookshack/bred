// The run's clock. One source, in the tracked queue's `run` block, so a fresh
// session inherits the deadline instead of choosing its own.
//
// The 2026-11-25 11:51Z run set stopNew for 14:21Z, never read the clock
// again, and declared the stop reached at 12:28Z from the amount of work
// done. A prose rule did not survive that; a budget the tool can refuse does.
//
//   read(queue)                    -> clock | 0
//   budget(clock, now, lastRoundMs) -> { canStart, roundsLeft, ... }
//   why(budget)                    -> the refusal reason, or ''
//   format(budget)                 -> the multi-line clock
//   summary(budget)                -> one line for `status`
//   duration(ms)                   -> "38s", "9m05s", "4h45m"

function time
(value) {
  let t

  t = Date.parse(value || '')
  return Number.isNaN(t) ? 0 : t
}

export
function read
(queue) {
  let run, start, stopnew, deadline

  run = (queue && queue.run) || {}
  start = time(run.start)
  stopnew = time(run.stopNew ?? run.stopnew)
  deadline = time(run.deadline)
  if ((start == 0) || (stopnew == 0) || (deadline == 0))
    return 0
  return { start, stopnew, deadline, state: run.state || 'active' }
}

export
function budget
(clock, now, lastRoundMs) {
  let roundMs, left

  roundMs = (lastRoundMs > 0) ? lastRoundMs : 10 * 60000
  left = clock.stopnew - now
  return { clock,
           now,
           elapsedMs: now - clock.start,
           stopNewInMs: left,
           deadlineInMs: clock.deadline - now,
           roundMs,
           roundsLeft: (left > 0) ? Math.floor(left / roundMs) : 0,
           canStart: ((left > 0) && (clock.state == 'active')) ? 1 : 0 }
}

export
function why
(b) {
  if (b.clock.state == 'active') {
    if (b.stopNewInMs <= 0)
      return 'stopNew passed ' + duration(-b.stopNewInMs) + ' ago'
    return ''
  }
  return 'the run is ' + b.clock.state
}

function pad
(n) {
  return (n < 10 ? '0' : '') + n
}

export
function duration
(ms) {
  let h, m, s

  s = Math.round(Math.abs(ms) / 1000)
  if (s < 60)
    return s + 's'
  m = Math.floor(s / 60)
  if (m < 60)
    return m + 'm' + pad(s % 60) + 's'
  h = Math.floor(m / 60)
  return h + 'h' + pad(m % 60) + 'm'
}

function hhmm
(ms) {
  return new Date(ms).toISOString().slice(11, 16) + 'Z'
}

export
function format
(b) {
  let tail

  tail = (b.canStart == 0) ? '   (' + why(b) + ')' : ''
  return [ 'now        ' + hhmm(b.now) + '   start ' + hhmm(b.clock.start),
           'deadline   ' + hhmm(b.clock.deadline) + '   stopNew ' + hhmm(b.clock.stopnew),
           'elapsed    ' + duration(b.elapsedMs) + '   stopNew in ' + duration(b.stopNewInMs),
           'last round ' + duration(b.roundMs) + '   rounds that fit before stopNew: ' + b.roundsLeft,
           'can-start  ' + b.canStart + tail ].join('\n')
}

export
function summary
(b) {
  let tail

  tail = (b.canStart == 0) ? ', cannot start: ' + why(b) : ''
  return 'elapsed ' + duration(b.elapsedMs) + ' of ' + duration(b.clock.deadline - b.clock.start) +
         ', stopNew in ' + duration(b.stopNewInMs) + ', ~' + b.roundsLeft + ' rounds' + tail
}
