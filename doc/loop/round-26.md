# Round 26 — Greek capitals

Base `7a6f460`, merged tip `c3ff554`, 2026-11-24 23:30Z. One lane.

| lane | item | result |
|------|------|--------|
| a1 | p81 | `c3ff554` — `*H`/`*Q`/`*Y` follow groff (`Θ`/`Ψ`/`Η`); lowercase controls unchanged; 1 test |

Gate red→green; suite **1975 passing, 2 pending**, man tests 578, check clean.
Measurement unchanged: **1:10p/25w  3:0p/0w  5:0p/0w  7:2p/7w  8:2p/7w**.

Found, queued:

- **p84**: `*G` is missing from the table; groff prints `Γ` (U+0393), so a page
  using `\[*G]` is refused today.
- **p85**: `*f` maps to `φ` (U+03C6); groff prints `ϕ` (U+03D5). `*J`/`*j`/
  `*V`/`*v` are absent from groff too, so those are not gaps.
- `groff_char(7)` is not installed in this image; groff itself was the
  authority for this audit.

Record on `loop/r26`, one fast-forward to main.
