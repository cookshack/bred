# Man page viewer

Status: 2026-11-19. `C-h u` / `M-x man` opens a manual page in a div buffer.

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
   It may print more than one candidate, one per line or as a colon-separated
   list, possibly mixed with diagnostics; paths are deduplicated and each is
   tried in order until one reads. A colon only separates paths when the part
   before it ends like a manual source (a section or a compression suffix), so
   a colon inside a filename such as `/x/a:/b.1` does not split it. Only a
   line that starts with `/` is scanned for paths, so a warning that mentions
   a path with a colon cannot inject a bogus path or hide the real one. A
   missing binary (exit 126/127, `command not found`, ENOENT) or a spawn
   failure is reported as `Cannot run man: ...`, not as `No manual entry`.
   The BSD/mandoc `man` implements `-w` as well (listing the search path when
   given no name), so no `man --path` fallback is needed.
2. Read it with `zcat`, falling back to `cat` only when `zcat` fails. An empty
   file is a valid page, not a read error, and is never sent to `cat` (which
   would print gzip bytes).
3. `.so`-only redirect pages are followed as topics (up to depth 3), keeping
   the target's section so `foo.1` and `foo.8` stay different pages. A
   redirect that reads a file already seen is refused as
   `Redirect cycle: a -> b -> a`, and a longer chain as
   `Redirect chain too deep: ...`. Redirect targets are resolved with the same
   `man -w` lookup, so a missing target reports both ends, for example
   `Redirect from a to b.8: No manual entry for b.8`.
4. Mid-page `.so` targets are resolved first: `gatherIncludes` turns each
   relative target into a topic, reads it with `man -w`, and recurses (up to
   depth 5); a target that starts with `/` is a file and is read directly.
   The collected text is passed to the parser as its include loader. A `.so`
   that revisits a target already open is refused as an `include cycle`, so a
   page that includes itself (directly or through another page) cannot loop.
5. `ManParse.parse(source)` → block model.
6. `ManRender.render(doc)` → DOM; the view's content element is replaced.

The prompt takes the ways people actually type a page: `printf(3)`,
`3 printf`, `printf (3)` and surrounding whitespace all open `printf(3)`.
A leading number that is not a valid section (`0 ls`, `33 ls`) and a bare
section (`(1)`) are refused before `man` runs. A path is read directly instead
of going through `man -w`: an absolute path, `./foo.1`, `../foo.1`, `~/foo.1`,
or a bare source name such as `foo.1` in the pane's directory. A path is a
plain filename, so spaces and colons in it are kept (only `~` and `~/` are
expanded; `~user` is refused). A bare name is ambiguous, so if the file does
not read it falls back to a topic lookup; explicit paths report
`Cannot read ...` and do not guess. A directory named like a page fails its
read and is never parsed.

Links to `http:`, `https:`, `mailto:` and `ftp:` open in the desktop browser
through `shell.open` and never navigate the window. Any other scheme is
refused with a message; `#...` links scroll within the page and `man:...`
links open another topic.

Refresh bumps a per-buffer load generation; a response or include prefetch from
an older generation is ignored, so refreshing while loading (or twice) keeps
the newest result. A path page is re-read from its path, not looked up again
with `man -w`. A failed refresh shows its error and the buffer stays usable;
reopening a refused or failed page retries it.

`M-x man` completes topics with `man -k '^prefix'` (cached per prefix); a
section prefix is stripped for the query and results are filtered to that
section, so `3 pr` suggests `printf(3)` rather than asking for `^3 pr`. A
suggestion closes the prompt and opens the page; a prompt submission is kept
in history and replaying one reopens or refreshes its page.

## Modules

| file | role |
|---|---|
| `js/man-roff.mjs` | dialect inventory: every macro/request/escape classified `render`/`metric`/`ignore`/`unsupported`; `scan(text)` for the static audit |
| `js/man-char.mjs` | closed table for `\(xx` / `\[name]`; unknown names fail |
| `js/man-parse.mjs` | interpreter for man(7), mdoc(7) and tbl; conditions, macros, strings, registers; block model; implicit `name(section)` linkification |
| `js/man-render.mjs` | block model → DOM (headings, paragraphs, tags, insets, lists, tables, pre, links) |
| `js/man.mjs` | viewer mode/commands: fetch, include prefetch, buffer per topic, reload, click-to-follow, TOC |
| `bin/man-audit` | corpus report; `--parse` runs the interpreter |
| `bin/man-diff` | content diff against `man -Tutf8` |
| `bin/fetch-man-corpus` | download Linux man-pages, groff and OpenBSD into `.corpus/` |
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
./bin/man-audit --parse --render       # parse and draw every page
npm run test-corpus                    # same, as a pass/fail test (slow, writes man-corpus.log)
./bin/fetch-man-corpus                 # Linux man-pages, groff, OpenBSD into .corpus/
./bin/fetch-man-corpus --only host     # copy the local manpath into .corpus/host*
MAN_CORPUS_ROOTS="$PWD/.corpus/linux:$PWD/.corpus/openbsd/share/man" \
  npm run test-corpus                  # test a downloaded corpus instead
```

`man-audit` without `--parse` reports the static dialect inventory (an upper
bound; it cannot evaluate `.if`). `--render` draws each parsed page too.
`test/man-corpus.mjs` walks `manpath`, refuses only known page bugs, and fails
on a renderer exception; it is opt-in because it takes about a minute. It
feeds each page with CRLF line endings, like the pty the viewer reads through.
`npm run test-corpus` writes its output to `man-corpus.log` as well as the
terminal.
`MAN_CORPUS_ROOTS` replaces `manpath`, so a downloaded corpus can be tested
without installing it. The Linux man-pages, groff, OpenBSD, FreeBSD and NetBSD
trees fetched by `fetch-man-corpus` cover 4,620 pages at 99.8% parsed with no
unexpected refusals and no render errors. `man-diff` needs `man` installed; it ignores
headers/footers (including BSD-style dated footers), overstrike, automatic
hyphenation (U+2010), compound hyphens broken at a line end, box-drawing
characters and bullet markers, then reports reference words missing from our
text. `test/man-viewer.mjs` drives `Man.open` with fake `man -w`/`zcat`
responses, so the viewer is tested without the installed corpus. It covers the
path and reader fallbacks, redirects (chains, cycles, sections, missing
targets), includes (including cycles), TOC and reference clicks, external and
unknown-scheme links, section/topic normalisation and path input (including
spaces, colons and home expansion), the prompt with its completion (regex
escaping, caching, a section prefix such as `3 pr`, suggestion clicks, a
throwing `tokenAt`, a close before the attract timer), prompt history replay,
error paths (unreadable, empty and blank pages, non-gzip fallback, a missing
`man` and a spawn failure), man -w diagnostics mixed with paths, refresh
(failing, repeated while loading, and path pages re-read from their path),
absolute `.so` includes, and buffer reuse and shared refresh across panes. The
renderer tests also draw compact and large pages, empty tables and lists,
combined table options, colspans and links with no text.

## Current state

Corpus: 4152 installed pages (English + translations) on Debian trixie.

```
parsed   4124   (99.3%)
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

Tests: 237 (inventory, interpreter, renderer, viewer); `test-corpus` also
parses and renders every page in the corpus. Coverage of the man modules is
99.7% of `man.mjs` lines (90% of branches) and 100% of `man-render.mjs` lines
and branches.

## Known gaps, in order

1. Div buffers are not searchable with isearch; that is a general limitation of
   div views, not specific to man pages.
2. mdoc `Ex`/`Rv` expand to canned sentences; they are approximations of the
   real macro text.
3. A colon in a path is still a separator when the text before it looks like a
   man source (for example `/x/a.1:/b.1`): `man -w` output has no unambiguous
   quoting, so this heuristic favours the common colon-separated list.
4. A bare `foo.1` is tried as a path before a topic; if it exists but cannot be
   read (a directory named `foo.1`, a permission error), the topic fallback can
   hide the read error. Avoiding that needs a `stat` (or an extra process per
   open) before the read; the viewer only has `zcat`/`cat`, so it tries both
   and then `man -w`. Explicit paths do not fall back, so the read error is
   shown and a directory is never parsed.
5. Only `http`, `https`, `mailto` and `ftp` links open externally; other schemes
   are refused rather than handed to the desktop.

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
