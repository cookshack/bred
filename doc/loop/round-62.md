# Round 62 — joins, space blocks, and a finished part

Base `0baf2cdb`, merged tip `596bc1a7`, 2026-11-25 15:40Z. Two lanes.

The round was first gated on `8f3eabee` and main moved under it (`0baf2cdb`,
the helper protocol). It was re-gated on the new base; the numbers below are
the re-gate's.

| lane | item | result |
|------|------|--------|
| a1 | b4 | `f6b63ada` — batch: p55 a `\c` survives one blank line (two still break); p73 `toText` draws a blank line for a space block; p126 a define/remove-only request keeps a pending `\c` join |
| a2 | c6 | `596bc1a7` — a finished text part re-renders: it rewrites a plain `.code-msg-text` node and no longer needs its step to still be active |

Gate red at base with each lane's test file, green after the rebase. Suite
**2086 passing, 2 pending** at `596bc1a7` (5 new tests), check clean.

Measured `--area man` at `596bc1a7`: 4123 parsed / 27 refused of 4150; sweep
1:1p/1w (p109), 3/5/7/8 clean — unchanged, as expected for a round with no
corpus page. Measured `--area code` at the same tip: 20 events, 19 translated,
1 dropped (`session.step.streamed`, c2), 0 malformed.

Two findings from the lanes were filed, not fixed: p128 (a `.`-only line with
no pending `\c` still draws a gap) and p129 (`.sp N` loses its count). c6's
report also filed c13 (a text delta with no message element is drawn as
thinking). Two rows were closed by evidence with a verdict instead of a lane:
p127 (mdoc body text is already roman) and p65 (the streaming decoder is
already correct; its test would be coverage-only).

Record on `loop/r62`, one fast-forward to main.
