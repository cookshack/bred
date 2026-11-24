# Round 17 — a semicolon, bytes across IPC, and a red merge

Base `9fe231b`, merged tip `9b8958c`, 2026-11-24 13:54Z.

## Lanes

| lane | item | result |
|------|------|--------|
| a1 | p61 | `b601364` — `.Fc` ends a SYNOPSIS declaration with `;` (section-sensitive; the same `.Fc` in DESCRIPTION does not); 1 new test |
| a2 | p50 | `fbdef92` — the flake's test waits on the push and adds a deterministic slow-revert variant; **reverted on main** (below); kept on the lane branch |
| a3 | p63 | `ec7eedf` — the pty sends Buffers across IPC and `js/shell.mjs` decodes with one streaming `TextDecoder` per run; the real-pty test now names `gzip`; 4 new tests |

## The merge was red, and why

`round.sh 17` merged all three and the suite in `verify-17` came back **1911
passing, 7 failing**. Each lane had been green alone. The failures were two
different things:

- **Six uncaught exceptions in `test/opt.mjs`'s `load` tests**:
  `Object.entries(undefined)` at `js/opt.mjs:26`, from a setTimeout in
  `js/tron.mjs`. A foreign fake left on `globalThis.tron` by another test file
  returned `{ err: 0 }` with no `data`; `Opt.load` called `load1` anyway. Adding
  `test/man-pty.mjs` (real pty) shifted the timing enough that the callback
  landed during the opt tests. Without it they did not appear.
- **Two failures in a2's own new tests**: `'v1' !== 'v1X'`. In the full suite the
  pushed text had not reached main when the test asserted; its wait chain was
  still not sufficient under the full suite's ordering. Standalone and under
  bounded c8 it passed.

Both were pre-existing isolation weaknesses made visible by the new tests. The
loop's rule is that a red tip is not a checkpoint, so:

- `b0b0afd` reverts the a2 test change. p50 returns to the queue with the
  failure evidence and `fbdef92` + `$LOOP/p50-crash/a2-wip.patch` as its record.
- `9b8958c` guards `Opt.load` against a response with no `data` (with a test)
  and has the `load` tests install their own fake per test instead of relying
  on import order. This is a loop stabilisation commit, not a lane's.

After both, the suite at `9b8958c` is **1915 passing, 2 pending**, check clean,
and the post-merge verify agrees.

## Measurement at `9b8958c`

- Corpus: **4123 parsed, 27 refused of 4150** — unchanged; `.Fc`'s `;` is
  punctuation and `keyOf` already strips it.
- Section 3 whole: **0 pages / 0 words** — still clean.
- Man tests 554 (was 552).
- The other sections were not re-measured: p61 changes SYNOPSIS punctuation,
  p63 changes IPC, and neither can change a word count. The diff tool did not
  change this round.

## Found, queued

- **p64**: `.Fn` in a SYNOPSIS also ends with `;` in groff; we do not print it
  (a1's evidence).
- **p65**: no fake emits a typed-array chunk split mid-UTF-8, so the streaming
  decoder in `js/shell.mjs` is proven only by real-pty timing (a3).
- **p66**: `flushPeer`'s `catch { return }` treats a throwing
  `sendableUpdates` as already flushed and would silently skip the wait (a2).
- **p50** is `ready`: it needs a test that is isolated from the full suite as
  well as green alone, then the same evidence under load.

## State at the stop

Main is `9b8958c`, green. The run stopped at the user's request after this
round; the loop upgrade is under discussion (`doc/Loop-upgrade.md` and
`doc/loop/plan-2026-11-24.md`).
