# Man page viewer

Status: 2026-11-23. `C-h u` / `M-x man` opens a manual page in a div buffer.
`Space`, `PageDown` and `C-v` scroll down a screenful; `Backspace`, `PageUp`
and `A-v` scroll up. Sections are listed in the Assist sidebar; `n`/`p` move
to the next/previous section and `Tab`/`Shift-Tab` to the next/previous link.

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

Corpus: 4150 installed pages (English + translations) on Debian bookworm.

```
parsed   4123   (99.3%)
refused    27
```

The refusals are page bugs, not dialect gaps: undefined `\*(AQ` in 7
translations, a broken `\f\f` in 6 Korean pages, an undefined `\fG` font in 2
gdbm pages, `It` without `Bl` (2), the `Su`/`R` strings that only eqn defines
(4), ms `DS`/`DE` (1), eqn `EQ`/`EN` (1), `mso pic.tmac` (1), strace's
undefined `.IX`, a `.p` typo and one undefined Cyrillic string.

A whole-section sweep (`--max 0`) after round 12 leaves this many pages (and
words) short of man(1)'s text. It is not a sample: `--max 400` prints
`400 of 1189 (sample; --max 0 for all)`, and an earlier version of this table
quoted such a sample as if it were the section.

```
section  1    3    5    7    8
pages   26   10    6    3    3
words  220  109    6    8   15
```

Part of that is measurement, not loss: man(1) wraps a long word onto the next
line (so it splits `[n]<&digit-` from `moves`), breaks a compound at a hyphen,
repeats a non-standard `.TH` in the footer, and breaks a long path at a `\:`
break point inside it. `man-diff` normalises the hyphen, the `\:` path and the
sentence-period cases, but a split inside a word that is neither hyphenated nor
marked in the source still counts. It also reassembles a U+2010-hyphenated
table cell (section 3's TIFF names are no longer reported as two words each),
drops a bare `|` and `_` from both sides since those are our table separators
and rule rows and man(1) draws neither, and compares words on a key that
ignores trailing sentence punctuation.

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
  among them only those three changed. `bash(1)` stays at 4: its PATH list
  breaks after a ":", the same `\:` mechanism, held for the next round so this
  change stays inside the "/" evidence.
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

Not a path break: `ttf2tfm(1)`'s 10 words are a `\c` at the end of a text line
whose next line is a macro call (the page's own `.C`, then `.ttc`). Groff keeps
the backtick glued to `.ttc'.]`; we insert the space the page suppressed and
split them. That is a parser question, not a measurement one.

The rest of the sweep is real. Section 1 is almost entirely ssh(1)/slogin(1)
references: `.Rs` puts a `%T` in curly quotes where groff leaves it bare. Then
`tbl(1)`/`gtbl(1)`'s example table (we print `eleven;11` where man(1) prints
`eleven 11`) and `ttf2tfm(1)`'s `\c` before a macro call, which is the parser's
(see below). Section 3 is pcre2demo(3)'s bare hyphens — an mdoc `-` is U+2010
and `\-` is U+2212, while we keep ASCII — and the mdoc header line
(`CRYPT_PREFERRED_METHO... BSD Library Functions Manual ...`), which `man-diff`
does not recognise as a header because groff truncated the name and dropped the
`(3)`. Section 8's worst pages are a synopsis of long `[a|b|c]` alternatives
that man(1) hyphenates, and the rest of the sweep is the same kind of
line-break join.

Some of the pages still reported hide a real loss rather than a layout one,
and are the next work. Fixed so far: the ssh helper pages' `OpenBSD 3.2.`
(the OS macros `.Ox`, `.Fx`, `.Nx`, `.Dx`, `.Ux` now print their version, `.Bx`
prepends it and `.At` gained groff's table); `init-d-script(5)`'s
`start\-stop\-daemon(8)` (`.Xr` expands its name); and `mount(8)`'s raw `\fP`
after a URL plus its literal `.sp` cells (the `.URL` tail is expanded, and a
`.sp`/`.br`/`.nf`/`.fi` line in a table body is a request, not a cell). Also fixed: the bare `.Nm` in
`ssh_config(5)` and `editrc(5)`, which prints the document name (the first
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

Tests: 520 (inventory, interpreter, renderer, viewer, real pty; the zstd pty
test is pending where `zstd` is not installed);
`test-corpus` also parses and renders every page in the corpus. Line coverage
is 100% for `man.mjs`, `man-char.mjs`, `man-render.mjs` and `man-roff.mjs`, and
99.97% for `man-parse.mjs` (one line: the scan of an unterminated `(` in a tbl
column spec, which no installed page has). Branch coverage is 92%, 100%, 100%,
97% and 95% in the same order.

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
   groff does. Their other flags (`-exit`, `-nop`) are accepted and ignored.
3. The bare-name stat still decides a directory and drives the topic lookup,
   but it is no longer the last word on readability: a regular file with no
   read bits is read anyway, because an ACL grant or root can read it (so root
   reading a mode-000 file now works), and `Permission denied` is reported only
   when that read fails. A mislabelled compressed file is caught by its magic
   bytes (gzip, xz, bzip2, zstd) even when `cat`'s output contains no NUL or
   replacement character, so it is reported as `cannot decompress` rather than
   drawn as text; lzma alone is not sniffed, since only its first byte is
   fixed and that byte is ordinary text.

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
