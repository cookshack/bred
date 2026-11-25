# Round 34 — `\N[65]`

Base `0305d0a`, merged tip `1219a56`, 2026-11-25 02:10Z. One lane.

| lane | item | result |
|------|------|--------|
| a1 | p91 | `1219a56` — `\N[65]` reads as a bracket argument; decimal-only and the `'`/`"` forms stay; 2 tests |

The fix is local to the `\N` branch: `unquote()` must not strip brackets
generally, because `\w[abcdef]` counts them. Gate red→green; suite **1988
passing, 2 pending**, man tests 591, check clean. Measurement unchanged.

Found, queued: **p94** (`\N[ 65]` with a leading space is accepted by groff
and refused here).

Record on `loop/r34`, one fast-forward to main.
