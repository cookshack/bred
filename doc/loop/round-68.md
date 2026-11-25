# Round 68 — a space key, the minor order, and two paren escapes

Base `94dfe428`, integrated tip `3fc48a88`, suite and check green at the tip
(`$LOOP/round-68-suite.log`). Measured at `3fc48a88` over 4150 installed pages.

## Lanes

| item | lane | what changed |
|------|------|--------------|
| c17 (p141, p142) | a3 | p141: `Em.seq` built its answer with `acc + cur + ' '` and then trimmed, so the space key's own separator was the whitespace the trim ate — a binding on `' '` decoded to `''` and `'C- '` to `'C-'` (which does not even parse). It now accumulates finished events and joins between them, so `' '`, `'C- '`, `'C-A- '`, `'C-x C- '`, `'a b'`, `'C--'` and `'-'` all round-trip through `lib/ev-parser.mjs`. p142: `Cmd.get` walked `buf.minors` forward while `Cmd.getAll` and `Em.mainGetActive` both put the last-added minor first, so the key that ran a command came from the newer minor and the command object from the older; `get` now walks the same way |
| p133 | a1 | `\h` gets its recovery in `skipMotion` (the `(` is one ignored character, and `\h'2'b`/`\h[2m]b`/`\h+01` keep their motion), and `\l` gets a branch of its own: the paren form draws nothing, while the delimited form still refuses until line drawing is modelled |

## A test that enshrined the bug

`test/ed.mjs:141` asserted `Em.seq('mark set') === 'C-'`. `'C-'` does not parse
back through `lib/ev-parser.mjs`, so that assertion could not describe a real
binding: it recorded the trim. The lane refused to widen its own file set and
said so; the queue row was widened instead, and the one-line flip is its own
commit. This is the p102 pattern the protocol names: a fix that makes an old
green test wrong must flip it, and the lane must not do that quietly.

## Measurement at 3fc48a88

    corpus    4150 pages: 4123 parsed, 27 refused   (unchanged)
    sweep     1:0p/0w  3:0p/0w  5:0p/0w  7:0p/0w  8:0p/0w

No corpus page uses `\h(`/`\l(` (zgrep finds only TeX prose), so the man number
does not move; the fix is correctness, not measurement.

## A stalled round, and the clock

This round's two lanes were briefed and marked `in-round` at 19:18Z but not
dispatched until 22:26Z, so about three hours of the window went unused. The
clock is the authority and it says so: elapsed 6h32m of 8h with 42 minutes to
stopNew when they were finally launched. The rows looked like progress; nothing
was running. `bin/loop.mjs status` shows a lane's tip, and a lane still at the
round base is the tell.

## Filed this round

`p148`–`p150`: the rest of the paren-escape class (`\L(`, the silently-wrong
`\o(`, and `\Z(`/`\b(`/`\D(`). `p149` matters most: `\o(2b` returns `ok: 1`
and prints a wrong page with no failure, which is the one thing the project's
policy forbids.
`p151`/`p152`: a `\^`-only table row's model, and the ragged row `tableFit`
can produce.
`p153`: `test/em.mjs` assumes a pristine `Em.root`, so it fails after the
`em-seq-*` files in one process (11 failing at base; green today only by file
order).
`p154`: `Cmd.getMo`'s `parentsForEm` walk is commented out.
