# Round 31 — hy is a typographic hyphen

Base `9daf8c9`, merged tip `cbbe080`, 2026-11-25 00:55Z. One lane.

| lane | item | result |
|------|------|--------|
| a1 | p80 | `cbbe080` — `\[hy]` is U+2010; a literal `-` and `\-` stay ASCII; 1 test |

Gate red→green; suite **1984 passing, 2 pending**, man tests 587, check clean.
No installed page uses `\[hy]`, so the measurement is unchanged.

Found, queued:

- **p90**: `groff -Tutf8 -man` renders `\-` as U+2212 MINUS SIGN while
  `-mdoc` prints ASCII; bred prints ASCII. p30's earlier note about `\-` was
  mdoc-only. Needs evidence and a decision (a1).

Record on `loop/r31`, one fast-forward to main.
