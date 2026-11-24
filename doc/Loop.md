# Unattended agent loop

Status: live, round 15, 2026-11-24 (deadline 18:56Z). Eleven earlier rounds of
three parallel agents, then rounds 12-14 in a previous run; all merged serially.
This file is the protocol; `doc/Loop-queue.md` is the durable queue;
`doc/loop/round-<n>.md` is the per-round record; `bred-loop/` in the session's
worktree root holds the rest of a run's live state.

The run is no longer the only thing moving `main`: other agents and the user
commit to it while the loop works. The protocol now assumes that (see "Working
on a moving main") instead of expecting a quiet tree.

`$LOOP` below is that directory:

    LOOP=$BRED_WORKTREE_ROOT/bred-loop

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
- `lane-a<lane>.test` — the one command that proves that lane, re-run by
  `round.sh` after every rebase.
- `round-N.log` — the merge, suite and check output for round N.
- `round-N.md` — a short summary of round N (also tracked, as
  `doc/loop/round-N.md`).
- `round.sh` — the serial merge step (rebase, re-test, park, fast-forward,
  then suite and check at a pinned tip).
- `lanes-up.sh` — bring the lane worktrees to `main` before dispatch; never
  resets a branch with unmerged commits.
- `verify-<n>/` — a throwaway worktree at the round's tip, where the suite
  runs, so the user's checkout is untouched.

Losing `$LOOP` costs the briefs and the claims, not the work or the queue: the
commits, `doc/Loop-queue.md`, `doc/loop/round-<n>.md` and the suite are the
source of truth.

## How a round works

1. Record `base` (`git rev-parse main`) in `state`, and the dirty paths and
   hot files from `git status` and `git log --since='2 hours ago'`. Pick up to
   three items from `doc/Loop-queue.md` whose **file sets are disjoint**, and
   whose files are neither dirty nor hot; mark them `in-round`, and write
   `$LOOP/lane-<id>.md` for each: the worktree, the item, exactly which files
   it owns, and how to prove the fix (a test that fails before it). Write the
   proof command, one line, to `$LOOP/lane-a<lane>.test`.
2. Run `$LOOP/lanes-up.sh`, then dispatch the lanes with `background`, each
   told to read `rules.md` and its lane file, claim with `mkdir
   $LOOP/claims/<id>`, work only in its own worktree, commit once, and never
   merge, rebase or push.
3. `$LOOP/round.sh <n>` merges: it rebases each lane onto the current `main`,
   re-runs `lane-a<lane>.test`, fast-forwards one at a time, parks a lane that
   conflicts or fails its re-test on `<branch>-r<n>-aborted` instead of
   forcing or resetting it away, then runs the suite and `npm run check` once
   in `$LOOP/verify-<n>` at the merged tip.
4. The loop — not a lane — updates this file from the numbers the agents report,
   writes `doc/loop/round-<n>.md`, and bumps `state` and `doc/Loop-queue.md`.
   Every number names the tip it was measured on.
5. Check the clock in `state`; stop if the deadline has passed.

## Working on a moving main

`main` is not quiet: the user and other agents commit to it while the loop
works, so the loop must never assume that the tree it started from is the tree
it merges onto.

- **Pin the base, and re-test after the rebase.** A clean rebase proves the
  text did not clash, not that the code still agrees: two agents can rewrite
  the same function in different hunks. Each lane therefore ships one command
  in `lane-a<lane>.test`, and `round.sh` runs it after rebasing. A lane whose
  re-test fails is parked, not merged.
- **Park, never reset, unmerged work.** `round.sh` renames a lane branch that
  could not merge to `<branch>-r<n>-aborted` and cuts a fresh lane branch from
  `main`. The commit stays reachable and is listed in the round record. A
  `reset --hard main` is only safe once the branch is an ancestor of `main`,
  and `lanes-up.sh` checks that.
- **The suite runs at a pinned tip in its own worktree.** `round.sh` records
  `TIP=$(git rev-parse main)`, adds a detached `verify-<n>` worktree at it
  (with `node_modules` symlinked), and runs mocha and `npm run check` there.
  The user's checkout can be dirty, mid-edit or mid-checkout without
  affecting the round. If `main` moved during the run, the log says so and the
  numbers stay attributed to `TIP`.
- **A failing suite is attributed, not accepted.** When the suite fails at
  `TIP`, run it at `base`; if `base` is green, merge the round's lane branches
  one at a time in a scratch worktree, running the suite after each, to name
  the lane. Only then write the round record.
- **Hot and dirty files are outside claims.** Before dispatch, list the paths
  in `git status --porcelain` and the paths touched by `git log --since='2
  hours ago'`. An item whose files intersect them is `next`, not `ready`, even
  if its lane is free. The `files` column in the queue makes this mechanical.
- **A locked index is "main busy".** `round.sh` waits for
  `.git/index.lock` and retries the fast-forward once. Only a real merge
  conflict parks a lane.
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

## Current state

Measured at `9c25cfa` (round 15's base), corpus `4150` pages:

    4121 parsed, 29 refused of 4150 installed pages
    4621 parsed, 1 refused, 9 templates of 4631 downloaded pages (round 11)
    section sweep, whole sections after round 14: 1:20p/154w  3:5p/71w  5:6p/6w  7:3p/8w  8:2p/9w
    1893 tests, 2 pending, 0 failing; check clean

The 29 refusals are upstream page bugs or eqn, not dialect gaps. Two more than
round 14: the Czech `passwd(5)` and `shadow(5)` now carry `.do hla`/`.do hpf`
(groff hyphenation requests, queue p58), a package update rather than a parser
regression — the page count is the population check for exactly this.

The numbers above used to be a **sample**: `bin/man-diff --max 400` slices
sorted order and prints it as `400 of 1189 (sample; --max 0 for all)`, section
1 has 1189 pages and section 3 has 959. Measured whole, section 1 was 34 pages
/ 403 words short of man(1), not 2 / 5. Round 12 fixed the tool and the three
parser bugs the honest sweep exposed (`\c`, `\F`, `.Sm off`) plus the
colon-path shadowing in the viewer; round 13 took the mdoc set (`.Lb`, `.In`,
`.do`, `\n+`); round 14 took the reference set and the tag continuation, and
two more `man-diff` rules. The sweep is down to 36 pages / 248 words, and most
of what is left is ps(1) (103 words) and pcre2demo(3) (67, which round 15
measured down to a measurement artifact: its page has no `.TH`, so man(1)
prints typographic hyphens). What is left is in `doc/Man.md` and, with ids, in
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
