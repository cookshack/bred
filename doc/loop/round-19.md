# Round 19 — the section survives a subsection

Base `ebfa4f3`, merged tip `74ba52d2`, 2026-11-24 17:00Z. Run on
`bin/loop.mjs round 19 --items p67,p68`.

## Lanes

| lane | item | result |
|------|------|--------|
| a1 | p67 | `ba79104` — a `.Ss` no longer replaces the top-level `.Sh` section, so `.Fn`/`.Fc` keep their `;` in a SYNOPSIS subsection; `.Nm` bold and `.In`'s `#include` are restored by the same change; 1 new test |
| a2 | p68 | `74ba52d` — a failed read of an existing regular file now outranks a later missing part; 1 new test |

Both gates fired and the suite at the tip is green: **1955 passing, 2
pending**, man tests 558, check clean.

## Measurement at `c635fb0`

- Corpus: 4123 parsed, 27 refused of 4150 — unchanged.
- Whole sections: **1:16p/147w  3:0p/0w  5:0p/0w  7:2p/7w  8:2p/9w** —
  unchanged; both fixes add or reorder punctuation/messages, not words.

## What the lanes found

- The `.Ss` fix is one line but restores three behaviours, because
  `c.mdoc.section` is the SYNOPSIS flag for `.Nm`, `.In` and the declaration
  semicolon (a1 verified all three against groff).
- p68's rank order is now 3 (permission on an existing file), 2 (read failure
  on an existing file), 1 (missing/unstattable), with equal ranks keeping the
  later reason; p57's permission-before-miss test still passes.
- Noted, not a bug: a *whole* colon line that stats as a regular file returns
  its read error directly through `wholeStatted`/`wholeFailed`, so the ranking
  only covers split parts and the two wordings are identical at different call
  sites (a2).

## State

Record on `loop/r19` with `Loop-verify: c635fb0`, then one fast-forward to
main. p50 (needs a proof red at base) and p65 (coverage-only) stay `next`.
