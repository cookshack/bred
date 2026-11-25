# Round 56 — joins and Sm, batched

Base `9b6b5f7`, merged tip `7846c1d`, 2026-11-25 14:52Z. One lane, two items.

| lane | item | result |
|------|------|--------|
| a1 | b3 | `7846c1d` — an empty `.de` body pushes a frame, so a `\c` before it carries (`xy`); `.Sm off` also suppresses the space before a text line (`-ab`) |
| a1 | p98 | absorbed: the empty-body test is in the commit; the `.ft`/`.ll` half was p125's, and a body that breaks still drops the join |
| a1 | p33 | absorbed: the mdoc Sm off test is in the commit |
| — | p54 | closed as absorbed by p125 (verified: `.ft` between `\c` and text joins) |
| — | p55 | disproved: groff breaks the paragraph after a blank line, as we do |

Gate red at base, green after the rebase. Suite **2077 passing, 2 pending**,
man tests 630, check clean at `7846c1d`.

Measured `--area man` only: 4123 parsed / 27 refused of 4150; 1:1p/1w (p109).
Code and core were not re-measured.

Record on `loop/r56`, one fast-forward to main.
