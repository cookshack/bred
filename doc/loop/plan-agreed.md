# The agreed plan — generalising the loop past the manual pages

Agreed, 2026-11-25, by the scheduler (author of `doc/Loop-general.md`) and the
reviewer (author of `doc/loop/plan-general.md`), in one exchange
(`A101.md`). This file supersedes both proposals; what was dropped, and why, is
at the end, so neither is lost.

Status: agreed, nothing implemented except where this file names a commit.

## The kernel

Strip the man-specific words and every round has five parts. This is what
repeats, and what an area must plug into.

1. **An oracle** that can say "the reference does X and we do Y" without a
   human. For man pages it is `man -Tutf8`; for another area it has to be named,
   and the section below says what has been found so far.
2. **A measure** over a population, cheap enough to run every merge: one number
   (or a few) plus the population it was measured on.
3. **Pins**: a small test that fails for the specific defect an item fixes, so
   "red at base" is executable and a fixed case cannot silently regress.
4. **Ownership by file set**, so lanes never edit the same file. "One parser
   item per round" is the instance: a central file is `exclusive`.
5. **A gate**: rebase → files → proof red at base → proof green → integrate →
   suite at the tip → record → one fast-forward. This is `bin/loop.mjs
   round`/`land` and it does not change per area.

Everything else — the queue, claims, WIP snapshots, history, the record, the
moving-main rules — is domain-free and stays.

## Five things an area supplies

An *area* is a named module set plus a queue namespace. It is a column, not a
separate loop: one queue, one gate, one record per round.

| part | man (today) | `ext/code` (next) | editor core | rendering | tooling |
|---|---|---|---|---|---|
| oracle | `man -Tutf8` | a recorded v2 event stream → legacy events | laws, + git/patch where they exist | structural DOM goldens | the protocol's own invariants |
| measure | `man-diff` pages/words, `man-audit` parsed/refused | translated / dropped / wrong-shape | laws passing; coverage floor; flake rate | golden mismatches | `test/loop*.mjs` + a real round |
| pins | page tests in `test/man-diff.mjs` | golden legacy-event arrays | the minimised `repro` sequence | a golden per page/state | a planted-failure test |
| exclusive | `js/man-parse.mjs` | `ext/code/event.mjs`, then `code.mjs` | `js/Buf.mjs`, `js/buf.mjs`, `js/view.mjs`, `js/Em.mjs` | shared `*.css` | `bin/loop.mjs`, `bin/loop-merge.mjs` |
| done | zero lost words, no new refusals | every documented event translated | laws hold at N sequences | delta zero or below tolerance | the round runs |

The real paths matter: `js/Buf.mjs` **and** `js/buf.mjs` both exist and are
different files, and there is no `js/View.mjs` — the exclusive list has to name
paths the files gate will see, or it protects nothing.

## Supply: three kinds of oracle

### 1. Laws and metamorphic relations — the general replacement

No reference implementation is needed when the expectation is derived from the
operation itself. These are the first laws, by module:

- **Buf and Point** (`js/buf*.mjs`, `js/point.mjs`, `js/pos.mjs`): insert then
  delete the same range restores text and point; an edit after the point does
  not move it, before it moves it by the length, spanning it clamps inside the
  buffer; `Buf.shared()` is a set with an MRU order (no duplicate, no loss,
  most-recent first) after any sequence of open/switch/close; the dirty flag is
  true exactly when the content differs from the saved content.
- **Hist** (`js/hist.mjs`): N edits then N undos returns the exact text and
  point; N redos returns the edited state; a new edit after an undo discards the
  redo stack and nothing else.
- **Find** (`js/wode-find.mjs`): every match reported equals the buffer sliced
  at the offset it names. No oracle at all, and a range that cannot be backed
  with text is a real bug class.
- **View, Pane, Frame, Area** (`js/view.mjs`, `js/pane.mjs`, `js/Pane.mjs`,
  `js/frame.mjs`, `js/area.mjs`, `js/Area.mjs`): one `Buf` may have many
  `View`s and closing a view never destroys the buffer; a closed view never
  reports ready; area widths sum to the frame before and after any split, close
  or resize; after any scroll or close the point is inside the visible window
  and the focused pane exists.
- **Em and Mode** (`js/em.mjs`, `js/Em.mjs`, `js/mode.mjs`, `js/cmd.mjs`):
  resolution is deterministic; a minor map shadows a mode binding and unbinding
  restores the parent's; a pending prefix is cleared by `C-g`.
- **Save and load** (`js/save.mjs`, `js/main-file.mjs`): write then read is
  byte-exact for no-trailing-newline, CRLF, BOM, latin-1, NUL inside and very
  long lines; a failed write leaves the previous file intact and says why.

**The engine.** A deterministic generator over model operations plus a shrinker,
following `test/man-fuzz.mjs` (small LCG, replay by seed, the index is the
name). A failing case is minimised to the shortest sequence that violates the
same law, and the item carries:

    repro: seed 7f3a2c91 — insert(0,"x") split() close() undo()
    law: closing a view never destroys the buffer
    expected: buf.shared() contains "*scratch*"; observed: it does not

**Kill criterion.** The spike is one day. If its first bounded hunt does not
yield three minimised failures that survive triage, laws are dropped and the
core falls back to the coverage and flake measure below. A lane that *disproves*
a law files the law as the item, so a false law costs one round and leaves a
record rather than churn.

### 2. Differential against an external tool — where one exists

The `man-diff` shape, with three ready-made oracles:

- **git** for the VC layer (`js/vc*.mjs`, `bin/git-eq`, `test/git-eq.mjs`):
  generate repositories — staged/unstaged mixes, renames, conflicts, detached
  heads, empty repos — and compare our parse with `git status --porcelain=v2`
  and `git log`. The parser and its test exist; only the generator is new.
- **patch and diff** (`bin/diff-cap`, `test/patch.mjs`, `js/wode-patch.mjs`):
  apply our patch with GNU `patch` and theirs with ours; a round-trip that does
  not reproduce the file is the bug.
- **the LSP server** (`js/lsp.mjs`, `js/main-lsp.mjs`): compare our handling
  against the capabilities the server declares and against a recorded session.
- **the opencode client** (`ext/code`): the vendored v2 client, with a recorded
  event stream as the input and the legacy event array as the expected output.
  There is no recorded stream today — `test/fake-oc.mjs` is a fixture server —
  so P2 starts with a small recorder (`event.subscribe()` over a scripted
  session, JSONL out). Budget half a day and treat it as `infra`.

### 3. Bounds on pathological inputs — "succeed or refuse"

The man viewer's policy — render faithfully or refuse, never silently wrong — is
a product law that generalises to every operation, and needs no oracle:

- **files**: 100 MB, one enormous line, no trailing newline, NUL, invalid
  UTF-8, symlink loop, FIFO, directory, mode 000, a file that changes while
  being read.
- **directories**: 100k entries, names with newlines, entries vanishing
  mid-listing, a path whose permissions change during a walk.
- **IPC**: a payload larger than the frame, a malformed message, a peer dying
  mid-write, a stderr flood.
- **laws**: no crash, no hang past a stated timeout, no data loss, and a message
  that says what went wrong.

### Why coverage is not a scout

Coverage says where a test is missing, not where the code is wrong. A test
invented for an uncovered line describes what the code does today, so it passes
at base, so the red gate parks it. That is not hypothetical: `96d70ec` moved p65
to `next` for exactly this reason. A coverage-to-queue pipeline builds a queue
the tool refuses to merge. Coverage has two jobs: **ranking** (where to aim a
generator) and **alarming** (it must not fall).

## Measures

One number that names its tip and population, cheap enough to run every merge,
and *audited before it is trusted*: break the product deliberately, confirm the
measure moves, fix a known case, confirm it moves back. Three rounds were spent
on `man-diff` bugs that looked like parser bugs, which is the argument for the
audit, not against the measure.

| area | measure | population |
|---|---|---|
| man | parsed/refused; section pages-short/words-short | the installed corpus, at the tip |
| `ext/code` | translated / dropped / wrong-shape | the recorded event stream + fixtures |
| editor core | laws passing; coverage line/branch; flake rate | N sequences; `js/**`; N runs under load |
| vc, diff, lsp | disagreements against the oracle | the generated repository/input set |
| file, dir, IPC | hangs, crashes, peak RSS, time | the pathological input list |
| rendering | golden mismatches; pixel delta for a short list | the page/state set |

**The coverage floor, executable.** `measure` records line and branch coverage
per area in `doc/loop/history.jsonl`; a drop against the area's previous record
is reported as a problem the round record must quote; `land` refuses while it is
unexplained. No item may be filed with a coverage gap as its only evidence.

## The queue: types, provenance, reproduction

Add to each item:

- `type`: `fix | triage | verify | measure | hunt | infra`.
  `measure` runs the tools and updates history (it merges nothing). `hunt` is a
  bounded generator run whose deliverable is queue rows. `infra` builds a
  harness, and it passes the *normal* gate when its proof is the harness's own
  acceptance test — a test that the shrinker finds a planted failure, which
  fails at base because the harness does not exist.
- `source`: `measure | lane | triage | hunt`. The run just finished cannot say
  which of its 61 items came from where, because the queue does not carry it.
  The next twenty rounds should be able to answer that.
- `repro`: a seed/op list/recipe string, so a lane never re-derives a failure.
- `area` and `exclusive` as above; `proof` already exists and stays a command.

`hunt` and `infra` are scheduled deliberately, never `pick`ed, so they cannot
crowd out fixes. One queue, one gate, one record per round.

**The dirty-doc rule.** The aggregate docs (`doc/Loop.md`, `doc/Man.md`,
`doc/Loop-queue.md`) are staged in the round's record commit, and `land` runs
`git status --porcelain -- doc/` and refuses a dirty doc tree. Rounds 22–38
accumulated seventeen rounds of summary edits that no commit carried; the rule
is a check, not a reminder.

## Order

| # | step | size | owner | proves |
|---|------|------|-------|--------|
| P0 | schema: `area`, `type`, `source`, `proof`, `exclusive`, `repro`; `Queue.report` gains an area column; `check` validates the fields | 0.5 d | scheduler | the existing queue still passes `check` |
| P1 | measure as an interface: a per-area `measures` block in `queue.json` (command, budget, population), `loop measure --area`, `area` on history records | 0.5–1 d | scheduler | the man numbers reproduce exactly through the new path |
| P2 | `ext/code`: the recorder (`infra`), the translation measure, the first golden pins, the AGENTS.md known issues queued | 2–3 d | scheduler | deliberately breaking a translation moves the measure |
| P3 | laws spike: runner, LCG, shrinker; suites for `Loc.make` and `computeRefine`; one bounded hunt | 1 d | reviewer | three minimised failures survive triage, or the spike is killed |
| P4 | editor core: laws if P3 survives, otherwise coverage + flake rate | 2 d | both | a planted core bug is found and pinned |
| P5 | rendering: structural goldens first, pixels for a short list | 2 d | reviewer | done: `787961e` |
| P6 | cadence: `measure --area all`, each area within its budget | 0.5 d | reviewer | done: `b2f0623` |
| P6 | scheduling: lane pool, area-aware picks | parked | — | two areas producing items in one round |

**Results, P0–P6, 2026-11-25.** P0/P1 (`993e104`, `a3a0155`), P2
(`f6ff0e7`, `bd4acc9`), P3 (`44b3726`, killed as the core's measure; the harness
stays), P4 (`c8d7f21`, first record `0d90bfc`: 75.6% lines and 88.7% branches
over eighteen modules, six flake runs at four workers with no failures), P5
(`787961e`, three structural goldens and a planted-class test), P6's cadence
(`b2f0623`). Every phase is closed except P6's *scheduling* half — a lane pool
and area-aware picks — which stays parked: one runner and two lanes per round
have been enough, which is the plan's own criterion for not building it.

P3's result (`44b3726`): the first hunt found nothing, so the criterion killed
laws **as the core's measure**; the core takes coverage and flake rate at P4.
The harness itself stays on main (`bin/law.mjs`, `bin/law-hunt.mjs`) as a
debugging tool with a planted-failure test, because a generator that can shrink
a failure is worth 300 lines even when its first target is clean. No second hunt
was run: a different target is a new experiment, not a re-roll.

P2 and P3 are disjoint and run in the same three-lane round, which is also the
cross-area acceptance test. P0/P1 must precede it: `ext/code` needs the `area`
column and a measure entry; the laws spike needs neither.

## The first two rounds

**Round A — P0/P1, one or two lanes.** Schema fields and the `measures` block;
`measure --area man` reproducing `1:16p/147w …` exactly; `check` validating the
new fields; `land` refusing a dirty `doc/`.

**Round B — three lanes**, a1 `ext/code` (recorder + first measure + one golden
pin), a2 laws (runner + shrinker + four law files + one hunt), a3 one man item
from the measured residual (`p103`–`p115` all have pinned page tests). If the
spike fails its kill criterion, a2 becomes a core coverage/flake lane next
round and `ext/code` continues.

## The infra backlog, from the run's own surprises

These were found by doing, not by planning, and they are the first `infra` items:

1. `spawnSync` maxBuffer: ENOBUFS killed a suite after ~1,500 tests and was
   reported as a failure. Test: a suite printing >1 MB is not "failed".
2. `ext/*/lib` symlinked into a worktree loads a second CodeMirror. Test: a
   provisioned worktree resolves one instance.
3. A worktree registration invisible from another namespace must never be
   pruned; `status` must not invite it.
4. Lane worktrees lacked `node_modules`/`lib`; `lanes-up` provisioning test.
5. `--hot` skipped everything before any trailer existed; test the transition.
6. `land` compared nothing before the fix; test a stale `Loop-verify:` tip.
7. p50's OOM: every generator states runs, workers and timeout, and is tested.
8. Mocha without `--exit` hung after 158 passing; the narrow-test timeout is
   tested.
9. `claim` recorded the CLI's pid; the lease TTL has a test.
10. `measure` measured the canonical tree; test that the tip's tools are used.

## Acceptance, per area

An area is adopted when all five hold: its measure runs at a tip in a worktree
within its budget and stamps its population; a deliberately broken commit moves
the measure and the gate catches it; a known fixed defect is pinned and stays
zero; two lanes from two areas ran in one round without a shared file; and
`loop status` names the area's last measurement and open items.

## What was dropped, and why

- **Pixel diffing as a primary measure** (my proposal): noisy across font and
  Chromium versions. Structural DOM goldens first; pixels for a short list only.
- **"Coverage + flake rate supply the editor core"** (the scheduler's): they
  measure, they do not supply. Replaced by the laws spike with a kill criterion;
  coverage and flake rate remain the measure if laws fail.
- **A separate queue or loop per area** (neither proposal, but worth refusing):
  areas are columns in one queue, and one record per round.
- **`js/View.mjs`** (the scheduler's exclusive list): the file does not exist.
- **The unbacked "scout lane"** (my earlier plan): replaced by `hunt` rounds,
  which are the same idea with a generator behind them.
- **"Port `round.sh` verbatim before improving it"** (both earlier plans, and
  already dead): the run was stopped, so the tool was written once.

## Risks

- **More measures, more wrong numbers.** Audit each against a known case before
  trusting it.
- **A wrong law is worse than no law.** It churns a round and parks a lane;
  hence the kill criterion, and the rule that a disproved law becomes the item.
- **Golden rot.** A golden names the tool version and conditions that produced
  it, like a measurement's population.
- **Flake load.** Bounded, timeout-capped, run count reported; p50's OOM is the
  precedent.
- **Fewer items per hour than man.** groff is an unusually dense oracle; the
  first findings will be in the harness, and that is success.

## What stays

Disjoint file sets, one proof per lane, red at base, the integration branch and
one fast-forward, park-never-reset, a measurement that names its tip and
population, and a human who owns the priorities. The pivot changes where
problems come from, not how they are merged.

## For Matt

- The pivot point is now: of 37 open man items, ~14 have no red-capable proof
  and the measured residue is **10 pages / 17 words** at round 40 (1:7p/9w,
  7:1p/5w, 8:2p/3w) with pinned tests — one or two rounds of measurement, and
  two or three of decisions for the tail. The figures here were 13/28 when the
  plan was drafted; the area moved while it was being agreed, which is the
  reason a measure names its tip.
- Rounds 25–38 ran one lane because every ready item touched
  `js/man-parse.mjs`, not by choice; a three-lane round costs ~35 min against
  ~28 for one, so lanes are cheap and items are the bottleneck.
- The first real decision is whether P2's recorder and P3's spike can run
  alongside the man tail, or whether you would rather the man area finish
  first. Both are one round's worth of work to find out.
