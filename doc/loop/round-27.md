# Round 27 — unicode names are canonical or refused

Base `946f4fa`, merged tip `0385d60`, 2026-11-24 23:50Z. One lane.

| lane | item | result |
|------|------|--------|
| a1 | p82 | `0385d60` — `u` names are `uA`/`dA` arrows or groff's canonical 4–6 upper-case hex (`u21D1`); non-canonical forms and unknown names are refused; 3 tests |

Gate red→green; suite **1978 passing, 2 pending**, man tests 581, check clean.
Measurement unchanged: **1:10p/25w  3:0p/0w  5:0p/0w  7:2p/7w  8:2p/7w**.

The lane corrected the item's wording: at base `\[uA]` was refused (a loose
`'\n' == 0` check), not rendered as a newline; the bogus decode was real for
`uAB`/`u1`/`uE`. The fix rejects the non-canonical form at the root.

Found, queued:

- **p86**: `..` maps to `‥` (U+2025) but groff refuses it; `\[char0x41]` is
  accepted but groff takes decimal `charNNN` only; missing arrows/lines
  `va`/`vA`/`an`.
- p80 (`hy`), p84 (`*G`), p85 (`*f`) still queued.

Record on `loop/r27`, one fast-forward to main.
