# Round 66 — a cell, a box, and a mode key

Base `0945e685`, integrated tip `9dbfaa9d`, suite and check green at the tip
(2117 passing, 2 pending; `$LOOP/round-66-suite.log`). Measured at `9dbfaa9d`
over 4150 installed pages.

## Lanes

| item | lane | tip | what changed |
|------|------|-----|--------------|
| b8 | a1 | b8f0fabc | an `.IP` with no tag inside a `T{` cell is a request, not cell text, and a `.`-only line adds nothing and keeps a pending `\c`; ps(1) 6710 → 6701 of man(1)'s 6692 |
| c9 | a2 | 067cfca9 | `handlePartDelta` asks every box whether the part's thinking block exists and hands the delta to `Ui.appendThinking`; `chunkText`/`appendMsg` are called once per delta, not once per box, so a split no longer appends `ab` twice |
| p139 | a3 | 9dbfaa9d | `Mode.remove` deletes the key the mode was stored under, so a mixed-case registration can be removed |

## Two briefs were wrong, and the lanes said so

- `c9`'s brief claimed a reasoning delta never reaches a second box. It already
  did after c8, and c13 had replaced the fallback, so that red did not
  reproduce. The lane proved two *different* reachable defects instead (a box
  that lacks the block, and the once-per-box double append) and pinned both.
- `b8`'s row called p75 "the 18-word ps(1) surplus". It is 9; the other 9 are
  `p131`'s table-row comment. The lane measured 6701 against man(1)'s 6692 and
  said so.

Both are the protocol working: the row is a claim to be proved, not an
instruction to be obeyed.

## Measurement at 9dbfaa9d

    corpus    4150 pages: 4123 parsed, 27 refused   (unchanged)
    sweep     1:0p/0w  3:0p/0w  5:0p/0w  7:0p/0w  8:0p/0w
    suite     2117 passing, 2 pending; check clean

`man-diff` reports lost words, so b8's 9-word *surplus* does not show in the
sweep; it shows in the word count (`--page ps.1.gz`). That is the measurement's
own limitation, now written into the rows that depend on it.

## Filed this round

- `p146` — `Mode.add('')` stores the empty key, which `get`/`remove` then treat
  as not-found (found by p139's lane).
- `p147` — a bounded audit of every escape whose copy-mode and text meanings
  differ, since b9's `\t` regression proved `escapeChars` is shared and the two
  passes can disagree.
- `l3` — `Claims.live` returns on a future `expires` before reading the pid, so
  a dead lane's lease survives `reap` (found by c9's lane, which had to release
  its own item by hand).
