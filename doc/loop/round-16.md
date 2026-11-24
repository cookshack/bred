# Round 16 — bytes, hyphenation requests, and a clean section 3

Base `212b3ef`, merged tip `f3f1539`, 2026-11-24 13:25Z.

## Lanes

| lane | item | result |
|------|------|--------|
| a1 | p58 | `9ba3175` — `.hla`/`.hpf` are known no-output requests; both Czech pages parse; new test |
| a2 | p51 | `c2b32ec` — `runToString` can keep a byte-per-char reading for the `cat` fallback, so the sniff sees the real signature and a mislabelled page names its format; 1 new test |
| a3 | p60 + p62 | `f3f1539` — `keyOf` folds U+2018/U+2019/U+201C/U+201D (U+2018 to a backtick); hyphen joins are now decided from the page source and applied to both sides; 5 new tests |

First merge attempt hung: the a2 narrow test (`npx mocha test/man-viewer.mjs`,
without `--exit`) printed 158 passing and then did not exit, and `round.sh` was
killed at 15 minutes. Fixed by adding `--exit` to every `lane-a*.test` and a
`timeout` around both the narrow tests and the verify commands. The second
attempt merged all three.

## Measurement at `f3f1539`

- Corpus: **4123 parsed, 27 refused of 4150** — exactly round 14's count. The
  29 refused at round 15's base were the two Czech pages; p58 is the whole
  difference, so the "drift" was a real dialect gap after all, not only a
  package update.
- All five sections, whole (`man-diff --section N --max 0`):

  ```
  section  1     3   5   7   8
  pages   16     0   0   2   2
  words  147     0   0   7   9
  ```

  Round 14 was 20/154, 5/71, 6/6, 3/8, 2/9. Sections 3 and 5 are now clean;
  section 1 improved by the quote fold and the source-decided join even though
  its parser did not change. Section 1's remains: ps(1) 103, ttf2tfm(1) 10,
  tbl(1)/gtbl(1) 7 each, ttf2pk(1) 5, hg(1) 2, man(1) 2. Section 7:
  editline(7) 5, gittutorial-2(7) 2. Section 8: dmsetup(8) 7, dmstats(8) 2.
- Suite: 1911 passing, 2 pending, check clean; 552 man tests.
- Coverage (c8, whole suite): `man-char` 100/100, `man-parse` 99.97/94.56,
  `man-render` 100/98.75, `man-roff` 100/97.18, `man.mjs` 98.88/90.28
  (lines/branches).
- The coverage run **reproduced p50**: `wode-view-e2e` "stale peer push during
  revert keeps content" failed with `'v1X' !== 'v1'` under c8 instrumentation.
  The item is no longer `triage`; it has a red test and a preserved patch
  (`$LOOP/p50-crash/a2-wip.patch`).

## What the round exposed

- a2's renderer fix is correct but not sufficient in the running app:
  `js/main-shell-run.mjs` builds `stdoutBuffer` as a string (`stdoutBuffer +=
  data` calls `String(Buffer)`, i.e. a UTF-8 decode) and sends that string over
  IPC. So the renderer never sees the bytes live, and gzip/xz/zstd still do
  not name their format. New item p63, with the lane's evidence.
- A mocha command that lacks `--exit` can hang after printing the result; the
  merge step now bounds it. Nothing else in the round was affected.

## Still open

p63 (main-process bytes), p50 (ready, red test under load), p49 (coverage, now
measured), p47 (residuals), p57, and the parser backlog (p61, p59, p44, p53,
p54, p55, p56, p19, p33, p34, p45).
