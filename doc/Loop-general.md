# Generalizing the loop beyond man pages

Status: proposal, 2026-11-25, written while a lane was running. The loop has
done 21 rounds on one area (installed manual pages) and the mechanical half is
now a tracked tool (`bin/loop.mjs`). This file is about turning that into a
technique for the rest of Bred, and about what does **not** generalize.

## The kernel (what actually repeats)

Strip the man-specific words and every round has the same five parts:

1. **An oracle** that can say "the reference does X and we do Y" without a
   human. For man pages it is `man -Tutf8`; for anything else it has to be
   named.
2. **A measure** over a population, cheap enough to run every merge: one
   number (or a few) plus the population it was measured on. `man-diff`'s
   pages/words and `man-audit`'s parsed/refused are the existing instance.
3. **Pins**: a small test that fails for the specific defect the item fixes,
   so "red at base" is executable and a fixed page cannot silently regress.
4. **Ownership by file set**, so lanes never edit the same file. The
   "one parser item per round" rule is just an instance: a central file is
   exclusive.
5. **A gate**: rebase → files → proof red at base → proof green → integrate →
   suite at the tip → record → one fast-forward. This is already
   `bin/loop.mjs round/land` and does not change per area.

Everything else — the queue schema, claims, WIP snapshots, history, the
record, the moving-main rules — is domain-free and stays.

## The five things an area must supply

An *area* is a named module plus a queue namespace. It supplies:

| part | man (today) | `ext/code` (next) | editor core | rendering |
|---|---|---|---|---|
| oracle | `man -Tutf8` | the opencode CLI/SDK and its event stream | the public API's documented behaviour + the test suite | Chromium's rendered result |
| measure | `man-diff` (pages/words) + `man-audit` (parsed/refused) | unmatched translations, ordering errors, dropped events | suite + coverage + flake rate | structural/pixel delta per page |
| pins | page tests in `test/man-diff.mjs` | golden event transcripts in `test/code-*.mjs` | failing unit/e2e tests | golden DOM/screenshot |
| exclusive | `js/man-parse.mjs` | `ext/code/code.mjs`, `comm.mjs` | `js/Buf.mjs`, `js/View.mjs` | shared `*.css` |
| done | zero lost words, no new refusals | every documented event translated | coverage threshold + flake rate | delta below tolerance |

The schema needs only: `area`, `type` (`fix`/`triage`/`verify`/`measure`),
`proof`, `exclusive`. `files` is already there.

## Candidate areas, in order

### 1. `ext/code` — the opencode UI (best second area)

- **Oracle**: the opencode v2 client is vendored under
  `ext/code/lib/opencode/`, and the CLI can produce real event streams. The
  event translation in `ext/code/event.mjs` is a pure function from v2 events
  to legacy events: a recorded v2 transcript is a deterministic input, and the
  expected legacy events are the output.
- **Measure**: for each recorded/vendored event, `translated | unchanged |
  dropped | wrong-shape`; plus the existing `test/code-*.mjs` results. A
  population of transcripts (fake-oc fixtures + one recorded real session).
- **Pins**: a golden legacy-event array per v2 event in `test/code-events.mjs`.
- **First items**: the known-issues list in `ext/code/AGENTS.md`
  (reconnect live-only streams, per-buffer subscription, permission/form
  replies, subagent routing). Each has a red-test shape already.
- **Exclusive**: `ext/code/event.mjs` (one translator), then `code.mjs`.

### 2. Editor core (`js/Buf`, `View`, `Pane`, `Em`, …)

- **Oracle**: there is no external reference; the oracle is the documented
  behaviour in `doc/*.md` plus the suite. So the *measure* is not a diff, it is
  **coverage + flake rate + the suite**, and items still use red tests.
- **Measure**: `c8` lines/branches for the core modules, `npx mocha --exit`
  pass count, and an N-run flake rate for the timing-sensitive e2e files under
  load. (Round 10's `indent` flake and p50 are the precedent: flake rate is a
  number, and load is the microscope.)
- **Pins**: ordinary tests; an item with no failing test is `triage`, not
  `fix`.
- **First items**: `doc/Man.md`'s known-gap 3 (readability) is closed; the
  next are the flake triage items and the core's DEAD/TODO notes. This area is
  where "one measurement per round" becomes "one flake run per cadence".

### 3. Rendering (man viewer, CSS)

- **Oracle**: the container has Chromium and `$HOME/tools/render.mjs`. A page's
  DOM can be captured structurally (block tree + span classes) and compared
  with a golden, or screenshotted and diffed.
- **Measure**: golden mismatches per page, and pixel delta for a small set.
  This is the honest way to test "a heading does not read as bold link text".
- **Pins**: a golden file per page/state; the render helper already exists.
- **Caveat**: pixel diffs are noisy across font/Chromium versions; prefer the
  structural block/class tree, and keep pixels for a short list.

### 4. Tooling (`bin/*`, `test/loop*.mjs`)

- The loop itself is now a Bred area: oracle = the protocol's invariants,
  measure = the tool's own tests plus a real round, pins = `test/loop*.mjs`.
  This is where the last two rounds' ENOBUFS/symlink bugs would have been
  items rather than surprises.

## What does not generalize

- **The word diff is not a template for UI work.** A missing word is a
  content defect with an external reference; a misplaced pixel is not. Do not
  invent a "pixel word count" and then tune it until it is zero.
- **A measure can be wrong.** Three rounds were spent on `man-diff` bugs that
  looked like parser bugs. Every new area needs a *measure-the-measure* audit
  before its numbers are trusted: deliberately break the product and confirm
  the measure moves; fix a known case and confirm it moves back.
- **Coverage is gameable.** For editor core, coverage is a floor, not a
  target; the item's proof is still a failing test.
- **Judgement stays.** The queue, briefs, diagnoses and the record are the
  agent's; only the gate and the numbers move into the tool.

## Phases

0. **Schema now** (half a day): add `area`, `type`, `proof`, `exclusive` to
   `queue.json`; `loop pick --area`; the generated table gets an area column.
   No behaviour change; the man queue is area `man`.
1. **Extract the measure** (half a day): move the `man-audit`/`man-diff`
   invocation behind `loop measure --area man`, so `measure` is an interface,
   not a script. `history.jsonl` records get `area`.
2. **`ext/code` as the second area** (2–3 days): record one v2 event stream,
   write the translation measure and the first golden pins, queue the AGENTS.md
   known issues, run two lanes (code + man) in one round to prove disjointness
   across areas.
3. **A measurement cadence per area** (1 day): `loop measure --area all` with
   per-area budgets; a failed area does not block the others' merges, but a
   red area cannot land.
4. **Editor core** (2–3 days): coverage + flake-rate measure, flake triage as
   a lane type, load harness bounded (the p50 OOM lesson).
5. **Rendering** (2 days): structural goldens, then pixels for a short list.
6. **Scheduling** (parked): lane pool > 3, area-aware picks, one exclusive per
   area. This is the last thing, not the first.

Each phase is useful alone and leaves the man loop running. The gate does not
change until step 6, and step 6 is only worth it once two areas are actually
producing items.

## Acceptance, per area

An area is "adopted" when:

- its measure runs in a worktree at a tip in under the measurement budget and
  stamps its population;
- a deliberately broken commit moves the measure and is caught by the gate;
- a known fixed defect is pinned and stays zero;
- two lanes from two areas ran in one round without touching the same file;
- `loop status` can name the area's tip, last measurement and open items.

## Risks

- **More measures, more wrong numbers.** Audit each one against a known case
  before trusting it (the man-diff lesson).
- **Golden rot.** A golden must name the tool version/condition that produced
  it (like a measurement's population).
- **Flake load.** Bounded, `timeout`-capped, and reported with the run count;
  p50's OOM is the precedent.
- **Area sprawl.** One queue, one gate, one record per round; areas are
  columns, not separate loops.
