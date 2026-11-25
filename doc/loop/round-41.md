# Round 41 — the second area starts, and a paren join

Base `481b76e`, merged tip `f6ff0e7`, 2026-11-25 10:30Z. One lane, plus a man
fix the reviewer landed directly.

| lane | item | result |
|------|------|--------|
| a1 | g1 | `f6ff0e7` — `bin/oc-record.mjs` records a real v2 stream; `bin/oc-conformance.mjs` classifies `translated/dropped/malformed`; `minimal.jsonl` (10 events, 8/2/0) and a sanitized `live.jsonl` (9, 7/2/0); 6 tests |
| — | p104 | `f6aceef` — `man-diff` joins a `\:` break before `)`; hg 2 → 0 |

`p104` was claimed by the reviewer, re-diagnosed as a diff join (not a parser
bug), and landed directly; the round's suite verifies it, but its red-at-base
proof is in its report rather than the lane gate. `g1` was the only lane.

## Measurement at `f6ff0e7`

**1:6p/7w  3:0p/0w  5:0p/0w  7:1p/5w  8:2p/3w** — 15 words on 9 pages, down
from 17 on 10. Section 1 lost hg's two words (7 → 6 pages is the round-40
starting point after p104 landed; the round-40 number above already includes
it).

Suite **2024 passing, 2 pending**, man tests 610, check clean.

## The new area's first measure

- Fixture: 10 events, 8 translated, 2 dropped, 0 malformed.
- Live recording (2.7 s against the local server): 9 events, 7 translated, 2
  dropped, 0 malformed.
- `session.idle` is deprecated server-side; the turn ends with
  `session.execution.succeeded`, which `translate` already maps to idle. The
  recorder stops on either.
- Dropped types exposed: `session.text.ended`, `session.step.streamed`,
  `session.retry.scheduled`, `provider.updated`, `model.updated`. They are the
  first queue items for `ext/code` (c1–c5), each a triage/verify question until
  the intended behaviour is named.

Record on `loop/r41`, one fast-forward to main.
