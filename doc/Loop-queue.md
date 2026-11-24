# Loop queue

The durable half of the unattended loop's state. `doc/Loop.md` is the protocol;
this file is the "do not redo" list, and it is tracked so that losing the
session's worktree root does not lose the queue again.

The loop owns this file. Lanes read it and never edit it.

    run     stopped 2026-11-24T14:05Z, after round 17, for a loop redesign
    round   17 done at 9b8958c; no round is scheduled
    main    9b8958c      tip after round 17, green (1915 tests)
    state   $BRED_WORKTREE_ROOT/bred-loop/  briefs, claims, round logs (untracked)
    sweep   whole sections after round 16: 1:16p/147w  3:0p/0w  5:0p/0w
            7:2p/7w  8:2p/9w  (section 3 re-checked after round 17: still 0)
    plans   doc/Loop-upgrade.md (the loop's) and doc/loop/plan-2026-11-24.md
            (a fresh agent's), written independently, for comparison
    hot     none

Statuses: `ready` (dispatchable), `next` (queued after a decision or another
item), `triage` (needs evidence before it can be called a bug), `done:<hash>`
(merged on `main`). An item that turned out to be a measurement error is `done`
too, with the verdict in its title.

`files` is the item's file set, and it is authoritative: the loop checks it for
two lanes overlapping, and against the dirty tree and the files touched in the
last two hours (not counting the loop's own commits, listed as `own` in
`state`). An item whose files are busy is `next`, whatever its status was
before.

## Next run — ready items (file sets are disjoint)

| id | lane | status | title | files |
|----|------|--------|-------|-------|
| p50 | a2 | ready | the peer-push test is now **reverted from main** (`b0b0afd`): it waits on the push and the revert callback, but in the full suite the push has not reached main when it asserts (`'v1' !== 'v1X'`, both tests). The diagnosis and slow-revert variant are on `agent/bred-0b2c11a0-a2` (`fbdef92`) and `$LOOP/p50-crash/a2-wip.patch`; it needs a test isolated from the suite as well as green alone | test/wode-view-e2e.mjs, js/wode*.mjs, js/view.mjs |
| p64 | a1 | ready | `.Fn` in a SYNOPSIS also ends with `;` in groff; we do not print it (found in p61's report) | js/man-parse.mjs, test/man-parse.mjs |
| p65 | a3 | ready | no fake emits a typed-array chunk split mid-UTF-8, so `js/shell.mjs`'s streaming decoder is proven only by real-pty timing; add the fake and the test | js/shell.mjs, test/man-viewer.mjs, test/main-shell.mjs |
| p66 | a2 | ready | `flushPeer`'s `catch { return }` treats a throwing `sendableUpdates` as already flushed, so a broken collab field skips the wait silently (found in p50's report) | js/wode-view.mjs, test/wode-view-e2e.mjs |
| p47 | a3 | triage | `strace-log-merge(1)`, `mendex(1)`, `gpg(1)`, `man(1)` residuals (1-2 words each) | bin/man-diff |
| p57 | a2 | next | a colon list reports the last failing candidate; with a mode-000 part before a missing one it names the missing one | js/man.mjs, test/man-viewer.mjs |

## Backlog

| id | lane | status | title | files |
|----|------|--------|-------|-------|
| p44 | a1 | triage | `tbl(1)`/`gtbl(1)`'s example table prints `eleven;11` where man prints `eleven 11` | js/man-parse.mjs |
| p53 | a1 | next | an `%A`-only `.Rs` ends with a period; groff ends with a comma (no corpus occurrence) | js/man-parse.mjs |
| p54 | a1 | next | a no-output request between a `\c` and the next line swallows the join (0 corpus occurrences) | js/man-parse.mjs |
| p55 | a1 | next | a `\c` followed by a blank line: groff joins to the next text line, we make a paragraph break | js/man-parse.mjs |
| p56 | a1 | next | a text line after `.br` starts with a space (`test/man-parse.mjs:2470` enshrines it); groff has none | js/man-parse.mjs, test/man-parse.mjs |
| p19 | a1 | next | `.Rv`/`.Ex` `-exit` and `-nop` (Man.md gap 2) | js/man-parse.mjs |
| p33 | a1 | next | after a macro under `.Sm off`, a text line still gets a space (groff joins it) | js/man-parse.mjs |
| p34 | a1 | next | `\v(`-delimited arguments are read as a 2-char name (no corpus use found) | js/man-parse.mjs |
| p45 | a1 | next | `.nr x +N` / `.nr x -N` set the register; groff adds/subtracts (found in p27) | js/man-parse.mjs |
| p59 | a1 | triage | a man page with no `.TH` loads no macro package in groff: man(1) drops the `.SH` headings and prints U+2010; we render headings (pcre2demo(3)) — refuse or mimic? | js/man-parse.mjs |

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
| p25 | a1 | done:d5042d1 | `.Rs` quotes `%T` only in a `%B`/`%J` reference, and takes groff's serial comma (14 ssh references) |
| p40 | a1 | done:d5042d1 | a `\c` tag line stays open across a macro (paperconfig `--paperpapername`, 5 dmstats tags) |
| p46 | a2 | done:2261231 | a colon-list part with no read bits says `Permission denied` |
| p21 | a2 | done:2261231 | lzma verdict: the header bytes are destroyed by the UTF-8 decode, so no safe sniff; `lzcat` already last |
| p41 | a3 | done:a18cd1b | the truncated mdoc banner is a header (5 pages, 31 → 1 words) |
| p42 | a3 | done:a18cd1b | the `\:` join accepts ":" (`bash(1)` 4 → 2) |
| p43 | a3 | done:a18cd1b | the `\:` join accepts "@" (`troff(1)` 2 → 0) |
| p52 | a1 | done:d9906f4 | a bare `.Nm` in a `T{`/`T}` cell prints the document name (both crypt pages 0) |
| p48 | a3 | done:2c5b9df | `man-diff --page` prints `lost <n>` before the sample |
| p30 | a3 | done:2c5b9df | verdict: no mdoc U+2010 rule; `man-diff` folds U+2010/U+2011/U+2212 (pcre2demo 67 → 12) |
| p58 | a1 | done:9ba3175 | `.hla`/`.hpf` are no-output requests; both Czech pages parse (corpus back to 4123/27) |
| p51 | a2 | done:c2b32ec | the `cat` fallback keeps its bytes, so the renderer names a mislabelled page's format (the app half is p63) |
| p60 | a3 | done:f3f1539 | `man-diff` folds typographic quotes; pcre2demo 12 → 0 (U+2018 folds to a backtick) |
| p62 | a3 | done:f3f1539 | the hyphen join is decided from the page source and applied to both sides; section 3 14 → 0 |
| p49 | a3 | done:f3f1539 | coverage re-measured over the whole suite: 100/99.97/100/100/98.88 line, branch 94.56/98.75/97.18/90.28 |
| p61 | a1 | done:b601364 | `.Fc` ends a SYNOPSIS declaration with `;`, and only in SYNOPSIS |
| p63 | a3 | done:ec7eedf | the pty's bytes cross IPC as Buffers; one streaming decoder per run; the real-pty test names gzip |
| s17 | - | done:9b8958c | stabilisation after the red merge: `Opt.load` survives a payload-less response, the opt tests install their own fake; a2's peer-push test reverted (p50) |
