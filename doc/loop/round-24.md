# Round 24 — a table continuation inherits its options

Base `7aec567`, merged tip `3f79ddf`, 2026-11-24 23:05Z. One lane.

## Lane

| lane | item | result |
|------|------|--------|
| a1 | p44 | `3f79ddf` — a `.T&` table part inherits the first part's global options (`tab(;)`), so the `;` stops appearing in the cell; tbl 7 → 1 lost; 1 test |

The lane was **parked by the files gate on the first attempt**: the brief named
`test/man-parse.mjs` but the queue row listed only `js/man-parse.mjs`. The gate
diffed against the row, parked the branch with a patch, and printed the
outside path. The row was fixed, the branch reset to its rebased commit, and
the round re-run. That is the failure mode the gate exists for, and it was a
dispatch error, not the lane's.

## Measurement at `3f79ddf`

- Corpus: 4123 parsed, 27 refused of 4150 — unchanged.
- Whole sections: **1:12p/27w  3:0p/0w  5:0p/0w  7:2p/7w  8:2p/7w**.
  Section 1 was 12p/39w: tbl/gtbl lost 7 words each and now lose 1 each; no
  page got worse. Suite at the tip **1973 passing, 2 pending**, man tests 576.

## Found, queued

- **p78**: `L\[tmu]C` renders `L™C`; groff prints `L×C`. `js/man-char.mjs`
  maps `tmu` to `™` instead of `×`. It is the last lost word on tbl/gtbl (a1).
- **p79**: on the same page a `l ld`/`r ^` table orders `foo` before `r`;
  man prints `r` then `foo` (word order around a vertical span) (a1).

## Rule confirmed

The queue row's `files` is the ownership set. A brief may not widen it: if the
item needs another file, the row is widened first (and `report --write` run),
then the lane is dispatched.
