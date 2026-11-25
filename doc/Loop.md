# Unattended agent loop

Status: handover after round 52, 2026-11-25. Thirty-three rounds used the
tool's gate: red at base, green after the rebase, one suite at the integrated
tip, the record on `loop/r<n>`, one fast-forward. Main is the round-52 tip,
green (2068 of 2070 tests passing, 2 pending, check clean). The agreed plan,
`doc/loop/plan-agreed.md`, is implemented through P6's cadence; P6's lane pool
and area-aware picks are parked by the plan's own criterion. Man is 1 word on
1 page, code 19 of 20 translated. The next items are in `doc/loop/queue.json`
(the view in `doc/Loop-queue.md` is generated); a bounded event-union hunt
after round 47 filed three code triages (c10–c12), recorded in
`doc/loop/hunt-2026-11-25.md`. The two designs the queue supersedes
are `doc/Loop-upgrade.md` and `doc/loop/plan-2026-11-24.md`, kept for their
reasoning. This file is the protocol;
`doc/loop/round-<n>.md` is the per-round record; `bred-loop/` in the session's
worktree root holds the rest of a run's live state.

The run is no longer the only thing moving `main`: other agents and the user
commit to it while the loop works. The protocol now assumes that (see "Working
on a moving main") instead of expecting a quiet tree.

`$LOOP` below is that directory:

    LOOP=$BRED_WORKTREE_ROOT/bred-loop

The queue, the leases, the measurement history and the lease-aware `land` are
implemented; the durable driver and the pipeline cadence from
`doc/Loop-upgrade.md` are not, and the agreed plan parks the scheduling half
(lane pool, area-aware picks) as well. Do not re-derive those from the proposals:
read `doc/loop/plan-agreed.md` for what was dropped and why.

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
- `doc/loop/queue.json` `run` — the run's clock: `start`, `deadline`,
  `stopNew`, `state`, and the round/main after each land. It is the one
  source; nothing else is a clock.
- `doc/loop/round-<n>.md` — one short record per round: lanes, tips, parked
  branches, the measurement and what it was measured on.
- the commits themselves; every merged round is a fast-forward on `main`.

Untracked, in `$LOOP` — the session's worktree root, which is a host bind mount
so it is visible on the host and outlives the container. Two places that do
**not** work: `/tmp` is container-local (a `/tmp/opencode` state directory was
wiped mid-run once), and `~` is container-local too — only `src/bred`,
`worktrees/<session>`, `sessions` and `fresh/main` are shared with the host.

- `state` — scratch only: `last-round.json` holds the round's start and its
  measured duration, which is what the budget's ETA uses. The *clock* (start,
  deadline, stopNew, state) is tracked in `queue.json` `run`, so a fresh
  session inherits it and `bin/loop.mjs clock` can refuse a round.
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

## Areas, measures and the queue

An **area** is a named module set plus a queue namespace: `man`, `code` (the
opencode UI in `ext/code`), `core` (the editor model) and `tooling`. Areas are
columns in one queue, not separate loops.

- `doc/loop/queue.json` is the source. `doc/Loop-queue.md` is generated from it
  by `bin/loop.mjs report --write`, and `check` fails when the two drift.
- Each area has a `measures` entry: `command`, `budget` in seconds and
  `population`. `bin/loop.mjs measure --area <name>` runs it in a worktree of
  the tip; `--area all` runs every area, each within its budget, and writes one
  record per tip and area into `doc/loop/history.jsonl`. A failing area does not
  hide the others: the run says `some areas failed` and keeps what it measured.
- An item carries `area`, `type`, `proof`, `files`, `exclusive`, and optionally
  `source` and `repro`. The `type`s are `fix`, `triage`, `verify`, `measure`,
  `hunt` and `infra`; `hunt` (a bounded generator run that files items) and
  `infra` (a harness whose proof is that it finds a planted failure) are
  scheduled deliberately and never handed out by `pick`.
- `source` records where an item came from — `measure`, `lane`, `triage`,
  `hunt` — so the question "is the measure still producing work" is answerable.
- Coverage is a floor and an alarm, not a target: an item filed on a coverage
  gap alone is parked by the red gate. `doc/loop/laws.md` records the one
  generator that was tried and found nothing, and why the harness is kept.
- `land` refuses while `doc/` is dirty: the aggregate docs belong in the round's
  record commit, and seventeen rounds once sat uncommitted behind their absence.

## How a round works

0. `bin/loop.mjs clock` first, every round. It prints the elapsed time, the
   round budget and `can-start`. Start a round only when it says `can-start
   1`; `round` refuses otherwise, and a run with no clock is a refusal too.
   Finishing before `stopNew` with dispatchable work is a failed run, not a
   short one.
1. `bin/loop.mjs status` is the re-entry point: tip, last verified tip, lane
   tips, queue counts, claims, parked branches, dirty paths. `pick` returns
   the ready items whose files are disjoint and neither dirty nor hot.
2. Mark the chosen items `in-round` in `doc/loop/queue.json` (then
   `report --write`), and write `$LOOP/lane-<id>.md` for each: the worktree,
   the item, the files it owns and the proof already in its queue row. Run
   `bin/loop.mjs lanes-up`, then dispatch each lane as a background subagent:
   call the native `subagent` tool directly (agent `general`, `background`),
   not through `execute`. `subagent` is a native harness tool, so the
   `execute` catalog's "the catalog is complete" note says nothing about it.
   Each lane reads `rules.md`, works only in its worktree and files, commits
   once with a `Loop-item: <id>` trailer, and never merges, rebases or
   pushes. If dispatch is genuinely impossible, stop and name the tool you
   tried: doing the lanes' work in the scheduler's own context is a different
   run, not a slower one.
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

The lists above are the man defaults. The lane labels are worktree names, not
ownership: the authoritative ownership for an item is its `files` in
`doc/loop/queue.json`, and that is what the merge gate diffs against — a commit
outside the row parks, whichever lane made it. An item may move to a different
lane, or to another area, if its files are free.

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
| 21 | marked commas | `aae6139` | `.br` adds no blank line and consecutive breaks collapse; `man-diff` joins a comma-marked `\:` list break (ps(1) 103 → 95, dmsetup 7 → 5) |
| 22 | cell macros | `00dc308` | a `T{ }` cell runs its text macros; ps(1) 95 → 0, section 1 137 → 42 words |
| 23 | names and quotes | `72e8ca4` | `.SY` expands its name; a quote-only token has an empty key; section 1 42 → 39 words |
| 24 | table options | `3f79ddf` | a `.T&` part inherits the table's global options (tbl/gtbl 7 → 1 each); the files gate parked the first attempt for a row that named one file too few |
| 25 | char table | `ee005d2` | `\[tmu]` is `×` (was `™`); tbl/gtbl clean; the whole table was audited against groff_char(7) |
| 26 | greek | `c3ff554` | `*H`/`*Q`/`*Y` follow groff; `*G` and `*f` queued |
| 27 | unicode names | `0385d60` | `u` names are arrows or canonical hex; non-canonical and unknown names refused |
| 28 | gamma | `5ea6105` | `*G` is `Γ`; the whole capital block matches groff (`*J`/`*V` are not groff names) |
| 29 | phi | `29665b6` | `*f` is `ϕ` (U+03D5); the lowercase Greek block is otherwise correct |
| 30 | strict names | `6943a15` | `..` refused, `char` decimal-only, `va`/`vA`/`an` added |
| 31 | hy | `cbbe080` | `\[hy]` is U+2010; literal `-` and `\-` stay ASCII |
| 32 | ascii u | `01f65ce` | a `u` name is refused only for a plain-glyph ASCII code point; special names resolve |
| 33 | \N | `50a83a6` | `\N` takes decimal digits; hex/exponent forms refuse the page; the row was widened after the gate parked it |
| 34 | \N[..] | `1219a56` | `\N[65]` reads as a bracket argument without widening `unquote()` |
| 35 | surrogates | `e7b1a52` | surrogate code points are refused; the boundaries stay valid |
| 36 | Ex/Rv | `1c115f6` | only a leading `-std` is a flag; the doc's `-exit`/`-nop` claim was wrong |
| 37 | continued lines | `7183a0e` | a `\c` glues to a macro body's first printing line (ttf2tfm 10 → 2); section 1 25 → 16 words |
| 38 | copy mode | `d21a9d5` | an argument is copied then interpreted (ttf2tfm 2 → 0); section 1 16 → 14 words |
| 39 | copy rounds | `6b36716` | each tmac request gets its measured copy rounds (xargs fixed); `man-diff` joins a glued em dash (gittutorial 0, ttf2pk 4 → 2); totals 23 words on 11 pages |
| 40 | arguments | `3bf287c` | a `\c` inside a macro argument continues its line (ttf2pk 0); `man-diff` joins a marked pipe/bracket break (dmsetup 5 → 1); totals 17 words on 10 pages |
| 41 | second area | `f6ff0e7` | `ext/code` recorder + conformance measure (10-event fixture, 9-event live recording, 0 malformed); the reviewer's `)` join (hg 2 → 0); totals 15 words on 9 pages |
| 42 | bars and parts | `c72362c` | a bar inside `.Op Fl` is another flag (ssh-agent 0); `session.text.ended` translates its authoritative text (code 17/2/0); man 13 words on 8 pages |
| 43 | reasoning | `f26a1d0` | `session.reasoning.ended` translates its complete text (code 18/2/0); rpcgen's last word proved to be a footer, not content |
| 44 | brackets and footers | `a3607bd` | `Ns` survives the closing bracket (ssh-copy-id 0); a right-aligned page-string is a footer (rpcgen 0); a thinking block is repaired from the ended text; man 11 words on 6 pages |
| 45 | dash and retry | `8618283` | `.Bl -dash` marks each item in the text model (editline 5 → 0, section 7 clean); `session.retry.scheduled` becomes a retry status (code 19/1); `appendThinking` decides the block per transcript box; man 6 words on 5 pages |
| 46 | copy mode and markers | `4dd8ef8` | copy mode keeps an escaped space (dmstats 2 → 0); a `-dash` list draws a hyphen; man 4 words on 4 pages |
| 47 | device name | `c1f2f38` | a bare `\T` is the letter (tex2aspc 1 → 0); man 3 words on 3 pages |
| 48 | the clock | `9e2a821` | the run clock moves into the tracked queue, `clock` prints the budget, `round` refuses after stopNew; 13 tests, man unchanged |
| 49 | link tails | `fc63c08` | `.UE`/`.ME` keep every trailing argument (tload 1 → 0); man 2 words on 2 pages |
| 50 | join through | `eac2c89` | a `\c` survives a request that draws nothing (dmsetup 1 → 0, section 8 clean); man 1 word on 1 page |
| 51 | compaction | `ab98859` | the four compaction events become a log line per phase; re-gated after an outside doc commit moved main mid-round |
| 52 | conditions | `e7e0d67` | `.if r X` / `.if d XX` take their name from the next token; no corpus change, a latent tmac form |

## Current state

Measured at `e7e0d671` (round 52's tip), corpus `4150` pages:

    4123 parsed, 27 refused of 4150 installed pages
    4621 parsed, 1 refused, 9 templates of 4631 downloaded pages (round 11)
    whole sections after round 50: 1:1p/1w  3:0p/0w  5:0p/0w  7:0p/0w  8:0p/0w
    code events after round 50: 20 (19 translated, 1 dropped, 0 malformed)
    622 man tests, 2068 of 2070 passing, 2 pending, 0 failing; check clean

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
- **A queue row's lane is where the work is.** Dispatch an item into the lane
  its row names, or change the row first: two items that claim one lane are
  caught by the tool and both are parked, and recovering them costs a round
  (round 42).
- **A lane is a subagent, not a second hat.** Rounds 45–50 did every lane's
  work in the scheduler's own context because the `execute` catalog was read
  as the whole tool list; `subagent` was native and callable throughout. Serial
  lane work is not a slower loop: it puts three lanes of code and tool output
  into one context, so a compaction or a crash costs more than the dispatch it
  was avoiding.
- **Never reset over unmerged work.** A `reset --hard main` on a lane branch
  that was parked for a conflict silently discards its commit. Reset only when
  the branch is an ancestor of `main`; otherwise park it and cut a fresh
  branch.
- **The suite runs where nobody is typing.** mocha and `npm run check` run in
  a throwaway worktree at a pinned tip, never in the checkout the user is
  editing. If `main` moved during the run, the numbers stay attributed to the
  tip they were measured on.
- **The clock is a command, not a feeling.** A run that set a stopNew and then
  declared it reached four hours early lost three rounds of work. `clock` is
  the only source, `round` enforces it, and the queue's `run` block carries it
  so a fresh session inherits the deadline rather than inventing one.
- **A number names its tip and its population.** A package update changes the
  corpus (4150 pages here) without touching the parser; a number without the
  commit and the page count cannot be compared with the last one.
- **The record lives in the repo.** The queue was untracked and keyed to a
  session, so it disappeared with that session. `doc/Loop-queue.md` and
  `doc/loop/round-<n>.md` are now the durable half; the session keeps only the
  briefs.

## Stopping

The clock is `bin/loop.mjs clock`; nothing else is a clock. Start a round only
while it says `can-start 1`, and check it before every round. `round` refuses
after `stopNew` and refuses a run with no clock, so the stop condition cannot
be remembered wrong.

Stopping early is a failure of the run unless one of these holds, and the
reason is written in the record:

- main is red and the fix is not in hand;
- no lane is free (every worktree has unmerged or dirty work);
- every open row is `triage` — a decision for the human, not a lane;
- the native `subagent` tool cannot be called (name the tool you tried and the
  error; do not inline the lanes);
- the human says stop.

A thin queue is not a reason: grooming and a bounded hunt are the round's work.
When `stopNew` passes, land or park what is in flight and write the summary
from `doc/loop/round-*.md`: what changed, what was measured, what is left, and
the clock line it stopped on. Do not start a round that cannot be finished and
verified.

A summary written before `stopNew` must quote `bin/loop.mjs clock` and name the
exception above. The 2026-11-25 run set stopNew for 14:21Z and summarised at
12:28Z with three of its four hours unspent; the record now says so.
