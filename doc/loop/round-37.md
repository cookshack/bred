# Round 37 — a continued line glues to a macro body

Base `9a011e5`, merged tip `7183a0e`, 2026-11-25 03:35Z. One lane.

| lane | item | result |
|------|------|--------|
| a1 | p96 | `7183a0e` — a `\c` before a macro call is handed to the macro body's first printing line; ttf2tfm 10 → 2 lost; 1 test |

The diagnosis was not "we drop `\c`" but "we attach it to the call line, which
prints nothing". The fix is guarded on `frames` growing, so `.ft`/`.ll` and
p12's forward-only rule are untouched. Gate red→green; suite **1994 passing, 2
pending**, man tests 597, check clean.

## Measurement at `7183a0e`

**1:10p/16w  3:0p/0w  5:0p/0w  7:2p/7w  8:2p/7w** — section 1 was 10p/25w.
ttf2tfm's eight backtick clusters are back; its last 2 words are a different
bug (below).

## Found, queued

- **p97**: four backslashes in a macro argument need two reduction rounds
  (`\\\\` → `\\` in copy mode, then → `\` in interpretation); we apply one, so
  `c:\\fonts\\truetype` keeps doubles. ttf2tfm's last two words.
- **p98**: a `\c` before a macro whose body prints nothing (or before a
  non-printing request) is still lost; groff glues it forward. The broader
  variant also glues across `.PP`/`.RS`/`.sp`, where groff's behaviour needs a
  multi-macro sweep before changing anything.

Record on `loop/r37`, one fast-forward to main.
