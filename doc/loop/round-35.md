# Round 35 — surrogates are not characters

Base `956b7c5`, merged tip `e7b1a52`, 2026-11-25 02:40Z. One lane.

| lane | item | result |
|------|------|--------|
| a1 | p92 | `e7b1a52` — a surrogate code point is refused like an out-of-range one; the boundaries U+D7FF/U+E000 still work; 1 test |

Gate red→green; suite **1989 passing, 2 pending**, man tests 592, check clean.
Measurement unchanged.

Found, queued: **p95** — groff's `\[charN]` is a glyph/table lookup, not a bare
code point: `\[char57344]` warns and prints nothing, while bred returns
U+E000. `char65`/`char233`/`char200` agree, so the table boundary needs work.

Record on `loop/r35`, one fast-forward to main.
