# Round 49 — link tails

Base `29be1d7` (round 48's land), merged tip `fc63c08`, 2026-11-25 12:55Z.
One lane.

| lane | item | result |
|------|------|--------|
| a1 | p110 | `fc63c08` — `.UE`/`.ME` join every trailing argument before expanding it, so tload(1)'s `.UE , and` prints `, and`; tload 1 → 0 |

Gate red at base with the new test, green after the rebase; two files inside
the row. Suite **2063 passing, 2 pending**, man tests 621, check clean at
`fc63c08`.

## Measurement at `fc63c08`

- man: **1:1p/1w  3:0p/0w  5:0p/0w  7:0p/0w  8:1p/1w** — 2 words on 2 pages
  (was 3 on 3). Section 1 is thumbpdf(1) alone; section 8 is dmsetup(8).
- code: 20 events, 19 translated, 1 dropped, 0 malformed. Unchanged.
- core: 75.6% lines, 88.7% branches; 6 flake runs, 0 failures. Unchanged.

## Found, queued

- **p109 becomes a triage.** thumbpdf(1) contains a raw 0xC2 byte followed by
  `\[co]` (`Copyright \302\[co] 1999`), which is not valid UTF-8. Our decode
  yields U+FFFD + `©`; groff reads the byte as U+00C2 and prints `Â©`. The page
  is mis-encoded upstream. Either refuse a page whose decode has U+FFFD (the
  faithful-or-refuse policy) or map invalid bytes the way groff does; both move
  the 4123/27 refusal count, so it is a decision, not a lane fix.

Record on `loop/r49`, one fast-forward to main.
