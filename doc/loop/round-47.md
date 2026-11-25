# Round 47 — a device-name escape that was not one

Base `dded7fa`, merged tip `c1f2f38`, 2026-11-25 14:14Z. One lane.

| lane | item | result |
|------|------|--------|
| a1 | p108 | `c1f2f38` — `escapeChars` mapped `\T` to `utf8`, so tex2aspc(1)'s `\TransformNotes` printed `utf8ransformNotes`; a bare `\T` is the letter (groff prints `TransformNotes`, and the device name is `\*[.T]`). tex2aspc 1 → 0 |

Gate red at base with the lane's test file, green after the rebase; one file
inside the row. Suite **2049 passing, 2 pending**, man tests 620, check clean
at `c1f2f38`.

## Measurement at `c1f2f38`

- man: **1:2p/2w  3:0p/0w  5:0p/0w  7:0p/0w  8:1p/1w** — 3 words on 3 pages
  (was 4 on 4). Section 1 is thumbpdf(1)'s `Â©` and tload(1)'s `and`; section 8
  is dmsetup(8)'s `load|reload`. 4123 parsed / 27 refused of 4150, unchanged.
- code: 20 events, 19 translated, 1 dropped, 0 malformed. Unchanged.
- core: 75.6% lines, 88.7% branches; 6 flake runs at 4 workers, 0 failures.
  Unchanged.

Nothing new to queue: the two remaining section-1 rows are already p109
(thumbpdf) and p110 (tload), and dmsetup is p115's sibling only by section.

Record on `loop/r47`, one fast-forward to main.
