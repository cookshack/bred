# Round 51 — compaction is a log line

Base `47745b9` (an outside doc commit landed mid-round; the first integration
was re-gated on it), merged tip `ab98859`, 2026-11-25 13:45Z. One lane.

| lane | item | result |
|------|------|--------|
| a2 | c10 | `ab98859` — `session.compaction.started/ended/failed` translate to one legacy `session.compaction` with a phase; the handler appends a log line for the buffer's own session, with the ended summary flattened and capped at 200 chars. Deltas are dropped because the ended text is authoritative |

The decision (a log line, not a transcript item) is recorded on the row. Gate
red at base with the two positive translate tests, green after the rebase, twice
(the first base was `eda56f1`; `47745b9f` moved main). Suite **2067 passing, 2
pending**, check clean at `ab98859`.

## Measurement at `ab98859`

- man: 1:1p/1w, others 0 — unchanged. The only word is the p109 triage.
- code: 20 events, 19 translated, 1 dropped, 0 malformed. Unchanged: no
  fixture has a compaction yet, which is the measure's next input.
- core: unchanged.

## Found, queued

Nothing new. The tool refused the land after main moved, which is the
moving-main rule doing its job; the record names both bases.

Record on `loop/r51`, one fast-forward to main.
