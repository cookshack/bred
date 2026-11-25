# Round 52 — conditions that name their argument

Base `0c0540a`, merged tip `e7e0d67`, 2026-11-25 13:58Z. One lane.

| lane | item | result |
|------|------|--------|
| a1 | p121 | `e7e0d67` — `splitCond` treats the next token as part of the condition when the condition is `r`, `d`, `!r` or `!d`, so `.if r X yes` parses; escapes are skipped when finding the token |

Latent: no installed page hits it, but an-old.tmac writes the spaced form and
the parser refused the page with `condition r`. Gate red at base, green after
the rebase. Suite **2068 passing, 2 pending**, check clean.

## Measurement at `e7e0d67`

Unchanged: 4123 parsed / 27 refused of 4150; 1:1p/1w only (the p109 triage).
Code and core unchanged.

Record on `loop/r52`, one fast-forward to main.
