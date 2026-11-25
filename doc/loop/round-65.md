# Round 65 — the man tail, a delta's part id, and a regression caught

Base `c30236b3`, integrated tip `5027366f`, suite and check green at the tip
(`$LOOP/round-65-suite.log`). Measured at `5027366f` over 4150 installed pages.

## Lanes

| item | lane | tip | what changed |
|------|------|-----|--------------|
| b9 | a1 | 04dce915 → e792dd0b → 2002c14a | three batches on one branch: b7 (p79 vertical table span, p83 21 groff_char names, p34 `\v(` has no paren form), b6 (p102 an unknown escape prints its letter, p76 `.SY`/`.OP` keep their space in mdoc, p77 a literal tab is a tab stop) and p145 (copy mode reads `\t` as a tab stop) |
| c16 | a2 | 412e322a | `session.text.delta`/`session.reasoning.delta` derive their part id from the event's `assistantMessageID`+`ordinal`, so a reconnect that dropped the started event no longer attributes every delta to part 0; the dead `textID`/`thinkID` state is gone |
| p132 | a3 | 5027366f | `doc/Man.md`'s scoreboard names its tip and population, every section measures 0 pages / 0 words, the round-16 table is history, and rounds 51-65 have their paragraphs |

## The regression, and how it was caught

Section 1 measured **2 pages / 78 words** at the first integrated tip
(`3c408273`): `troff(1)` 42 and `unzip(1)` 36. The cause was b6's `\t` rule,
which is right for a text line (`a\tb` is `ab`) and wrong for copy mode, where
`\t` is a tab stop (`.BR color "\t524288"` prints `color     524288`). p145
fixed it in `copyMode()` with a test that pins all five halves, and the
re-measure at `5027366f` is:

    corpus    4150 pages: 4123 parsed, 27 refused   (unchanged)
    sweep     1:0p/0w  3:0p/0w  5:0p/0w  7:0p/0w  8:0p/0w

Both pages reach an exact word match (troff(1) 1479/1479, unzip(1)
7113/7113). The lesson is the protocol's: measure what the round changed, at
the merged tip, before landing — the lanes' own proofs were all green.

## Also this round (filed, not merged)

- `p139`-`p144`: six core bugs from a bounded hunt, each with a red test and a
  divergence from `doc/Em.md` or the code's stated contract.
- `p135`/`p136`: the man inventory still calls the 27 ignored escapes unknown;
  a literal tab in filled text is not modelled.
- `p133`/`p134`: `\h(`/`\l(` still read a 2-char name; a vertical span's text
  is right but the renderer draws an extra empty `<td>`.
- `c12`: groomed to `ready` — a streaming tool input must translate to a
  `message.part.delta` with `field: 'input'`, with a red test and a fixture
  plan. It waits for `ext/code/` to be free.

## Left open

`c9` was dispatched on a2 beside c14 and had not committed when the round
merged, so its row stays `ready`; c16 is c14 alone. The a2 lane is otherwise
quiet.
