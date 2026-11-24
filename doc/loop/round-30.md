# Round 30 — strict char names

Base `03ac363`, merged tip `6943a15`, 2026-11-25 00:45Z. One lane.

| lane | item | result |
|------|------|--------|
| a1 | p86 | `6943a15` — `..` is refused, `char` is decimal-only, `va`/`vA`/`an` added; 3 tests |

Gate red→green; suite **1983 passing, 2 pending**, man tests 586, check clean.
Measurement unchanged.

Found, queued:

- **p87**: `\[u0041]`/`\[u0065]` (ASCII code points) are refused by groff but
  resolve here; `unicodeCode` should not accept U+0000–U+007F.
- **p88**: `\N'0x41'`/`\N'1e2'`/`\N'0'` are read with `Number()`, so hex and
  exponent forms become characters; groff reads digits only.
- **p89**: `\[char0]` is accepted by groff (a NUL byte) but refused here.

Record on `loop/r30`, one fast-forward to main.
