# Round 39 — copy rounds per macro, and an em-dash join

Base `cf0e61b`, merged tip `6b36716`, 2026-11-25 07:40Z. Two lanes.

| lane | item | result |
|------|------|--------|
| a1 | p99 | `7032014` — each tmac-built request gets the measured number of copy rounds (`B`/`I`/`SH`/`SS`/`IP` one extra, `BR`/`BI`/… two, `OP` three); xargs fixed; 7 tests |
| a3 | p113 | `6b36716` — `man-diff` joins a non-spaced `\(em` line break; gittutorial-2 0, ttf2pk 4 → 2 as a bonus; 4 tests |

The item's "one round" was only true for part of the family; the lane measured
per macro. Gate red→green; suite **2005 passing, 2 pending**, man tests 608,
check clean.

## Measurement at `6b36716`

**1:8p/11w  3:0p/0w  5:0p/0w  7:1p/5w  8:2p/7w** — totals 23 words on 11 pages,
down from 28 on 13. Section 7 lost gittutorial-2; section 1 lost xargs and two
ttf2pk words.

## Bookkeeping

Rounds 22–38's aggregate doc edits were uncommitted in the canonical checkout;
the reviewer caught it. They are staged in `cf0e61b`, and the record rule now
says the aggregate docs are part of the round's record commit. A `land` check
for a dirty `doc/` tree is queued.

## Found, queued

- **p116**: `.UE`/`.ME`/`.URL`/`.MTO` trailing arguments lose a copy round.
- **p117**: a zero-width escape (`\b`) is refused here and printed by groff;
  no corpus occurrence, latent.

Record on `loop/r39`, one fast-forward to main.
