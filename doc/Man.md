# Man page viewer

Status: 2026-11-23. `C-h u` / `M-x man` opens a manual page in a div buffer.
`Space`, `PageDown` and `C-v` scroll down a screenful; `Backspace`, `PageUp`
and `A-v` scroll up. Sections are listed in the Assist sidebar; `n`/`p` move
to the next/previous section and `Tab`/`Shift-Tab` to the next/previous link.
Section jumps count from the top of the pane and put the heading there.

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
   a colon inside a filename such as `/x/a:/b.1` does not split it. `man -w`
   cannot quote a colon, so a line that splits is ambiguous: the whole line is
   statted first and read as one path when it is a regular file, which is how
   `/x/a.1:/b.1` can be one real path even when `/x/a.1` also exists; only a
   line that is not a regular file is split into its parts. Only a
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
trying a decompressor or `cat`, an existing directory reports `Cannot read ...:
Is a directory`, and a regular file is read. A regular file with no read bits
is read anyway, since an ACL grant or root can still read it; if that read
fails the page reports `Permission denied` rather than falling back to a topic,
because the file is there and the problem is permission. Explicit paths never
fall back, so their read error is shown and a directory is never parsed. A
`file:` URL is refused with a message rather than resolved into the pane
directory.

Links to `http:`, `https:`, `mailto:`, `ftp:`, `ftps:`, `irc:`, `ircs:`, `news:`,
`nntp:`, `gopher:`, `gophers:`, `ssh:`, `sftp:` and `git:` open in the desktop
through `shell.open` and never navigate the window. That hands the URL to
whichever application registered the scheme, which is a security decision taken
per scheme rather than per link: a page can start an IRC client or an SSH
handler, not only show a web document. The allow-list is therefore explicit: the
installed corpus links `http`, `https`, `ftp` and `mailto` only (the fetched
groff/OpenBSD trees add `file`), and the rest are the schemes a reader would
expect a page to use. Any other scheme is refused
with a message, `file:` among them: a page cannot make a click open a local
path, which is why the prompt refuses a `file:` URL as well. `#...` links
scroll within the page and `man:...`
links open another topic. A link with no text shows its topic (`man:foo(1)`
shows `foo(1)`) or its URL. A page link keeps its target visible: `.UR`/`.UE`
print `⟨target⟩` after the link text, and alone when the block has no text,
which is what an-ext does. `.URL`/`.MTO` print the bare target when the macro
has no description, otherwise the description and then the target between
brackets: `⟨…⟩` as www.tmac defaults, `<…>` when the page calls `.LINKSTYLE`
with ASCII glyphs, which is what the util-linux pages do (fstab(5)). A scheme-less relative link (for example `.UR foo.1`)
never navigates the window either: a target that names a manual source opens as
a path page, and anything else is refused with `Cannot open ... link`.

A delimiter macro prints typographic brackets when it stands on a line of its
own or inside `.Dl`/`.D1`, the way mdoc(7) treats a display line, and ASCII
brackets when it is an argument of another macro: `.Dl lf foobar Aq return`
gives `lf foobar ⟨return⟩`, while `.An foo Aq addr` gives `foo <addr>`.

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
cache answer and only the section filter differs. The prompt is nested in the
pane it was opened from. The token at point prefills it: a link or reference
gives its topic (`ls(1)`), plain text gives the word under the point, and
trailing sentence punctuation is dropped from `ls(1).`. A URL, or a page that
is still loading or refused, contributes no token, so the last history item is
the placeholder, as in other prompts. A suggestion closes the prompt and opens
the page.
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
| `js/man.mjs` | viewer mode/commands: fetch, include prefetch, buffer per topic, reload, click-to-follow, Assist sections, section/link movement |
| `bin/man-audit` | corpus report; `--parse` runs the interpreter |
| `bin/man-diff` | content diff against `man -Tutf8` |
| `bin/fetch-man-corpus` | download Linux man-pages, groff and OpenBSD into `.corpus/` |
| `css/manpage.css` | page styles (reflow, no fixed width) |

Block model: `doc.blocks` of `heading{level,spans}`, `para{spans,synopsis}`,
`tag{tag,blocks}`, `group{blocks}`, `pre{spans,mono}`, `list{listType,items[
{tag,blocks}]}`, `table{options,cols,rows[{cells[{spans,colspan}]}]}` (the column count is the
longest tbl format line, and each row follows its own format line),
`space`. Inline spans are `{ text, style, href, role }` plus `{ br: 1 }`;
styles are `roman`, `bold`, `italic`, `mono`, `small`; `role` names what an
mdoc macro says the run is (`fl`, `pa`, `ev`, ...), and is absent for the
presentational man macros (`.B`, `.I`). The renderer draws every inline run as
a `<span>` with a class (`man-bold`, `man-italic`, `man-mono`, `man-small`,
plus `man-r-<role>`), never `<b>`/`<i>`: the theme styles classes, and a div is
invalid inside a `<p>` or a heading. Bold is emphasis colour (`--clr-emph`)
with normal weight, as in the editor; the role classes colour paths, variables
and literals; headings use `--clr-nb0`, so they do not read as bold emphasis.
The model has no DOM dependency so it is unit-testable and could feed another
renderer.

## Measuring

```
npm run check                          # style + layering
npx mocha test/man-roff.mjs test/man-parse.mjs test/man-render.mjs test/man-viewer.mjs test/man-pty.mjs
./bin/man-audit --parse                # pages parsed vs refused
./bin/man-audit --parse --list         # with the reason for each refusal
./bin/man-diff --section 1 --max 0     # content diff against man(1), whole section
./bin/man-diff --section 1 --max 120   # the same, as a repeatable sample
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
`test/man-corpus.mjs` walks `manpath` and fails on a renderer exception; it is
opt-in because it takes about a minute. It feeds each page with CRLF line
endings, like the pty the viewer reads through. Every refusal that is not a
known page bug is reported with its page and line, and the suite fails with
them; the only exception is a `character` failure on `mandoc_char.7`, the page
that exists to exhaust the character table.
`npm run test-corpus` writes its output to `man-corpus.log` as well as the
terminal, runs with a 512 MB V8 heap and collects every 250 pages, so a
large corpus cannot starve the editor.
`MAN_CORPUS_ROOTS` replaces `manpath`, so a downloaded corpus can be tested
without installing it. The default Linux man-pages, groff and OpenBSD trees are
4,631 pages: with all three as `MAN_CORPUS_ROOTS`, 4,621 parse (99.8%), one is
refused and there are no render errors. The refusal is `mandoc_char.7`; nine
more are groff's `name.section.man` sources, which still carry `@VERSION@`-style
markers in their `.TH` until groff's build substitutes them, so they are
counted and skipped rather than parsed (a `.so` alias into one is skipped too).
Before the filter was fixed this run passed while 181 unexpected constructs in
nine classes were suppressed; the same corpus with the fixed filter and the old
parser fails, which is what proves the gate gates. FreeBSD and NetBSD can be
fetched with `--only` but were not measured here. `man-diff` needs `man` installed; it
ignores
headers/footers (including BSD-style dated footers), overstrike, automatic
hyphenation (U+2010), compound hyphens broken at a line end, a word
hyphenated inside a table cell (the U+2010 halves are reassembled before the
line ends are joined), box-drawing
characters and bullet markers, then reports reference words missing from our
text. `--max N` reads the first N pages in sorted path order and says so
(`pages 120 of 1189  (sample; --max 0 for all)`); only `--max 0` measures a
whole section. `test/man-viewer.mjs` drives `Man.open` with fake `man -w`/`zcat`
responses, so the viewer is tested without the installed corpus. It covers the
path and reader fallbacks, redirects (chains, cycles, sections, missing
targets), includes (including cycles), Assist sections, section/link movement
and reference clicks, external and
unknown-scheme links (every allowed scheme opens, `javascript:` and `file:` are
refused), section/topic normalisation and path input (including
spaces, colons and home expansion), the prompt with its completion (regex
escaping, a shared normalised cache key, a section prefix such as `3 pr`, a
parenthesised suffix such as `printf (3)`, a section prefix and suffix together,
suggestion clicks, C-n/C-p navigation starting at either end and Enter on the
highlighted item, `That's all` with no matches, a throwing `tokenAt`, tokens
with sentence punctuation or a `man:` prefix, a point inside a reference or
plain page text seeding the prompt, a URL token leaving it empty, a close with
suggestions before
the attract timer), prompt history replay, a refused `file:` URL and `~user`
path, bare path stat checks (missing, directory, a mode-000 file both when the
reader can and cannot read it), error paths
(unreadable, empty and blank pages, non-gzip fallback, a missing `man` and a
spawn failure), man -w
diagnostics mixed with paths, a man -w line whose split paths do not read but
whose whole line is one real file with a colon (and the common colon list that
never stats its whole, plus a whole that is a directory or fails to stat
keeping the split error), refresh (failing, repeated while loading, and
path pages re-read from their path), absolute `.so` includes, unknown-suffix
includes read with `cat`, xz/bz2/zst sources choosing their own tool, a failed
decompressor whose cat fallback looks binary reporting a clear error instead of
garbage, the capped completion cache evicting its oldest name while a recent
prefix still hits, a `constructor` completion that used to crash, scheme-less
relative links (a bare filename opens its page, anything else is refused), the 40-item
failure cap and its "show all" command, following a link to a page that is
refused and retrying it after another click, trailing punctuation and no-text
man links, and buffer reuse and shared refresh across panes. The parser tests
cover the `.LINKSTYLE` glyph pair around a described `.URL` target (ASCII when
the page asks for it, `⟨⟩` otherwise, and `.UR` unaffected). A div-buffer
search test feeds `C-s`
through `Em.look` and the characters through the key handler the search
installs, then checks the needle in the search bar and the point on the match;
another searches a phrase that crosses a bold span (forwards and backwards) and
a third shows that two paragraphs do not join into one match. `C-w`'s word
pattern is searched as a regexp: it finds `alpha beta` (which the old literal
search could not), keeps its case folding from an upper-case needle, works
backwards (including from the start of a block) and treats an empty match and
an invalid pattern as ordinary misses.
`test/man-pty.mjs`
covers the real reader path: it writes a gzip page to a temporary file, runs
`zcat` through node-pty (the same main-side path the viewer uses), checks the
CRLF that comes back, and parses and renders it, including no-argument macros
(`.PP`, `.br`, `.nf`/`.fi`). It also packs a page with real `xz` and `bzip2`
(and `zstd` when installed) and reads it back through the tool the suffix picks,
skipping a tool the container does not have. It skips when node-pty is not
available. The renderer tests also draw a page with no blocks, a 400-section
page, empty tables and lists, combined table options, colspans and links with
no text; a colspanned row styles every later cell by the column it starts at,
and a row with too many or too few cells draws without an undefined cell. The
viewer tests also refuse a compressed page whose `cat` fallback starts with a
known magic, naming the format when it disagrees with the suffix.
`test/man-parse.mjs` ends with a seeded fuzz test: 300 short roff documents
built from control lines, escapes, unclosed brackets and quotes, `T{`/`T}`
cells and random macro names, from a generator shared with the renderer test in
`test/man-fuzz.mjs`. Each must parse and convert with `toText` without
throwing, return `ok` 0 or 1, give every failure a `what`, and serialise as
JSON; the whole run must take under two seconds, so a parser hang fails it.
`test/man-render.mjs` draws the same 300 sources with the same seed: every one
that parses (9 of the 300, since most are deliberately refused) is rendered,
must not throw, must return an `el` with child nodes for a document that has
blocks, must have a string `textContent` and a `toc` array, and the loop must
finish in under two seconds, so a renderer hang fails it. The seed is fixed, so
a failure can be replayed.

A second generator in the same helper, `fuzzPages`, composes *valid* pages
instead: tagged items holding lists and whole tables, literal blocks inside
list items, `T{`/`T}` cells, `.Rs` and inline macros, nested a few levels
deep. Two hundred of those must every one parse (a valid page that is refused
fails the test with its source printed) and the same two hundred are drawn,
with the hostile stream's invariants.

## Current state

Measured at `c5029a94`, corpus 4150 installed pages (English + translations) on
Debian bookworm. The commit that carries this paragraph changes only this file,
so the numbers still hold at it.

```
parsed   4123   (99.3%)
refused    27
```

The refusals are page bugs, not dialect gaps: undefined `\*(AQ` in 7
translations, a broken `\f\f` in 6 Korean pages, an undefined `\fG` font in 2
gdbm pages, `It` without `Bl` (2), the `Su`/`R` strings that only eqn defines
(4), ms `DS`/`DE` (1), eqn `EQ`/`EN` (1), `mso pic.tmac` (1), strace's
undefined `.IX`, a `.p` typo and one undefined Cyrillic string. Round 16 fixed
the two Czech pages whose `.do hla`/`.do hpf` are groff hyphenation requests
(`passwd(5)`, `shadow(5)`); they had arrived with a package update and pushed
the count to 29 for one round. The page count is 4150 in both cases, but the
refusal list is not the same one round 14 measured — a number has to name its
page set as well as its commit.

A whole-section sweep (`--max 0`) at `c5029a94` prints `0 pages with missing
words (0 words total)` for each of sections 1, 3, 5, 7 and 8. Each was measured
whole with the round-64 tool over these populations, so these are the sections,
not samples:

```
section     1     3     5     7     8
pages    1189   959   180   209   358
compared 1176   955   178   207   358
```

(The rest are refused pages, or pages too small for a comparison: 11 and 2 in
section 1, 4 in section 3, 2 in section 5, 2 in section 7.) That output also
prints the tool's own summary line, `pages with missing words 0 (0 words
total)`, for every section.

Sections 3 and 5 have been clean since round 16, section 7 since round 45 and
section 8 since round 50; section 1's last word went with round 64. The
distinction matters because `--max 400` prints `400 of 1189 (sample; --max 0 for
all)` for section 1, and an earlier version of this table quoted such a sample
as if it were the whole section.

`man-diff` reports only words the reference has and we lack, so a page that
prints *more* than man(1) reads as clean. ps(1) is one: the b8 groom helper
measured at `2e31d106` that its text carried 9 extra tokens from a `.\"` comment
line at table-row level, which tbl ignores and we drew as a data row (p131), and
9 more from `.IP "" 2` inside a `T{` cell, which draws no text (p75, batch b8).
Neither is a lost word, and neither is visible in the sweep above.

What the sweep used to report is worth keeping, because most of it was the
tool's, not the parser's: man(1) wraps a long word onto the next line (so it
splits `[n]<&digit-` from `moves`), breaks a compound at a hyphen, repeats a
non-standard `.TH` in the footer, and breaks a long path at a `\:` break point
inside it. `man-diff` normalises the hyphen, the `\:` path and the
sentence-period cases, but a split inside a word that is neither hyphenated nor
marked in the source still counts. It also reassembles a U+2010-hyphenated
table cell (section 3's TIFF names were once reported as two words each),
drops a bare `|` and `_` from both sides since those are our table separators
and rule rows and man(1) draws neither, folds typographic hyphens
(U+2010/U+2011/U+2212) and quotes (U+2018/U+2019/U+201C/U+201D) to ASCII in its
word key, and decides a hyphen join from the page source: a line end is joined
only when the source writes the hyphen with no space after it, and the same
decision is applied to both sides.

Round 16 left section 1 at 147 words on 16 pages, and that list was ps(1) 103,
ttf2tfm(1) 10, `tbl(1)`/`gtbl(1)` 7 each, ttf2pk(1) 5, `hg(1)` 2 and man(1) 2;
section 7 was editline(7) 5 and gittutorial-2(7) 2, section 8 dmsetup(8) 7 and
dmstats(8) 2. Sections 3 and 5 were already clean then. Rounds 20 to 50 closed
that list page by page (the round paragraphs below say which mechanism each
one was), and round 64 closed the last word, thumbpdf(1)'s mis-encoded byte.

Three joins in round 12's `man-diff` were still wrong. Each was the
reference's fault, not our text's, and each is now a tool fix:

- A path break is a `\:` in the page source, not a "/" at the line end.
  `troff(1)` prints `/usr/` + `lib/groff/site-tmac,` because the source is
  `.IR /usr/\:lib/\:groff/\:site\-tmac`; a test page with the same path and no
  `\:` moved the whole `/usr/lib/groff/site-tmac,` to the next line. So the
  join needs the source: `man-diff` joins a line-ending token only when the
  page marks that exact token with `\:`, and only when it ends in "/" (a
  finished URL, a regexp or `/usr/` at a sentence end also ends a line).
  `troff(1)` 10 -> 2 words, `nroff(1)` 4 -> 0, `groff(1)` 2 -> 0; the 26
  installed pages containing a `\:` are that join's whole blast radius, and
  among them only those three changed. Round 14 widened the end character to
  the other separators the pages mark. Dropping the character test was
  measured first and is wrong: `hg(1)` writes `\%\fBhg help urls\fP\:` in
  prose, so a `\:` marks an ordinary word as breakable, and joining at those
  took `hg(1)` from 3 to 367 words and `hgrc(5)` from 0 to 15. The break must
  still follow a path or address separator, `/`, `:` or `@`: `bash(1)`'s PATH
  list joins after ":" (4 -> 2) and `troff(1)`'s
  `.MT groff\-bernd.warken\-72@\:web.de` after "@" (2 -> 0). Page by page over
  the same 26, only those two changed, and the set went 120 -> 116 words on
  6 -> 5 pages.
- `joinCells` read a justified paragraph as a table. The gaps justification
  inserts look like column boundaries, so a word hyphenated at the right margin
  took the next line's token at the same column: `hgrc(5)`'s
  `format.use-dirstate-tracked-hint=yes` came out as `for` + `the` +
  `mat.use-...`. A cell that runs to the end of the line is prose, not a cell:
  a table row has another column or a border after it. `hgrc(5)` is now 0.
- The same code joins a *bordered* cell by its borders. `TIFFGetField(3)`
  continues `BitsPer‐`/`Sample` and `ar‐`/`ray` from the cell's left edge,
  before the token's column, which the old "at or after the column" rule
  refused; borders make the cell unambiguous and prose has none. And because
  `normal()` blanks a border, a row ending `BitsPer‐ │` used to reach
  `joinHyphens` as a prose hyphen and be joined with the *previous* column's
  `uint16_t**`; joining the cell first leaves no trailing U+2010.
  `TIFFGetField(3)` is now 0, and `mysql_optionsv(3)` and
  `mariadb_get_infov(3)` (`MARI` + `MARIADB_...`) were the same defect.

Round 16 left `ttf2tfm(1)` at 10 words, and they were not a path break but a
`\c` at the end of a text line whose next line is a macro call (the page's own
`.C`, then `.ttc`). Groff keeps the backtick glued to `.ttc'.]`; we inserted the
space the page suppressed and split them. Round 37 glued a continued line to the
first line its macro body prints (10 -> 2) and round 38 gave a macro argument
one copy round at the call and another in the body (2 -> 0).

Those words were the tail of the round-16 list, and each one had a mechanism
rather than a layout excuse. Section 1 was mostly ps(1): 103 of that section's
words were one comma list man(1) wraps (`pid,format,tname,` / `time,cmd,`) plus
the `-o` field names, and rounds 21 and 22 joined the marked comma break and ran
the cell's text macros. `tbl(1)`/`gtbl(1)`'s example table printed `eleven;11`
where man(1) prints `eleven 11` until round 24 inherited a `.T&` part's
options, and round 25 corrected `\[tmu]`. `hg(1)`'s `incoming )
case-insensitive` was a source-marked `\:` break, joined in round 41. Section
7's editline(7) items were the `-dash` marker teaching `toText` one `-` per
item in round 45, and section 8's dmsetup(8) line was a `\c` eaten by a request
that draws nothing in round 50. Section 3's pcre2demo(3) kept 12 typographic
quotes because the page has no
`.TH`, so groff loads no macro package and its default utf8 mapping prints
U+2018/U+2019 where we print ASCII; the round-14 note here called its hyphens an
mdoc rule (`-` is U+2010), and round 15 checked that and found it wrong —
`groff -Tutf8 -mdoc` prints ASCII `-`, and the U+2010 came only from the
no-`.TH` page. Round 16's quote fold and source-decided hyphen join cleared it.
Section 8's long `[a|b|c]` synopsis alternatives and the rest were the same kind
of line-break join, and they are gone with the rest.

Some of those pages hid a real loss rather than a layout one, and fixing them
was the work of the early rounds. The ssh helper pages' `OpenBSD 3.2.` (the OS
macros `.Ox`, `.Fx`, `.Nx`, `.Dx`, `.Ux` now print their version, `.Bx`
prepends it and `.At` gained groff's table); `init-d-script(5)`'s
`start\-stop\-daemon(8)` (`.Xr` expands its name); and `mount(8)`'s raw `\fP`
after a URL plus its literal `.sp` cells (the `.URL` tail is expanded, and a
`.sp`/`.br`/`.nf`/`.fi` line in a table body is a request, not a cell). Also
fixed: the bare `.Nm` in `ssh_config(5)` and `editrc(5)`, which prints the
document name (the first
`.Nm` with an argument, as groff's `doc-command-name`), not the last one. And
`bash(1)`'s RESTRICTED SHELL sentence is back: the text after a `\{` on a
taken `.ie`/`.el` branch is kept, and an undefined register in a condition now
reads as 0 (groff's rule) instead of refusing the page. Bash defines its own
`zY`/`zZ`, so that page never needed the second rule; the dropped text was the
whole loss.

Round 12 fixed three more, each proven against `groff -Tutf8` first. A `\c` at
the end of a line joins it to the *next* line only; it used to drop the space
*before* the line too, so `ext4(5)` read `trackingfile`. `\F` takes one family
character (or `\F[name]`), but the shared escape skipper treated a plain
character as a delimiter and scanned for its pair, so `\FI$BOOT\FR PARTITION`
in `kernel-install(8)` came out `THE TION` and `git-subtree(1)` lost nine words
of its synopsis; `\m`, `\M`, `\k`, `\S` and `\v` shared the defect and now take
their own forms. And `.Sm off` begins suppressing at the *second* macro call
after it, not the first, so `ssh_config(5)`'s `PermitRemoteOpen` items no longer
run their tag into `host:port`.

Round 13 finished the mdoc set that the honest sweep exposed. `.Lb` maps its
argument through groff's own table (`Crypt Library (libcrypt, -lcrypt)`, 70
entries; an unknown name falls back to groff's `library "name"`). `.In` prints
`#include <header>` in SYNOPSIS and `<header>` in a body section. `.do` runs the
rest of its line as a request instead of printing it (11 pages, all
`.do nr X \n[.C]`), and `\n+[reg]`/`\n-[reg]` step the register before reading
it, the way groff does, so `sensible-editor(1)`'s `.IP \n+[step]` items are
1-5 again.

Round 14 also fixed the last `man-diff` measurement bug. A page name too long
for the running header is truncated to `NAME...` and loses its `(section)`, so
`man-diff` read the whole mdoc banner as content. It now removes a first or
last line that contains `Manual`, a `...`-truncated word, and a page name whose
uppercase form starts with that word's prefix; over the corpus (4150 entries,
symlinks included) that fires on exactly the five pages it was written for,
`crypt_preferred_method(3)` and four `rpc_gss_*(3)`, which went
7/6/6/6/6 -> 1/0/0/0/0 (31 -> 1). No other `.Dt` page's text changed, and the
clause removes no footer. The remaining word is real: a bare `.Nm` inside a
`T{`/`T}` cell prints as `.Nm`, so `crypt_preferred_method(3)` and
`crypt_checksalt(3)` are each short one name (a parser question, not the
diff).

Round 14 took the last of the reference set and the tag continuation. `.Rs`
quotes a `%T` only when the same reference also carries a `%B` or `%J` — the
container that makes it an article title — and three or more authors take
groff's serial comma; the 14 references in `ssh(1)` were the whole family. A
`.TP` tag line ending in `\c` keeps the tag open across the next macro, so
`paperconfig(8)` reads `-p, --paperpapername` again and five `dmstats(8)` tags
are whole. `man-diff` now recognises groff's truncated mdoc banner
(`CRYPT_PREFERRED_METHO... BSD Library Functions Manual ...`) as a header, and
joins a `\:` break after ":" and "@" as well as "/".

Round 15 fixed the table-cell name and the diff's hyphen keys. A bare `.Nm` on
its own control line inside a `T{`/`T}` cell is run as `.Nm` (the document
name) instead of being printed as data; `crypt_checksalt(3)` and
`crypt_preferred_method(3)` are 0. `man-diff --page` now prints the total
(`lost 67 [...]`) instead of only a sample, and its word key folds the
typographic hyphens U+2010/U+2011/U+2212 to ASCII, which takes pcre2demo(3)
from 67 to 12 — the rest are typographic quotes from the same page, whose
missing `.TH` means groff loads no macro package at all (queue p60). The claim
that an mdoc `-` is U+2010 was tested and is false: `groff -Tutf8 -mdoc`
prints ASCII.

Round 16 took the hyphenation requests and the rest of section 3. `.hla` and
`.hpf` are accepted as no-output requests (they pick a hyphenation language and
load patterns; our renderer does not hyphenate), so the two Czech pages parse
and the corpus is back to 4123/27. The `cat` fallback can now keep the bytes it
read, so a mislabelled compressed page names its real format — but only in the
renderer: `js/main-shell-run.mjs` still stringifies the pty chunk before IPC,
so the running app cannot see the bytes yet (queue p63). `man-diff` folds
typographic quotes, and its hyphen join is now decided from the page source and
applied to both sides, which clears pcre2demo(3) and section 3:

```
section 3, round 15:  3 pages / 14 words
section 3, round 16:  0 pages /  0 words
```

Round 17 closed the `.Fo`/`.Fc` declaration. `.Fc` ends a SYNOPSIS declaration
with `;` (`int crypt_checksalt(const char *setting);`), and the same `.Fc` in
a DESCRIPTION section prints no semicolon; `.Fn` in a SYNOPSIS gets one too,
which we still do not print (queue p64). The pty's bytes now cross IPC as
Buffers and `js/shell.mjs` decodes with one streaming `TextDecoder` per run, so
a mislabelled compressed page names its format in the app, not only in the
renderer.

Round 18 ran on the new `bin/loop.mjs` and closed the `.Fn` half of the
declaration pair: a `.Fn` in a SYNOPSIS now ends with `;`
(`other(char *y, int z);`) and a body-section `.Fn` does not. The same round
made a spent colon list name the failure that matters (a part with no read
bits, not a later missing part), and made `flushPeer` report an unreadable
collab field instead of treating the throw as "already flushed" — the revert
now aborts visibly rather than rebuilding over an unacknowledged push. Two
harness bugs surfaced on the first real round and are fixed in the tool, not in
the parser: a symlinked `ext/*/lib` loaded a second CodeMirror, and
`spawnSync`'s 1 MB buffer killed the suite with ENOBUFS.

Round 19 kept the top-level `.Sh` section across a `.Ss` subsection. The
parser was overwriting its section state with every heading, so a `.Ss` inside
SYNOPSIS made `.Fn`/`.Fc` drop their `;` (and `.Nm` lose bold, `.In` lose
`#include`); only a level-1 `.Sh` updates it now. The same round taught the
colon-list reporter a third rank: a failed read of an existing regular file
outranks a later missing part, so the reader sees the read failure and its
path; permission on an existing file still ranks above both.

Round 20 made the text after `.br` flush (the old test enshrined a separator
space) and taught `man-diff` to join a wrapped word in an unbordered table cell
whose continuation starts at the cell's left edge — `man(1)`'s `hy‐`/`phen`
became `hyphen`, taking section 1 from 16p/147w to 15p/145w with no other page
changed.

Round 21 made `.br` behave: a break before text adds no blank line,
consecutive breaks collapse, and a trailing break is dropped (p56's flush line
stays). `man-diff` also joins a comma-marked `\:` break inside an option list
when the source puts no whitespace after the comma — a rule narrow enough that
only ps(1) and dmsetup(8) are touched. ps(1) 103 → 95, dmsetup 7 → 5, section
1 145 → 137 words, and no page got worse.

Round 22 made a `T{ }` tbl cell run its text macros: `.BR pcpu ).` renders
`pcpu).`, `.Xr ps 1 .` renders `ps(1).`, and every cell that used a font or
mdoc macro stops printing the macro name. ps(1)'s 95 lost words became 0 and
section 1 dropped from 137 to 42 words.

Round 23 fixed `.SY`: its command name now expands escapes the way `.B` does,
and groff's rule that only the first argument is used is followed. `man-diff`
also gives a quote-only token an empty key, so `mendex(1)`'s tab-collapsed
`""` no longer counts as a lost word; the alternative (a tab rule) was measured
and invented words on awk/mawk/nawk. Section 1 42 → 39 words.

Round 24 made a `.T&` table continuation inherit the first part's global
options: `tab(;)` applies to the second part, so `item eleven;11` is two cells
again. tbl/gtbl lose one word each instead of seven. The first attempt was
parked by the files gate for a queue row that named only the parser file while
the lane also changed its test; the row was fixed and the round re-run.

Round 25 corrected `\[tmu]`: it is U+00D7 (`×`), not the trade mark `™`
(which is `\[tm]`). tbl(1) and gtbl(1) are now word-perfect, and the lane
audited the whole character table against `groff_char(7)`: `hy` (ASCII vs
U+2010), three shifted Greek capitals, and the `\[uA]` fallback are queued.

Round 26 fixed the three shifted Greek capitals (`*H`, `*Q`, `*Y`); `*G` (Γ)
is missing and `*f` is the phi symbol in groff, both queued.

Round 27 made `u` character names canonical: `uA`/`dA` are the arrows,
`u21D1` is accepted because it is groff's spelling, and `uAB`, `u02014` or a
lower-case hex run are refused instead of decoded as one digit. `..`, `char0x`
and three arrow names are queued from the neighbour audit.

Round 28 added the missing `*G` (Γ) and confirmed the whole Greek capital
block against groff; `*J`/`*V` are not groff names, so they stay refused.

Round 29 made `*f` the phi symbol (U+03D5) and swept the lowercase Greek
block; the rest matches groff.

Round 30 made the character names strict: `..` is refused (groff has no such
glyph), `char` takes decimal digits only, and the `va`, `vA` and `an` arrows
and line were added. Three further strictness gaps (`u` ASCII, `\N` number
forms, `char0`) are queued.

Round 31 made `\[hy]` the typographic hyphen (U+2010) while a literal `-` and
`\-` stay ASCII; no installed page uses the name. A future item should decide
whether `\-` follows `-man` (U+2212) as well as `-mdoc` (ASCII).

Round 32 refined the `u` rule: an ASCII code point is refused only when groff
has a plain glyph for it, so `u0040` (`@`), `u007E` (`~`) and the controls
still resolve. A future round decides `char0`/NUL.

Round 33 fixed `\N`: the argument is decimal digits (with an optional `+`),
not a JavaScript number, so `\N'0x41'` no longer becomes `A`; the odd forms
refuse the page. `\N[65]` and unpaired surrogates are queued.

Round 34 added the `\N[65]` bracket form (groff accepts `[`, `'` and `"`)
without generalising `unquote()`, which must keep brackets literal for `\w`.

Round 35 refuses surrogate code points (the boundaries U+D7FF/U+E000 still
work). `\[charN]`'s glyph-table boundary is queued.

Round 37 glued a continued line to the first line its macro body prints, which
brought ttf2tfm's eight backtick/filename clusters back (10 → 2 lost, section 1
25 → 16 words). Its last two words are a double-backslash reduction bug, queued.

Round 38 made a macro argument go through copy mode at the call and the
interpretation round in the body, so `c:\\\\fonts` prints one backslash as
groff does; ttf2tfm reached 3591/3591 and section 1 is 14 words. Built-in man
requests still get one round (p99), and `copyMode` over-reduces chained
escapes (p100).

Round 39 gave every tmac-built request its measured number of copy rounds
(`B`/`I`/`SH`/`SS`/`IP` one extra, the `BR` family two, `OP` three), which
fixed xargs; and `man-diff` now joins a non-spaced `\(em` line break, which
fixed gittutorial-2 and took two words off ttf2pk. Totals are 23 words on 11
pages (section 1: 11, section 7: 5, section 8: 7).

Round 40 kept a `\c` inside a macro argument joining its line (ttf2pk clean),
and `man-diff` joins a source-marked `|`/`]` break (dmsetup 5 → 1). Totals are
17 words on 10 pages.

Round 41 joined a `\:` break the source marks before `)`; `man-diff` now
reassembles hg(1)'s `incoming)` (2 → 0), and section 1 is 7 words on 6 pages.
The key is the word the source glued, not the token alone — keying on the word
made 53 words worse before the rule was narrowed.

Round 42 read a bar inside `.Op Fl` as another flag, not the end of the
argument list, so ssh-agent(1)'s `[-c | -s]` keeps its dash (2 → 0). A bar
still ends the argument list of other multi-argument macros; that is style
only and queued per macro.

Round 44 made `Ns` survive a closing bracket (ssh-copy-id's
`[user@]hostname`, 1 → 0) and taught `man-diff` that a right-aligned
multi-page page-string is a footer, not content (rpcgen's `0a`, 1 → 0).
Section 1 was then 3 words on 3 pages: tex2aspc, thumbpdf, tload.

Round 45 taught `toText` the `-dash`/`-hyphen` item marker: groff prints one
`-` per item, and editline(7)'s five items were the whole of section 7's
residue, so section 7 was clean from then on. The renderer still draws a `<ul>`
disc for a `-dash` list; `man-diff` cannot see that (it maps U+2022 to a
space), so the display fix is queued as p123 instead of being measured. After
round 45 what was left was section 1's three words on three pages (tex2aspc,
thumbpdf, tload) and section 8's three on two (dmstats 2, dmsetup 1).

Round 46 fixed the copy-mode chain: `copyMode()` reduced `\\` first and then
re-examined the backslash it produced with the `\ ` rule, so an escaped space
became an argument separator and dmstats(8)'s `.de CMD_COMMAND` body printed
`device_name|` for groff's `device_name |` (2 → 0). The same round named a
`-dash`/`-hyphen` list `man-dash` and gave it a hyphen marker in the
stylesheet (p123), so the page and the text model agree. Section 8 was then
dmsetup(8)'s single `load|reload`; totals were 4 words on 4 pages.

Round 47 stopped mapping `\T` to the output device name: tex2aspc(1) writes
`\TransformNotes` and groff prints `TransformNotes`, so the bare escape is the
letter. Section 1 was then thumbpdf(1)'s `Â©` and tload(1)'s `and`; totals
were 3 words on 3 pages (section 8's dmsetup line was the third).

Round 49 let `.UE`/`.ME` keep every trailing argument: tload(1) writes
`.UE , and`, and only the comma survived, so the page lost `and` (1 → 0).
Section 1 was then thumbpdf(1) alone; totals were 2 words on 2 pages.

Round 50 let a `\c` survive a request that draws nothing: dmsetup(8)'s
`.de CMD_RELOAD` opens with `.ad l`, which consumed the join, so the page
printed `load| reload` for groff's `load|reload` (1 → 0). Sections 3, 5, 7 and
8 were then clean; the only measured word left was thumbpdf(1)'s mis-encoded
byte, which is a triage (p109).

Round 51 collapsed the `session.compaction` events into one legacy event with a
phase, and the handler draws a log line per phase.

Round 52 let `.if r X` and `.if d XX` take their name from the next token, so
an-old.tmac's spaced form parses.

Round 53 made a `.UE`/`.ME` tail take its copy round before expanding, so a
backslash in a link tail prints what groff prints.

Round 54 made `.nr X +N` and `.nr X -N` relative, and a valueless `.nr X` no
longer defines the register; p45 and p120 came with it.

Round 55 turned `\[charN]` into a glyph lookup (0..255 prints, above it
nothing) and let `\N[ 65]` skip leading spaces.

Round 56 kept a `\c` across an empty `.de` body and made `.Sm off` suppress the
space before a text line.

Round 57 tried to turn `session.synthetic` into one log line and merged
nothing: a peer's grooming commit had moved the row to another lane between
dispatch and gate, so the record pointed at a commit that was not the work.

Round 58 re-armed the row and landed the line, checked the merge line this
time, and filed l2 — the check accepted any hash on main, so a done item could
point at unrelated work.

Round 59 fixed l2 the way the round-58 record proposed: a done hash's
`Loop-item:` trailer must name the item, an item it was absorbed by, or a batch
row.

Round 60 replaced it with the rule that stuck: the done hash's own diff must
touch a file the row owns. The trailer rule reported 36 legitimate old rows.

Round 61 gave an `.Rs` that carries only `%A` its trailing comma
(`A. Author,`), which is p53 and another latent form.

Round 62 kept a `\c` across one blank line, drew a blank line for a space block,
carried a pending join through a define-only request, and made a finished text
part re-render.

Round 63 made a single-backslash `\$1` expand at definition time, let a `\c`
inside an interpolated argument cut the rest of the body line, and made a bar
roman instead of the end of an mdoc argument list.

Rounds 51 to 63 left the sweep untouched, each for a stated reason: 51, 57 and
58 were code or tooling, 52 to 56 and 61 are forms no installed page uses, and
62 and 63's joins and macro arguments had no page left to move.

Round 64 closed the last word. thumbpdf(1) writes `Copyright \302\[co] 1999`,
whose lone `C2` byte is the corpus's only invalid UTF-8; `man-diff` now drops
U+FFFD from a word key and re-reads a word of byte-sized Latin-1 characters as
UTF-8 when that decode is valid, so the byte folds to `©` and sections 1, 3, 5,
7 and 8 are all 0 pages / 0 words on the 4150 installed pages.

Round 65 is the round that writes this paragraph. It takes a code item (c14:
a text or reasoning delta takes its part id from the event that started it, not
from `state`) and a man batch (b7: an `l ld`/`r ^` table span, about 110
`groff_char(7)` names the corpus never uses, and the `\v(` form, which is p79,
p83 and p34). No part of it should move the sweep: p79 reorders tbl(1)'s own
example text, and `man-diff` compares word multisets, not order, while p83's
names and p34's `\v(` are forms no installed page uses. The numbers above are
this file's measurement at `c5029a94`, the round's base; the loop re-measures
at the merged tip and that number is the one to trust.

Tests: the last whole-suite count taken (round 63's record) is 637 man tests
and 2095 of 2097 passing, 2 pending, check clean. Round 64 and round 65 added
tests without re-counting, so 2095 is a floor at `c5029a94`, not a measurement
of it.
`test-corpus` also parses and renders every page in the corpus. Line coverage
(measured after round 16, over the whole suite) is 100% for `man-char.mjs` and
`man-render.mjs`, 99.97% for `man-parse.mjs` (one line: the scan of an
unterminated `(` in a tbl column spec, which no installed page has), 100% for
`man-roff.mjs` and 98.88% for `man.mjs`. Branch coverage is 100%, 98.75%,
97.18%, 94.56% and 90.28% in the same order.

## Known gaps, in order

1. Div-buffer search works: `C-s`/`C-r` install the div search, the needle
   accumulates in the search bar and the point moves onto the match. A phrase
   may cross a styled span, because `Point.search` searches a block's whole
   text and returns a range with a bep at each end (in `alpha \fBbeta\fP
   gamma`, `alpha beta` is found both ways). `C-w` (`add word to search`) works
   too: its word pattern is matched as a regexp, the same `spec.regExp` the
   editor backend takes (global, with `i` unless the search is case sensitive),
   and an invalid pattern or an empty match is a miss rather than a hang. The
   block still bounds every match, so two paragraphs do not join and a phrase
   cannot cross a `<br>`, and a backward search that starts at the very
   beginning of a block skips that block, because nothing before the point
   exists to match there.
2. mdoc `Ex`/`Rv` match mdoc(7)'s sentences (names joined with `and`, the
   plural verbs, the `Nm` fallback) and expand to nothing without `-std`, as
   groff does. There are no `-exit`/`-nop` flags: only a leading `-std` is a
  flag, later arguments are names (dashes included), and a first argument that
  is not `-std` prints nothing — round 36 corrected an earlier claim here.
3. The bare-name stat still decides a directory and drives the topic lookup,
   but it is no longer the last word on readability: a regular file with no
   read bits is read anyway, because an ACL grant or root can read it (so root
   reading a mode-000 file now works), and `Permission denied` is reported only
   when that read fails. A mislabelled compressed file is caught by its magic
   bytes (gzip, xz, bzip2, zstd) even when `cat`'s output contains no NUL or
   replacement character, so it is reported as `cannot decompress` rather than
   drawn as text; lzma is not sniffed, because its header arrives UTF-8-decoded
   (the dictionary size's `0x80` and xz's eight `0xff` size bytes are already
   `U+FFFD`), so a test could only guess at the bytes that decide its shape,
   and `lzcat` is already tried for every compressed suffix.

## Changing it

- New man macro: classify it in `js/man-roff.mjs`, handle it in `man-parse.mjs`,
  add a test, rerun `man-audit --parse`.
- New request/escape: same, and prefer failing over "best effort" unless the
  construct is purely presentational (classify it `metric`/`ignore`).
- Inline styling is a class on a `<span>` (`man-bold`, `man-italic`,
  `man-mono`, `man-small`, `man-r-<role>`), never `<b>`/`<i>`: headings use
  `--clr-nb0` and bold uses `--clr-emph`, so a heading does not read as bold
  link text.
- A character name is added to `js/man-char.mjs` only when groff really has it:
  `\(ts` is the final sigma, and `\]` keeps its `]` because groff drops the
  backslash from an escape it does not know. Both were added after seeing them
  in the corpus.
- An escape whose bracket never closes consumes the rest of the line: `\f[`
  fails as `unterminated font escape`, and `\*[`/`\n[` take the rest as the
  string or register name. Never set the scan position from a negative
  `indexOf` result — the old `end + 1` became `0` and rescanned the line
  forever.
- Keep `man-parse.mjs` DOM-free and `man-render.mjs` model-only.
- `.mso` is accepted only for `www.tmac` and `an-ext.tmac`, whose macros
  (`URL`, `MTO`, `UR/UE`, `MT/ME`) are implemented directly; `.LINKSTYLE`'s
  glyph pair chooses the brackets `.URL`/`.MTO` use around a described target.
- `name(section)` in text is linkified to `man:name(section)`; the renderer puts
  the topic on `data-topic` and `man.mjs` follows clicks.
