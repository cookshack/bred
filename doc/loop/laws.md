# The laws harness

`bin/law.mjs` is the runner; `bin/law-hunt.mjs` is its command line. The point
is supply without an oracle: a *law* is an expectation derived from the
operation, so a violation fails at base and is a queue item like any other.

## A suite

A suite module exports three things:

```js
export { suite }

suite = { make: function () { return { p: '/a' } },
          ops: [ { name: 'join', args: rnd => [ 'x' ], run: (m, args) => { ... } } ],
          laws: [ { name: 'a dirname ends with a slash', check: m => 0 } ] }
```

- `make()` returns a fresh model.
- `ops` are operations. `args(rnd)` picks arguments from the LCG; `run(model,
  args)` mutates the model. An operation that throws is a finding, not a crash.
- `laws` are invariants. `check(model)` returns `0` when it holds and a string
  describing what it saw when it does not.

## Running one

    bin/law-hunt.mjs hunt test/law-loc.mjs --seeds 150 --steps 60

A finding prints as a queue item:

    repro: seed 42
    law: a dirname ends with a slash
    detail: dirname a of /a
      join(a)

`seed` alone is enough to replay the run; the shrunk trail is the shortest
sequence that still violates *the same* law (a different law after a removal is
a different bug). State seeds and steps whenever a hunt is run: an unbounded
generator is how the container was OOM-killed once already.

## Writing a law

A law has to be right before a fix can be. Test it against a deliberately
broken model first (`test/law.mjs` plants one and requires the runner to find,
shrink and replay it); if a lane disproves a law, the law is the item, not the
code. A law that encodes a misunderstanding churns a round and parks a lane.

Operations carry their own preconditions. `Loc.make(p).parent()` tosses on an
empty path; that is the operation's contract, so the generator skips it rather
than filing the toss as a bug. The first hunt found exactly that and the op was
fixed, not the product.

## The first hunt

Two suites, `test/law-loc.mjs` (four laws on the path contract: dirname ends in
a slash, dirname + filename is the path, both slash helpers idempotent) and
`test/law-refine.mjs` (two laws on `computeRefine`'s spans: every span is inside
its line, a change is not empty and a no-op is), over 150 seeds × 60 steps each,
**found nothing**. The mechanism is proven — the planted failure is found,
shrunk to two operations and replayed from its seed — but the yield on these two
modules is zero.

That is the plan's kill criterion as written: *if the first hunt does not yield
three minimised failures that survive triage, laws are dropped and the editor
core falls back to coverage and flake rate.* Two honest readings, for the next
round to settle:

1. **Kill it.** The mechanism works, the targets are covered by hand-written
   tests already, and a harness that finds nothing is a cost. Coverage plus
   flake rate for the core, as the plan says.
2. **Aim it once more.** Two modules, six laws, and neither has changed much.
   A second target with more churn and less test coverage — `main-dir` and
   `main-file` path handling, `wode-find`'s reported ranges, `diff-cap` — is a
   different experiment from this one.

The harness is small enough that keeping it costs little either way, but the
plan's criterion says kill, and a criterion that is ignored when it is
inconvenient is not a criterion.
