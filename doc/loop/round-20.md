# Round 20 — breaks and a cell's left edge

Base `abcdc30`, merged tip `8c684ac`, 2026-11-24 21:55Z. Run on
`bin/loop.mjs round 20 --items p56,p47`.

## Lanes

| lane | item | result |
|------|------|--------|
| a1 | p56 | `889ce7c` — no separator space after `.br`; the old test at 2470 was enshrining it. Three tests changed/added |
| a3 | p47 | `8c684ac` — `man-diff` joins a wrapped word in an unbordered table cell whose continuation starts at the cell's left edge; `man(1)` 2 → 0 |

Both gates red→green; suite at the tip **1957 passing, 2 pending**, man tests
560, check clean.

## Measurement at `8c684ac`

- Corpus: 4123 parsed, 27 refused of 4150 — unchanged.
- Whole sections: **1:15p/145w  3:0p/0w  5:0p/0w  7:2p/7w  8:2p/9w**.
  Section 1 was 16p/147w: `man(1)`'s `hy‐`/`phen` are one word again and no
  other page changed (15 pages, 145 words).

## Found, queued

- **p69**: `.br` before any text emits an extra blank line, and two consecutive
  `.br`s are not collapsed (groff: one break). Same break span, different
  symptom (a1).
- **p70**: `strace-log-merge(1)` prints `strace\-log\-merge` literally in the
  synopsis; `synopsisStart` pushes `args[0]` raw where `handleFont`/`OP`
  expand it (a3's evidence).
- **p71**: `mendex(1)`'s one "lost" word is a tab display difference (`""` vs
  two `"` tokens), not lost content; leave or treat tabs differently in
  `man-diff` only.
- `gpg(1)` is already 0 lost; the p47 row was stale.

## State

Record on `loop/r20`, then one fast-forward to main; queue marks and the
generated table follow.
