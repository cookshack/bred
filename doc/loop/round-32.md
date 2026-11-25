# Round 32 — ASCII `u` names need a special glyph

Base `b84447d`, merged tip `01f65ce`, 2026-11-25 01:15Z. One lane.

| lane | item | result |
|------|------|--------|
| a1 | p87 | `01f65ce` — a `u` code point is refused only when groff's name for that glyph is plain (`A`, `zero`, `!`); special names (`u0040` for `@`, `u007E` for `~`, space, controls) still resolve; 1 test |

The lane corrected the item's wording: "all ASCII is refused" was too broad.
The rule is groff's glyph table, and every code point U+0000–U+007F now agrees
with groff except `u0000`. Gate red→green; suite **1985 passing, 2 pending**,
man tests 588, check clean. Measurement unchanged.

Remaining: **p88** (`\N` number forms), **p89** (`char0`/NUL), both next.

Record on `loop/r32`, one fast-forward to main.
