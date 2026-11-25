#!/usr/bin/env node

// A laws harness: a deterministic generator over operations, invariants checked
// after every step, and a shrinker that reduces a failure to the shortest
// sequence that still violates the same law.
//
//   see bin/law-hunt.mjs for the command line
//
// A suite module exports:
//
//   make()            -> a fresh model
//   ops: [ { name, args(rnd), run(model, args) } ]
//   laws: [ { name, check(model) } ]      // 0 when it holds, a string when not
//
// A failure is a queue item: the seed, the op trail, the law, and what was
// observed. `repro` in the item is that block, so a lane never re-derives it.
//
// Bounded by construction: the caller states seeds and steps, the run is
// single-threaded, and the shrinker only replays recorded trails. That is the
// p50 lesson: a generator that states nothing about its load is an outage.

// The LCG from test/man-fuzz.mjs, so a seed means the same kind of thing in
// both harnesses.
export
function lcg
(seed) {
  let state

  function next
  () {
    state = ((state * 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }

  state = seed >>> 0
  return next
}

function pick
(rnd, items) {
  return items[ Math.floor(rnd() * items.length) ]
}

function checkAll
(laws, model) {
  let i

  i = 0

  while (i < laws.length) {
    let detail

    detail = laws[ i ].check(model)
    if (detail)
      return { law: laws[ i ].name, detail }
    i += 1
  }

  return 0
}

// An operation that throws is a finding, not a crash: the harness has to
// survive its own generator, or one precondition violation ends the hunt.
function runStep
(suite, model, step) {
  let op

  op = suite.ops.find(o => o.name == step.name)
  if (op == undefined)
    return { ok: 0, err: 'no operation named ' + step.name }
  try {
    op.run(model, step.args)
    return { ok: 1 }
  }
  catch (e) {
    return { ok: 0, err: e.message }
  }
}

function replay
(suite, trail) {
  let model

  model = suite.make()

  for (let i = 0; i < trail.length; i += 1)
    runStep(suite, model, trail[ i ])

  return model
}

// Remove one step at a time while the *same* law still fails. The first
// failure is the item; a different law after a removal is a different bug, not
// a smaller version of this one.
export
function shrink
(suite, trail, law) {
  let current, changed

  current = trail
  changed = 1

  while (changed) {
    changed = 0

    for (let i = 0; i < current.length;) {
      let attempt, model, found

      attempt = current.slice(0, i).concat(current.slice(i + 1))
      model = replay(suite, attempt)
      found = checkAll(suite.laws, model)
      if (found && (found.law == law)) {
        current = attempt
        changed = 1
      }
      else
        i += 1
    }
  }

  return current
}

export
function hunt
(suite, opts) {
  let seed, steps, rnd, model, trail, i

  seed = opts.seed == undefined ? 1 : opts.seed
  steps = opts.steps == undefined ? 40 : opts.steps

  rnd = lcg(seed)
  model = suite.make()
  trail = []
  i = 0

  while (i < steps) {
    let op, args, found, step, ran

    op = pick(rnd, suite.ops)
    args = op.args(rnd)
    step = { name: op.name, args }
    trail.push(step)
    ran = runStep(suite, model, step)
    if (ran.ok == 0)
      return { ok: 0, seed, steps, law: 'operation threw', detail: ran.err, trail, shrunk: trail }
    found = checkAll(suite.laws, model)
    if (found)
      return { ok: 0, seed, steps, law: found.law, detail: found.detail, trail, shrunk: shrink(suite, trail, found.law) }
    i += 1
  }

  return { ok: 1, seed, steps }
}

export
function box
(failure) {
  let lines, i

  lines = [ 'repro: seed ' + failure.seed ]
  lines.push('law: ' + failure.law)
  lines.push('detail: ' + failure.detail)
  i = 0

  while (i < failure.shrunk.length) {
    let step, args

    step = failure.shrunk[ i ]
    args = JSON.stringify(step.args).slice(1, -1)
    lines.push('  ' + step.name + '(' + args + ')')
    i += 1
  }

  return lines.join('\n')
}
