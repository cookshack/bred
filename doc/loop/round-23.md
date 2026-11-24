# Round 23 — a synopsis name and a quote-only token

Base `327fd08`, merged tip `72e8ca4`, 2026-11-24 22:50Z. Run on
`bin/loop.mjs round 23 --items p70,p71`.

## Lanes

| lane | item | result |
|------|------|--------|
| a1 | p70 | `d8a351c` — `.SY` expands escapes through `.B`'s path and drops extra arguments; `strace-log-merge` renders; 2 tests |
| a3 | p71 | `72e8ca4` — `man-diff` gives a quote-only token an empty key, so `mendex(1)`'s `""` collapses; 2 tests |

Both gates red→green; suite at the tip **1972 passing, 2 pending**, man tests
575, check clean.

## Measurement at `72e8ca4`

- Corpus: 4123 parsed, 27 refused of 4150 — unchanged.
- Whole sections: **1:12p/39w  3:0p/0w  5:0p/0w  7:2p/7w  8:2p/7w**.
  Section 1 was 14p/42w: `strace-log-merge` and `mendex` left the list; no
  page got worse.

## Found, queued

- **p76** (low): in mdoc mode the man(7) `.SY`/`.OP` pair renders with no
  separator (`strace-log-merge[-a]`); pre-existing, only if an mdoc page uses
  them (a1).
- **p77** (low): `js/man-parse.mjs` maps the `\t` escape and a literal tab to
  the same character, erasing groff's difference (zero width vs tab stop).
  `man-diff` now works around the consequence; the workaround is harmless if
  the parser ever distinguishes them (a3).
- p71's rejected alternatives are worth keeping: collapsing `"\t+"` inside
  quotes invented two words on awk/mawk/nawk, which is why the fix is at the
  key level.

## State

Record on `loop/r23`, then one fast-forward to main.
