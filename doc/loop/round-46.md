# Round 46 — copy mode and a list marker

Base `e0a3680`, merged tip `4dd8ef8`, 2026-11-25 13:52Z. Two lanes; c9 stayed a
triage because the branch it names looks unreachable with the current
translations.

| lane | item | result |
|------|------|--------|
| a1 | p100 | `5b95c88` — `copyMode` is one left-to-right pass, so the backslash it produces from `\\` is not re-examined by the `\ ` rule; dmstats(8) 2 → 0 |
| a3 | p123 | `4dd8ef8` — a `-dash`/`-hyphen` list is named `man-dash` and the stylesheet draws a hyphen instead of a disc |

Both gates red at base with the lane's test files, green after the rebase;
both commits touched only their rows' files. Suite **2048 passing, 2
pending**, man tests 619, check clean at `4dd8ef8`.

## Measurement at `4dd8ef8`

- man: **1:3p/3w  3:0p/0w  5:0p/0w  7:0p/0w  8:1p/1w** — 4 words on 4 pages
  (was 6 on 5). dmstats is clean; section 8 is dmsetup(8)'s `load|reload`
  alone. 4123 parsed / 27 refused of 4150, unchanged.
- code: 20 events, 19 translated, 1 dropped, 0 malformed. Unchanged.
- core: 75.6% lines, 88.7% branches; 6 flake runs at 4 workers, 0 failures.
  Unchanged.

## Found, queued

- **p124** (triage): `copyMode` still reduces `\.` to `.`, so a body line that
  starts with `\.` becomes an unknown request and refuses the page, where
  groff prints nothing and does not warn. No corpus occurrence; p100 fixed only
  the space half.
- p115 was folded into p100 during grooming: dmstats was its corpus instance.

Record on `loop/r46`, one fast-forward to main.
