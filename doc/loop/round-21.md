# Round 21 — breaks, and a comma the page marks

Base `f365b5d`, merged tip `aae6139`, 2026-11-24 22:20Z. Run on
`bin/loop.mjs round 21 --items p69,p72`.

## Lanes

| lane | item | result |
|------|------|--------|
| a1 | p69 | `2e66879` — a `.br` before text adds no blank line, consecutive breaks collapse, a trailing break is dropped; p56's flush line preserved; 5 new tests |
| a3 | p72 | `aae6139` — `man-diff` joins a comma-marked `\:` break inside an option list, source-backed (no whitespace after the marked comma); ps(1) 103 → 95, dmsetup(8) 7 → 5; 2 new tests |

Both gates red→green; suite at the tip **1964 passing, 2 pending**, man tests
567, check clean.

## Measurement at `aae6139`

- Corpus: 4123 parsed, 27 refused of 4150 — unchanged.
- Whole sections: **1:15p/137w  3:0p/0w  5:0p/0w  7:2p/7w  8:2p/7w**.
  Section 1 was 15p/145w and section 8 was 2p/9w; no page got worse.
- The comma rule is narrow on evidence: only `ps.1` (four locales) and
  `dmsetup.8` contain `,\:` at all, none followed by whitespace.

## Found, queued

- **p73**: `toText` ignores `space` blocks, so `.sp`/blank lines are invisible
  to `asText` while `man-render` draws them. Measurement-neutral (`normal()`
  collapses whitespace), pre-existing (a1).
- **p74**: ps(1)'s remaining 95 words are a parser defect — `.BR pcpu ).`
  inside a `T{ }` tbl cell stays raw macro text instead of `pcpu).`; every
  `T{ }` cell using a macro is affected (a3).

## State

Record on `loop/r21`, then one fast-forward to main. p74 is the next a1 item;
its round must also update the ps(1) pin in `test/man-diff.mjs`, so pair it
with an a3 item that does not touch that file, or run it alone.
