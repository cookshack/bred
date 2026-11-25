# Loop queue

The durable half of the unattended loop's state. `doc/Loop.md` is the protocol;
this file is the "do not redo" list, and it is tracked so that losing the
session's worktree root does not lose the queue again.

The loop owns this file. Lanes read it and never edit it.

    run     stopped after round 18 (one round on the new tool)
    round   18 done at c1562d7; no round is scheduled
    main    ba74ca6      green; the record names the tip it verified
    state   $BRED_WORKTREE_ROOT/bred-loop/  briefs, claims, round logs (untracked)
    sweep   1:16p/147w  3:0p/0w  5:0p/0w  7:2p/7w  8:2p/9w   (round 18, c1562d7)
    plans   doc/Loop-upgrade.md (the loop's) and doc/loop/plan-2026-11-24.md
    hot     none

`bin/loop.mjs status` derives the same facts from git and the queue; this block
is prose and is not worth trusting over the command. The tables below are
generated from `doc/loop/queue.json` by `bin/loop.mjs report --write`.

Statuses: `ready` (dispatchable), `next` (queued after a decision or another
item), `triage` (needs evidence before it can be called a bug), `done:<hash>`
(merged on `main`). An item that turned out to be a measurement error is `done`
too, with the verdict in its title.

`files` is the item's file set, and it is authoritative: the loop checks it for
two lanes overlapping, and against the dirty tree and the files touched in the
last two hours (not counting the loop's own commits, listed as `own` in
`state`). An item whose files are busy is `next`, whatever its status was
before.

<!-- loop:queue -->
## Ready

| id | area | lane | status | title | files |
|----|------|------|--------|-------|-------|
| c14 | code | a2 | ready | text and reasoning deltas take their part id from state, so after a dropped started event they are attributed to part 0 | ext/code/event.mjs, test/code-events.mjs, test/code-prompt-e2e.mjs |
| b7 | man | a1 | ready | batch: table spans, character names, and the \v paren form (p79, p83, p34) | js/man-parse.mjs, js/man-char.mjs, test/man-parse.mjs |
| p128 | man | a1 | ready | a `.`-only line with no pending `\c` adds a space block; groff draws no gap | js/man-parse.mjs, test/man-parse.mjs |
| p34 | man | a1 | ready | `\v(`-delimited arguments are read as a 2-char name (no corpus use found) | js/man-parse.mjs, test/man-parse.mjs |
| p75 | man | a1 | ready | .IP "" 2 inside ps(1) cells (and nested .TS value lists) stays raw cell text; .IP draws no text, so it may join tableRequests or need a no-op path (the 18-word surplus, not lost) | js/man-parse.mjs, test/man-parse.mjs |
| p76 | man | a1 | ready | in mdoc mode the man(7) .SY/.OP pair renders with no separator (strace-log-merge[-a]); pre-existing, only reachable if an mdoc page uses them | js/man-parse.mjs, test/man-parse.mjs |
| p77 | man | a1 | ready | the parser maps the \t escape and a literal tab to the same character, erasing groff's zero-width vs tab-stop distinction; man-diff works around it | js/man-parse.mjs, test/man-parse.mjs |
| p79 | man | a1 | ready | on tbl(1) a l ld / r ^ table orders foo before r; man prints r then foo (word order around a vertical span) | js/man-parse.mjs, test/man-parse.mjs |
| p83 | man | a1 | ready | about 110 groff_char(7) names are absent (box pieces, md, c*, r!, OK, Eu, fractions); expected for the corpus claim, but the fallback hides it | js/man-char.mjs, test/man-parse.mjs |
| p102 | man | a1 | ready | an unknown escape (`\Q`) is printed by groff as its letter and refused here | js/man-parse.mjs, test/man-parse.mjs |
| c9 | code | a2 | ready | handlePartDelta asks one view whether a delta is thinking text and returns before the per-box draw, so a view that lacks the block never gets it; appendThinking already draws per box and the reference client renders every part in every view | ext/code/code.mjs, test/code-prompt-e2e.mjs |

## Backlog

| id | area | lane | status | title | files |
|----|------|------|--------|-------|-------|
| b8 | man | a1 | next | batch: a cell request, a dot-only line, and quoted arguments (p75, p128, p130) | js/man-parse.mjs, test/man-parse.mjs |
| b6 | man | a1 | next | batch: escapes and synopsis spacing (p102, p76, p77) | js/man-parse.mjs, test/man-parse.mjs |
| p129 | man | a1 | next | .sp N loses its count: one space block whatever N is, and man-render draws one gap | js/man-parse.mjs, js/man-render.mjs, test/man-parse.mjs, test/man-render.mjs |
| p50 | core | a2 | next | the peer-push test was reverted from main (b0b0afd; its commit fbdef92 is in main history). Both tests fail in the full suite (v1 !== v1X) while standing alone and under bounded c8 they pass; the first deliverable is a proof that fails at base, not only in suite order — until then the red gate parks it. Patch: $LOOP/p50-crash/a2-wip.patch | test/wode-view-e2e.mjs, js/wode*.mjs, js/view.mjs |

## Triage

| id | area | lane | status | title | files |
|----|------|------|--------|-------|-------|
| p59 | man | a1 | triage | a man page with no `.TH` loads no macro package in groff: man(1) drops the `.SH` headings and prints U+2010; we render headings (pcre2demo(3)) — refuse or mimic? | js/man-parse.mjs |
| p89 | man | a1 | triage | \[char0] is accepted by groff (a NUL byte) but refused here | js/man-char.mjs, test/man-parse.mjs |
| p90 | man | a1 | triage | groff -Tutf8 -man renders \- as U+2212 MINUS SIGN while -mdoc prints ASCII; bred prints ASCII. p30's note was mdoc-only; needs evidence and a decision | js/man-char.mjs, test/man-parse.mjs |
| p117 | man | a1 | triage | a zero-width escape (\b) is refused here and printed by groff (drops the backslash, prints the char); no corpus occurrence, latent | js/man-parse.mjs, test/man-parse.mjs |
| c2 | code | a2 | triage | session.step.streamed is dropped (seen live); decide whether it must translate | ext/code/event.mjs, test/code-events.mjs |
| c4 | code | a2 | triage | provider.updated / model.updated are dropped (session-less); decide whether the UI needs them | ext/code/event.mjs, test/code-events.mjs |
| p124 | man | a1 | triage | copy mode still reduces \. to "."; a body line starting with \. becomes an unknown request and refuses the page where groff prints nothing | js/man-parse.mjs, test/man-parse.mjs |
| c12 | code | a2 | triage | session.tool.input.delta is dropped; the tool preview only appears when the whole input has arrived | ext/code/event.mjs, test/code-events.mjs |

## Done

| id | area | lane | status | title | files |
|----|------|------|--------|-------|-------|
| c15 | code | a2 | done:2f97b214 | the `Creating session...` placeholder is never removed, so it stays above the first turn and can receive an orphan delta | ext/code/code.mjs, test/code-prompt-e2e.mjs |
| p130 | man | a1 | done:a0e05f0b | `\$@` interpolation does not quote its arguments: groff prints `["a" "b" "c"]`, bred `[a b c]` | js/man-parse.mjs, test/man-parse.mjs |
| b5 | man | a1 | done:30263abb | batch: macro arguments, a bar, and a cut body line (p101, p118, p119) | js/man-parse.mjs, test/man-parse.mjs |
| c13 | code | a2 | done:aa5130e6 | handlePartDelta draws a text delta as a thinking block when the assistant message element is missing (a reconnect that dropped session.text.started) | ext/code/code.mjs, test/code-prompt-e2e.mjs |
| b4 | man | a1 | done:f6b63ada | batch: joins and space blocks (p55, p73, p126) | js/man-parse.mjs, test/man-parse.mjs |
| p64 | man | a1 | done:cc7042c | `.Fn` in a SYNOPSIS also ends with `;` in groff; we do not print it (found in p61's report) | js/man-parse.mjs, test/man-parse.mjs |
| p65 | man | a3 | done:8f3eabee | verdict: the streaming decoder is already correct and a typed-array fake would be coverage-only, which the red gate cannot merge |  |
| p66 | man | a3 | done:c1562d7 | `flushPeer`'s `catch { return }` treats a throwing `sendableUpdates` as already flushed, so a broken collab field skips the wait silently (found in p50's report) | js/wode-view.mjs, test/wode-view-e2e.mjs |
| p47 | man | a3 | done:8c684ac | `strace-log-merge(1)`, `mendex(1)`, `gpg(1)`, `man(1)` residuals (1-2 words each) | bin/man-diff, test/man-diff.mjs |
| p57 | man | a2 | done:6e94402 | a colon list reports the last failing candidate; with a mode-000 part before a missing one it names the missing one | js/man.mjs, test/man-viewer.mjs |
| p44 | man | a1 | done:3f79ddf | `tbl(1)`/`gtbl(1)`'s example table prints `eleven;11` where man prints `eleven 11` | js/man-parse.mjs, test/man-parse.mjs |
| p53 | man | a1 | done:49156f7d | an `%A`-only `.Rs` ends with a period; groff ends with a comma (no corpus occurrence) | js/man-parse.mjs, test/man-parse.mjs |
| p54 | man | a1 | done:eac2c89c | a no-output request between a `\c` and the next line swallows the join (0 corpus occurrences) | js/man-parse.mjs |
| p55 | man | a1 | done:f6b63ada | a `\c` followed by a blank line: groff joins to the next text line, we make a paragraph break | js/man-parse.mjs, test/man-parse.mjs |
| p56 | man | a1 | done:889ce7c | a text line after `.br` starts with a space (`test/man-parse.mjs:2470` enshrines it); groff has none | js/man-parse.mjs, test/man-parse.mjs |
| p19 | man | a1 | done:1c115f6 | verdict: .Rv/.Ex have no -exit/-nop flags; only a leading -std is a flag, later args are names (p19 corrected the doc) | js/man-parse.mjs, test/man-parse.mjs |
| p33 | man | a1 | done:7846c1d0 | after a macro under `.Sm off`, a text line still gets a space (groff joins it) | js/man-parse.mjs |
| p45 | man | a1 | done:07e195dd | `.nr x +N` / `.nr x -N` set the register; groff adds/subtracts (found in p27) | js/man-parse.mjs |
| p12 | man | a1 | done:3eb439b | `\c` joins forward only (ext2/3/4.5 `trackingfile`) |  |
| p13 | man | a1 | done:3eb439b | `\F` and `\m \M \k \S \v` take their own forms (kernel-install `THE TION`, git-subtree, mflua) |  |
| p14 | man | a1 | done:3eb439b | `.Sm off` starts suppressing at the second call (ssh_config `PermitRemoteOpen host:port`) |  |
| p16 | man | a1 | done:3eb439b | ssh(1) synopsis `-D [bind_address:]port`: fixed by p14 |  |
| p20 | man | a2 | done:546bfee | a readable whole `man -w` line wins over its split parts (Man.md gap 3) |  |
| p23 | man | a1 | done:8edfd43 | `.Lb` maps through groff's table (9 libcrypt pages) |  |
| p24 | man | a1 | done:8edfd43 | `.In` prints `#include <...>` in SYNOPSIS (47 pages) |  |
| p26 | man | a1 | done:8edfd43 | `.do` runs its remainder instead of printing it (11 pages) |  |
| p27 | man | a1 | done:8edfd43 | `\n+[reg]` steps then reads (sensible-editor 1-5, zlib 1-3) |  |
| p35 | man | a2 | done:d59ccf7 | a whole `man -w` line that stats as a file is settled by its read |  |
| p36 | man | a2 | done:d59ccf7 | one `Cannot read <path>: <reason>` shape |  |
| p28 | man | a3 | done:244c425 | `man-diff` joins at a `\:` the page marks, not at every "/" |  |
| p31 | man | a3 | done:244c425 | a justified paragraph is not a table (hgrc `forthe`) |  |
| p37 | man | a3 | done:244c425 | a bordered cell's continuation at the left edge (TIFFGetField 6 → 0) |  |
| p39 | man | - | done:7ce2ecf | a background subagent is launched, not finished (tick, routing, ⏳) |  |
| p25 | man | a1 | done:d5042d1 | `.Rs` quotes `%T` only in a `%B`/`%J` reference, and takes groff's serial comma (14 ssh references) |  |
| p40 | man | a1 | done:d5042d1 | a `\c` tag line stays open across a macro (paperconfig `--paperpapername`, 5 dmstats tags) |  |
| p46 | man | a2 | done:2261231 | a colon-list part with no read bits says `Permission denied` |  |
| p21 | man | a2 | done:2261231 | lzma verdict: the header bytes are destroyed by the UTF-8 decode, so no safe sniff; `lzcat` already last |  |
| p41 | man | a3 | done:a18cd1b | the truncated mdoc banner is a header (5 pages, 31 → 1 words) |  |
| p42 | man | a3 | done:a18cd1b | the `\:` join accepts ":" (`bash(1)` 4 → 2) |  |
| p43 | man | a3 | done:a18cd1b | the `\:` join accepts "@" (`troff(1)` 2 → 0) |  |
| p52 | man | a1 | done:d9906f4 | a bare `.Nm` in a `T{`/`T}` cell prints the document name (both crypt pages 0) |  |
| p48 | man | a3 | done:2c5b9df | `man-diff --page` prints `lost <n>` before the sample |  |
| p30 | man | a3 | done:2c5b9df | verdict: no mdoc U+2010 rule; `man-diff` folds U+2010/U+2011/U+2212 (pcre2demo 67 → 12) |  |
| p58 | man | a1 | done:9ba3175 | `.hla`/`.hpf` are no-output requests; both Czech pages parse (corpus back to 4123/27) |  |
| p51 | man | a2 | done:c2b32ec | the `cat` fallback keeps its bytes, so the renderer names a mislabelled page's format (the app half is p63) |  |
| p60 | man | a3 | done:f3f1539 | `man-diff` folds typographic quotes; pcre2demo 12 → 0 (U+2018 folds to a backtick) |  |
| p62 | man | a3 | done:f3f1539 | the hyphen join is decided from the page source and applied to both sides; section 3 14 → 0 |  |
| p49 | man | a3 | done:f3f1539 | coverage re-measured over the whole suite: 100/99.97/100/100/98.88 line, branch 94.56/98.75/97.18/90.28 |  |
| p61 | man | a1 | done:b601364 | `.Fc` ends a SYNOPSIS declaration with `;`, and only in SYNOPSIS |  |
| p63 | man | a3 | done:ec7eedf | the pty's bytes cross IPC as Buffers; one streaming decoder per run; the real-pty test names gzip |  |
| s17 | man | - | done:9b8958c | stabilisation after the red merge: `Opt.load` survives a payload-less response, the opt tests install their own fake; a2's peer-push test reverted (p50) |  |
| p67 | man | a1 | done:ba79104 | a .Ss subsection inside SYNOPSIS resets the section state, so .Fn and .Fc lose the ; (groff keeps doc-in-synopsis-section across .Ss; no installed page hits it) | js/man-parse.mjs, test/man-parse.mjs |
| p68 | man | a2 | done:74ba52d | a colon-list part with read bits whose read fails ranks with a missing part, so a later miss can still shadow it; no test covers that ordering | js/man.mjs, test/man-viewer.mjs |
| p69 | man | a1 | done:2e66879 | a .br before any text emits an extra blank line, and two consecutive .br are not collapsed (groff keeps one break) | js/man-parse.mjs, test/man-parse.mjs |
| p70 | man | a1 | done:d8a351c | strace-log-merge(1) prints strace\-log\-merge literally in the synopsis; synopsisStart pushes args[0] raw where handleFont/OP expand it | js/man-parse.mjs, test/man-parse.mjs |
| p71 | man | a3 | done:72e8ca4 | mendex(1) one "lost" word is a tab display difference ("" vs two quote tokens); decide whether man-diff should treat a tab as non-separating | bin/man-diff, test/man-diff.mjs |
| p72 | man | a3 | done:aae6139 | ps(1) is 103 of section 1's words: man(1) wraps a comma-separated option list, and man-diff does not join a line that ends at a comma in that list; find a rule that joins it without joining prose commas | bin/man-diff, test/man-diff.mjs |
| p73 | man | a1 | done:f6b63ada | toText ignores space blocks, so .sp/blank lines are invisible to asText while man-render draws them; measurement-neutral (normal() collapses), pre-existing | js/man-parse.mjs, test/man-parse.mjs |
| p74 | man | a1 | done:00dc308 | ps(1) loses 95 words because a macro line inside a T{ } tbl cell stays raw (.BR pcpu ). instead of pcpu).); every T{ } cell using a macro is affected; the ps(1) pin in test/man-diff.mjs must be updated with the fix | js/man-parse.mjs, test/man-parse.mjs, test/man-diff.mjs |
| p78 | man | a1 | done:ee005d2 | L\[tmu]C renders L™C; groff prints L×C: js/man-char.mjs maps tmu to ™ instead of ×, the last lost word on tbl/gtbl | js/man-char.mjs, test/man-parse.mjs |
| p80 | man | a1 | done:cbbe080 | hy prints ASCII - ; groff prints U+2010: page-visible, measurement-neutral because man-diff folds it | js/man-char.mjs, test/man-parse.mjs |
| p81 | man | a1 | done:c3ff554 | Greek capitals are shifted one letter: *H is Η but should be Θ, *Q Θ should be Ψ, *Y Ψ should be Η; lowercase is correct | js/man-char.mjs, test/man-parse.mjs |
| p82 | man | a1 | done:0385d60 | an unknown u-prefixed name (uA) falls through to a hex/bogus codepoint (U+000A) instead of groff's U+21D1 or a refusal | js/man-char.mjs, test/man-parse.mjs |
| p84 | man | a1 | done:5ea6105 | *G is missing from the char table; groff prints Γ (U+0393), so a page using \[*G] is refused today | js/man-char.mjs, test/man-parse.mjs |
| p85 | man | a1 | done:29665b6 | *f maps to φ (U+03C6); groff prints ϕ (U+03D5); *J/*j/*V/*v are absent from groff too, not gaps | js/man-char.mjs, test/man-parse.mjs |
| p86 | man | a1 | done:6943a15 | .. maps to ‥ (U+2025) but groff refuses it; \[char0x41] is accepted but groff takes decimal charNNN only; missing arrows/lines va/vA/an | js/man-char.mjs, test/man-parse.mjs |
| p87 | man | a1 | done:01f65ce | an ASCII u name is refused only when groff has a plain glyph for it; u0040/u007E and controls still resolve (done: the blanket <0x80 wording was too broad) | js/man-char.mjs, test/man-parse.mjs |
| p88 | man | a1 | done:50a83a6 | \N'0x41'/\N'1e2'/\N'0' are read with Number(), so hex and exponent forms become characters; groff reads digits only | js/man-char.mjs, js/man-parse.mjs, test/man-parse.mjs |
| p91 | man | a1 | done:1219a56 | the \N[65] bracket form is unsupported (groff prints A); unquote only strips a matching first/last delimiter, so \N[65] refuses | js/man-char.mjs, js/man-parse.mjs, test/man-parse.mjs |
| p92 | man | a1 | done:e7b1a52 | an unpaired surrogate code point (\N'55296') is accepted as a JS string; groff emits invalid UTF-8; refuse surrogates as out of range | js/man-char.mjs, test/man-parse.mjs |
| p93 | man | a1 | done:50a83a6 | verdict: \N expression forms (65+1, 2*3, 1.5, leading space) stay refused by design; p88 measured groff's NUL-plus-tail output and the corpus has only plain decimals | js/man-parse.mjs, test/man-parse.mjs |
| p94 | man | a1 | done:091f8e5b | groff accepts \N[ 65] with a leading space; bred refuses it under the decimal-only rule | js/man-char.mjs, js/man-parse.mjs, test/man-parse.mjs |
| p95 | man | a1 | done:091f8e5b | groff's \[charN] is a glyph/table lookup, not a bare code point: char57344 warns and prints nothing, bred returns U+E000; char65/233/200 agree | js/man-char.mjs, test/man-parse.mjs |
| p96 | man | a1 | done:7183a0e | ttf2tfm(1) loses 10 words: a \c at the end of a text line whose next line is a .C macro call keeps the backtick glued to the macro text; groff joins them and we insert a space | js/man-parse.mjs, test/man-parse.mjs |
| p97 | man | a1 | done:d21a9d5 | four backslashes in a macro argument need two reduction rounds (copy mode then interpretation); we apply one, so c:\\fonts\\truetype keeps doubles: ttf2tfm's last two words | js/man-parse.mjs, test/man-parse.mjs |
| p98 | man | a1 | done:7846c1d0 | a \c before a macro whose body prints nothing (or before .ft/.ll) is still lost; the broad fix also glues across .PP/.RS/.sp, which needs a multi-macro sweep before changing | js/man-parse.mjs, test/man-parse.mjs |
| p99 | man | a1 | done:7032014 | built-in man requests (B, BR, SH, SS, SY, IP, OP) get one round here and two in groff, which implements them as tmac macros; .B a\\\\b is a\\b in groff and a\\b here | js/man-parse.mjs, test/man-parse.mjs |
| p100 | man | a1 | done:5b95c88e | copyMode() chains replacements and over-reduces \. and \  (groff copy mode leaves \. and an encoded space) | js/man-parse.mjs, test/man-parse.mjs |
| p101 | man | a1 | done:30263abb | a single-backslash body (\$1) is expanded at definition time in groff, not call time | js/man-parse.mjs, test/man-parse.mjs |
| p103 | man | a1 | done:66f38b3 | ttf2pk(1) loses 2 words: `.<resolution>pk' split on our side and `<namestem>@<sfd-filename>@') — quote/spacing placement, not a line join | js/man-parse.mjs, test/man-parse.mjs |
| p104 | man | a1 | done:f6aceef | hg(1) loses 2 words: man breaks at the \: between incoming and ), and man-diff's join whitelist does not accept ); our text is right, so the fix is the join | bin/man-diff, test/man-diff.mjs |
| p105 | man | a2 | done:de1718c | ssh-agent(1) loses 2 words: the synopsis -s] bracket | js/man-parse.mjs, test/man-parse.mjs |
| p106 | man | a3 | done:a3607bd | rpcgen(1)'s 0a is a footer page-string, not content: man-diff's isFooter must drop a right-aligned multi-page token (/^\s{10,}[0-9]+[a-z]$/) | bin/man-diff, test/man-diff.mjs |
| p107 | man | a1 | done:9612e96 | ssh-copy-id(1) loses 1 word: [user@]hostname in the synopsis | js/man-parse.mjs, test/man-parse.mjs |
| p108 | man | a1 | done:c1f2f38a | tex2aspc(1) loses 1 word: TransformNotes | js/man-parse.mjs, test/man-parse.mjs |
| p109 | man | a3 | done:9c9e1b12 | thumbpdf(1) mis-encoded byte folds to ©: section 1 reaches 0 lost words | bin/man-diff, test/man-diff.mjs |
| p110 | man | a1 | done:fc63c08c | tload(1) loses 1 word: and (a line join) | js/man-parse.mjs, test/man-parse.mjs |
| p111 | man | a1 | done:7032014a | xargs(1) loses 1 word: --show-limits (a hyphen join) | js/man-parse.mjs, test/man-parse.mjs |
| p112 | man | a1 | done:3d13d152 | editline(7) loses 5 words: a lone - in the text | js/man-parse.mjs, js/man-render.mjs, test/man-parse.mjs, test/man-render.mjs |
| p113 | man | a3 | done:6b36716 | gittutorial-2(7) loses 2 words: ways— and by (an em-dash join in man-diff) | bin/man-diff, test/man-diff.mjs |
| p114 | man | a3 | done:3bf287c | dmsetup(8) loses 5 words: long [a\|b] alternatives wrapped by man(1); decide a diff join or parser rule | bin/man-diff, test/man-diff.mjs |
| p116 | man | a1 | done:673c8b77 | .UE/.ME/.URL/.MTO trailing arguments lose a copy round: .UE a\\\\- prints a\- in groff, a\\- here | js/man-parse.mjs, test/man-parse.mjs |
| p118 | man | a1 | done:30263abb | a \c inside an interpolated macro argument must cut the rest of the outer body line; groff does, we keep emitting (pre `a tailnext) | js/man-parse.mjs, test/man-parse.mjs |
| g1 | code | a1 | done:f6ff0e7 | second area: a recorder of real v2 event streams and a conformance measure over translate() (translated / dropped / malformed), plus one committed fixture | bin/oc-record.mjs, bin/oc-conformance.mjs, test/code-conformance.mjs, test/fixtures/oc-events/*, ext/code/event.mjs |
| c1 | code | a1 | done:c72362c | session.text.ended is dropped by translate; the deltas carry the text, but the finished part is unused — decide whether it must produce a legacy event (triage) | ext/code/event.mjs, test/code-events.mjs, test/code-conformance.mjs, test/fixtures/oc-events/* |
| c3 | code | a3 | done:8618283a | session.retry.scheduled is dropped; a retry is visible to the user, so decide what legacy event it should be | ext/code/event.mjs, test/code-events.mjs, test/code-conformance.mjs |
| c5 | code | a1 | done:f26a1d0 | session.reasoning.ended has the same authoritative text as text.ended and is still dropped; translate it the same way | ext/code/event.mjs, test/code-events.mjs, test/code-conformance.mjs, test/fixtures/oc-events/* |
| c6 | code | a2 | done:596bc1a7 | a finished part is not re-rendered when it is plain .code-msg-text or seen only after its step ended (code.mjs/ui.mjs) | ext/code/code.mjs, ext/code/ui.mjs, test/code-prompt-e2e.mjs |
| p119 | man | a1 | done:30263abb | a bar is a roman word inside a macro argument list; the words after it keep the macro font and role | js/man-parse.mjs, test/man-parse.mjs |
| c7 | code | a2 | done:fd65122 | the reasoning handler reads only event.properties.delta, so c5's translated part.text does not repair a truncated thinking block; reconcile it like text parts | ext/code/code.mjs, ext/code/ui.mjs, test/code-prompt-e2e.mjs |
| p120 | man | a1 | done:07e195dd | a valueless .nr X sets it to 0 here; groff leaves it undefined and reading \nX creates it (two register divergences, no corpus effect) | js/man-parse.mjs, test/man-parse.mjs |
| p121 | man | a1 | done:e7e0d671 | .if r X with a space is refused; groff accepts both spellings (zero occurrences, but an-old.tmac uses it) | js/man-parse.mjs, test/man-parse.mjs |
| c8 | code | a2 | done:e3e11414 | Ui.appendThinking decides create-vs-append from one view's out box and applies it to every box, so a delta can duplicate a thinking block in another tab (pre-existing) | ext/code/ui.mjs, test/code-prompt-e2e.mjs |
| p123 | man | a3 | done:4dd8ef83 | a .Bl -dash list still renders as an HTML ul disc; groff draws "-" per item (the text model now agrees, the renderer does not) | js/man-render.mjs, css/manpage.css, test/man-render.mjs |
| c10 | code | a2 | done:ab988598 | the four session.compaction events are dropped; the reference client draws a compaction item with a running status and streams its summary, bred shows nothing | ext/code/event.mjs, ext/code/code.mjs, test/code-events.mjs |
| c11 | code | a2 | done:57c1d58f | session.synthetic is dropped; the reference client inserts a synthetic transcript item with text and description | ext/code/event.mjs, ext/code/code.mjs, test/code-events.mjs |
| p125 | man | a1 | done:eac2c89c | dmsetup(8) splits load\|reload into two words around a .BR line ending in \c | js/man-parse.mjs, test/man-parse.mjs, test/man-diff.mjs |
| l1 | tooling | a3 | done:9e2a821f | the loop has no clock it can enforce: put start/deadline/stopNew in the tracked queue, print the budget in status, and refuse a round after stopNew | bin/loop-clock.mjs, bin/loop.mjs, test/loop-clock.mjs, test/loop.mjs, doc/Loop.md, doc/Loop-prompt.md |
| b1 | man | a1 | done:07e195dd | batch: the man tail's register claims (p45, p120) | js/man-parse.mjs, test/man-parse.mjs |
| b2 | man | a1 | done:091f8e5b | batch: the character forms (p94, p95) | js/man-char.mjs, js/man-parse.mjs, test/man-parse.mjs |
| b3 | man | a1 | done:7846c1d0 | batch: a join through an empty macro, and Sm off before a text line (p98, p33) | js/man-parse.mjs, test/man-parse.mjs |
| p126 | man | a1 | done:f6b63ada | a no-output request that defines or removes still swallows a pending \c join (p54 covered only .ft) | js/man-parse.mjs, test/man-parse.mjs |
| p127 | man | a1 | done:8f3eabee | verdict: mdoc body text after .Sh is already roman (mdocHeading does restore c.font); not reproducible at 8f3eabee |  |
| l2 | tooling | a3 | done:ad68333e | check accepts any ancestor hash as a done hash, so a done item can point at an unrelated commit | bin/loop.mjs, bin/loop-queue.mjs, test/loop.mjs |

<!-- /loop:queue -->
