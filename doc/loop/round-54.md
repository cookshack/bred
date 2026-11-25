# Round 54 — registers, batched

Base `6f8a4a8`, merged tip `07e195d`, 2026-11-25 14:22Z. One lane, two items:
the first round under the protocol's batching rule.

| lane | item | result |
|------|------|--------|
| a1 | b1 | `07e195d` — `.nr X +2` adds and `.nr Y -3` subtracts (0 when the register is undefined); `.nr Z` with no value no longer defines Z |
| a1 | p45 | absorbed into b1; its relative-assignment test is in the commit |
| a1 | p120 | absorbed into b1; the no-value test is in the commit. The read-creates half stays refused by policy |

Gate red at base (both tests fail), green after the rebase. Suite **2071
passing, 2 pending**, man tests 624, check clean at `07e195d`.

Measured `--area man` only: the round touched one area, and `--area all` is
reserved for the final tip. 4123 parsed / 27 refused of 4150; 1:1p/1w (p109).
Code and core were not re-measured.

Record on `loop/r54`, one fast-forward to main.
