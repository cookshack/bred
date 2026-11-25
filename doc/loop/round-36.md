# Round 36 — `.Rv`/`.Ex` have no `-exit`/`-nop` flags

Base `1c5c9f9`, merged tip `1c115f6`, 2026-11-25 03:10Z. One lane.

| lane | item | result |
|------|------|--------|
| a1 | p19 | `1c115f6` — only a leading `-std` is a flag; later arguments (including `-exit`/`-nop`) are names; a non-`-std` first argument prints nothing; 4 tests |

The lane disproved the item and the doc: groff 1.22.4, the corpus tarball's
1.25.0 `doc.tmac` and the 2026-09 OpenBSD `mdoc.7` all accept only `-std`, as
the first argument. Bred was searching for `-std` anywhere and then filtering
dash-prefixed names, so `.Rv -std -exit` lost the name and `.Rv memcpy -std`
printed a sentence groff does not. `doc/Man.md`'s "accepted and ignored" line
is corrected in this record's commit.

Gate red→green; suite **1993 passing, 2 pending**, man tests 596, check clean.
Measurement unchanged (no corpus page uses the forms).

The files gate parked the first attempt for a row that named one file too few
(the third dispatch error of the run); the row was widened and the round
re-run.

Record on `loop/r36`, one fast-forward to main.
