# Round 15 — table cells, the diff total, and a moving main

Base `d5151d2`, merged tip `2c5b9df`, 2026-11-24 12:36Z.

This was the first round under the "moving main" protocol: main was at
`d5151d2` at dispatch, `45eddc6` when the lanes merged, and a1's and a3's
commits were rebased and re-tested before the fast-forward.

## Lanes

| lane | item | result |
|------|------|--------|
| a1 | p52 | `d9906f4` — a bare `.Nm` in a `T{`/`T}` cell expands to the document name; two tests, `man-diff` 0 lost on both crypt pages |
| a2 | p50 | **no commit** — the flake hunt OOM-killed the container; the in-progress test patch is preserved at `$LOOP/p50-crash/a2-wip.patch` and the item is back in the queue with a bounded-load requirement |
| a3 | p48 + p30 | `2c5b9df` — `man-diff --page` prints `lost <n>`; `keyOf` folds U+2010/U+2011/U+2212 to ASCII `-`; pcre2demo 67 → 12; new `test/man-diff.mjs` (6 tests) |

a2's death cost the lane, not the round: the merge step found nothing to
merge, left the branch alone, and the round ran with two lanes. That is the
park-not-reset rule doing its job.

## Measurement at `2c5b9df`

- Corpus: `4121 parsed, 29 refused of 4150` — unchanged from the base
  (`d5151d2`), as expected: p52 turns a cell into text, not a refusal.
  The 29 include the two Czech `.do hla`/`.do hpf` pages (p58).
- Section 3, whole (`man-diff --section 3 --max 0`): **3 pages / 14 words**,
  down from 5 / 71 after round 14.
  - pcre2demo(3) 12: all typographic quotes (p60), the hyphen half is done.
  - TIFFReadScanline(3tiff) 1, pcre2_compile(3) 1: an ASCII-hyphen line end in
    `.nf` text (`byte-` + `and`, `paren-` + `theses`) that the diff joins on
    the reference side only (p62).
- Suite at the tip: 1902 passing, 2 pending, check clean. Man tests 543
  (was 533 after round 14; `a5229a8` added 2, this round 8).

Sections 1, 5, 7 and 8 were not re-measured: no parser output changed there
(this round's parser change touches nine `.Nm`-in-cell pages, all section 3),
but the `keyOf` change is in the diff tool itself, so their next whole-section
sweep may move by a word or two without a parser change.

## What the round exposed

- The old lane setup (worktrees without `node_modules`/`lib`) would have
  failed every test; `lanes-up.sh` now provisions them.
- An unbounded flake-hunt load is an outage. p50 is `next` with a rule:
  `timeout`, at most `nproc-2` workers, and never an unbounded `yes` loop.
- The queue's `files` column made the hot-file swap mechanical: a2's original
  item (p51, `js/man.mjs`) was moved to `next` because the user had touched
  that file within two hours; a2 took the cold flake item instead.

## Still open

p51 (compressed magics), p58 (`.hla`/`.hpf`), p60 (quote fold), p61 (`Fo`/`Fc`
semicolon), p62 (ASCII-hyphen diff join), p49 (coverage re-measure), p47
(residuals), p50 (flake, bounded), p57, and the parser backlog.
