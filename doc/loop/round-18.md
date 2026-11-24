# Round 18 — the first round on the tool

Base `58a0543`, merged tip `c1562d7`, 2026-11-24 15:52Z. Run on the new
`bin/loop.mjs`: `round 18 --items p64,p57,p66`.

## Lanes

| lane | item | result |
|------|------|--------|
| a1 | p64 | `cc7042c` — `.Fn` in a SYNOPSIS ends with `;`, body sections do not; 1 new test |
| a2 | p57 | `6e94402` — a colon-list part with no read bits outranks a later missing part; 1 new test |
| a3 | p66 | `c1562d7` — `flushPeer` reports an unreadable collab field instead of calling it flushed; the revert aborts visibly rather than rebuilding; 1 new test |

Every gate fired: files inside the queue row, proof red at base, proof green
after the rebase, suite and check at the integrated tip.

## What the first run found (tool bugs, not lane bugs)

1. `provision()` linked `ext/*/lib` but copied `lib/`. The minimap extension's
   relative imports followed the symlink back to the canonical repo and loaded
   a second `@codemirror/state`; three minimap tests failed. `58a0543` copies
   `ext/*/lib` into the worktree instead.
2. `spawnSync`'s default 1 MB `maxBuffer` killed the suite with `ENOBUFS`
   (SIGTERM) after about 1,500 tests; the tool reported "suite failed" with no
   test name. `c91ef03` raises the buffer and writes
   `$LOOP/round-<n>-suite.log`, and the CLI prints the log path.

Both were invisible to the unit tests, which use a scratch repo and a fake
suite; the end-to-end run through the CLI is what found them.

## Measurement at `c1562d7`

- Corpus: 4123 parsed, 27 refused of 4150 — unchanged.
- Whole sections: **1:16p/147w  3:0p/0w  5:0p/0w  7:2p/7w  8:2p/9w** —
  unchanged; `.Fn`'s `;` is punctuation, so no word count moves.
- Suite at the tip: 1951 passing, 2 pending; man tests 556 (was 554).

`doc/loop/history.jsonl` has the record.

## Found, queued

- **p67**: a `.Ss` subsection inside SYNOPSIS resets the section state, so both
  `.Fn` and `.Fc` lose their `;`. groff keeps the synopsis state across `.Ss`;
  no installed page hits it (a1's evidence).
- **p68**: a part with read bits whose read fails still ranks level with a
  missing part, so a later miss can shadow it; no test covers that ordering
  (a2's evidence).

## State

Main moves by one fast-forward after the record on `loop/r18` carries
`Loop-verify: c1562d7`. p50 and p65 stay `next`: p50 needs a proof that fails
at base, p65 is coverage-only and the red gate would park it.
