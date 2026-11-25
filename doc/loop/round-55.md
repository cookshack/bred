# Round 55 — character forms, batched

Base `7080df4`, merged tip `091f8e5`, 2026-11-25 14:40Z. One lane, two items.

| lane | item | result |
|------|------|--------|
| a1 | b2 | `091f8e5` — `\[charN]` is a glyph lookup: 0..255 prints, above it nothing (was U+E000); `\N[ 65]` skips leading spaces inside the bracket |
| a1 | p94 | absorbed: the bracket-space test is in the commit |
| a1 | p95 | absorbed: the char256/char57344 tests are in the commit |
| — | p89 | verdict, not a fix: groff prints a NUL byte for char0 and the text model refuses NUL, as rounds 33-35 decided |

Gate red at base, green after the rebase. Suite **2075 passing, 2 pending**,
man tests 628, check clean at `091f8e5`.

Measured `--area man` only: 4123 parsed / 27 refused of 4150; 1:1p/1w (p109).
Code and core were not re-measured.

## Correction

Round 54's record said "2071 of 2073" and "624 man tests"; both were derived,
not measured. This round quotes only counts it measured: 2075 passing and 628
man tests, and the header's numbers come from them.

Record on `loop/r55`, one fast-forward to main.
