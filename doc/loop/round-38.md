# Round 38 — an argument is copied, then interpreted

Base `af77e7a`, merged tip `d21a9d5`, 2026-11-25 04:05Z. One lane.

| lane | item | result |
|------|------|--------|
| a1 | p97 | `d21a9d5` — a macro call's arguments go through copy mode at the call; the body line's expand is the interpretation round; ttf2tfm 2 → 0; 1 test |

Gate red→green; suite **1995 passing, 2 pending**, man tests 598, check clean.

## Measurement at `d21a9d5`

**1:9p/14w  3:0p/0w  5:0p/0w  7:2p/7w  8:2p/7w** — section 1 was 10p/16w.
ttf2tfm is now 3591/3591 and left the list.

## Found, queued

- **p99**: built-in man requests (`.B`, `.BR`, `.SH`, `.SS`, `.SY`, `.IP`,
  `.OP`) get one round here and two in groff, because groff implements them as
  tmac macros; `.B a\\\\b` is `a\b` in groff and `a\\b` here.
- **p100**: `copyMode()` chains replacements and over-reduces `\\.` and `\ `.
- **p101**: a single-backslash body (`\$1`) is expanded at definition time in
  groff, not call time.
- **p102**: an unknown escape is printed by groff (`\Z` → `Z`) and refused
  here; the new copy round can expose it, so a sweep of refusal counts is
  wanted after this round (the lane spot-checked 60 man1 pages and the 12
  four-backslash pages: no new refusals).

Record on `loop/r38`, one fast-forward to main.
