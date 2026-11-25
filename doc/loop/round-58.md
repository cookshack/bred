# Round 58 — synthetic notes, retried

Base `b0a1a0b`, merged tip `57c1d58`, 2026-11-25 13:53Z. One lane.

| lane | item | result |
|------|------|--------|
| a2 | c11 | `57c1d58` — `session.synthetic` translates to one legacy event with text and description; the handler appends a log line for the buffer's own session |

## The round-57 mis-merge

Round 57 recorded c11 done at `1947f160`, but that commit is a peer's grooming
commit, not c11's: the peer moved the row from lane a2 to a3 between dispatch
and gate, the round looked for a commit on a3, found none, merged nothing, and
still reported success. The code sat on a2's branch (`5d17dc30`). This round
re-armed the row on a2 and checked the `merged c11` line before recording.
`1947f160` remains in main's history as the peer's own commit.

Gate red at base, green after the rebase. Suite **2078 passing, 2 pending**,
check clean at `57c1d58`. Measured `--area code` only: 20 events, 19
translated, 1 dropped, 0 malformed (no fixture has a synthetic event yet).

## Found, queued

- **l2** (infra): `check` accepts any hash that is an ancestor of main, so a
  done item can point at an unrelated commit. It should require the doneHash
  commit to carry `Loop-item: <id>` or a batch trailer that names the item.

Record on `loop/r58`, one fast-forward to main.
