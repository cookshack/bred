# Unattended agent loop

Status: last round, 2026-11-24. Eleven rounds of three parallel agents, merged
serially, 87 commits. This file is the protocol; `~/bred-loop` holds the live
state of a run.

The loop is not a script. It is one agent acting as the scheduler: it writes a
brief per lane, dispatches the lanes in parallel, merges their branches one at a
time, and keeps the scoreboard. The lanes never talk to each other, so the
value depends on them owning disjoint files.

## The prompt

Hand this to a fresh agent (build mode, from the repository root):

    You are continuing an ongoing effort on Bred. A previous run did eleven
    rounds of parallel-agent work and left everything committed and verified.
    Do not redo any of it.

    Read doc/Loop.md first: it is the protocol, the prompt, and the round
    history. Then ~/bred-loop/state (if it exists), ~/bred-loop/queue and
    ~/bred-loop/rules.md.

    Establish the baseline before changing anything:

        git log --oneline -1        # this file's tip or later
        git status --porcelain      # only ?? noise files is normal
        npx mocha --exit            # expect the count in "Current state"
        npm run check

    If any of those differ, find out why before starting work.

    Then work in rounds of up to three lanes, as doc/Loop.md describes: write a
    lane brief, dispatch the agents, merge with ~/bred-loop/round.sh, update
    this file and the queue. Only the loop edits this file.

    If the deadline in ~/bred-loop/state has passed, stop and summarise the
    rounds. A half-finished round is worse than a clean checkpoint.

## Where state lives

Tracked (the record, survives anything):

- `doc/Loop.md` — this file: protocol, prompt, round history, current numbers.
- the commits themselves; every merged round is a fast-forward on `main`.

Untracked, under `~/bred-loop` (the mounted home, so it outlives a container;
`/tmp` does not — a `/tmp/opencode` state directory was wiped mid-run once):

- `state` — start, deadline, round counter, the `main` commit after each round.
- `queue` — items as `id | lane | status | title`, with `done:<hash>` for merged
  work and `ready`/`next` for the backlog. This is the "do not redo" list.
- `claims/<id>` — a directory per item an agent is working on, created with
  `mkdir` so two lanes cannot take the same item.
- `rules.md` — the contract every lane agent reads.
- `lane-<id>.md` — one brief per item, kept as the record of what was asked.
- `round-N.log` — the merge, suite and check output for round N.
- `round-N.md` — a short summary of round N.
- `round.sh` — the serial merge step (rebase, fast-forward, suite, check).

Losing `~/bred-loop` costs the queue's hashes and the briefs, not the work: the
commits, this file and the suite are the source of truth.

## How a round works

1. Pick up to three items from the queue whose **file sets are disjoint**, and
   write `~/bred-loop/lane-<id>.md` for each: the worktree, the item, exactly
   which files it owns, and how to prove the fix (a test that fails before it).
2. Dispatch the lanes with `background`, each told to read `rules.md` and its
   lane file, claim with `mkdir ~/bred-loop/claims/<id>`, work only in its own
   worktree, commit once, and never merge, rebase or push.
3. `~/bred-loop/round.sh <n>` merges: it rebases each lane onto `main`,
   fast-forwards one at a time, aborts a conflicting lane instead of forcing it,
   then runs the suite and `npm run check` once for the round.
4. The loop — not a lane — updates this file from the numbers the agents report,
   writes `round-<n>.md`, and bumps `state`/`queue`.
5. Check the clock in `state`; stop if the deadline has passed.

## Lanes

- **a1 parser** — `js/man-parse.mjs`, `js/man-char.mjs`, `js/man-roff.mjs` and
  their tests.
- **a2 viewer** — `js/man.mjs`, `js/point.mjs`, `js/wode*.mjs`, `js/view.mjs`,
  `js/mode.mjs` and their tests.
- **a3 other** — everything else.

Never put two parser items in one round: `js/man-parse.mjs` is 3000 lines and two
correct patches can merge cleanly and still disagree. Lanes never edit this file;
the loop owns it, which removes the one line every lane would otherwise touch.

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

## Current state

    4125 parsed, 27 refused of 4150 installed pages
    4621 parsed, 1 refused, 9 templates of 4631 downloaded pages
    section sweep: 1:2p/5w  3:4p/248w  5:9p/18w  7:3p/8w  8:4p/17w
    502 man tests, 1859 total, 0 failing; check clean

The 27 refusals are upstream page bugs or eqn; section 3 is TIFF hyphenation
inside narrow cells. What is left in the sweep is line-break joining.

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

## Stopping

The deadline is in `~/bred-loop/state`. When it passes, stop merging and write a
summary from `round-*.md`: what changed, what was measured, what is left. Do not
start a round that cannot be finished and verified.
