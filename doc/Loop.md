# Unattended agent loop

Status: live, round 20, 2026-11-24 (deadline 2026-11-25T05:35Z). Three rounds
have used the tool's gate: red at base, green after the rebase, one suite at
the integrated tip, the record on `loop/r<n>`, one fast-forward. Main is the
round-20 record commit, green (1957 tests, check clean). The next items
are in `doc/loop/queue.json` (the view in `doc/Loop-queue.md` is generated);
the upgrade designs are `doc/Loop-upgrade.md` (the loop's) and
`doc/loop/plan-2026-11-24.md` (a fresh agent's). This file is the protocol;
`doc/loop/round-<n>.md` is the per-round record; `bred-loop/` in the session's
worktree root holds the rest of a run's live state.

The run is no longer the only thing moving `main`: other agents and the user
commit to it while the loop works. The protocol now assumes that (see "Working
on a moving main") instead of expecting a quiet tree.

`$LOOP` below is that directory:

    LOOP=$BRED_WORKTREE_ROOT/bred-loop

An upgrade proposal (machine-checkable queue, leases, measurement history, a
durable driver, a pipeline cadence) is in `doc/Loop-upgrade.md`; it is not
implemented.

The queue is tracked because the previous run's `$LOOP` was keyed to a session
that ended, and its queue went with it. Briefs, claims and round logs stay
untracked; the work, the round tips and this file survive anything.

The loop is not a script. It is one agent acting as the scheduler: it writes a
brief per lane, dispatches the lanes in parallel, merges their branches one at a
time, and keeps the scoreboard. The lanes never talk to each other, so the
value depends on them owning disjoint files.

## The prompt

`doc/Loop-prompt.md` holds the prompt to hand a fresh agent (build mode, from
the repository root). It is short on purpose: it points at this file for the
protocol and at `doc/Loop-queue.md` for the work. The only thing it cannot
carry is the deadline — `$LOOP/state` is per-session and a fresh session has
none — so state the deadline when you hand it over, or the agent will choose
its own.

## Where state lives

Tracked (the record, survives anything):

- `doc/Loop.md` — this file: protocol, prompt, round history, current numbers.
- `doc/Loop-queue.md` — the queue: every item, its files, its status and its
  `done:<hash>`. Losing the session costs the briefs, not the queue.
- `doc/loop/round-<n>.md` — one short record per round: lanes, tips, parked
  branches, the measurement and what it was measured on.
- the commits themselves; every merged round is a fast-forward on `main`.

Untracked, in `$LOOP` — the session's worktree root, which is a host bind mount
so it is visible on the host and outlives the container. Two places that do
**not** work: `/tmp` is container-local (a `/tmp/opencode` state directory was
wiped mid-run once), and `~` is container-local too — only `src/bred`,
`worktrees/<session>`, `sessions` and `fresh/main` are shared with the host.

- `state` — start, deadline, round counter, the base and the `main` commit
  after each round.
- `claims/<id>` — a directory per item an agent is working on, created with
  `mkdir` so two lanes cannot take the same item.
- `rules.md` — the contract every lane agent reads.
- `lane-<id>.md` — one brief per item, kept as the record of what was asked.
- `doc/loop/queue.json` — the queue and each item's proof; the markdown view
  is generated from it by `bin/loop.mjs report --write`.
- `round-N.log` — the merge, suite and check output for round N.
- `round-N.md` — a short summary of round N (also tracked, as
  `doc/loop/round-N.md`).
- `bin/loop.mjs` — the tool: status, pick, claim/release/reap, lanes-up,
  round, measure, land, report, check.
- `bin/loop-merge.mjs`, `bin/loop-queue.mjs`, `bin/loop-claims.mjs`,
  `bin/loop-measure.mjs` — its four halves, imported through documented
  interfaces.
- `verify-<n>/` — a throwaway worktree at the round's tip, where the suite
  runs, so the user's checkout is untouched.

Losing `$LOOP` costs the briefs and the claims, not the work or the queue: the
commits, `doc/Loop-queue.md`, `doc/loop/round-<n>.md` and the suite are the
source of truth.

## How a round works

1. `bin/loop.mjs status` is the re-entry point: tip, last verified tip, lane
   tips, queue counts, claims, parked branches, dirty paths. `pick` returns
   the ready items whose files are disjoint and neither dirty nor hot.
2. Mark the chosen items `in-round` in `doc/loop/queue.json` (then
   `report --write`), and write `$LOOP/lane-<id>.md` for each: the worktree,
   the item, the files it owns and the proof already in its queue row. Run
   `bin/loop.mjs lanes-up`, then dispatch with `background`; each lane reads
   `rules.md`, works only in its worktree and files, commits once with a
   `Loop-item: <id>` trailer, and never merges, rebases or pushes.
3. `bin/loop.mjs round <n> --items ...` builds `loop/r<n>` from main, rebases
   each lane onto it, and gates it: files inside the queue row, proof red at
   base with the lane's test files, proof green after the rebase. A failing
   lane is parked with its patch; the suite and `npm run check` run once at
   the integrated tip (`$LOOP/round-<n>-suite.log`).
4. `bin/loop.mjs measure --tip <tip>` measures the tip's own tools and appends
   `doc/loop/history.jsonl`. Write `doc/loop/round-<n>.md` on `loop/r<n>` and
   commit it there with `Loop-round: <n>` and `Loop-verify: <tip>`.
5. `bin/loop.mjs land <n>` fast-forwards main once, refusing unless the
   recorded tip is on the branch and only docs follow it. Then mark the merged
   items `done` with their lane hashes in `queue.json` and `report --write`.
6. Check the clock in `state`; stop starting rounds at `stopnew`.

## Working on a moving main

`main` is not quiet: the user and other agents commit to it while the loop
works, so the loop must never assume that the tree it started from is the tree
it merges onto.

- **Pin the base, and re-test after the rebase.** A clean rebase proves the
  text did not clash, not that the code still agrees: two agents can rewrite
  the same function in different hunks. Each item ships one proof command in
  `queue.json`, and `round` runs it at the base (it must fail) and after the
  rebase (it must pass). A lane that fails either is parked, not merged.
- **Park, never reset, unmerged work.** `round` renames a lane branch that
  could not merge to `<branch>-r<n>-aborted`, writes its patch under `$LOOP`,
  and cuts a fresh branch from the integration tip. The commit stays reachable
  and is listed in the round record. A lane is reset only when its branch is
  an ancestor of `main` and its tree is clean; `lanes-up` checks that.
- **The suite runs at the integrated tip in its own worktree.** `round` builds
  `loop/r<n>`, adds a detached verify worktree at its tip, provisions
  `node_modules`, `lib/` and `ext/*/lib`, and runs mocha and `npm run check`
  there (`$LOOP/round-<n>-suite.log`). The user's checkout can be dirty,
  mid-edit or mid-checkout without affecting the round. If `main` moved,
  `land` refuses and the round is re-gated on the new base.
- **A failing suite is attributed, not accepted.** When the suite fails at
  `TIP`, run it at `base`; if `base` is green, merge the round's lane branches
  one at a time in a scratch worktree, running the suite after each, to name
  the lane. Only then write the round record.
- **Hot and dirty files are outside claims.** Before dispatch, list the paths
  in `git status --porcelain` and the paths touched by `git log --since='2
  hours ago'`, leaving out commits this loop made itself (recorded in `state`
  as `own`, so its own round tips do not freeze their files for the next
  round). An item whose files intersect the outside set is `next`, not
  `ready`, even if its lane is free. The `files` column in the queue makes
  this mechanical.
- **A locked index is "main busy".** The tool retries the fast-forward and a
  rebase once after the lock is gone. Only a real conflict parks a lane.
- **The record names its tip.** `doc/loop/round-<n>.md`, the measurement and
  the `Current state` block all say which commit and which page population
  they describe. A package update (the corpus page count moving) is a
  population change, not a parser regression.

## Lanes

- **a1 parser** — `js/man-parse.mjs`, `js/man-char.mjs`, `js/man-roff.mjs` and
  their tests.
- **a2 viewer** — `js/man.mjs`, `js/point.mjs`, `js/wode*.mjs`, `js/view.mjs`,
  `js/mode.mjs` and their tests.
- **a3 other** — everything else.

Never put two parser items in one round: `js/man-parse.mjs` is 3000 lines and two
correct patches can merge cleanly and still disagree. Lanes never edit this file;
the loop owns it, which removes the one line every lane would otherwise touch.

The lists above are the default owner; the `files` column in
`doc/Loop-queue.md` is authoritative for an item and is what the loop checks
for overlap with the other lanes, the dirty tree and the hot files. An item may
move to a different lane than its prefix suggests if its files are free.

## Rounds so far

| # | theme | tip | headline |
|---|-------|-----|----------|
| 1 | corpus + coverage | `421181e` | two escape hangs found by fuzzing; valid-page fuzz generator; colspan styling |
| 2 | links and formats | `9865dd4` | `Ex`/`Rv` need `-std`; compressed bytes refused by magic; `Scroll` cache event |
| 3 | claims and structures | `89c298a` | table with no format is refused; closed views cannot report ready; `man-diff` ignores sentence punctuation |
| 4 | mdoc arguments | `c6a9e71` | `.Ox`/`.Fx`/`.Nx`/`.Dx`/`.Ux` keep their version; `.At` table; one destroy listener |
| 5 | expansion | `4a16624` | `.Xr` name and `.URL` tail expanded; `.sp` in a table body is a request |
| 6 | names | `40eb65d` | bare `.Nm` prints the document name; peer sync and the message log |
| 7 | honesty | `2207c7c` | `.ie`/`.el` block text (bash RESTRICTED SHELL); doc audited against code; `Ev.post` no longer throws out of a timer |
| 8 | verification | `6ae555a` | the corpus gate now gates (181 constructs had been suppressed); `Lb`/`Lx`; raw groff templates skipped |
| 9 | tables | `e597ab2` | one tbl format line per row (324 blocks, 72 pages had multiplied columns); the container check says why it gave up |
| 10 | flake | `8e30e7c` | the `indent` flake reproduced under load: CodeMirror's 20 ms parse budget |
| 11 | finish | `afa6d6f` | per-row table styling; `indent buffer` parsed the whole document (was truncating at 3000 chars); health-check message |
| 12 | verification | `5e531f0` | `\c` joins forward only; `\F`/`\m`/`\M`/`\k`/`\S`/`\v` take their own forms; `.Sm off` starts at the second call; `man -w` stats the whole line first; `man-diff` says what it sampled |
| 13 | mdoc set | `244c425` | `.Lb` table, `.In` `#include`, `.do`, `\n+[reg]`; a background lane is launched, not finished; `man-diff` joins at a source `\:` and reads a cell as a cell |
| 14 | references | `a18cd1b` | `.Rs` quotes `%T` only in a `%B`/`%J` reference; a `\c` tag line stays open across a macro; `man-diff` knows the truncated mdoc banner and `\:` after ":" and "@" |
| 15 | moving main | `2c5b9df` | `.Nm` in a `T{` cell expands; `man-diff --page` prints the total and folds typographic hyphens; the flake hunt OOM'd, the two live lanes merged |
| 16 | bytes + joins | `f3f1539` | `.hla`/`.hpf` accepted; `runToString` can keep bytes (renderer half only); quote fold and source-decided hyphen joins clear section 3 |
| 17 | isolation | `9b8958c` | `.Fc` ends a SYNOPSIS declaration with `;`; the pty's bytes cross IPC; the merged suite was red (test isolation, a2 reverted) and stabilised |
| 18 | first tool round | `c1562d7` | `.Fn` ends a SYNOPSIS declaration with `;`; a colon list names the unreadable part; `flushPeer` reports instead of calling a throw flushed; the tool found two harness bugs on its first real round |
| 19 | subsection state | `74ba52d` | a `.Ss` keeps the top-level section, so `.Fn`/`.Fc` keep the `;` (and `.Nm`/`.In` their synopsis forms); a failed read outranks a later miss |
| 20 | breaks and cells | `8c684ac` | no separator space after `.br`; `man-diff` joins a wrapped cell at the left edge (`man(1)` 2 → 0) |

## Current state

Measured at `8c684acd` (round 20's tip), corpus `4150` pages:

    4123 parsed, 27 refused of 4150 installed pages
    4621 parsed, 1 refused, 9 templates of 4631 downloaded pages (round 11)
    whole sections after round 20: 1:15p/145w  3:0p/0w  5:0p/0w  7:2p/7w  8:2p/9w
    560 man tests, 1957 total, 2 pending, 0 failing; check clean

The 27 refusals are upstream page bugs or eqn, not dialect gaps. Round 15
counted 29 because a package update added `.do hla`/`.do hpf` to the Czech
`passwd(5)` and `shadow(5)`; round 16 accepted both requests, so the count is
back to round 14's 27 and those two pages parse. The page count stayed 4150
throughout — a number has to name its page set as well as its commit.

The numbers above used to be a **sample**: `bin/man-diff --max 400` slices
sorted order and prints it as `400 of 1189 (sample; --max 0 for all)`, section
1 has 1189 pages and section 3 has 959. Measured whole, section 1 was 34 pages
/ 403 words short of man(1), not 2 / 5. Round 12 fixed the tool and the three
parser bugs the honest sweep exposed (`\c`, `\F`, `.Sm off`) plus the
colon-path shadowing in the viewer; round 13 took the mdoc set (`.Lb`, `.In`,
`.do`, `\n+`); round 14 took the reference set and the tag continuation, and
two more `man-diff` rules. After round 16, sections 3 and 5 are clean, section
1 is 147 words (ps(1) 103, ttf2tfm(1) 10, tbl/gtbl 7 each, ttf2pk 5, hg 2,
man 2), section 7 is editline 5 + gittutorial-2 2, and section 8 is dmsetup 7
+ dmstats 2. What is left is in `doc/Man.md` and, with ids, in
`doc/Loop-queue.md`.

## Rules that earned their place

- **Prove the claim before fixing it.** Three rounds in a row the obvious
  diagnosis was wrong: `o3`'s literal "drop punctuation tokens" made the
  measurement worse; `p6` blamed an undefined register that the page defines;
  `p10` looked like a false alarm and was a 72-page bug. Ask for `groff -t` or
  `groff -Tutf8 -mdoc` evidence in every parser brief.
- **Never widen a timeout silently.** Five separate bugs were deferred work
  bounded by a wall clock that gave up without saying so. Wait on the real state,
  or make the expiry observable — and say which.
- **Bound the load you create.** The p50 flake hunt started unbounded CPU
  workers and OOM-killed the container, taking the lane and the whole agent
  server with it. Any load a lane starts is capped: `timeout`, at most
  `nproc-2` workers, no `while :` loops, and a reporter that says how many
  runs and how much load it used.
- **A test command has to exit.** `npx mocha test/man-viewer.mjs` printed 158
  passing and then hung on an open handle; the merge step waited 15 minutes
  for a command that had already passed. Every lane test ends in `--exit`, and
  the merge step puts a `timeout` around it, so a hang is a failure with a
  reason instead of a stalled round.
- **Lane-green is not suite-green.** Round 17's three lanes each passed their
  own tests and the merged suite still failed: a foreign test fake and two
  under-waited assertions only show in the full suite's order. The tip is the
  gate; a red tip is reverted (the commit stays on its branch) and the item
  goes back to the queue, not recorded as merged.
- **The tool's first real round finds what the unit tests cannot.** Round 18's
  gates passed and the suite "failed" twice for reasons outside any lane: a
  symlinked `ext/*/lib` loaded a second CodeMirror instance, then `spawnSync`'s
  1 MB buffer killed the suite with ENOBUFS. A scratch repository with a fake
  suite cannot see either. Run the tool on the real tree before trusting it,
  and print the log when a suite fails.
- **Red first.** Every behaviour change needs a test shown failing against the
  old code. A coverage-only test cannot fail, so prove it by mutating the code
  and say so.
- **One measurement per round.** `man-audit` and a section sweep are minutes of
  CPU and will make the timing-sensitive viewer tests flaky if lanes run them in
  parallel.
- **A sample is not a measurement.** `man-diff --max 400` was quoted as a
  section total for three rounds; section 1 was 80 times worse than the number
  in this file. A tool that samples must print what it sampled, and a number
  here must name its population.
- **A clean rebase is not a pass.** Two agents can rewrite the same function in
  different hunks and git will merge both. Every lane ships its proof command
  and the merge step re-runs it after rebasing; a lane that fails is parked,
  not merged.
- **Never reset over unmerged work.** A `reset --hard main` on a lane branch
  that was parked for a conflict silently discards its commit. Reset only when
  the branch is an ancestor of `main`; otherwise park it and cut a fresh
  branch.
- **The suite runs where nobody is typing.** mocha and `npm run check` run in
  a throwaway worktree at a pinned tip, never in the checkout the user is
  editing. If `main` moved during the run, the numbers stay attributed to the
  tip they were measured on.
- **A number names its tip and its population.** A package update changes the
  corpus (4150 pages here) without touching the parser; a number without the
  commit and the page count cannot be compared with the last one.
- **The record lives in the repo.** The queue was untracked and keyed to a
  session, so it disappeared with that session. `doc/Loop-queue.md` and
  `doc/loop/round-<n>.md` are now the durable half; the session keeps only the
  briefs.

## Stopping

The deadline is in `$LOOP/state`. When it passes, stop merging and write a
summary from `doc/loop/round-*.md`: what changed, what was measured, what is
left. Do not start a round that cannot be finished and verified.
