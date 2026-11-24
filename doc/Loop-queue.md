# Loop queue

The durable half of the unattended loop's state. `doc/Loop.md` is the protocol;
this file is the "do not redo" list, and it is tracked so that losing the
session's worktree root does not lose the queue again.

The loop owns this file. Lanes read it and never edit it.

    run     live 2026-11-24T10:56Z, deadline 18:56Z
    round   15 in progress (started on a5229a8, 11:06Z)
    main    a5229a8      tip when round 15 was dispatched
    state   $BRED_WORKTREE_ROOT/bred-loop/  briefs, claims, round logs (untracked)
    sweep   1:20p/154w  3:5p/71w  5:6p/6w  7:3p/8w  8:2p/9w  (whole sections, after round 14)
    drift   corpus now 4121 parsed / 29 refused: cs/passwd.5 and cs/shadow.5 added
            `.do hla` and `.do hpf` (groff hyphenation requests, p58)

Statuses: `ready` (dispatchable), `next` (queued after a decision or another
item), `triage` (needs evidence before it can be called a bug), `done:<hash>`
(merged on `main`). An item that turned out to be a measurement error is `done`
too, with the verdict in its title.

## Round 15 — suggested lanes (file sets are disjoint)

| id | lane | status | title |
|----|------|--------|-------|
| p52 | a1 | in-round | a bare `.Nm` inside a `T{`/`T}` cell is printed literally (crypt_checksalt(3), crypt_preferred_method(3)) |
| p51 | a2 | in-round | the compressed magics never fire in the app: pty output is UTF-8-decoded, so every byte ≥ 0x80 is U+FFFD and only bzip2's `BZh` survives (tests pass because they bypass the decode) |
| p30 | a3 | in-round | verdict: not an mdoc rule — pcre2demo(3) has no `.TH`, so groff loads no macro package and its default utf8 hyphen is U+2010; fold typographic hyphens in `man-diff` word keys |
| p48 | a3 | in-round | `man-diff --page` has no missing-word total, only the deduped sample (needed to measure p30) |
| p49 | a3 | next | re-measure coverage: `doc/Man.md` still claims 100%/99.97% from round 11; the loop takes it after the round |
| p47 | a3 | triage | `strace-log-merge(1)`, `mendex(1)`, `gpg(1)`, `man(1)` residuals (1-2 words each) |

## Backlog

| id | lane | status | title |
|----|------|--------|-------|
| p44 | a1 | triage | `tbl(1)`/`gtbl(1)`'s example table prints `eleven;11` where man prints `eleven 11` |
| p53 | a1 | next | an `%A`-only `.Rs` ends with a period; groff ends with a comma (no corpus occurrence) |
| p54 | a1 | next | a no-output request between a `\c` and the next line swallows the join (0 corpus occurrences) |
| p55 | a1 | next | a `\c` followed by a blank line: groff joins to the next text line, we make a paragraph break |
| p56 | a1 | next | a text line after `.br` starts with a space (`test/man-parse.mjs:2470` enshrines it); groff has none |
| p19 | a1 | next | `.Rv`/`.Ex` `-exit` and `-nop` (Man.md gap 2) |
| p33 | a1 | next | after a macro under `.Sm off`, a text line still gets a space (groff joins it) |
| p34 | a1 | next | `\v(`-delimited arguments are read as a 2-char name (no corpus use found) |
| p45 | a1 | next | `.nr x +N` / `.nr x -N` set the register; groff adds/subtracts (found in p27) |
| p58 | a1 | next | `.hla`/`.hpf` are groff hyphenation requests; `.do hla cs` refuses cs/passwd.5 and cs/shadow.5 (2 pages) |
| p59 | a1 | triage | a man page with no `.TH` loads no macro package in groff: man(1) drops the `.SH` headings and prints U+2010; we render headings (pcre2demo(3)) — refuse or mimic? |
| p57 | a2 | next | a colon list reports the last failing candidate; with a mode-000 part before a missing one it names the missing one |
| p50 | a2 | triage | `wode-view-e2e` "stale peer push during revert" failed once in a post-merge verify, passed twice alone (round 13) |

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
