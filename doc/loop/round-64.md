# Round 64 — a startup placeholder, quoted arguments, a mis-decoded byte

Base `c4c15fa3`, integrated tip `9c9e1b12`, suite and check green at the tip
(`$LOOP/round-64-suite.log`), measured at `9c9e1b12` over 4150 installed pages.

## Lanes

| item | lane | tip | what changed |
|------|------|-----|--------------|
| c15 | a2 | 2f97b214 | `Spawning docker...` and `Creating session...` are drawn with sentinel ids no part can claim, and `clearStartupMsgs` removes them when the prompt is accepted (and on the error path), so a normal turn no longer leaves the placeholder above the first message or lets a part-id-0 delta land in it |
| p130 | a1 | a0e05f0b | `\$@` quotes each argument (`["a" "b" "c"]`), `\$*` stays the plain join; the split is applied in `expand()` and `copyMode()` |
| p109 | a3 | 9c9e1b12 | `keyOf` drops U+FFFD and re-reads a word of byte-sized Latin-1 characters as UTF-8 when that decode is valid, so thumbpdf(1)'s lone `C2` byte folds to `©`; an invalid pair still reports |

Proofs: c15 `test/code-prompt-e2e.mjs --grep placeholder` (1 failing → 1
passing); p130 `test/man-parse.mjs` (new test red at base, 380 passing after);
p109 `test/man-diff.mjs` (two new tests red at base, 24 passing after) and the
single page `lost 1 → lost 0`. Each proof was red at base and green after the
rebase, and each commit stayed inside its row's file set.

## Measurement at 9c9e1b12

    corpus    4150 pages: 4123 parsed, 27 refused   (unchanged)
    sweep     1:0p/0w  3:0p/0w  5:0p/0w  7:0p/0w  8:0p/0w
    core      6 timing runs, 0 failures, 0 timeouts; 17 modules, lines 75.6, branches 88.7
    code      20 events: 19 translated, 1 dropped (session.step.streamed), 0 malformed

Section 1 reaches 0 lost words: p109 closed the last one. The 27 refusals are
the same upstream page bugs and eqn (unchanged by this round).

## Left in the queue

- p130's lane found that `\$*` joins an argument holding an escaped space with
  two spaces where groff emits one; not tested or filed as a row yet.
- The b7 groom helper's note that `\S(` shares `\v(`'s `skipValue` path, so
  `\S(2` likely has the same 2-char-name bug. b7 is `ready` with red tests.
