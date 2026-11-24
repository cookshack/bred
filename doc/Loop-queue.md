# Loop queue

The durable half of the unattended loop's state. `doc/Loop.md` is the protocol;
this file is the "do not redo" list, and it is tracked so that losing the
session's worktree root does not lose the queue again.

The loop owns this file. Lanes read it and never edit it.

    run     stopped after round 18 (one round on the new tool)
    round   18 done at c1562d7; no round is scheduled
    main    ba74ca6      green; the record names the tip it verified
    state   $BRED_WORKTREE_ROOT/bred-loop/  briefs, claims, round logs (untracked)
    sweep   1:16p/147w  3:0p/0w  5:0p/0w  7:2p/7w  8:2p/9w   (round 18, c1562d7)
    plans   doc/Loop-upgrade.md (the loop's) and doc/loop/plan-2026-11-24.md
    hot     none

`bin/loop.mjs status` derives the same facts from git and the queue; this block
is prose and is not worth trusting over the command. The tables below are
generated from `doc/loop/queue.json` by `bin/loop.mjs report --write`.

Statuses: `ready` (dispatchable), `next` (queued after a decision or another
item), `triage` (needs evidence before it can be called a bug), `done:<hash>`
(merged on `main`). An item that turned out to be a measurement error is `done`
too, with the verdict in its title.

`files` is the item's file set, and it is authoritative: the loop checks it for
two lanes overlapping, and against the dirty tree and the files touched in the
last two hours (not counting the loop's own commits, listed as `own` in
`state`). An item whose files are busy is `next`, whatever its status was
before.

<!-- loop:queue -->
## Ready

| id | lane | status | title | files |
|----|------|--------|-------|-------|
| p70 | a1 | ready | strace-log-merge(1) prints strace\-log\-merge literally in the synopsis; synopsisStart pushes args[0] raw where handleFont/OP expand it | js/man-parse.mjs, test/man-parse.mjs |
| p71 | a3 | ready | mendex(1) one "lost" word is a tab display difference ("" vs two quote tokens); decide whether man-diff should treat a tab as non-separating | bin/man-diff, test/man-diff.mjs |

## Backlog

| id | lane | status | title | files |
|----|------|--------|-------|-------|
| p50 | a2 | next | the peer-push test was reverted from main (b0b0afd; its commit fbdef92 is in main history). Both tests fail in the full suite (v1 !== v1X) while standing alone and under bounded c8 they pass; the first deliverable is a proof that fails at base, not only in suite order — until then the red gate parks it. Patch: $LOOP/p50-crash/a2-wip.patch | test/wode-view-e2e.mjs, js/wode*.mjs, js/view.mjs |
| p65 | a3 | next | no fake emits a typed-array chunk split mid-UTF-8, so `js/shell.mjs`'s streaming decoder is proven only by real-pty timing; add the fake and the test | js/shell.mjs, test/man-viewer.mjs, test/main-shell.mjs |
| p53 | a1 | next | an `%A`-only `.Rs` ends with a period; groff ends with a comma (no corpus occurrence) | js/man-parse.mjs |
| p54 | a1 | next | a no-output request between a `\c` and the next line swallows the join (0 corpus occurrences) | js/man-parse.mjs |
| p55 | a1 | next | a `\c` followed by a blank line: groff joins to the next text line, we make a paragraph break | js/man-parse.mjs |
| p19 | a1 | next | `.Rv`/`.Ex` `-exit` and `-nop` (Man.md gap 2) | js/man-parse.mjs |
| p33 | a1 | next | after a macro under `.Sm off`, a text line still gets a space (groff joins it) | js/man-parse.mjs |
| p34 | a1 | next | `\v(`-delimited arguments are read as a 2-char name (no corpus use found) | js/man-parse.mjs |
| p45 | a1 | next | `.nr x +N` / `.nr x -N` set the register; groff adds/subtracts (found in p27) | js/man-parse.mjs |
| p73 | a1 | next | toText ignores space blocks, so .sp/blank lines are invisible to asText while man-render draws them; measurement-neutral (normal() collapses), pre-existing | js/man-parse.mjs, test/man-parse.mjs |
| p75 | a1 | next | .IP "" 2 inside ps(1) cells (and nested .TS value lists) stays raw cell text; .IP draws no text, so it may join tableRequests or need a no-op path (the 18-word surplus, not lost) | js/man-parse.mjs, test/man-parse.mjs |

## Triage

| id | lane | status | title | files |
|----|------|--------|-------|-------|
| p44 | a1 | triage | `tbl(1)`/`gtbl(1)`'s example table prints `eleven;11` where man prints `eleven 11` | js/man-parse.mjs |
| p59 | a1 | triage | a man page with no `.TH` loads no macro package in groff: man(1) drops the `.SH` headings and prints U+2010; we render headings (pcre2demo(3)) — refuse or mimic? | js/man-parse.mjs |

## Done

| id | lane | status | title | files |
|----|------|--------|-------|-------|
| p64 | a1 | done:cc7042c | `.Fn` in a SYNOPSIS also ends with `;` in groff; we do not print it (found in p61's report) | js/man-parse.mjs, test/man-parse.mjs |
| p66 | a3 | done:c1562d7 | `flushPeer`'s `catch { return }` treats a throwing `sendableUpdates` as already flushed, so a broken collab field skips the wait silently (found in p50's report) | js/wode-view.mjs, test/wode-view-e2e.mjs |
| p47 | a3 | done:8c684ac | `strace-log-merge(1)`, `mendex(1)`, `gpg(1)`, `man(1)` residuals (1-2 words each) | bin/man-diff, test/man-diff.mjs |
| p57 | a2 | done:6e94402 | a colon list reports the last failing candidate; with a mode-000 part before a missing one it names the missing one | js/man.mjs, test/man-viewer.mjs |
| p56 | a1 | done:889ce7c | a text line after `.br` starts with a space (`test/man-parse.mjs:2470` enshrines it); groff has none | js/man-parse.mjs, test/man-parse.mjs |
| p12 | a1 | done:3eb439b | `\c` joins forward only (ext2/3/4.5 `trackingfile`) |  |
| p13 | a1 | done:3eb439b | `\F` and `\m \M \k \S \v` take their own forms (kernel-install `THE TION`, git-subtree, mflua) |  |
| p14 | a1 | done:3eb439b | `.Sm off` starts suppressing at the second call (ssh_config `PermitRemoteOpen host:port`) |  |
| p16 | a1 | done:3eb439b | ssh(1) synopsis `-D [bind_address:]port`: fixed by p14 |  |
| p20 | a2 | done:546bfee | a readable whole `man -w` line wins over its split parts (Man.md gap 3) |  |
| p23 | a1 | done:8edfd43 | `.Lb` maps through groff's table (9 libcrypt pages) |  |
| p24 | a1 | done:8edfd43 | `.In` prints `#include <...>` in SYNOPSIS (47 pages) |  |
| p26 | a1 | done:8edfd43 | `.do` runs its remainder instead of printing it (11 pages) |  |
| p27 | a1 | done:8edfd43 | `\n+[reg]` steps then reads (sensible-editor 1-5, zlib 1-3) |  |
| p35 | a2 | done:d59ccf7 | a whole `man -w` line that stats as a file is settled by its read |  |
| p36 | a2 | done:d59ccf7 | one `Cannot read <path>: <reason>` shape |  |
| p28 | a3 | done:244c425 | `man-diff` joins at a `\:` the page marks, not at every "/" |  |
| p31 | a3 | done:244c425 | a justified paragraph is not a table (hgrc `forthe`) |  |
| p37 | a3 | done:244c425 | a bordered cell's continuation at the left edge (TIFFGetField 6 → 0) |  |
| p39 | - | done:7ce2ecf | a background subagent is launched, not finished (tick, routing, ⏳) |  |
| p25 | a1 | done:d5042d1 | `.Rs` quotes `%T` only in a `%B`/`%J` reference, and takes groff's serial comma (14 ssh references) |  |
| p40 | a1 | done:d5042d1 | a `\c` tag line stays open across a macro (paperconfig `--paperpapername`, 5 dmstats tags) |  |
| p46 | a2 | done:2261231 | a colon-list part with no read bits says `Permission denied` |  |
| p21 | a2 | done:2261231 | lzma verdict: the header bytes are destroyed by the UTF-8 decode, so no safe sniff; `lzcat` already last |  |
| p41 | a3 | done:a18cd1b | the truncated mdoc banner is a header (5 pages, 31 → 1 words) |  |
| p42 | a3 | done:a18cd1b | the `\:` join accepts ":" (`bash(1)` 4 → 2) |  |
| p43 | a3 | done:a18cd1b | the `\:` join accepts "@" (`troff(1)` 2 → 0) |  |
| p52 | a1 | done:d9906f4 | a bare `.Nm` in a `T{`/`T}` cell prints the document name (both crypt pages 0) |  |
| p48 | a3 | done:2c5b9df | `man-diff --page` prints `lost <n>` before the sample |  |
| p30 | a3 | done:2c5b9df | verdict: no mdoc U+2010 rule; `man-diff` folds U+2010/U+2011/U+2212 (pcre2demo 67 → 12) |  |
| p58 | a1 | done:9ba3175 | `.hla`/`.hpf` are no-output requests; both Czech pages parse (corpus back to 4123/27) |  |
| p51 | a2 | done:c2b32ec | the `cat` fallback keeps its bytes, so the renderer names a mislabelled page's format (the app half is p63) |  |
| p60 | a3 | done:f3f1539 | `man-diff` folds typographic quotes; pcre2demo 12 → 0 (U+2018 folds to a backtick) |  |
| p62 | a3 | done:f3f1539 | the hyphen join is decided from the page source and applied to both sides; section 3 14 → 0 |  |
| p49 | a3 | done:f3f1539 | coverage re-measured over the whole suite: 100/99.97/100/100/98.88 line, branch 94.56/98.75/97.18/90.28 |  |
| p61 | a1 | done:b601364 | `.Fc` ends a SYNOPSIS declaration with `;`, and only in SYNOPSIS |  |
| p63 | a3 | done:ec7eedf | the pty's bytes cross IPC as Buffers; one streaming decoder per run; the real-pty test names gzip |  |
| s17 | - | done:9b8958c | stabilisation after the red merge: `Opt.load` survives a payload-less response, the opt tests install their own fake; a2's peer-push test reverted (p50) |  |
| p67 | a1 | done:ba79104 | a .Ss subsection inside SYNOPSIS resets the section state, so .Fn and .Fc lose the ; (groff keeps doc-in-synopsis-section across .Ss; no installed page hits it) | js/man-parse.mjs, test/man-parse.mjs |
| p68 | a2 | done:74ba52d | a colon-list part with read bits whose read fails ranks with a missing part, so a later miss can still shadow it; no test covers that ordering | js/man.mjs, test/man-viewer.mjs |
| p69 | a1 | done:2e66879 | a .br before any text emits an extra blank line, and two consecutive .br are not collapsed (groff keeps one break) | js/man-parse.mjs, test/man-parse.mjs |
| p72 | a3 | done:aae6139 | ps(1) is 103 of section 1's words: man(1) wraps a comma-separated option list, and man-diff does not join a line that ends at a comma in that list; find a rule that joins it without joining prose commas | bin/man-diff, test/man-diff.mjs |
| p74 | a1 | done:00dc308 | ps(1) loses 95 words because a macro line inside a T{ } tbl cell stays raw (.BR pcpu ). instead of pcpu).); every T{ } cell using a macro is affected; the ps(1) pin in test/man-diff.mjs must be updated with the fix | js/man-parse.mjs, test/man-parse.mjs, test/man-diff.mjs |

<!-- /loop:queue -->
