# Round 63 — macro arguments and a reconnect delta

Base `9978571c`, merged tip `aa5130e6`, 2026-11-25 15:58Z. Two lanes.

| lane | item | result |
|------|------|--------|
| a1 | b5 | `30263abb` — batch: p101 a single-backslash `\$1` expands at definition time; p118 a `\c` inside an interpolated argument cuts the rest of the body line; p119 a bar is roman and does not end an mdoc argument list |
| a2 | c13 | `aa5130e6` — a text delta with no started part draws no thinking block; a delta whose element is gone opens the assistant box the ended part then finishes |

Gate red at base with each lane's test file, green after the rebase. Suite
**2095 passing, 2 pending** at `aa5130e6` (9 new tests), check clean.

Measured `--area man`: 4123 parsed / 27 refused of 4150; sweep 1:1p/1w (p109),
3/5/7/8 clean — unchanged. Measured `--area code`: 20 events, 19 translated,
1 dropped (`session.step.streamed`), 0 malformed.

A groom helper proved c9 real and left its red test uncommitted; the scheduler
applied its proposal (`bin/loop.mjs apply`) so c9 is `ready` with the test
patch at `$LOOP/groom-c9-test.patch`. A second groom helper took p109 (the
last measured word in section 1, thumbpdf's `Â©`) and its proposal is left in
`$LOOP` for the next round.

Filed from the lanes, not fixed: p130 (`\$@` does not quote its arguments),
c14 (text/reasoning deltas take their part id from `state`, so a dropped
started event attributes them to part 0 — c13's root cause), c15 (the
`Creating session...` placeholder is never removed).

Record on `loop/r63`, one fast-forward to main.
