# Loop queue

The durable half of the unattended loop's state. `doc/Loop.md` is the protocol;
this file is the "do not redo" list, and it is tracked so that losing the
session's worktree root does not lose the queue again.

The loop owns this file. Lanes read it and never edit it.

    run     2026-11-24T08:05Z .. 2026-11-24T16:05Z
    round   13
    main    5e531f0      tip after round 12
    state   $BRED_WORKTREE_ROOT/bred-loop/  briefs, claims, round logs (untracked)

Statuses: `ready` (dispatchable), `next` (queued after a decision or another
item), `triage` (needs evidence before it can be called a bug), `done:<hash>`
(merged on `main`). An item that turned out to be a measurement error is `done`
too, with the verdict in its title.

## Round 13 — the families the honest sweep exposed

| id | lane | status | title |
|----|------|--------|-------|
| p23 | a1 | ready | `.Lb libcrypt` prints the bare argument; groff prints `Crypt Library (libcrypt, -lcrypt)` (crypt*.3, ~10 pages) |
| p24 | a1 | ready | `.In crypt.h` in SYNOPSIS prints `<crypt.h>`; groff prints `#include <crypt.h>` (crypt*.3) |
| p26 | a1 | ready | `.do nr tbl_C \n[.C]` is printed as text (`nr tbl_C 1` in tbl(1)'s synopsis) |
| p27 | a1 | ready | `\n+[step]` in `.IP` does not auto-increment (sensible-editor(1) numbers 1, 1, 1) |

## Backlog

| id | lane | status | title |
|----|------|--------|-------|
| p25 | a1 | next | `.Rs` wraps `%T` in curly quotes; groff leaves it bare (ssh(1)/slogin(1), 56 words) |
| p30 | a1 | next | an mdoc bare `-` is U+2010 (and `\-` is U+2212); we emit ASCII `-` (pcre2demo(3), 67 words) |
| p33 | a1 | next | after a macro under `.Sm off`, a text line still gets a space (groff joins it) |
| p34 | a1 | next | `\v(`-delimited arguments are read as a 2-char name (no corpus use found) |
| p19 | a1 | next | `.Rv`/`.Ex` `-exit` and `-nop` (Man.md gap 2) |
| p21 | a2 | next | lzma alone is not sniffed for a mislabelled compressed page (Man.md gap 3) |
| p35 | a2 | next | a readable-but-unreadable whole `man -w` line reports the split error, not its own |
| p36 | a2 | next | `readPath` says `Cannot read <file>`, `fetchPage` says `Cannot read <part>` |
| p28 | a3 | triage | man(1) breaks a long path after `/`; `man-diff` does not join it (troff(1), nroff(1), ttf2tfm(1)) |
| p29 | a3 | triage | dmsetup(8)/dmstats(8) long `[a|b|c]` tokens (14 words) |
| p31 | a3 | triage | hgrc(5) `forthe`: did the `\c` fix land where groff does? |
| p32 | a3 | triage | editline(7) five bare `-` tokens |
| p37 | a3 | triage | a hyphenated *last-column* cell continues at the left margin (TIFFGetField, 6 words) |
| p38 | a3 | next | `man-diff --page` has no missing-word total, only the deduped sample |

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
