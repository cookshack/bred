# Loop queue

The durable half of the unattended loop's state. `doc/Loop.md` is the protocol;
this file is the "do not redo" list, and it is tracked so that losing the
session's worktree root does not lose the queue again.

The loop owns this file. Lanes read it and never edit it.

    run     2026-11-24T08:05Z .. 2026-11-24T16:05Z
    round   14
    main    244c425      tip after round 13
    state   $BRED_WORKTREE_ROOT/bred-loop/  briefs, claims, round logs (untracked)

Statuses: `ready` (dispatchable), `next` (queued after a decision or another
item), `triage` (needs evidence before it can be called a bug), `done:<hash>`
(merged on `main`). An item that turned out to be a measurement error is `done`
too, with the verdict in its title.

## Round 14 — the `.Rs` set, and the measurement that still lies

| id | lane | status | title |
|----|------|--------|-------|
| p25 | a1 | ready | `.Rs` wraps `%T` in curly quotes; groff leaves it bare (ssh(1)/slogin(1), 56 words) |
| p40 | a1 | ready | a `\c` before a macro call still gets a space (ttf2tfm(1)/ttf2pk(1), 15 words) |
| p41 | a3 | ready | an mdoc header line groff truncated (`... BSD Library Functions Manual ...`) is not recognised as a header (crypt_preferred_method, rpc_gss_*, 30 words) |
| p42 | a3 | ready | `bash(1)`'s PATH list breaks after a source `\:` ending in ":"; the join only knows "/" (4 → 2) |
| p43 | a3 | ready | `.MT ...@\:web.de` breaks at "@": the same `\:` join, another character (troff(1), 2 words) |

## Backlog

| id | lane | status | title |
|----|------|--------|-------|
| p44 | a1 | triage | `tbl(1)`/`gtbl(1)`'s example table prints `eleven;11` where man prints `eleven 11` |
| p30 | a1 | next | an mdoc bare `-` is U+2010 (and `\-` is U+2212); we emit ASCII `-` (pcre2demo(3), 67 words) |
| p19 | a1 | next | `.Rv`/`.Ex` `-exit` and `-nop` (Man.md gap 2) |
| p33 | a1 | next | after a macro under `.Sm off`, a text line still gets a space (groff joins it) |
| p34 | a1 | next | `\v(`-delimited arguments are read as a 2-char name (no corpus use found) |
| p45 | a1 | next | `.nr x +N` / `.nr x -N` set the register; groff adds/subtracts (found in p27) |
| p21 | a2 | next | lzma alone is not sniffed for a mislabelled compressed page (Man.md gap 3) |
| p46 | a2 | next | a *part* of a genuine colon list that is mode 000 reports `read failed`, not `Permission denied` (found in p35) |
| p47 | a3 | triage | `strace-log-merge(1)`, `mendex(1)`, `gpg(1)`, `man(1)` residuals (1-2 words each) |
| p48 | a3 | next | `man-diff --page` has no missing-word total, only the deduped sample |
| p49 | a3 | next | re-measure coverage: `doc/Man.md` still claims 100%/99.97% from round 11, before two rounds of parser code |

## Done

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
| p12 | a1 | done:3eb439b | `\c` joins forward only (ext2/3/4.5 `trackingfile`) |
| p13 | a1 | done:3eb439b | `\F` and `\m \M \k \S \v` take their own forms (kernel-install `THE TION`, git-subtree, mflua) |
| p14 | a1 | done:3eb439b | `.Sm off` starts suppressing at the second call (ssh_config `PermitRemoteOpen host:port`) |
| p16 | a1 | done:3eb439b | ssh(1) synopsis `-D [bind_address:]port`: fixed by p14 |
| p20 | a2 | done:546bfee | a readable whole `man -w` line wins over its split parts (Man.md gap 3) |
| o12 | a3 | done:5e531f0 | `man-diff --max` says `20 of 1189 (sample; --max 0 for all)` and sorts the sample |
| o13 | a3 | done:5e531f0 | a U+2010-hyphenated table cell is reassembled (TIFF 125 → 6, 116 → 0) |
| o14 | a3 | done:5e531f0 | docs: 505 tests, the sweep is a sample, the cell rule |
| p23 | a1 | done:8edfd43 | `.Lb` maps through groff's table (9 libcrypt pages) |
| p24 | a1 | done:8edfd43 | `.In` prints `#include <...>` in SYNOPSIS (47 pages) |
| p26 | a1 | done:8edfd43 | `.do` runs its remainder instead of printing it (11 pages) |
| p27 | a1 | done:8edfd43 | `\n+[reg]` steps then reads (sensible-editor 1-5, zlib 1-3) |
| p35 | a2 | done:d59ccf7 | a whole `man -w` line that stats as a file is settled by its read |
| p36 | a2 | done:d59ccf7 | one `Cannot read <path>: <reason>` shape |
| p28 | a3 | done:244c425 | `man-diff` joins at a `\:` the page marks, not at every "/" |
| p31 | a3 | done:244c425 | a justified paragraph is not a table (hgrc `forthe`) |
| p37 | a3 | done:244c425 | a bordered cell's continuation at the left edge (TIFFGetField 6 → 0) |
| p39 | - | done:7ce2ecf | a background subagent is launched, not finished (tick, routing, ⏳) |
