# Round 25 — tmu is a multiplication sign

Base `6c4a625`, merged tip `ee005d2`, 2026-11-24 23:15Z. One lane.

## Lane

| lane | item | result |
|------|------|--------|
| a1 | p78 | `ee005d2` — `\[tmu]` is U+00D7 (`×`), `\[tm]` stays `™`; tbl/gtbl 0 lost; 1 test |

The gate was red at base and green after; suite at the tip **1974 passing, 2
pending**, man tests 577, check clean.

## Measurement at `ee005d2`

- Corpus: 4123 parsed, 27 refused of 4150 — unchanged.
- Whole sections: **1:10p/25w  3:0p/0w  5:0p/0w  7:2p/7w  8:2p/7w**.
  Section 1 was 12p/27w: tbl(1)/gtbl(1) left the list entirely.

## Found, queued (the lane compared the whole table with `groff_char(7)`)

- **p80**: `hy` prints ASCII `-`; groff prints U+2010. Page-visible (a Unicode
  hyphen vs ASCII), measurement-neutral because `man-diff` folds it.
- **p81**: Greek capitals are shifted one letter: `*H` is `Η` but should be
  `Θ`, `*Q` `Θ` should be `Ψ`, `*Y` `Ψ` should be `Η`; lowercase is correct.
- **p82**: `\[uA]` is not in the table, so the `u`-hex fallback yields U+000A
  instead of groff's U+21D1; an unknown `u`-name gets a bogus code point rather
  than a refusal.
- **p83** (coverage): about 110 `groff_char(7)` names are absent (box pieces,
  `md`, `c*`, `r!`, `OK`, `Eu`, fractions). Expected for the corpus claim, but
  p82's fallback hides the gaps.

## State

Record on `loop/r25`, then one fast-forward to main.
