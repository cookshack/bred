# Round 33 — `\N` is a decimal number, not a JS number

Base `3186f0f`, merged tip `50a83a6`, 2026-11-25 01:45Z. One lane.

| lane | item | result |
|------|------|--------|
| a1 | p88 | `50a83a6` — `\N` accepts an optional `+` and decimal digits; `0x41`/`1e2`/`0` refuse the page instead of decoding through `Number()`; 2 tests |

The lane corrected the item: groff's `\N` is a numeric *expression*
(`65+1` → 66), and non-canonical forms print a NUL/control plus the unconsumed
tail. Copying that is not useful for a text renderer, so the page is refused.
The corpus only uses plain decimals, so nothing installable changes.

The files gate parked the first attempt: the brief named `js/man-parse.mjs`
(the `\N` branch lives there) but the row did not. Row widened, branch reset,
round re-run. Gate red→green; suite **1986 passing, 2 pending**, man tests 589,
check clean. Measurement unchanged.

Found, queued: **p91** (`\N[65]` bracket form unsupported), **p92** (unpaired
surrogate code points accepted), **p93** (expression forms refused by design,
record the decision).

Record on `loop/r33`, one fast-forward to main.
