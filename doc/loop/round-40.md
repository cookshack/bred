# Round 40 — a continued argument, and a pipe join

Base `98d1f76`, merged tip `3bf287c`, 2026-11-25 08:15Z. Two lanes.

| lane | item | result |
|------|------|--------|
| a1 | p103 | `66f38b3` — a `\c` inside a macro argument continues the macro line; ttf2pk 2 → 0; 1 test |
| a3 | p114 | `3bf287c` — `man-diff` joins a source-marked `|`/`]` break; dmsetup 5 → 1; 1 test |

Gate red→green; suite **2011 passing, 2 pending**, check clean.

## Measurement at `3bf287c`

**1:7p/9w  3:0p/0w  5:0p/0w  7:1p/5w  8:2p/3w** — 17 words on 10 pages, down
from 23 on 11. ttf2pk is clean; dmsetup keeps one word (`load|reload`, a
token split across two macro calls, not a line break).

Found, queued: **p118** — a `\c` inside an interpolated macro argument must cut
the rest of the outer body line; groff does, we keep emitting (`pre `a tailnext`).

Record on `loop/r40`, one fast-forward to main.
