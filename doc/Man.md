# Man page viewer

Status: 2026-11-19. `C-h u` / `M-x man` opens a manual page in a div buffer.

## Policy

A page either renders faithfully or is refused. There is no fallback to
`man -Tutf8`/`-Thtml` output and no partial page: `parse()` returns `ok: 0` and
a list of `{ what, line }` failures, and the viewer shows those instead. The
point is that a broken render is visible and gets fixed, not hidden. At most 40
failures are listed, followed by `... N more (show all)`; clicking it (or
`M-x man show all failures`) lists them all. The state still holds every
failure, so nothing is lost when the list is long.

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
2. Read it with the decompressor its suffix names (`zcat` for `.gz`, `xzcat`,
   `bzcat`, `zstdcat`, `lzcat`), trying the others next if that tool is missing
   or refuses the file, and `cat` last when the suffix is plain or unknown. A
   compressed page whose cat output looks binary (NUL or U+FFFD) is reported as
   `Cannot read ...: cannot decompress .xz` instead of being rendered as
   garbage. An empty file is a valid page, not a read error.
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
expanded; a `~user/foo.1` path is refused with a message, while a bare `~user`
is not path-like and is looked up as a topic). A bare name is ambiguous, so one
`file.stat` decides it: a missing name goes straight to a topic lookup without
trying a decompressor or `cat`, an existing directory reports `Cannot read ...: Is a
directory`, a file with no read bits reports `Permission denied`, and a regular
file is read. Explicit paths never fall back, so their read error is shown and
a directory is never parsed. A `file:` URL is refused with a message rather
than resolved into the pane directory.

Links to `http:`, `https:`, `mailto:` and `ftp:` open in the desktop browser
through `shell.open` and never navigate the window. Any other scheme is
refused with a message; `#...` links scroll within the page and `man:...`
links open another topic. A link with no text shows its topic (`man:foo(1)`
shows `foo(1)`) or its URL. A page link keeps its target visible: `.UR`/`.UE`
and `.URL` print `⟨target⟩` after the link text, and alone when the block has
no text, which is what an-ext does. A scheme-less relative link (for example `.UR foo.1`)
never navigates the window either: a target that names a manual source opens as
a path page, and anything else is refused with `Cannot open ... link`.

Refresh bumps a per-buffer load generation; a response or include prefetch from
an older generation is ignored, so refreshing while loading (or twice) keeps
the newest result. A path page is re-read from its path, not looked up again
with `man -w`. A failed refresh shows its error and the buffer stays usable;
reopening a refused or failed page retries it.

`M-x man` completes topics with `man -k '^prefix'` (cached by the name alone,
not by section); the cache holds the 100 most recently used names and drops the
oldest, so a long session cannot grow it without bound. A name that collides
with an object property such as `constructor` is an ordinary miss, not an
inherited function. A section prefix or suffix is stripped for the query and
results are filtered to that section, so `3 pr` and `printf (3)` suggest
`printf(3)` rather than asking for `^3 pr` or `^printf (3)`, and
`3 printf (3)` asks for `^printf` once. `3 pr`, `pr (3)` and `pr` share that
cache answer and only the section filter differs. The token at point prefills
the prompt: a link or reference gives its topic (`ls(1)`), plain text gives
the word under the point, trailing sentence punctuation is dropped from
`ls(1).`, and a URL leaves the prompt empty. A suggestion closes the prompt
and opens the page.
C-n and C-p move through the suggestions (saying `That's all` when there are
none); C-p starts at the last one and C-n at the first, and Enter opens the
highlighted one. A prompt submission is kept in history and replaying one
reopens or refreshes its page.

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
npx mocha test/man-roff.mjs test/man-parse.mjs test/man-render.mjs test/man-viewer.mjs test/man-pty.mjs
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
terminal, runs with a 512 MB V8 heap and collects every 250 pages, so a
large corpus cannot starve the editor.
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
escaping, a shared normalised cache key, a section prefix such as `3 pr`, a
parenthesised suffix such as `printf (3)`, a section prefix and suffix together,
suggestion clicks, C-n/C-p navigation starting at either end and Enter on the
highlighted item, `That's all` with no matches, a throwing `tokenAt`, tokens
with sentence punctuation or a `man:` prefix, a point inside a reference or
plain page text seeding the prompt, a URL token leaving it empty, a close with
suggestions before
the attract timer), prompt history replay, a refused `file:` URL and `~user`
path, bare path stat checks (missing, directory, unreadable), error paths
(unreadable, empty and blank pages, non-gzip fallback, a missing `man` and a
spawn failure), man -w
diagnostics mixed with paths, refresh (failing, repeated while loading, and
path pages re-read from their path), absolute `.so` includes, unknown-suffix
includes read with `cat`, xz/bz2/zst sources choosing their own tool, a failed
decompressor whose cat fallback looks binary reporting a clear error instead of
garbage, the capped completion cache evicting its oldest name while a recent
prefix still hits, a `constructor` completion that used to crash, scheme-less
relative links (a bare filename opens its page, anything else is refused), the 40-item
failure cap and its "show all" command, following a link to a page that is
refused and retrying it after another click, trailing punctuation and no-text
man links, and buffer reuse and shared refresh across panes. `test/man-pty.mjs`
covers the real reader path: it writes a gzip page to a temporary file, runs
`zcat` through node-pty (the same main-side path the viewer uses), checks the
CRLF that comes back, and parses and renders it, including no-argument macros
(`.PP`, `.br`, `.nf`/`.fi`). It also packs a page with real `xz` and `bzip2`
(and `zstd` when installed) and reads it back through the tool the suffix picks,
skipping a tool the container does not have. It skips when node-pty is not
available. The renderer tests also draw compact and large pages, empty tables
and lists, combined table options, colspans and links with no text.

## Current state

Corpus: 4150 installed pages (English + translations) on Debian trixie.

```
parsed   4123   (99.3%)
refused    27
```

The refusals are page bugs, not dialect gaps: undefined `\*(AQ` in 7
translations, a broken `\f\f` in 6 Korean pages, an undefined `\fG` font in 2
gdbm pages, `It` without `Bl` (2), the `Su`/`R` strings that only eqn defines
(4), ms `DS`/`DE` (1), eqn `EQ`/`EN` (1), `mso pic.tmac` (1), strace's
undefined `.IX`, a `.p` typo and one undefined Cyrillic string.

A section sweep with `--max 400` leaves this many pages (and words) short of
man(1)'s text:

```
section  1    3    5    7    8
pages   15    4   15    4   58
words   32  248   34   14   88
```

Most of that is measurement, not loss: man(1) wraps a long word onto the next
line (so it splits `[n]<&digit-` from `moves`), breaks a compound at a hyphen,
and repeats a non-standard `.TH` in the footer; `man-diff` normalises those,
but a split inside a word that is not hyphenated still counts. Section 3 is
almost entirely the TIFF pages, whose option table hyphenates long names such
as `TIFFTAG_BADFAXLINES` inside a narrow cell; the cells themselves now parse
(`T{`/`T}` blocks, which used to leave the markers in the text). `man-diff`
drops a bare `|` and `_` from both sides, since those are our table separators
and rule rows and man(1) draws neither.
Section 8 is almost entirely `.URL`/`.MTO` with an empty description: man(1)
prints the bare target where we print `⟨target⟩`.

Tests: 396 (inventory, interpreter, renderer, viewer, real pty);
`test-corpus` also parses and renders every page in the corpus. Line coverage
is 100% for `man.mjs` (91% of branches), `man-char.mjs` (93%),
`man-render.mjs` (100%) and `man-roff.mjs` (96%), and 98% for
`man-parse.mjs` (91% of branches).

## Known gaps, in order

1. Div buffers are not searchable with isearch; that is a general limitation of
   div views, not specific to man pages.
2. mdoc `Ex`/`Rv` match mdoc(7)'s sentences (names joined with `and`, the
   plural verbs, and the `Nm` fallback) but not every `-std` family variant:
   the `-exit`/`-nop` flags are accepted and ignored.
3. A colon in a path is still a separator when the text before it looks like a
   man source (for example `/x/a.1:/b.1`): `man -w` output has no unambiguous
   quoting, so this heuristic favours the common colon-separated list.
4. The bare-name check reads the mode bits from one `stat`; an ACL grant or
   root reading a mode-000 file is reported as `Permission denied` even though
   the decompressor might succeed. The alternative was an extra read process
   per open, and the stat saves two processes when the name is not a file at
   all. Relatedly, a mislabelled compressed file whose `cat` output happens to
   contain no NUL or replacement character is still read as text.
5. Only `http`, `https`, `mailto` and `ftp` links open externally; other schemes
   are refused rather than handed to the desktop.
6. `.URL`/`.MTO` with an empty description: man(1) prints the bare target,
   while we print `⟨target⟩` (what groff's www.tmac does on an explicit
   `groff -man` run). `.UR`/`.UE` always print `⟨target⟩`, which both agree on.

## Changing it

- New man macro: classify it in `js/man-roff.mjs`, handle it in `man-parse.mjs`,
  add a test, rerun `man-audit --parse`.
- New request/escape: same, and prefer failing over "best effort" unless the
  construct is purely presentational (classify it `metric`/`ignore`).
- A character name is added to `js/man-char.mjs` only when groff really has it:
  `\(ts` is the final sigma, and `\]` keeps its `]` because groff drops the
  backslash from an escape it does not know. Both were added after seeing them
  in the corpus.
- Keep `man-parse.mjs` DOM-free and `man-render.mjs` model-only.
- `.mso` is accepted only for `www.tmac` and `an-ext.tmac`, whose macros
  (`URL`, `MTO`, `UR/UE`, `MT/ME`) are implemented directly.
- `name(section)` in text is linkified to `man:name(section)`; the renderer puts
  the topic on `data-topic` and `man.mjs` follows clicks.
