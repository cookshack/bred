# Plan — after the man pages: finding general problems in bred

Proposal, 2026-11-25. Written after the man loop's first 21 rounds on the new
`bin/loop.mjs` (rounds 18–38: 61 items done, section 1 from 147 words to 14,
main green at 1995 tests). It is the third plan beside `doc/Loop-upgrade.md` and
`doc/loop/plan-2026-11-24.md`; the loop's protocol is `doc/Loop.md`.

The question it answers: the man loop works because groff exists. Everywhere
else in bred there is no groff. What is the substitute, and how much of it can
be built?

## What the man loop actually relies on

There is no scout in it. Its supply comes from three places:

1. **An oracle.** `bin/man-diff` renders a page and compares it to `man -Tutf8`.
   A disagreement *is* the reproduction: a page, a line, the exact words lost.
   That is why every queue row already carries evidence and a proof that fails
   at base.
2. **A scoreboard.** 4,150 pages, per-section pages-short/words-short, measured
   at a named tip. It finds and ranks at once, so the loop always knows whether
   a round won.
3. **Lanes finding siblings.** p64's lane found p67, p57's found p68. Real, but
   incidental, and it dries up: the tail of this run is 34 `next` items and two
   `ready`.

Round 1's fuzz generator (two escape hangs) is the only generator that has ever
shipped. The "scout lane" in `plan-2026-11-24.md` is a proposal, not a thing that
runs.

## Coverage is the map, not the scout

The tempting substitute is test coverage: point the loop at the uncovered code.
It does not work, and the loop's own record says why.

- Coverage says where a test is missing, not where the code is wrong. A lane
  given "`js/point.mjs` line 40 is uncovered" has to invent a behaviour to
  assert. An invented assertion is a characterisation test: it describes what
  the code does today, so it **passes at base**, so the red gate parks it.
- That is not hypothetical. `96d70ec` moved p65 to `next` for exactly this:
  "p65 is coverage-only and would be parked by the red gate". A coverage-driven
  queue would build items the tool refuses to merge.
- Untested code is mostly *fine* code. The yield per item would be low, and the
  loop would look busy while no number moved.

Coverage has two real jobs, and they are the other ones:

- **Ranking.** An uncovered branch is where a generator is most likely to bite.
  Coverage is how you aim the oracles below, not a source of items.
- **An alarm.** Coverage must not fall. A round that adds code without a test
  lowers it; that is a number with a tip and a population, exactly like the word
  counts, and it belongs in the measurement.

## Three oracles that replace groff

All three produce a failure that exists at base, so all three fit the gate.

### 1. Laws and metamorphic relations — the general replacement

No reference implementation is needed when the expectation is derived from the
operation itself. These are the laws worth starting with, grouped by the module
they constrain. Each one is an *observable*: something a test can assert without
knowing what the code intends.

**Buf and Point** (`js/buf*.mjs`, `js/point.mjs`, `js/pos.mjs`)

- Insert text at an offset then delete the same range: text is identical, and
  the point is where it was.
- An edit wholly after the point does not move the point; wholly before it moves
  it by the inserted length; an edit spanning it clamps it inside the buffer.
- `Buf.shared()` is a set with an MRU order: no duplicated entry, no lost entry,
  and the most recently used is first, after any random sequence of open,
  switch and close.
- A buffer's dirty flag is true exactly when its content differs from what was
  last saved.

**Hist** (`js/hist.mjs`)

- N edits then N undos returns the exact text *and* the point; N redos returns
  the edited state.
- Undo, then a new edit, discards the redo stack (and nothing else).

**Find** (`js/wode-find.mjs`)

- Every match reported equals the buffer sliced at the offset it names. This
  needs no oracle at all, and a search that reports a range it cannot back with
  text is a real bug class.

**View, Pane, Frame, Area** (`js/view.mjs`, `js/pane.mjs`, `js/Pane.mjs`,
`js/frame.mjs`, `js/area.mjs`, `js/Area.mjs`)

- One `Buf` may have many `View`s; closing a view never destroys the buffer.
- A closed view never reports itself ready.
- Area widths sum to the frame width, before and after any split, close or
  resize; no pane has a negative size.
- After any scroll, split or close, the point is inside the visible window, and
  the focused pane exists.

**Em and Mode** (`js/em.mjs`, `js/Em.mjs`, `js/mode.mjs`, `js/cmd.mjs`)

- Resolution is deterministic: the same key sequence in the same state reaches
  the same command.
- A minor map shadows a mode binding; unbinding restores the parent's.
- A prefix key left pending is cleared by `C-g`, and the next key is then a
  fresh sequence.

**Save and load** (`js/save.mjs`, `js/main-file.mjs`, `js/wode*.mjs`)

- Write then read is byte-exact: no trailing newline, CRLF, BOM, latin-1, NUL
  inside, very long line.
- A failed write (read-only directory, vanished parent, full filesystem) leaves
  the previous file intact and reports why.

**The engine.** A deterministic generator over model operations plus a shrinker:
random sequences of operations, all laws checked after each step, and a failing
case minimised to the shortest sequence that still violates the same law. The
pattern already exists in `test/man-fuzz.mjs` — a small LCG, replay by seed, the
index is the name — so the shape is proven in this repo. The output of a hunt is

    seed 7f3a2c91
    ops: insert(0,"x") split() close() undo()
    law: closing a view never destroys the buffer
    expected: buf.shared() contains "*scratch*"; observed: it does not

which is a complete queue item: `proof: law`, `repro: <the block>`, and the
proof fails at base by construction. Load is bounded (`nproc-2`, `timeout`, a
stated number of sequences), because an unbounded hunt is how the container was
OOM-killed once already.

### 2. Differential against an external tool — where an oracle exists

The `man-diff` shape, with three ready-made oracles:

- **git**, for the VC layer (`js/vc*.mjs`, `bin/git-eq`, `test/git-eq.mjs`).
  Generate repositories — staged and unstaged mixes, renames, conflicts,
  detached heads, empty repos, submodules — and compare our parse with
  `git status --porcelain=v2` and `git log`. The parser and its test exist; only
  the generator is new. This is the closest thing to `man-diff` outside man.
- **patch and diff** (`bin/diff-cap`, `test/patch.mjs`, `js/wode-patch.mjs`,
  `js/patch.mjs`). Apply our patch with GNU `patch`, theirs with ours: a
  round-trip that does not reproduce the file is the bug.
- **the LSP server** (`js/lsp.mjs`, `js/main-lsp.mjs`). Compare our handling
  against the capabilities the server declares, and against a recorded session.

### 3. Bounds on pathological inputs — "succeed or refuse"

The man viewer's policy — render faithfully or refuse, never silently wrong — is
a product law that generalises to every operation in bred, and it needs no
oracle:

- **files**: 100 MB, one enormous line, no trailing newline, NUL bytes, invalid
  UTF-8, a symlink loop, a FIFO, a directory, mode 000, a file that changes
  while being read.
- **directories**: 100k entries, names with newlines, entries vanishing
  mid-listing, a path whose permissions change during a walk.
- **IPC**: a payload larger than the frame, a malformed message, a peer that
  dies mid-write, a stderr flood.
- **laws**: no crash, no hang past a stated timeout, no data loss, and a message
  that says what went wrong.

## The measure per area

The loop's discipline is one number that names its tip and population. Each area
needs its analogue, or a round cannot tell winning from churn:

| area | files | measure |
|------|-------|---------|
| man | `js/man-*.mjs`, `bin/man-diff` | corpus parsed/refused; section pages-short/words-short |
| core model | `js/buf*.mjs`, `point`, `hist`, `scroll`, `view`, `pane`, `area`, `em` | laws passing; minimised sequences found; coverage must not fall |
| vc, diff, lsp | `js/vc*`, `patch`, `lsp` | disagreements against the oracle; coverage alarm |
| file, dir, IPC | `js/main-file*`, `js/main-dir`, `js/tron` | hangs, crashes, peak RSS, time on the pathological set |
| UI | `js/wode*`, `ext/code`, `test/*e2e*` | replay failures, flake rate, startup and open-10MB time |

`npm run coverage` exists (c8 over `js/**` and `ext/**`) and nothing gates it
today. It becomes an alarm in the `measure` step, not a target.

## How it plugs into the loop

The mechanics barely change, which is the point:

- `proof:` gains `law`, `oracle` and `bounds`. The field is already a free
  string; the gate reads it as a command, so the kinds are documentation for the
  scheduler, not code.
- items gain `repro:` — a seed, an op list, a repo recipe or an input list — so
  a lane never re-derives the failure and a parked lane can be retried by
  anyone.
- two round types, alternating: **hunt** rounds (a bounded generator run, no
  merge; output is a batch of minimised items) and **fix** rounds (what the loop
  does now). A hunt is the scout lane with something real behind it.
- a third item type, `infra`, for building the harness itself. It has no red
  proof, so it needs a different gate: the shrinker is tested against a
  deliberately failing law, and the generator is shown to find that failure.
  That is how round 18's two harness bugs were found and fixed.
- `exclusive:` already protects `js/man-parse.mjs`; it now also protects
  `js/buf.mjs`, `js/view.mjs` and `js/em.mjs`, where two correct patches can
  disagree.

An item looks like this:

```json
{ "id": "g12", "lane": "a2", "status": "ready",
  "area": "core", "proof": "law",
  "title": "closing the last view of a buffer drops it from Buf.shared()",
  "files": [ "js/view.mjs", "js/pane.mjs", "test/law-view.mjs" ],
  "repro": "seed 7f3a2c91: insert(0,\"x\") split() close() undo(); law: closing a view never destroys the buffer" }
```

## Build order

1. **Laws harness for the pure model** (~1 day). Runner, LCG, op vocabulary,
   shrinker, and the Buf/Point/Hist/Find laws. No DOM, no oracle, and it starts
   producing items the day it lands. Acceptance: a deliberately broken law is
   found, shrunk to fewer than five operations, and replayed from its seed.
2. **Save/load byte-exactness** (half a day). Small, and an editor that drops a
   trailing newline is a bug nobody finds by hand.
3. **Coverage as ranking and alarm** (half a day). A per-area report to aim the
   generators, and a delta in `measure` so a round cannot quietly lower it.
4. **git differential** (~1 day). Repository generator plus `git status`/`log`
   comparison; closest to `man-diff`.
5. **Bounds fuzz for file, dir and IPC** (half a day). Mostly small findings,
   occasionally spectacular.
6. **UI replay monkey** (last). Electron plus a flake rate makes it the least
   reliable per hour; it needs the bounded-load rules and the flake quarantine
   first.

## Honest expectations

- **Fewer items per hour than man.** groff is an unusually dense oracle. The
  metamorphic laws are the exception: they can supply as much as the corpus did,
  but each item needs more judgement, because the law has to be right before the
  fix can be.
- **The first findings will be in the harness.** Round 18 found two bugs in the
  loop itself (`ext/*/lib` module identity, `spawnSync`'s 1 MB buffer) before it
  found a bug in bred. Budget for that and count it as success.
- **Do not chase coverage.** p65 is the precedent: a coverage-only item is
  parked by the gate. Coverage ranks and alarms; it does not file work.
- **A law that is wrong is worse than no law.** Two laws that contradict each
  other will produce churn and a parked lane every round. Each law cites the
  behaviour it protects, and a lane that disproves a law is doing its job — the
  law is then the item.
- **Bounded load is not optional.** The p50 hunt OOM-killed the container once.
  Every generator states its run count, its worker count and its timeout, and
  reports all three.

## The first dispatch

One `infra` round, three lanes, disjoint files:

| lane | owns | deliverable |
|------|------|-------------|
| a1 | `bin/law`, `test/law.mjs` | the runner: LCG, op vocabulary, shrinker, replay by seed |
| a2 | `test/law-buf.mjs`, `test/law-point.mjs` | the buffer and point laws, with a deliberately failing one to prove the shrinker |
| a3 | `test/law-hist.mjs`, `test/law-find.mjs` | undo/redo symmetry and the find-slice law |

Acceptance for the round: the runner finds the planted failure, shrinks it to
four operations, and replays it from the seed; the other laws pass at N
sequences; `npm run check` clean. Then the *next* round is a hunt: run the
generator wider, minimise what it finds, and stock the queue with `repro` items.

## What stays

Disjoint file sets, one proof per lane, red at base, the integration branch and
one fast-forward, park-never-reset, a measurement that names its tip and
population, and a human who owns the priorities. The pivot changes where
problems come from, not how they are merged.
