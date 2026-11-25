# Round 59 — a done hash must name its work

Base `e0e2a11`, merged tip `6434838`, 2026-11-25 13:57Z. One lane.

| lane | item | result |
|------|------|--------|
| a3 | l2 | `6434838` — `check` now requires the done hash's `Loop-item:` trailer to name the item, an item it was absorbed by (`absorbedBy`), or a batch row (`batch`); two scratch-repo tests pin both sides |

This closes the hole that let round 57 record c11 done with a peer's grooming
commit: the hash was on main, so the old check was satisfied. The batch rows
now carry `batch: 1` and p54 carries `absorbedBy: p125`, so the absorbed
marks stay valid.

Gate red at base, green after the rebase. Suite **2080 passing, 2 pending**,
check clean at `6434838`. No measure: tooling has no entry in `measures`, and
`loop check` is this round's measure.

Record on `loop/r59`, one fast-forward to main.
