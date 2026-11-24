# Loop upgrade proposal

Status: proposal, 2026-11-24, written while round 17 was in flight. Nothing in
this file is implemented. It is deliberately opinionated so that it can be
compared with another agent's plan, item by item.

`doc/Loop.md` is the current protocol. This file is what the protocol should
become, and why.

## What this run exposed

Round 17 was the first run under the "moving main" rules. The deterministic
parts held: base/tip pinning, post-rebase re-test, park-not-reset, the suite in
a throwaway worktree, the `files` column. Everything that hurt was bookkeeping
or liveness, not man parsing:

- **The scheduler is a chat session.** A network drop killed two lanes; an OOM
  killed the container and a third lane's uncommitted edits (a patch was
  preserved by hand). Closing the laptop ends the loop.
- **The queue is prose.** Two duplicate rows appeared while editing it by hand
  (p57, p61), and statuses moved by typing.
- **Claims are bare `mkdir`.** A crashed lane leaves one behind; `p50` had to be
  released by hand before it could be retried.
- **The round is a barrier.** Three lanes dispatch, the slowest sets the
  cadence, then everything merges. A 15-minute hang in one lane idled two.
- **The scheduler does arithmetic and doc edits**, so its context goes on
  transcription instead of judgement, and the numbers exist only as prose.
- **A brief can be wrong.** p30's "an mdoc `-` is U+2010" diagnosis was false;
  the fix was a measurement-tool change. Time went into disproving the brief.
- **A test can hang after passing.** `npx mocha test/man-viewer.mjs` printed 158
  passing and never exited; the round stalled for 15 minutes. The rule is now
  written down instead of enforced.
- **Coverage drift:** `doc/Man.md` still described round 14; nothing noticed
  until a lane ran the numbers.

The pattern: the protocol is good at *what to verify* and bad at *remembering
and enforcing it*. Move the remembering into files and programs; keep the agent
for judgement.

## Goals

1. Any one process (chat, lane, scheduler) can die without losing committed
   work; uncommitted work is recoverable.
2. Queue, claims, statuses, measurements and the docs' numbers are
   machine-checkable and generated, not typed.
3. The cadence is not set by the slowest lane.
4. A human gates priorities and the measurement; the machinery gates the rest.
5. No heavy new dependencies: Node and the existing shell are enough.

Non-goals: cloud CI, auto-merge without tests, changing the man parser's
policy, a web UI.

## Design principles

- **The record is the state.** If the JSON and the logs cannot reconstruct what
  happened, the mechanism is wrong.
- **Every gate is executable.** "Red first", "one measurement per round",
  "`--exit`", "no unbounded load" become checks, not advice.
- **Park, never discard.** An aborted lane keeps a branch and a patch.
- **The loop may be wrong; it must be visible.** Parked lanes, stale claims and
  metric regressions are reported, never silently fixed.
- **The chat session is an observer.** The run survives it.

## Track A — machine-checkable state (P0)

Tracked under `doc/loop/`:

- `queue.json` — the single source of truth:
  `{ run: { start, deadline, stopNew, base, main },
     items: [ { id, title, lane, status, files: [], proof, doneHash, notes } ],
     schema: 1 }`
- `history.jsonl` — one record per measurement:
  `{ ts, tip, corpus: { pages, parsed, refused },
     sweep: { "1": { pages, words }, ... },
     suite: { pass, pending }, check: 1 }`
- `doc/loop/round-<n>.md` — unchanged, the human record.

`bin/loop` (small, testable, no deps):

- `loop status` — running lanes, ready items, stale claims, last measurement,
  and whether the stop flag is set. One screen.
- `loop claim <id> <lane>` — writes `$LOOP/claims/<id>.json`
  `{ pid, host, lane, started, branch }`; fails if a live claim exists.
- `loop release <id>` / `loop reap` — release one; reap claims whose pid is
  dead or older than N hours, and print them.
- `loop pick [--n 3]` — choose ready items whose `files` are disjoint from the
  running set and from dirty/hot paths (the hot set excludes `own` commits in
  `run`), refusing two parser items in one pick.
- `loop report` — regenerate the marked tables in `doc/Loop-queue.md`
  (`<!-- loop:queue -->` … `<!-- /loop:queue -->`) and the Current state
  blocks in `doc/Loop.md` and `doc/Man.md` from `queue.json` + `history.jsonl`.
  Idempotent; hand edits inside the markers are a check failure.

Acceptance: two schedulers cannot pick the same item; `loop report` run twice
changes nothing; a killed lane's claim is reaped by pid; `loop status` answers
"what is running and what is next" from disk alone.

## Track B — lane lifecycle (P0)

- `loop run-lane <id>` starts the agent for that item and, in the same process,
  snapshots the worktree every 60 s and on SIGTERM/exit:
  `$LOOP/wip/<lane>/<ts>.patch` = `git diff` plus a list of untracked files
  (and their contents when small). Killing a lane costs a re-apply.
- `loop merge` is `round.sh` generalised: rebase onto current main → run the
  item's `proof` with `timeout` → fast-forward, or park to
  `<branch>-r<n>-aborted`. The proof command comes from `queue.json`, not a
  separate `.test` file.
- The lane agent's own commit is never amended or reset; a parked branch is
  listed in the round record and in `loop status`.

Acceptance: `kill -9` a lane mid-edit → a patch exists, the claim is stale, and
`loop reap` + `loop run-lane` resume from the patch. No lane branch with
unmerged commits is ever reset.

## Track C — measurement as a program (P1)

- `loop measure [--sections 1,3,5,7,8]` runs `man-audit --parse`, per-section
  `man-diff --max 0`, and the suite + check in the verify worktree at a pinned
  tip, then appends to `history.jsonl` and calls `loop report`.
- Per-section and per-page deltas: the sweep stores the pages with missing
  words, not only totals, so "round 18 increased section 1 by 1 word" names the
  page.
- **Regression gate:** a merge whose sweep total (or a section's) increases
  beyond a configured tolerance is flagged; the merge is parked unless the
  item's `intent` field declares a metric change (tool fixes do). No automatic
  revert of a merged commit: park the next lane, never rewrite history.
- Docs' numbers are rendered from history; an agent never types "4123 parsed".

Acceptance: `git grep -n '4123 parsed' doc/` only matches generated blocks;
`loop measure` is the only way the Current state changes; a deliberately bad
merge is reported as a metric regression with the page named.

## Track D — durable driver (P1/P2)

- `bin/loopd` (or `loop daemon`) with `start | stop | status | tick`.
- Keeps up to N lanes in flight. On lane completion: merge → record → pick the
  next item → dispatch, without waiting for the other lanes.
- `loop stop` sets `run.stopping`; the driver stops picking, waits for or parks
  the running lanes, measures, records, exits.
- Dispatch is a subprocess: `opencode run --agent general --prompt-file
  $LOOP/briefs/<id>.md`, so the run is not tied to the chat. The in-session
  subagent path stays for supervised work.
- Run under tmux/systemd; `loop status` is the re-entry point after a restart.

Acceptance: close the chat and the laptop for ten minutes → the daemon
continues, merges at least one lane, and `loop status` shows the same state
afterwards. At most N lanes; no orphaned claims.

## Track E — pipeline cadence (P2)

- Replace the round barrier with a merge cadence: merge each lane as it
  finishes, then dispatch the next. A "round" becomes an accounting unit of K
  merges; the measurement runs every K merges or T minutes, whichever first.
- During a measurement, dispatch pauses (configurable) or runs `nice 10`; the
  timing-sensitive viewer tests are the reason, and the history records whether
  the measurement overlapped dispatch.
- The queue's page/section count in history is the throttle: no new parser item
  while a measurement is running.

Acceptance: with one deliberately slow lane, the other two slots merge at least
two items before the slow lane finishes; history shows merge timestamps; no
measurement overlaps a running suite.

## Track F — lane types and test selection (P2)

- `type: fix | triage | verify | measure`.
  - `triage`: evidence only; a commit is optional; the report becomes a queue
    item with `evidence`.
  - `verify`: re-check a claim before it is queued (the p30 class).
  - `measure`: runs a tool and updates history only.
- `loop tests-for <files...>` maps changed files to test files (a small table in
  `queue.json` or `bin/loop`), so merge-time verification is narrow and the
  full suite belongs to the measurement.
- Briefs are generated from the item (files, proof, red-first, evidence,
  bounds), so a missing `--exit` or an unbounded load is a template bug, not a
  lane mistake.

Acceptance: a triage item that produces no commit still closes with evidence;
a fix's merge-time test is the mapped subset; the full suite runs only on the
measurement cadence.

## Order and effort

1. **P0, half a day:** `queue.json` + `loop report`; claims as leases + `reap`;
   WIP snapshots; `loop status`; stop flag; proof commands from the queue.
2. **P1, one to two days:** `loop measure` + `history.jsonl` + generated docs;
   per-page deltas; regression gate; `bin/loopd` with subprocess dispatch.
3. **P2, two to three days:** pipeline cadence; lane types; `tests-for`;
   systemd/tmux packaging.

Each phase is useful alone; the loop keeps running the current protocol between
phases. P0 is the precondition for P1/P2: a durable driver without leases and
snapshots is just a faster way to lose a lane.

## Open decisions

1. **Where state lives.** Proposal: `queue.json` and `history.jsonl` are tracked
   in `doc/loop/` (durable, reviewable); runtime state (claims, wip, logs,
   verify worktrees) stays in `$LOOP` (session-scoped, host-visible).
2. **Dispatch mechanism.** Proposal: `opencode run` subprocess for the driver;
   harness subagents for supervised runs. Costs a client process per lane;
   survives the chat.
3. **Measurement vs dispatch.** Proposal: pause dispatch during the suite, allow
   lane work during `man-diff` with `nice`; record the overlap in history.
4. **Regression response.** Proposal: park the next lane and report; never
   revert a merged commit automatically.
5. **Machine-readable page identity.** Per-page deltas need stable keys (path +
   section); proposal: the corpus path relative to `/usr/share/man`, which is
   what `man-diff` already prints.

## Risks

- **More machinery, more bugs.** Keep `bin/loop` small and tested; the current
  protocol is the fallback (`git revert` is a commit, not a lost run).
- **Generated docs vs hand edits.** Markers plus a check in `npm run check`
  that the block matches `history.jsonl`; a hand edit fails the check.
- **Unsupervised merging.** The narrow proof, the measurement gate and park
  remain the guards; add a `--dry-run` that merges into a scratch branch.
- **Concurrent humans.** The queue and history are tracked, so a user commit can
  conflict; rebase the loop's doc branch and re-apply the small generated
  block, as the current protocol already does.
- **Agent context.** The driver does not read the repo; the lane does. Keep the
  briefs short, the state in files, and the reports for the human.

## What stays

One parser item per round; disjoint file sets; red first; park-never-reset; a
measurement that names its tip and its population; a human who owns priorities.
The upgrade moves bookkeeping and cadence, not the standards.
