# Round 53 — a link tail takes its copy round

Base `dbd7e66` (a peer's tooling commit moved main mid-round; the first two
integrations were re-gated), merged tip `673c8b7`, 2026-11-25 14:15Z. One lane.

| lane | item | result |
|------|------|--------|
| a1 | p116 | `673c8b7` — `.UE`/`.ME` read their trailing arguments in copy mode before expanding them, so `a\\\\-` prints `a-` and `b\\\\\\\\-` prints `b\\-` |

Latent: no installed page has a backslash in a `.UE` tail, so the measurement
is unchanged. Gate red at base, green after the rebase, three times. Suite
**2069 passing, 2 pending**, check clean.

## Measurement at `673c8b7`

Unchanged: 4123 parsed / 27 refused of 4150; 1:1p/1w only (p109). Code and
core unchanged.

Record on `loop/r53`, one fast-forward to main.
