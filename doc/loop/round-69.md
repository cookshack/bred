# Round 69 — a span as one cell, and a modified key reaches otherwise

Base `4ed584b3`, integrated tip `f3bdd882`, suite and check green at the tip
(`$LOOP/round-69-suite.log`). Measured at `f3bdd882` over 4150 installed pages:
4123 parsed, 27 refused, and `1:0p/0w  3:0p/0w  5:0p/0w  7:0p/0w  8:0p/0w`.

## Lanes

| item | lane | tip | what changed |
|------|------|-----|--------------|
| p134 | a2 | 888271d2 | `tablePlans()` pairs each continuation cell (`cont`, or `up` for a `\^` item) with the cell above it at the same column offset, bumps that cell's `rowspan`, adopts the continuation's text when the top cell is empty (a bottom-anchored `d` span), and omits the continuation. Column matching tolerates a short row, so an unpaired continuation is skipped. `.man-bottom` gives the span `vertical-align: bottom` |
| p143 | a3 | f3bdd882 | `look1` returned `0` when a ctrl or alt key found no `Control`/`Alt` submap, before reaching `kb || otherwise`; it now records the miss, skips the plain lookup for that event, and reaches `otherwise` like any other unbound key |

## The design was decided by evidence, and the spec settled the other one

`p134`'s groom had to choose between rowspan and dropping the empty cell. A
first-column span settled it: groff draws `│      │ x  │` above `│1111  ├────┤`,
so the empty cell is a real column-1 cell the span covers — dropping it would
slide `x` left and erase the vertical border. `p134` implemented rowspan.

`p143` read `doc/Em.md` instead of guessing: step 2 makes ctrl/alt descent part
of lookup and step 4 says "if no match, try `otherwise`" with no modifier
exception, so the code was wrong. It deliberately did *not* invent a rule for
the one thing the doc leaves open (whose `otherwise` applies after a descent);
that is filed as a triage, `p155`.

## Filed this round

`p155` — whose `otherwise` wins after a `Control`/`Alt` descent. The code uses
the outer map's, and `js/ed.mjs:769-777` gives `emCtl`/`emAlt` their own
`otherwise` that is therefore dead. A decision, not a lane.

## The clock

This round started at 22:37Z and landed at 22:47Z, with `stopNew` at 23:09Z.
Two lanes were still finishing when it began; both reported before the gate, so
no work was left in flight.
