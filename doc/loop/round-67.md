# Round 67 — a streaming tool input, the minors stack, and a table comment

Base `2e1f57fe`, integrated tip `dad8d3bf`, suite and check green at the tip
(`$LOOP/round-67-suite.log`). Measured at `dad8d3bf` over 4150 installed pages.

## Lanes

| item | lane | what changed |
|------|------|--------------|
| c12 | a2 | `session.tool.input.delta` translates to a `message.part.delta` with `field: 'input'`, gated on a `toolStreaming` flag that `.started` sets and `.ended`/`.called` clear, so a delta whose start a reconnect dropped stays dropped. The view grows a `.code-msg-input` preview and draws the pending tool line itself, because every handler guards on `state.input.path` while the input is still a string. New fixture `test/fixtures/oc-events/tool-input.jsonl`: 4 events, 4 translated |
| p140 | a3 | `seqMode` walks `buf.minors` before the major mode, in `doc/Em.md`'s order (`[ targetEm?, minor1.., mode, parentEms.., root ]`); the return shape is untouched, leaving p141 clear |
| p131 | a1 | a `.`-led line at table-row level is a control line roff reads to end of line, so it owns no row; the skip happens before the tab split, `'` stays data, and a `T{` cell's comment line falls out of the same filter |

## What the gate and the row got wrong, and how it was fixed

`c12` was parked on the first gate run for `outside its file set:
test/code-conformance.mjs, test/fixtures/oc-events/tool-input.jsonl`. That was
the scheduler's error: the brief told the lane to add both and the row had not
listed them. The row now owns them, and the re-gate merged with 5 files inside
the set.

The recovery of that parked commit exposed a second, worse error: the first
recovery attempt cherry-picked the three lanes onto `main` in the canonical
checkout. Main was restored to `2e1f57fe`, each lane was put back on its own
commit, and the round was re-run from scratch by the tool. Nothing was lost and
no lane's work was discarded; the round below is the tool's own.

## Measurement at dad8d3bf

    corpus    4150 pages: 4123 parsed, 27 refused   (unchanged)
    sweep     1:0p/0w  3:0p/0w  5:0p/0w  7:0p/0w  8:0p/0w
    core      6 timing runs, 0 failures/timeouts
    code      20 events: 19 translated, 1 dropped (session.step.streamed), 0 malformed

The code area's population is still the two fixtures it names; c12's new
`tool-input.jsonl` is classified by its own conformance test but is not in the
measure's population, so the 20 does not move. Widening that population is a
separate decision.

## Found by the lanes, filed for later

- `c12`: a streaming tool has no line until a handler's guard is satisfied, so
  the preview had to draw the pending line itself; a follow-up could have
  `.started` render a named tool line through one generic path and drop the
  `(streaming)` fallback label.
- `p131`: `.ne` (any `.`-led request outside the `tableRequests` whitelist) at
  row level draws a row where groff draws none; a mid-line comment inside a
  `T{` cell loses the rest of the cell; `.TS H` header comments leak as a
  literal `.TH` cell row. Three separate rows.
