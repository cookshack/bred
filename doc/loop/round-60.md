# Round 60 — the done-hash rule, corrected

Base `e5a2e35`, merged tip `ad68333`, 2026-11-25 15:38Z. One lane.

| lane | item | result |
|------|------|--------|
| a3 | l2 | `ad68333` — `check` requires the done hash's own diff to touch a file the row owns; rows with no files are exempt |

Round 59's trailer rule was too strict: it reported 36 problems on main, all
rows from before the trailer convention or legitimate absorbs. The diff rule
catches round 57's peer grooming commit (it touches none of c11's files) and
reports 0 on main.

Gate red at base, green after the rebase. Suite **2080 passing, 2 pending**,
check clean (0 problems) at `ad68333` with the new rule. No measure: tooling
has no entry in `measures`.

Record on `loop/r60`, one fast-forward to main.
