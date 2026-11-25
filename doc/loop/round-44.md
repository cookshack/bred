# Round 44 — a no-space bracket, a footer, and a thinking repair

Base `1490e8a`, merged tip `a3607bd`, 2026-11-25 12:05Z. Three lanes.

| lane | item | result |
|------|------|--------|
| a1 | p107 | `9612e96` — `Ns` after `.Op Ar user` … survives the closing bracket; ssh-copy-id 1 → 0; 15 groff variants checked |
| a2 | c7 | `fd65122` — an ended reasoning update repairs the thinking block (`finalizeThinking`); red test timed out at base |
| a3 | p106 | `a3607bd` — a right-aligned multi-page footer token is not content; rpcgen 1 → 0; `isFooter` exported and unit-guarded |

All three gates red→green; suite **2040 passing, 2 pending**, man tests 615,
check clean.

## Measurement at `a3607bd`

- man: **1:3p/3w  3:0p/0w  5:0p/0w  7:1p/5w  8:2p/3w** — 11 words on 6 pages;
  section 1 lost ssh-copy-id and rpcgen. Its three left are tex2aspc,
  thumbpdf, tload.
- code: **20 events, 18 translated, 2 dropped, 0 malformed** — unchanged (c7 is
  display, not translation).

## Found, queued

- **c8**: `Ui.appendThinking` decides create-vs-append from one view's out box
  and applies it to every box, so a delta can duplicate a thinking block in
  another tab (pre-existing; c7's replacement path is per-box).
- The last section-1 words are already queued: p108 (tex2aspc), p109
  (thumbpdf), p110 (tload).

Record on `loop/r44`, one fast-forward to main.
