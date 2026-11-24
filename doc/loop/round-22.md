# Round 22 — a table cell runs its text macros

Base `905648c`, merged tip `00dc308`, 2026-11-24 22:35Z. One lane, because the
ps(1) pin lives in `test/man-diff.mjs`: pairing it with another diff item
would overlap.

## Lane

| lane | item | result |
|------|------|--------|
| a1 | p74 | `00dc308` — a `T{ }` cell's text macros are run (`.BR`, `.B`, `.I`, `.Xr`, `.Fl`, the mdoc set); ps(1) 95 → 0; 4 tests (3 parser, the ps pin) |

The gate was red at base (the new cell tests and the tightened ps pin) and
green after; suite at the tip **1968 passing, 2 pending**, man tests 571,
check clean. p74 is the only lane commit, so the tip is the lane's commit.

## Measurement at `00dc308`

- Corpus: 4123 parsed, 27 refused of 4150 — unchanged.
- Whole sections: **1:14p/42w  3:0p/0w  5:0p/0w  7:2p/7w  8:2p/7w**.
  Section 1 was 15p/137w: ps(1) went from 95 lost to 0, no page got worse.

## Found, queued

- **p75**: `.IP "" 2` inside ps(1)'s cells (and the nested `.TS` value lists)
  is still raw cell text — the 18-word surplus, not lost content. `.IP` draws
  no text; it may join `tableRequests` or need its own no-op handling (a1).
- Behaviour note: macro-bearing cells now expand line by line, so a `\c` in
  such a cell joins lines instead of truncating the rest of the cell; plain
  cells keep the old whole-text path.

## State

Record on `loop/r22`, then one fast-forward to main.
