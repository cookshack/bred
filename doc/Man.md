# Man page viewer

Status: 2026-11-18. `C-h u` / `M-x man` opens a manual page in a div buffer.

## Policy

A page either renders faithfully or is refused. There is no fallback to
`man -Tutf8`/`-Thtml` output and no partial page: `parse()` returns `ok: 0` and
a list of `{ what, line }` failures, and the viewer shows those instead. The
point is that a broken render is visible and gets fixed, not hidden.

Because of that, two things must stay in sync when the corpus needs more:
the dialect inventory (`js/man-roff.mjs`) and the interpreter
(`js/man-parse.mjs`). Unknown constructs are failures, not ignored.

## Pipeline

1. `man -w topic` gives the installed source path (respects `MANPATH`, locale).
2. Read it with `zcat` (fall back to `cat`).
3. `.so`-only redirect pages are followed as topics (up to depth 3).
4. `ManParse.parse(source)` → block model.
5. `ManRender.render(doc)` → DOM; the view's content element is replaced.

Mid-page `.so` includes are refused by the viewer: the parser accepts an
include loader, but the viewer is synchronous at that point and cannot read
files. Fixing that means pre-fetching includes or resolving them in the main
process.

## Modules

| file | role |
|---|---|
| `js/man-roff.mjs` | dialect inventory: every macro/request/escape classified `render`/`metric`/`ignore`/`unsupported`; `scan(text)` for the static audit |
| `js/man-char.mjs` | closed table for `\(xx` / `\[name]`; unknown names fail |
| `js/man-parse.mjs` | interpreter for man(7), mdoc(7) and tbl; conditions, macros, strings, registers; block model; implicit `name(section)` linkification |
| `js/man-render.mjs` | block model → DOM (headings, paragraphs, tags, insets, lists, tables, pre, links) |
| `js/man.mjs` | viewer mode/commands: fetch, buffer per topic, reload, click-to-follow, TOC |
| `bin/man-audit` | corpus report; `--parse` runs the interpreter |
| `bin/man-diff` | content diff against `man -Tutf8` |
| `css/manpage.css` | page styles (reflow, no fixed width) |

Block model: `doc.blocks` of `heading{level,spans}`, `para{spans,synopsis}`,
`tag{tag,blocks}`, `group{blocks}`, `pre{spans,mono}`, `list{listType,items[
{tag,blocks}]}`, `table{options,cols,rows[{cells[{spans,colspan}]}]}`,
`space`. Inline spans are `{ text, style, href }` plus `{ br: 1 }`; styles are
`roman`, `bold`, `italic`, `mono`, `small`. The model has no DOM dependency so
it is unit-testable and could feed another renderer.

## Measuring

```
npm run check                          # style + layering
npx mocha test/man-roff.mjs test/man-parse.mjs test/man-render.mjs test/man-viewer.mjs
./bin/man-audit --parse                # pages parsed vs refused
./bin/man-audit --parse --list         # with the reason for each refusal
./bin/man-diff --section 1 --max 120   # content diff against man(1)
./bin/man-diff --page /usr/share/man/man1/ls.1.gz
```

`man-audit` without `--parse` reports the static dialect inventory (an upper
bound; it cannot evaluate `.if`). `man-diff` needs `man` installed; it ignores
headers/footers (including BSD-style dated footers), overstrike, automatic
hyphenation (U+2010), compound hyphens broken at a line end, box-drawing
characters and bullet markers, then reports reference words missing from our
text. `test/man-viewer.mjs` drives `Man.open` with fake `man -w`/`zcat`
responses, so the viewer is tested without the installed corpus.

## Current state

Corpus: 4150 installed pages (English + translations) on Debian trixie.

```
parsed   4122   (99.3%)
refused    28
```

The refusals are page bugs, not dialect gaps: undefined `\*(AQ` in 7
translations, malformed `\f\fI` in 6 Korean pages, `\fGDBM` in 2 gdbm pages,
ms macros (1), eqn (1), a `.p` typo, `It` without `Bl` (2), strace's undefined
`.IX`, and a few odd groff symbols (`Su`, `ts`, `R`, `\]`).

`man-diff --section 1 --max 400` leaves 25 pages with 82 missing words. Those
are measurement artifacts, not content loss: `.UR`/`.MT`/`.MTO` targets live in
the link href rather than the visible text, and man(1) sometimes fills a tag or
a long word onto the following line, so the reference splits `[n]<&digit-`
from `moves` where we keep one word. Enum labels are now part of `toText`.

Tests: 140 (inventory, interpreter, renderer, viewer).

## Known gaps, in order

1. Mid-page `.so` includes (3 pages: `rbash.1`, `bash-builtins.7`,
   `builtins.7`) — the parser takes an include loader, but the viewer has no
   read path to pass one.
2. Topic completion in the prompt (`Prompt.ask` has a `suggest` hook); the
   prompt only uses the word at point as a placeholder today.
3. Table styling: `box` should be an outer frame while `allbox` borders every
   cell; both currently use the same CSS.
4. `man -w` fallback for systems where `man` is mandoc (`man --path`).
5. Div buffers are not searchable with isearch; that is a general limitation of
   div views, not specific to man pages.
6. mdoc `Ex`/`Rv` expand to canned sentences; they are approximations of the
   real macro text.

## Changing it

- New man macro: classify it in `js/man-roff.mjs`, handle it in `man-parse.mjs`,
  add a test, rerun `man-audit --parse`.
- New request/escape: same, and prefer failing over "best effort" unless the
  construct is purely presentational (classify it `metric`/`ignore`).
- Keep `man-parse.mjs` DOM-free and `man-render.mjs` model-only.
- `.mso` is accepted only for `www.tmac` and `an-ext.tmac`, whose macros
  (`URL`, `MTO`, `UR/UE`, `MT/ME`) are implemented directly.
- `name(section)` in text is linkified to `man:name(section)`; the renderer puts
  the topic on `data-topic` and `man.mjs` follows clicks.
