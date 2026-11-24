# Unattended agent loop

Status: paused after round 14, 2026-11-24. Eleven earlier rounds of three
parallel agents, then rounds 12-14 in this run, all merged serially. This file
is the protocol; `doc/Loop-queue.md` is the durable queue; `bred-loop/` in the
session's worktree root holds the rest of a run's live state.

The run was stopped deliberately, not by the deadline: `doc/Loop-queue.md` has
the next items (`ready`/`next`/`triage`) and the prompt below is how to resume
in a fresh session. Nothing is half-merged; `main` is clean and green.

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

Hand this to a fresh agent (build mode, from the repository root):

    You are continuing an ongoing effort on Bred. A previous run did fourteen
    rounds of parallel-agent work and left everything committed and verified.
    Do not redo any of it.

    Read doc/Loop.md first: it is the protocol, the prompt, and the round
    history. Then doc/Loop-queue.md (the queue), $LOOP/state (if it exists) and
    $LOOP/rules.md.

    Establish the baseline before changing anything:

        git log --oneline -1        # this file's tip or later
        git status --porcelain      # only ?? noise files is normal
        npx mocha --exit            # expect the count in "Current state"
        npm run check

    If any of those differ, find out why before starting work.

    Then work in rounds of up to three lanes, as doc/Loop.md describes: write a
    lane brief, dispatch the agents, merge with $LOOP/round.sh, update
    this file and doc/Loop-queue.md. Only the loop edits those two.

    If the deadline in $LOOP/state has passed, stop and summarise the
    rounds. A half-finished round is worse than a clean checkpoint.

## Where state lives

Tracked (the record, survives anything):

- `doc/Loop.md` — this file: protocol, prompt, round history, current numbers.
- `doc/Loop-queue.md` — the queue: every item, its status and its `done:<hash>`.
  Losing the session costs the briefs, not the queue.
- the commits themselves; every merged round is a fast-forward on `main`.

Untracked, in `$LOOP` — the session's worktree root, which is a host bind mount
so it is visible on the host and outlives the container. Two places that do
**not** work: `/tmp` is container-local (a `/tmp/opencode` state directory was
wiped mid-run once), and `~` is container-local too — only `src/bred`,
`worktrees/<session>`, `sessions` and `fresh/main` are shared with the host.

- `state` — start, deadline, round counter, the `main` commit after each round.
- `claims/<id>` — a directory per item an agent is working on, created with
  `mkdir` so two lanes cannot take the same item.
- `rules.md` — the contract every lane agent reads.
- `lane-<id>.md` — one brief per item, kept as the record of what was asked.
- `round-N.log` — the merge, suite and check output for round N.
- `round-N.md` — a short summary of round N.
- `round.sh` — the serial merge step (rebase, fast-forward, suite, check).

Losing `$LOOP` costs the briefs and the claims, not the work or the queue: the
commits, `doc/Loop-queue.md` and the suite are the source of truth.

## How a round works

1. Pick up to three items from `doc/Loop-queue.md` whose **file sets are
   disjoint**, mark them `in-round`, and write `$LOOP/lane-<id>.md` for each:
   the worktree, the item, exactly which files it owns, and how to prove the fix
   (a test that fails before it).
2. Dispatch the lanes with `background`, each told to read `rules.md` and its
   lane file, claim with `mkdir $LOOP/claims/<id>`, work only in its own
   worktree, commit once, and never merge, rebase or push.
3. `$LOOP/round.sh <n>` merges: it rebases each lane onto `main`,
   fast-forwards one at a time, aborts a conflicting lane instead of forcing it,
   then runs the suite and `npm run check` once for the round.
4. The loop — not a lane — updates this file from the numbers the agents report,
   writes `round-<n>.md`, and bumps `state` and `doc/Loop-queue.md`.
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
| 12 | verification | `5e531f0` | `\c` joins forward only; `\F`/`\m`/`\M`/`\k`/`\S`/`\v` take their own forms; `.Sm off` starts at the second call; `man -w` stats the whole line first; `man-diff` says what it sampled |
| 13 | mdoc set | `244c425` | `.Lb` table, `.In` `#include`, `.do`, `\n+[reg]`; a background lane is launched, not finished; `man-diff` joins at a source `\:` and reads a cell as a cell |
| 14 | references | `a18cd1b` | `.Rs` quotes `%T` only in a `%B`/`%J` reference; a `\c` tag line stays open across a macro; `man-diff` knows the truncated mdoc banner and `\:` after ":" and "@" |

## Current state

    4123 parsed, 27 refused of 4150 installed pages
    4621 parsed, 1 refused, 9 templates of 4631 downloaded pages (round 11)
    section sweep, whole sections after round 14: 1:20p/154w  3:5p/71w  5:6p/6w  7:3p/8w  8:2p/9w
    533 man tests, 1891 total, 0 failing; check clean

The 27 refusals are upstream page bugs or eqn, not dialect gaps.

The numbers above used to be a **sample**: `bin/man-diff --max 400` slices
sorted order and prints it as `400 of 1189 (sample; --max 0 for all)`, section
1 has 1189 pages and section 3 has 959. Measured whole, section 1 was 34 pages
/ 403 words short of man(1), not 2 / 5. Round 12 fixed the tool and the three
parser bugs the honest sweep exposed (`\c`, `\F`, `.Sm off`) plus the
colon-path shadowing in the viewer; round 13 took the mdoc set (`.Lb`, `.In`,
`.do`, `\n+`); round 14 took the reference set and the tag continuation, and
two more `man-diff` rules. The sweep is down to 36 pages / 248 words, and most
of what is left is ps(1) (103 words) and pcre2demo(3) (67). What is left is in
`doc/Man.md` and, with ids, in `doc/Loop-queue.md`.

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
- **The record lives in the repo.** The queue was untracked and keyed to a
  session, so it disappeared with that session. `doc/Loop-queue.md` is now the
  durable half; the session keeps only the briefs.

## Stopping

The deadline is in `$LOOP/state`. When it passes, stop merging and write a
summary from `round-*.md`: what changed, what was measured, what is left. Do not
start a round that cannot be finished and verified.
