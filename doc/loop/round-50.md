# Round 50 — a join through requests that draw nothing

Base `4a32f5c`, merged tip `eac2c89`, 2026-11-25 13:19Z. One lane.

| lane | item | result |
|------|------|--------|
| a1 | p125 | `eac2c89` — a `\c` is inherited through a request that neither prints nor ends the line (metric requests, and `ft`/`ftr`/`in`/`ti`/`ta`/`ce`); dmsetup(8) 1 → 0, and its `test/man-diff.mjs` pin moved with it |

Gate red at base with the three-shape test, green after the rebase; three files
inside the row. Suite **2064 passing, 2 pending**, man tests 622, check clean
at `eac2c89`.

## Measurement at `eac2c89`

- man: **1:1p/1w  3:0p/0w  5:0p/0w  7:0p/0w  8:0p/0w** — 1 word on 1 page.
  Section 8 is now clean; the only measured word is thumbpdf(1)'s mis-encoded
  byte, which is the p109 triage. 4123 parsed / 27 refused, unchanged.
- code: 20 events, 19 translated, 1 dropped, 0 malformed. Unchanged.
- core: 75.6% lines, 88.7% branches; 6 flake runs, 0 failures. Unchanged.

## The man area's measured work is done

Every section is clean except the one page whose *input* is invalid UTF-8.
That is a policy decision (p109), not a parser gap. Further man work is the
latent list in the queue (dialect claims with no corpus occurrence), which the
loop should take only when the code and core areas have nothing better.

Record on `loop/r50`, one fast-forward to main.
