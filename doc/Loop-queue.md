# Loop queue

The durable half of the unattended loop's state. `doc/Loop.md` is the protocol;
this file is the "do not redo" list, and it is tracked so that losing the
session's worktree root does not lose the queue again.

The loop owns this file. Lanes read it and never edit it.

    run     2026-11-24T08:05Z .. 2026-11-24T16:05Z
    round   12
    main    453a63c      tip when the run started
    state   $BRED_WORKTREE_ROOT/bred-loop/  briefs, claims, round logs (untracked)

Statuses: `ready` (dispatchable), `next` (queued after a decision or another
item), `triage` (needs evidence before it can be called a bug), `done:<hash>`
(merged on `main`). An item that turned out to be a measurement error is
`done` too, with the verdict in its title.

## Round 12 — the sweep tells the truth

| id | lane | status | title |
|----|------|--------|-------|
| p12 | a1 | ready | `\c` also drops the space *before* its own line (`aa` + `bb multi-\c` renders `aabb`) |
| p13 | a1 | ready | `\F` takes one family char; `skipArg`'s char pairing eats the text after it (kernel-install `THE TION`) |
| p14 | a1 | ready | `.Sm off` merges an `.It` tag with its body (ssh_config `PermitRemoteOpenhost:port`) |
| o12 | a3 | ready | `man-diff --max` must report what it sampled, not a section total |
| o13 | a3 | ready | `man-diff` joins a mid-cell U+2010 hyphenation (tbl/TIFF cells, 248 "lost" words) |
| o14 | a3 | ready | docs: real numbers (4123 pages, 505/1862 tests), `AGENTS.md` state path, sweep verdicts |

## Backlog

| id | lane | status | title |
|----|------|--------|-------|
| p15 | a1 | triage | ps(1), 103 words: a comma list joins with no space (`pid,format,tname,time,cmd,`) |
| p16 | a1 | triage | ssh(1)/slogin(1), 48 each: synopsis runs `-D` into `[bind_address:]port` |
| p17 | a1 | triage | tbl(1)/gtbl(1): `.do nr tbl_C` is printed as text (`nr tbl_C 1` in the synopsis) |
| p18 | a3 | triage | nroff(1)/ttf2tfm(1) long-token wrapping: layout or loss? |
| p19 | a1 | next | `.Rv`/`.Ex` `-exit` and `-nop` (Man.md gap 2) |
| p20 | a2 | ready | a colon in a path is still shadowed by the colon-list heuristic (Man.md gap 3) |
| p21 | a2 | next | lzma alone is not sniffed for a mislabelled compressed page (Man.md gap 4) |
| p22 | a3 | next | per-page verdicts for the documented layout pages (bash, git-help, dmsetup, TIFF) |

## Done

Per-item hashes were lost with the previous session's worktree root; the round
tips below are the record, and `doc/Loop.md`'s round table has the headlines.

| id | lane | status | title |
|----|------|--------|-------|
| r1 | - | done:421181e | corpus + coverage: escape hangs, valid-page fuzz, colspan |
| r2 | - | done:9865dd4 | links and formats: `Ex`/`Rv` need `-std`, compressed bytes, Scroll cache |
| r3 | - | done:89c298a | claims and structures: table with no format, closed views, sentence punctuation |
| r4 | - | done:c6a9e71 | mdoc arguments: OS macros keep their version, `.At`, one destroy listener |
| r5 | - | done:4a16624 | expansion: `.Xr` name and `.URL` tail, `.sp` in a table body |
| r6 | - | done:40eb65d | names: bare `.Nm`, peer sync, message log |
| r7 | - | done:2207c7c | honesty: `.ie`/`.el` block text, doc audited, no throw out of a timer |
| r8 | - | done:6ae555a | verification: the corpus gate gates, `Lb`/`Lx`, templates skipped |
| r9 | - | done:e597ab2 | tables: one format line per row, container check says why |
| r10 | - | done:8e30e7c | flake: the indent parse budget |
| r11 | - | done:afa6d6f | finish: per-row table styling, indent buffer, health-check message |
