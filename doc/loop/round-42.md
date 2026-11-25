# Round 42 — a bar inside Fl, and a finished text part

Base `bd4acc9`, merged tip `c72362c`, 2026-11-25 10:30Z. Two lanes.

| lane | item | result |
|------|------|--------|
| a2 | p105 | `de1718c` — a bar inside `.Op Fl` is another flag, so ssh-agent's `[-c | -s]` keeps its dash; 1 test |
| a1 | c1 | `c72362c` — `session.text.ended` translates to the finished text part (its `text` is authoritative, not the delta sum); conformance 19 events: 17 translated, 2 dropped, 0 malformed; 1 test + fixture counts |

## The lane mismatch

The first attempt parked both lanes: `p105`'s row said `a2` but was dispatched
to `a1`, and `c1`'s row said `a2` while its work was in `a1`, so both items
claimed one lane. The tool's "two items on one lane" guard caught the second
pair, and the parked commits were recovered from the `-r42-aborted` branches.
The rows now name the branches the work was done on. This is the files-gate
lesson again: the queue row is the record of where the work lives.

## Measurement at `c72362c`

- man: **1:5p/5w  3:0p/0w  5:0p/0w  7:1p/5w  8:2p/3w** — 13 words on 8 pages;
  ssh-agent left the list.
- code: **19 events, 17 translated, 2 dropped, 0 malformed** (the two remaining
  drops are `session.retry.scheduled` and `session.step.streamed`).
- Suite **2026 passing, 2 pending**, man tests 611, check clean.

## Found, queued

- **c5**: `session.reasoning.ended` has the same authoritative `text` and is
  still dropped (c1's schema evidence).
- **c6**: the finished-part update reconciles `partTexts` and `lastText`, but a
  part rendered as plain `.code-msg-text` or seen only after its step ended is
  not re-rendered (`code.mjs`/`ui.mjs`, outside c1's files).
- **p119**: a bar ends the argument list of other multi-argument macros
  (`Ar`, `Cm`, `Ic`, `Pa`, …), so words after it lose the macro's font; content
  identical, style only, and each macro needs its own evidence.

Record on `loop/r42`, one fast-forward to main.
