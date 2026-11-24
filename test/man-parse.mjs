import { equal, ok } from 'node:assert/strict'
import { fuzzDocs, fuzzPages } from './man-fuzz.mjs'
import * as ManParse from '../js/man-parse.mjs'

let tests

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

function parsed
(text, spec) {
  return ManParse.parse(text, spec)
}

function asText
(text, spec) {
  return ManParse.toText(parsed(text, spec).doc.blocks)
}

function flat
(spans) {
  return ManParse.toText([ { kind: 'para', spans } ]).replace(/\n$/, '')
}

tests = {}

test('title', 'TH fills the document header',
     () => {
       let r

       r = parsed('.TH LS 1 "2024-01-01" "GNU" "User Commands"\n')
       equal(r.doc.title, 'LS')
       equal(r.doc.section, '1')
       equal(r.doc.date, '2024-01-01')
       equal(r.doc.source, 'GNU')
     })

test('headings', 'SH and SS make headings',
     () => {
       let r

       r = parsed('.TH T 1\n.SH NAME\n.SS Extra\n')
       equal(r.doc.blocks[0].kind, 'heading')
       equal(r.doc.blocks[0].level, 1)
       equal(flat(r.doc.blocks[0].spans), 'NAME')
       equal(r.doc.blocks[1].level, 2)
     })

test('paragraphs', 'text lines fill one paragraph',
     () => {
       let r

       r = parsed('.TH T 1\n.SH NAME\nfirst line\nsecond line\n')
       equal(r.doc.blocks[1].kind, 'para')
       equal(flat(r.doc.blocks[1].spans), 'first line second line')
     })

test('paragraphs', 'CRLF line continuation joins before parsing',
     () => {
       let r

       r = parsed('.TH T 1\r\n.TP\r\nfirst \\\r\nsecond\\\r\nthird\r\nbody\r\n')
       equal(r.ok, 1)
       equal(flat(r.doc.blocks[0].tag), 'first secondthird')
     })

test('paragraphs', 'CRLF input is treated as LF',
     () => {
       let r

       r = parsed('.TH T 1\r\n.SH NAME\r\ntext\r\n.TP\r\ntag\r\nbody\r\n')
       equal(r.ok, 1)
       equal(flat(r.doc.blocks[0].spans), 'NAME')
     })

test('paragraphs', 'PP separates paragraphs',
     () => {
       let r

       r = parsed('.TH T 1\none\n.PP\ntwo\n')
       equal(r.doc.blocks.filter(b => b.kind == 'para').length, 2)
     })

test('fonts', 'B keeps spaces between arguments',
     () => {
       let r

       r = parsed('.TH T 1\n.B foo bar\n')
       equal(r.doc.blocks[0].spans[0].text, 'foo bar')
       equal(r.doc.blocks[0].spans[0].style, 'bold')
     })

test('fonts', 'quoted arguments lose their quotes',
     () => {
       let r

       r = parsed('.TH T 1\n.B "foo bar"\n')
       equal(flat(r.doc.blocks[0].spans), 'foo bar')
     })

test('headings', 'quoted headings lose their quotes',
     () => {
       let r

       r = parsed('.TH T 1\n.SH "SEE ALSO"\n')
       equal(flat(r.doc.blocks[0].spans), 'SEE ALSO')
     })

test('fonts', 'BR concatenates alternating arguments',
     () => {
       let r

       r = parsed('.TH T 1\n.BR ls (1)\n')
       equal(r.doc.blocks[0].spans[0].text, 'ls')
       equal(r.doc.blocks[0].spans[0].style, 'bold')
       equal(r.doc.blocks[0].spans[1].text, '(1)')
       equal(r.doc.blocks[0].spans[1].style, 'roman')
     })

test('fonts', 'inline font escapes change style until reset',
     () => {
       let r

       r = parsed('.TH T 1\na \\fBbold\\fR plain\n')
       equal(r.doc.blocks[0].spans.map(s => s.style).join(','), 'roman,bold,roman')
     })

test('tags', 'TP takes the next line as its tag',
     () => {
       let r, tag

       r = parsed('.TH T 1\n.TP\n.B \\-h\nShow help.\n')
       tag = r.doc.blocks[0]
       equal(tag.kind, 'tag')
       equal(flat(tag.tag), '-h')
       equal(tag.blocks[0].kind, 'para')
       equal(flat(tag.blocks[0].spans), 'Show help.')
     })

test('tags', 'IP takes its mark as an argument',
     () => {
       let r, tag

       r = parsed('.TH T 1\n.IP \\(bu 2\nItem\n')
       tag = r.doc.blocks[0]
       equal(tag.kind, 'tag')
       equal(flat(tag.tag), '•')
       equal(flat(tag.blocks[0].spans), 'Item')
     })

test('tags', 'IP without a mark is a plain paragraph',
     () => {
       let r

       r = parsed('.TH T 1\n.IP\nIndented\n')
       equal(r.doc.blocks[0].kind, 'para')
     })

test('insets', 'RS and RE group blocks',
     () => {
       let r

       r = parsed('.TH T 1\noutside\n.RS\ninside\n.RE\nafter\n')
       equal(r.doc.blocks[0].kind, 'para')
       equal(r.doc.blocks[1].kind, 'group')
       equal(r.doc.blocks[1].blocks[0].kind, 'para')
       equal(r.doc.blocks[2].kind, 'para')
     })

test('literal', 'nf keeps lines and fi ends it',
     () => {
       let r

       r = parsed('.TH T 1\n.nf\nline one\nline two\n.fi\nafter\n')
       equal(r.doc.blocks[0].kind, 'pre')
       equal(flat(r.doc.blocks[0].spans), 'line one\nline two')
       equal(r.doc.blocks[1].kind, 'para')
     })

test('literal', 'EX is a monospace literal block',
     () => {
       let r

       r = parsed('.TH T 1\n.EX\ncode\n.EE\n')
       equal(r.doc.blocks[0].kind, 'pre')
       equal(r.doc.blocks[0].mono, 1)
     })

test('links', 'UR and UE make a link with trailing text',
     () => {
       let r, link

       r = parsed('.TH T 1\n.UR https://example.com\nthe site\n.UE .\n')
       link = r.doc.blocks[0].spans.find(s => s.href)
       equal(link.href, 'https://example.com')
       equal(link.text, 'the site ⟨https://example.com⟩')
       equal(flat(r.doc.blocks[0].spans).endsWith('.') == 1, true)
     })

test('links', 'UR with no text shows the target',
     () => {
       let r

       r = parsed('.TH T 1\n.UR https://example.com\n.UE\n')
       equal(flat(r.doc.blocks[0].spans), '⟨https://example.com⟩')
     })

test('synopsis', 'SY, OP and YS build a synopsis line',
     () => {
       let r

       r = parsed('.TH T 1\n.SY ls\n.OP \\-a all\n.YS\n')
       equal(flat(r.doc.blocks[0].spans), 'ls [-a all]')
     })

test('strings', 'ds defines a string used by star',
     () => {
       let r

       r = parsed('.TH T 1\n.ds XX hello\n\\*(XX world\n')
       equal(flat(r.doc.blocks[0].spans), 'hello world')
     })

test('strings', 'as appends to a string',
     () => {
       let r

       r = parsed('.TH T 1\n.ds XX one\n.as XX two\n\\*(XX\n')
       equal(flat(r.doc.blocks[0].spans), 'onetwo')
     })

test('macros', 'de defines a macro with arguments',
     () => {
       let r

       r = parsed('.TH T 1\n.de M\n.B \\\\$1\n..\n.M bold\n')
       equal(r.doc.blocks[0].spans[0].text, 'bold')
       equal(r.doc.blocks[0].spans[0].style, 'bold')
     })

test('macros', 'am appends to a macro',
     () => {
       let r

       r = parsed('.TH T 1\n.de M\none\n..\n.am M\ntwo\n..\n.M\n')
       equal(flat(r.doc.blocks[0].spans), 'one two')
     })

test('macros', 'de ignores a trailing comment on its line',
     () => {
       let r

       r = parsed('.TH T 1\n.de M \\" comment\n.B hi\n..\n.M\n')
       equal(flat(r.doc.blocks[0].spans), 'hi')
     })

test('conditions', 'if n is true and if t is false',
     () => {
       equal(asText('.TH T 1\n.if n yes\n.if t no\n'), 'yes\n')
     })

test('conditions', 'ie and el pick one branch',
     () => {
       equal(asText('.TH T 1\n.ie n first\n.el second\n'), 'first\n')
     })

test('conditions', 'a brace block is skipped when false',
     () => {
       equal(asText('.TH T 1\n.if t \\{\\\nhidden\n.\\}\nshown\n'), 'shown\n')
     })

test('conditions', 'a brace block keeps its first line when true',
     () => {
       let r

       r = parsed('.TH T 1\n.ie n \\{\\\n. ftr V B\n.\\}\n\\f[V]text\n')
       equal(r.ok, 1)
       equal(flat(r.doc.blocks[0].spans), 'text')
       equal(r.doc.blocks[0].spans[0].style, 'bold')
     })

test('conditions', 'one-line text after an opened brace block is kept',
     () => {
       // groff prints "x chosen"; the untaken `.el \{ other` block is dropped.
       equal(asText('.TH T 1\n.SH A\nx\n.ie 1 chosen\n.el \\{ other\nmore\n\\}\n'),
             '\nA\nx chosen\n')
       // With the `.ie` false, groff prints "x other more".
       equal(asText('.TH T 1\n.SH A\nx\n.ie 0 chosen\n.el \\{ other\nmore\n\\}\n'),
             '\nA\nx other more\n')
     })

test('conditions', 'the bash(1) restricted shell sentence survives',
     () => {
       let text

       // bash.1's RESTRICTED SHELL: the taken `.el \{` branch carries the
       // sentence on the same line as the block opener.
       text = asText('.TH T 1\n' +
                     '.ie \\n(zY=1 When a command that is found to be a shell script is executed,\n' +
                     '.el \\{ When a command that is found to be a shell script is executed\n' +
                     '(see\n' +
                     '.SM\n' +
                     '.B "COMMAND EXECUTION"\n' +
                     'above),\n' +
                     '\\}\n' +
                     '.B rbash\n' +
                     'turns off any restrictions in the shell spawned to execute the\n' +
                     'script.\n')
       ok(text.includes('When a command that is found to be a shell script is executed'))
       ok(text.includes('(see COMMAND EXECUTION above),'))
       // The bare `\}` line closes the block without adding a space, so the
       // next inline macro does not leave two (round 7 left `above),  rbash`).
       ok(text.includes('(see COMMAND EXECUTION above), rbash turns off'))
     })

test('conditions', 'a bare closing brace line contributes no text or space',
     () => {
       let text

       // groff prints "x aaa bbb ccc": the `\}` line that closes the block
       // opened by `.ie 1 \{` is neither text nor a separator, and the `.B`
       // request after it still runs.
       text = asText('.TH T 1\n.SH A\nx\n.ie 1 \\{ aaa\n' +
                     'bbb\n' +
                     '\\}\n' +
                     '.B ccc\n')
       equal(text, '\nA\nx aaa bbb ccc\n')
     })

test('conditions', 'a taken ie brace block still skips the el block',
     () => {
       // The untaken `.el \{` block owns `more` through its own `\}` line.
       equal(asText('.TH T 1\n.SH A\nx\n.ie 1 \\{ taken\n.el \\{ other\nmore\n\\}\n.B after\n'),
             '\nA\nx taken after\n')
     })

test('conditions', 'an undefined register in a condition is 0',
     () => {
       let r

       // groff reads an undefined register as 0 and does not warn (bash(1)
       // guards `zY` for the rbash(1) copy, but groff does not require it).
       r = parsed('.TH T 1\n.ie \\n(zz=1 yes\n.el no\n')
       equal(r.ok, 1)
       equal(r.fails.length, 0)
       equal(ManParse.toText(r.doc.blocks), 'no\n')
     })

test('conditions', 'a defined register still picks both branches',
     () => {
       equal(asText('.TH T 1\n.nr Q 1\n.ie \\nQ=1 one\n.el no\n.ie \\nQ=2 no\n.el two\n'),
             'one two\n')
     })

test('conditions', 'registers are tested and expanded',
     () => {
       let r

       r = parsed('.TH T 1\n.nr X 5\n.if \\nX>3 big\nX is \\nX\n')
       equal(flat(r.doc.blocks[0].spans), 'big X is 5')
     })

test('conditions', 'a string condition compares text',
     () => {
       equal(asText('.TH T 1\n.if \'a\'a\' same\n'), 'same\n')
     })

test('translation', 'tr maps characters',
     () => {
       equal(asText('.TH T 1\n.tr ab ba\nabba\n'), 'baab\n')
     })

test('escapes', 'special characters and dashes',
     () => {
       equal(flat(parsed('.TH T 1\na \\(em b \\[bu] c \\- d\n').doc.blocks[0].spans),
             'a — b • c - d')
     })

test('escapes', 'a nested bracket argument does not leak a bracket',
     () => {
       // libsasl(5) defines `T>` as a font-family change built on a register.
       equal(asText('.TH T 1\n' +
                    '.ds T> \\F[\\n[.fam]]\n' +
                    'x \\*(T>ls\\*(T> y\n'),
             'x ls y\n')
       equal(asText('.TH T 1\nx \\F[\\n[.fam]] y\n'), 'x  y\n')
     })

test('escapes', 'a font family takes one character or a name',
     () => {
       let r

       // kernel-install(8): the SH heading must keep the $BOOT arguments.
       r = parsed('.TH T 1\n.SH "THE \\FI$BOOT\\FR PARTITION"\n')
       equal(flat(r.doc.blocks[0].spans), 'THE $BOOT PARTITION')
       // mflua(1): \FIRST-LINE is family I, then the text RST-LINE.
       equal(asText('.TH T 1\nx \\FIRST-LINE y\n'), 'x RST-LINE y\n')
       equal(asText('.TH T 1\nx \\F(BIcanary y\n'), 'x canary y\n')
     })

test('escapes', 'colour escapes take one character or a name',
     () => {
       equal(asText('.TH T 1\nx \\mIcanary y \\Miagain z\n'),
             'x canary y again z\n')
       equal(asText('.TH T 1\nx \\m[red]canary y\n'), 'x canary y\n')
     })

test('escapes', 'a horizontal mark takes one character',
     () => {
       // getconf(1) marks the position as \k: for the decimal separator.
       equal(asText('.TH T 1\nx \\k:canary y\n'), 'x canary y\n')
     })

test('escapes', 'slant and vertical motion take one character undelimited',
     () => {
       equal(asText(".TH T 1\nx \\S'2'icanary y\n"), 'x icanary y\n')
       equal(asText('.TH T 1\nx \\S2icanary y\n'), 'x icanary y\n')
       equal(asText('.TH T 1\nx \\v2icanary y\n'), 'x icanary y\n')
     })

test('escapes', 'a continued line glues to the macro after it',
     () => {
       equal(asText('.TH T 1\n.I file\\c\n.RB [ .dvi ]\n'), 'file[.dvi]\n')
     })

test('escapes', 'a font argument ending in c continues the next line',
     () => {
       equal(asText('.TH T 1\n.B x\\c\nand y\n'), 'xand y\n')
       equal(asText('.TH T 1\n.BI \\e n\\c\n\\&, where\n'), '\\n, where\n')
     })

test('escapes', 'a size escape takes one signed digit or two plain ones',
     () => {
       equal(asText('.TH T 1\n.nf\nx\\s-133y\n.fi\n'), 'x33y\n')
       equal(asText('.TH T 1\n.nf\nx\\s123y\n.fi\n'), 'x3y\n')
       equal(asText('.TH T 1\n.nf\nx\\s12y\n.fi\n'), 'xy\n')
     })

test('escapes', 'a unicode and a decimal character name resolve',
     () => {
       equal(asText('.TH T 1\nx \\[u2014] \\[char65] y\n'), 'x — A y\n')
       equal(parsed('.TH T 1\nx \\N\'0\' y\n').ok, 0)
     })

test('escapes', 'final sigma has its own name',
     () => {
       equal(asText('.TH T 1\na \\(ts b\n'), 'a ς b\n')
     })

test('escapes', 'unrecognised escape keeps its character',
     () => {
       let r

       r = parsed('.TH T 1\nfile \\] a\n')
       equal(r.ok, 1)
       equal(flat(r.doc.blocks[0].spans), 'file ] a')
     })

test('escapes', 'continue joins lines without a space',
     () => {
       equal(flat(parsed('.TH T 1\njoin\\c\ned\n').doc.blocks[0].spans), 'joined')
     })

test('escapes', 'a line ending in c keeps the space before itself',
     () => {
       // ext2/3/4.5: "for tracking" then "file system" must not run together.
       equal(asText('.TH T 1\naa\nbb multi-\\c\ncc dd.\n'),
             'aa bb multi-cc dd.\n')
     })

test('escapes', 'a break escape starts a new output line',
     () => {
       equal(flat(parsed('.TH T 1\none\\ptwo\n').doc.blocks[0].spans), 'one\ntwo')
     })

test('comments', 'comment lines and mid-line comments are dropped',
     () => {
       let r

       r = parsed('.TH T 1\n.\\" .wibble\nvisible \\" hidden\n')
       equal(flat(r.doc.blocks[0].spans), 'visible')
       equal(r.ok, 1)
     })

test('ignore', 'ig skips until the terminator',
     () => {
       let r

       r = parsed('.TH T 1\n.ig\n.wibble\n..\nshown\n')
       equal(r.ok, 1)
       equal(flat(r.doc.blocks[0].spans), 'shown')
     })

test('include', 'so asks the caller for the included text',
     () => {
       let r

       r = parsed('.TH T 1\n.so other.1\n',
                  { include: path => (path == 'other.1') ? '.B included\n' : 0 })
       equal(r.ok, 1)
       equal(flat(r.doc.blocks[0].spans), 'included')
     })

test('include', 'so without a loader fails',
     () => {
       let r

       r = parsed('.TH T 1\n.so other.1\n')
       equal(r.ok, 0)
       equal(r.fails[0].what, 'include other.1')
     })

test('include', 'a self-including page is refused instead of looping',
     () => {
       let r, src

       src = '.TH T 1\n.SH NAME\ntext\n.so self.1\n'
       r = parsed(src, { include: path => (path == 'self.1') ? src : 0 })
       equal(r.ok, 0)
       equal(r.fails[0].what, 'include cycle self.1')
     })

test('include', 'mutually including pages are refused instead of looping',
     () => {
       let a, b, r

       a = '.TH A 1\n.so b.1\n'
       b = '.TH B 1\n.so a.1\n'
       r = parsed(a, { include: path => (path == 'a.1') ? a : ((path == 'b.1') ? b : 0) })
       equal(r.ok, 0)
       equal(r.fails[0].what, 'include cycle b.1')
     })

test('include', 'including the same page twice in sequence is allowed',
     () => {
       let r

       r = parsed('.TH T 1\n.so frag.1\n.so frag.1\n',
                  { include: path => (path == 'frag.1') ? '.B twice\n' : 0 })
       equal(r.ok, 1)
       equal(ManParse.toText(r.doc.blocks).includes('twice'), true)
     })

test('refusal', 'a recursive string is refused instead of crashing',
     () => {
       let r

       r = parsed('.TH T 1\n.ds A \\*A\ntext \\*A\n')
       equal(r.ok, 0)
       equal(r.fails.some(f => f.what == 'expansion recursion'), true)
     })

test('refusal', 'an unknown macro fails the page with its line',
     () => {
       let r

       r = parsed('.TH T 1\n.SH NAME\n.wibble x\n')
       equal(r.ok, 0)
       equal(r.fails[0].what, 'macro wibble')
       equal(r.fails[0].line, 3)
     })

test('refusal', 'an unknown character fails the page',
     () => {
       let r

       r = parsed('.TH T 1\na \\(zz b\n')
       equal(r.ok, 0)
       equal(r.fails[0].what, 'character \\(zz)')
     })

test('refusal', 'an unparsed condition fails the page',
     () => {
       let r

       r = parsed('.TH T 1\n.if nonsense text\n')
       equal(r.ok, 0)
       equal(r.fails[0].what.startsWith('condition'), true)
     })

test('text', 'toText walks the block model',
     () => {
       equal(asText('.TH T 1\n.SH NAME\n.B ls\n.TP\n.B \\-a\nall\n'),
             '\nNAME\nls\n-a\nall\n')
     })

test('tables', 'a tab option separated by a space sets the separator',
     () => {
       let r

       r = parsed('.TH T 1\n.TS\ntab (@);\nl l.\na@b\nc@d\n')
       equal(flat(r.doc.blocks[0].rows[0].cells[0].spans), 'a')
       equal(flat(r.doc.blocks[0].rows[0].cells[1].spans), 'b')
       equal(flat(r.doc.blocks[0].rows[1].cells[1].spans), 'd')
     })

test('tables', 'a T} opens the next multiline cell on the same line',
     () => {
       let r, rows

       r = parsed('.TH T 1\n.TS\nl l.\n_\nT{\nfirst\nT}\tT{\nsecond\nT}\n_\n')
       equal(r.ok, 1)
       rows = r.doc.blocks[0].rows
       equal(rows[1].cells.length, 2)
       equal(flat(rows[1].cells[0].spans), 'first')
       equal(flat(rows[1].cells[1].spans), 'second')
       // A closing T} can follow the last line of the cell.
       r = parsed('.TH T 1\n.TS\nl.\nT{\nfirst\nlast text T}\n')
       equal(flat(r.doc.blocks[0].rows[0].cells[0].spans), 'first\nlast text')
     })

test('tables', 'a simple table keeps rows and cells',
     () => {
       let r, table

       r = parsed('.TH T 1\n.TS\nl l.\none\ttwo\nthree\tfour\n.TE\n')
       table = r.doc.blocks[0]
       equal(table.kind, 'table')
       equal(table.rows.length, 2)
       equal(flat(table.rows[0].cells[0].spans), 'one')
       equal(flat(table.rows[1].cells[1].spans), 'four')
     })

test('tables', 'column modifiers set alignment and bold',
     () => {
       let r, table

       r = parsed('.TH T 1\n.TS\nlb r c.\na\tb\tc\n.TE\n')
       table = r.doc.blocks[0]
       equal(table.cols[0].bold, 1)
       equal(table.cols[1].align, 'right')
       equal(table.cols[2].align, 'center')
     })

test('tables', 'tab() selects the cell separator',
     () => {
       let r, table

       r = parsed('.TH T 1\n.TS\ntab(:);\nl l.\none:two\n.TE\n')
       table = r.doc.blocks[0]
       equal(flat(table.rows[0].cells[0].spans), 'one')
       equal(flat(table.rows[0].cells[1].spans), 'two')
     })

test('tables', 'box is recorded as an option',
     () => {
       let r

       r = parsed('.TH T 1\n.TS\nbox;\nl l.\na\tb\n.TE\n')
       equal(r.doc.blocks[0].options.box, 1)
     })

test('tables', 'T{ and T} make a multi-line cell',
     () => {
       let r, table

       r = parsed('.TH T 1\n.TS\nl l.\none\tT{\ntwo lines\nT}\n.TE\n')
       table = r.doc.blocks[0]
       equal(flat(table.rows[0].cells[1].spans), 'two lines')
     })

test('tables', 'T& starts another table',
     () => {
       let r

       r = parsed('.TH T 1\n.TS\nl.\na\n.T&\nl.\nb\n.TE\n')
       equal(r.doc.blocks.filter(b => b.kind == 'table').length, 2)
     })

test('tables', 'toText joins cells in a row',
     () => {
       equal(asText('.TH T 1\n.TS\nl l.\na\tb\n.TE\n'), 'a | b\n')
     })

test('tables', 'a request line in a table body is not a cell',
     () => {
       let r, table

       // mount(8)'s filesystem table puts `.sp` at the top of every T{ cell;
       // tbl passes the line to roff instead of reading it as data.
       r = parsed('.TH T 1\n.TS\nallbox tab(:);\nlt lt.\n' +
                  'T{\n.sp\n\\fBFilesystem(s)\\fP\nT}:T{\n.sp\n\\fBManual page\\fP\nT}\n' +
                  'T{\n.sp\nbtrfs\nT}:T{\n.sp\nbtrfs(5)\nT}\n.TE\n')
       table = r.doc.blocks[0]
       equal(flat(table.rows[0].cells[0].spans), 'Filesystem(s)')
       equal(flat(table.rows[0].cells[1].spans), 'Manual page')
       equal(flat(table.rows[1].cells[0].spans), 'btrfs')
       equal(flat(table.rows[1].cells[1].spans), 'btrfs(5)')
       // A body line that is a bare `.` or `.br` is a request too, and one
       // such line must not split a row into cells of its own.
       r = parsed('.TH T 1\n.TS\nl l.\na\tb\n.sp\nc\td\n.br\ne\tf\n.TE\n')
       table = r.doc.blocks[0]
       equal(table.rows.length, 3)
       equal(flat(table.rows[0].cells[0].spans), 'a')
       equal(flat(table.rows[1].cells[0].spans), 'c')
       equal(flat(table.rows[2].cells[1].spans), 'f')
     })

test('tables', 'a bare Nm in a T{ cell prints the document name',
     () => {
       let r, table, page

       // crypt_checksalt(3) writes the name as a bare `.Nm` in the ATTRIBUTES
       // table. tbl hands the control line to roff, so mdoc runs it and prints
       // the document name; it must not come out as the literal ".Nm".
       page = '.Dd November 8, 2018\n.Dt CRYPT_CHECKSALT 3\n.Os\n' +
              '.Sh NAME\n.Nm crypt_checksalt\n.Nd validate a setting\n' +
              '.Sh ATTRIBUTES\n.TS\nallbox;\nlb lb lb\nl l l.\n' +
              'Interface\tAttribute\tValue\n' +
              'T{\n.Nm\nT}\tThread safety\tMT-Safe\n.TE\n'
       r = parsed(page)
       equal(r.ok, 1)
       table = r.doc.blocks.filter(b => b.kind == 'table')[0]
       equal(flat(table.rows[1].cells[0].spans), 'crypt_checksalt')
       equal(flat(table.rows[1].cells[1].spans), 'Thread safety')
       equal(flat(table.rows[1].cells[2].spans), 'MT-Safe')
       ok(asText(page).includes('.Nm') == 0)
     })

test('tables', 'an Nm with an argument in a T{ cell prints the argument',
     () => {
       let r, table

       r = parsed('.Dd November 8, 2018\n.Dt CRYPT_CHECKSALT 3\n.Os\n' +
                  '.Sh NAME\n.Nm crypt_checksalt\n.Nd validate a setting\n' +
                  '.Sh ATTRIBUTES\n.TS\nl l.\n' +
                  'T{\n.Nm crypt\nT}\tThread safety\n.TE\n')
       equal(r.ok, 1)
       table = r.doc.blocks.filter(b => b.kind == 'table')[0]
       equal(flat(table.rows[0].cells[0].spans), 'crypt')
       equal(flat(table.rows[0].cells[1].spans), 'Thread safety')
     })

test('tables', 'a font macro inside a T{ cell prints its arguments',
     () => {
       let r, page

       // ps(1)'s %cpu description ends with `.BR pcpu ).` inside the cell.
       // tbl hands the control line to roff, so man runs the macro and prints
       // "pcpu)." (the close paren attaches to the bold word); the macro line
       // itself must not reach the text.
       page = '.TH T 1\n.TS\nl l.\na\tT{\nlucky.  (alias\n.BR pcpu ).\nT}\n.TE\n'
       r = parsed(page)
       equal(r.ok, 1)
       equal(flat(r.doc.blocks[0].rows[0].cells[1].spans), 'lucky.  (alias\npcpu).')
       ok(asText(page).includes('.BR') == 0)
     })

test('tables', 'a quoted font-macro argument inside a T{ cell keeps its text',
     () => {
       let r

       // ps(1)'s state field writes `.BR s ". (alias" \ s ).`: the quoted
       // argument is `. (alias`, and the escaped spaces separate the rest.
       r = parsed('.TH T 1\n.TS\nl l.\nstate\tT{\nsee\n' +
                  '.BR s ". (alias" \\ s ).\nT}\n.TE\n')
       equal(flat(r.doc.blocks[0].rows[0].cells[1].spans), 'see\ns. (alias s).')
     })

test('tables', 'an mdoc text macro inside a T{ cell prints its expansion',
     () => {
       let r, table, page

       // A cell can hold any text macro, not only a bare `.Nm`: tbl hands the
       // line to mdoc, so `.Xr ps 1 .` prints "ps(1)." and `.Fl a` prints
       // "-a".
       page = '.Dd November 8, 2018\n.Dt T 3\n.Os\n.Sh NAME\n.Nm t\n.Nd x\n' +
              '.Sh SEE ALSO\n.TS\nl l.\n' +
              'T{\nsee\n.Xr ps 1 .\nT}\tT{\nall\n.Fl a\nT}\n.TE\n'
       r = parsed(page)
       equal(r.ok, 1)
       table = r.doc.blocks.filter(b => b.kind == 'table')[0]
       equal(flat(table.rows[0].cells[0].spans), 'see\nps(1).')
       equal(flat(table.rows[0].cells[1].spans), 'all\n-a')
     })

test('tables', 'a cell request outside the text macros is still not run',
     () => {
       let r

       // tbl hands every control line to roff, but this model runs only the
       // text macros. Anything else stays as the text it was, so a request is
       // never half-applied.
       r = parsed('.TH T 1\n.TS\nl l.\na\tT{\ntext\n.IP "" 2\nmore\nT}\n.TE\n')
       equal(flat(r.doc.blocks[0].rows[0].cells[1].spans),
             'text\n.IP "" 2\nmore')
     })

test('tables', 'a normal row still splits and a cell keeps its period',
     () => {
       let r, table

       r = parsed('.TH T 1\n.TS\nl l.\n3.5\t.sp text\n.TE\n')
       table = r.doc.blocks[0]
       equal(table.rows.length, 1)
       equal(flat(table.rows[0].cells[0].spans), '3.5')
       equal(flat(table.rows[0].cells[1].spans), '.sp text')
     })

test('tables', 'a table with no format is refused, not emptied',
     () => {
       let r, text

       r = parsed('.TH T 1\n.TS\n.\na\tb\nc\td\n.TE\n')
       equal(r.ok, 0)
       equal(r.fails.length, 1)
       equal(r.fails[0].what, 'table with no format')
       // The .TS line, not the .TE line, so the report points at the table.
       equal(r.fails[0].line, 2)
       // tbl draws nothing for it, and neither do we: toText and the block
       // model agree, so no half table leaks out.
       equal(r.doc.blocks[0].kind, 'table')
       equal(r.doc.blocks[0].rows.length, 2)
       equal(r.doc.blocks[0].rows[0].cells.length, 0)
       text = asText('.TH T 1\n.TS\n.\na\tb\nc\td\n.TE\n')
       ok(text.indexOf('a') < 0)
       ok(text.indexOf('b') < 0)
     })

test('tables', 'a table with an unrecognisable format is refused',
     () => {
       let r

       r = parsed('.TH T 1\n.TS\nx x.\na\tb\n.TE\n')
       equal(r.ok, 0)
       equal(r.fails[0].what, 'table format without columns')
     })

test('tables', 'a normal table next to a refused one keeps its cells',
     () => {
       let r, tables

       r = parsed('.TH T 1\n.TS\n.\nlost\twords\n.TE\n.TS\nl l.\nkept\tcells\n.TE\n')
       equal(r.ok, 0)
       equal(r.fails.length, 1)
       tables = r.doc.blocks.filter(b => b.kind == 'table')
       equal(tables.length, 2)
       equal(flat(tables[1].rows[0].cells[0].spans), 'kept')
       equal(flat(tables[1].rows[0].cells[1].spans), 'cells')
     })

test('mdoc', 'the prologue fills the document header',
     () => {
       let r

       r = parsed('.Dd January 1, 2024\n.Dt LS 1\n.Os Linux\n')
       equal(r.doc.title, 'LS')
       equal(r.doc.section, '1')
       equal(r.doc.date, 'January 1, 2024')
       equal(r.doc.source, 'Linux')
     })

test('mdoc', 'Sh and Ss make headings',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh NAME\n.Ss Extra\n')
       equal(r.doc.blocks[0].kind, 'heading')
       equal(flat(r.doc.blocks[0].spans), 'NAME')
       equal(r.doc.blocks[1].level, 2)
     })

test('mdoc', 'Nm and Nd make the NAME line',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh NAME\n.Nm ls\n.Nd list files\n')
       equal(flat(r.doc.blocks[1].spans), 'ls — list files')
     })

test('mdoc', 'Xr is a cross reference link',
     () => {
       let r, link

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh SEE ALSO\n.Xr ls 1 .\n')
       link = r.doc.blocks[1].spans[0]
       equal(link.text, 'ls(1)')
       equal(link.href, 'man:ls(1)')
       equal(flat(r.doc.blocks[1].spans), 'ls(1).')
     })

test('mdoc', 'Xr expands the name it links',
     () => {
       let r, link

       // init-d-script(5): `.Xr start\-stop\-daemon 8 .` is
       // "start-stop-daemon(8)." in groff -Tutf8 -man.
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh SEE ALSO\n.Xr start\\-stop\\-daemon 8 .\n')
       link = r.doc.blocks[1].spans[0]
       equal(link.text, 'start-stop-daemon(8)')
       equal(link.href, 'man:start-stop-daemon(8)')
       equal(flat(r.doc.blocks[1].spans), 'start-stop-daemon(8).')
     })

test('mdoc', 'In brackets its header and makes it a #include in SYNOPSIS',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh SYNOPSIS\n.In stdio.h\n')
       equal(flat(r.doc.blocks[1].spans), '#include <stdio.h>')
     })

test('mdoc', 'Fl makes options and Fl Fl makes a long option',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Fl a b\n.Op Fl Fl all\n')
       equal(flat(r.doc.blocks[0].spans), '-a -b [--all]')
     })

test('mdoc', 'Cd is a bold configuration declaration',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Cd "pseudo-device mtrr 1"\n')
       equal(flat(r.doc.blocks[0].spans), 'pseudo-device mtrr 1')
       equal(r.doc.blocks[0].spans[0].style, 'bold')
     })

test('mdoc', 'Fd, Ad and Bsx format their arguments',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Fd #include <stdio.h>\n.Ad 0x1234\n.Bsx 3.0 .\n')
       equal(flat(r.doc.blocks[0].spans), '#include <stdio.h> 0x1234 BSD/OS 3.0.')
       equal(r.doc.blocks[0].spans[0].style, 'bold')
       equal(r.doc.blocks[0].spans.find(s => s.text == '0x1234').style, 'italic')
     })

test('mdoc', 'Tg produces no output',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\nBefore\n.Tg examine\nAfter\n')
       equal(flat(r.doc.blocks[0].spans), 'Before After')
     })

test('mdoc', 'a reference field outside a reference is text',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.%T "A Title"\n')
       equal(r.ok, 1)
       equal(flat(r.doc.blocks[0].spans), 'A Title')
     })

test('mdoc', 'Op nests a macro call',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Op Fl e Ar file\n')
       equal(flat(r.doc.blocks[0].spans), '[-e file]')
     })

test('mdoc', 'Dq quotes its nested content',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Dq Ar file\n')
       equal(flat(r.doc.blocks[0].spans), '“file”')
     })

test('mdoc', 'Qq uses straight double quotes',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Qq Ar file\n')
       equal(flat(r.doc.blocks[0].spans), '"file"')
     })

test('mdoc', 'trailing punctuation follows the closing delimiter',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Dq Ar file .\n.Pq Ar file ,\n.Ql file .\n.In sys/stat.h .\n')
       equal(flat(r.doc.blocks[0].spans), '“file”. (file), ‘file’. <sys/stat.h>.')
     })

test('mdoc', 'an ellipsis is text, not punctuation',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Op Ar argument ...\n')
       equal(flat(r.doc.blocks[0].spans), '[argument ...]')
     })

test('mdoc', 'tag mode spaces consecutive macros',
     () => {
       let r, list

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Bl -tag -width x\n.It Fl a Em allexport\nfirst\n.El\n')
       list = r.doc.blocks[0]
       equal(flat(list.items[0].tag), '-a allexport')
     })

test('mdoc', 'a delimiter inside an open tag stays in the tag',
     () => {
       let r, list

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Bl -tag -width x\n.It Xo\n.Op opt\n.Xc\nbody\n.El\n')
       list = r.doc.blocks[0]
       equal(flat(list.items[0].tag), '[opt]')
       equal(flat(list.items[0].blocks[0].spans), 'body')
     })

test('mdoc', 'Ns suppresses the space before punctuation in a tag',
     () => {
       let r, list

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Bl -tag -width x\n.It Fl a Ns , description\nfirst\n.El\n')
       list = r.doc.blocks[0]
       equal(flat(list.items[0].tag), '-a, description')
     })

test('mdoc', 'punctuation ends a macro so the next call is separate',
     () => {
       let r, list

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Bl -tag -width x\n.It Fl b , Fl Fl brief\nfirst\n.El\n')
       list = r.doc.blocks[0]
       equal(flat(list.items[0].tag), '-b, --brief')
     })

test('mdoc', 'a break before any text adds no blank line',
     () => {
       equal(asText('.Dd t\n.Dt T 1\n.Os\n.Sh NAME\n.br\ntwo\n'),
             '\nNAME\ntwo\n')
     })

test('mdoc', 'consecutive breaks collapse to one',
     () => {
       equal(asText('.Dd t\n.Dt T 1\n.Os\n.Sh NAME\none\n.br\n.br\ntwo\n'),
             '\nNAME\none\ntwo\n')
     })

test('mdoc', 'a closing macro keeps text after it',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Po\n.Dq backquoted\nversion\n.Pc :\n')
       equal(flat(r.doc.blocks[0].spans), '(“backquoted” version):')
     })

test('mdoc', 'Oo and Oc nest an optional group',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Op Ar command_file Oo Ar argument ... Oc\n')
       equal(flat(r.doc.blocks[0].spans), '[command_file [argument ...]]')
     })

test('mdoc', 'St expands known standards',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\ndefined in\n.St -ansiC .\n')
       equal(flat(r.doc.blocks[0].spans), 'defined in ANSI X3.159-1989 (“ANSI C89”).')
     })

test('mdoc', 'Xr keeps all trailing punctuation',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Xr ksh 1 ) .\n')
       equal(flat(r.doc.blocks[0].spans), 'ksh(1)).')
     })

test('mdoc', 'Nm with only punctuation keeps the stored name',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh NAME\n.Nm file\n.Nd x\n.Sh D\ntext\n.Nm .\n')
       equal(flat(r.doc.blocks.filter(b => b.kind == 'para').at(-1).spans), 'text file.')
     })

test('mdoc', 'a bare Nm prints the document name',
     () => {
       let r, paras

       // groff keeps the first `.Nm` that has an argument as the document
       // name (`doc-command-name`) and a bare `.Nm` prints that, even after
       // a later named `.Nm`.
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh NAME\n.Nm first\n.Nd a thing\n' +
                  '.Sh DESCRIPTION\n.Nm second\nis another.\n.Pp\n.Nm\n' +
                  'is the document name.\n')
       paras = r.doc.blocks.filter(b => b.kind == 'para')
       equal(flat(paras[0].spans), 'first — a thing')
       equal(flat(paras[1].spans), 'second is another.')
       equal(flat(paras[2].spans), 'first is the document name.')
     })

test('mdoc', 'Nm with an argument prints that argument',
     () => {
       let r

       // Only the bare form uses the document name; a named `.Nm` still
       // prints its own word.
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh NAME\n.Nm first\n.Nd a thing\n' +
                  '.Sh DESCRIPTION\n.Nm second\nis another.\n')
       equal(flat(r.doc.blocks[1].spans), 'first — a thing')
       equal(flat(r.doc.blocks[3].spans), 'second is another.')
     })

test('mdoc', 'a bare Nm before any named Nm prints nothing',
     () => {
       let r

       // groff warns "Usage: .Nm name ..." there and prints nothing; a later
       // named `.Nm` does not fill in the earlier bare one.
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh DESCRIPTION\n.Nm\nis bare.\n.Nm later\nmore.\n')
       equal(flat(r.doc.blocks[1].spans), 'is bare. later more.')
     })

test('mdoc', 'the ssh_config system-wide Nm is the document name',
     () => {
       let r

       // ssh_config(5), after `.Nm sftp`: groff prints "system-wide
       // ssh_config files).", not "sftp".
       r = parsed('.Dd t\n.Dt SSH_CONFIG 5\n.Os\n.Sh NAME\n.Nm ssh_config\n.Nd x\n' +
                  '.Sh DESCRIPTION\n.Nm sftp\nsome text\n' +
                  '(this keyword may be useful in system-wide\n.Nm\nfiles).\n')
       equal(flat(r.doc.blocks[3].spans),
             'sftp some text (this keyword may be useful in system-wide ssh_config files).')
     })

test('mdoc', 'the editrc setty Nm is the document name',
     () => {
       let r

       // editrc(5) prints "Control which tty modes that editrc won't allow
       // the user to change." after an earlier `.Nm editline`.
       r = parsed('.Dd t\n.Dt EDITRC 5\n.Os\n.Sh NAME\n.Nm editrc\n.Nd x\n' +
                  '.Sh DESCRIPTION\n.Nm editline\ntext\n.Pp\n' +
                  'Control which tty modes that\n.Nm\nwon\'t allow the user to change.\n')
       equal(flat(r.doc.blocks[4].spans),
             'Control which tty modes that editrc won\'t allow the user to change.')
     })

test('mdoc', 'Dl attaches trailing punctuation',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Dl $ \\*[Lt]newline\\*[Gt] .\n')
       equal(flat(r.doc.blocks[0].spans), '$ <newline>.')
     })

test('mdoc', 'a delimiter macro inside Dl and D1 uses the Unicode brackets',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Dl lf foobar Aq return\n' +
                  '.D1 lf Aq return\n.Dl Op Aq x\n')
       equal(flat(r.doc.blocks[0].spans), 'lf foobar ⟨return⟩')
       equal(flat(r.doc.blocks[1].spans), 'lf ⟨return⟩')
       equal(flat(r.doc.blocks[2].spans), '[⟨x⟩]')
     })

test('mdoc', 'a delimiter macro outside a display keeps the ASCII brackets',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.An foo Aq addr\n')
       equal(flat(r.doc.blocks[0].spans), 'foo <addr>')
     })

test('mdoc', 'Sm off removes spacing between Dl arguments',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sm off\n.Dl \\*q abc \\*q \\  \\*q def\\ ghi \\*q\n.Sm on\n')
       equal(flat(r.doc.blocks[0].spans), '"abc" "def ghi"')
     })

test('mdoc', 'an opening delimiter attaches the next word',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Pa ( https://example.com )\n.Dl [!] command1 [ | command2 ...]\n.Dl { list; }\n')
       equal(flat(r.doc.blocks[0].spans), '(https://example.com)')
       equal(flat(r.doc.blocks[1].spans), '[!] command1 [| command2 ...]')
       equal(flat(r.doc.blocks[2].spans), '{ list; }')
     })

test('mdoc', 'a bar separates macro calls',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Op Fl H | Fl S\n.Pp\n.Op Fl a \\*(Ba Fl b\n')
       equal(flat(r.doc.blocks[0].spans), '[-H | -S]')
       equal(flat(r.doc.blocks[1].spans), '[-a | -b]')
     })

test('mdoc', 'Sm off does not join separate input lines',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sm off\nfrom a string\n.Pf ( Cm b\n.Sm on\n')
       equal(flat(r.doc.blocks[0].spans), 'from a string (b')
     })

test('mdoc', 'Sm off joins the macro calls that follow it',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sm off\n' +
                  '.Ar a\n.Ar b\n.Sm on\n.Ar c\n')
       equal(flat(r.doc.blocks[0].spans), 'ab c')
     })

test('mdoc', 'Sm off keeps the synopsis pieces joined',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Xo\n.Sm off\n' +
                  '.Op Ar user No @\n.Ar host\n.Op : Ns Ar port\n' +
                  '.Sm on\nor an ssh URI\n.Xc .\n')
       equal(flat(r.doc.blocks[0].spans).startsWith('[user@]host[:port]'), true)
     })

test('mdoc', 'Sm off keeps the space before the first macro it does not join',
     () => {
       let r, list

       // ssh_config(5): the -item body is one line, "PermitRemoteOpen host:port".
       r = parsed('.Dd t\n.Dt T 1\n.Os\n' +
                  '.Bl -item -offset indent -compact\n.It\n' +
                  '.Cm PermitRemoteOpen\n.Sm off\n.Ar host : port\n.Sm on\n' +
                  '.El\n')
       list = r.doc.blocks[0]
       equal(flat(list.items[0].blocks[0].spans), 'PermitRemoteOpen host:port')
     })

test('mdoc', 'Sm off still joins the arguments of the macro that follows',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Cm PermitRemoteOpen\n.Sm off\n' +
                  '.Ar host : port\n.Sm on\n')
       equal(flat(r.doc.blocks[0].spans), 'PermitRemoteOpen host:port')
       // Repeating `.Sm off` must not hand back the space a second time.
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Cm a\n.Sm off\n.Ar b\n.Ar c\n' +
                  '.Sm off\n.Ar d\n.Sm on\n')
       equal(flat(r.doc.blocks[0].spans), 'a bcd')
     })

test('mdoc', 'Fn formats a function call',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Fn foo "int a" "char b"\n')
       equal(flat(r.doc.blocks[0].spans), 'foo(int a, char b)')
     })

test('mdoc', 'a tagged list keeps tags and bodies',
     () => {
       let r, list

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Bl -tag -width x\n.It Fl a\nfirst\n.It Fl b\nsecond\n.El\n')
       list = r.doc.blocks[0]
       equal(list.kind, 'list')
       equal(list.listType, 'tag')
       equal(list.items.length, 2)
       equal(flat(list.items[0].tag), '-a')
       equal(flat(list.items[0].blocks[0].spans), 'first')
     })

test('mdoc', 'an enum list numbers its items in text',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Bl -enum\n.It\nfirst\n.It\nsecond\n.El\n')
       equal(ManParse.toText(r.doc.blocks).includes('1.'), true)
       equal(ManParse.toText(r.doc.blocks).includes('2.'), true)
     })

test('mdoc', 'an enum list keeps its type when options follow',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n' +
                  '.Bl -enum -offset indent -compact\n.It\nfirst\n.It\nsecond\n.El\n')
       equal(r.doc.blocks[0].listType, 'enum')
       equal(ManParse.toText(r.doc.blocks).includes('1.'), true)
     })

test('mdoc', 'a nested list stays inside its item',
     () => {
       let r, outer, inner

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Bl -tag -width x\n.It one\n.Bl -bullet\n.It inner\n.El\n.It two\nbody\n.El\n')
       outer = r.doc.blocks[0]
       inner = outer.items[0].blocks[0]
       equal(inner.kind, 'list')
       equal(outer.items[1].tag[0].text, 'two')
     })

test('mdoc', 'text after a nested list stays in the outer item',
     () => {
       let r, text

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Bl -tag -width x\n.It echo\nPrint.\n' +
                  '.Bl -tag -width y\n.It Li a\nAAA\n.El\n.Pp\nAfter.\n.It eval\nConcatenate.\n.El\n')
       text = ManParse.toText(r.doc.blocks)
       equal(text.indexOf('After.') < text.indexOf('eval'), true)
     })

test('mdoc', 'Bd -literal makes a literal block',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Bd -literal\ncode line\n.Ed\n')
       equal(r.doc.blocks[0].kind, 'pre')
       equal(flat(r.doc.blocks[0].spans), 'code line')
     })

test('mdoc', 'a second Bd -literal line starts a new pre line',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Bd -literal\none\ntwo\n.Ed\n')
       equal(flat(r.doc.blocks[0].spans), 'one\ntwo')
     })

test('mdoc', 'Rs and Re collect a reference',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Rs\n.%A A. Author\n.%T A Title\n.%D 2020\n.Re\n')
       equal(flat(r.doc.blocks[0].spans), 'A. Author, A Title, 2020.')
     })

test('mdoc', 'a reference joins authors and orders its fields',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Rs\n.%U https://u\n.%D 1999\n' +
                  '.%T The Title\n.%A First\n.%A Second\n.Re\n')
       equal(flat(r.doc.blocks[0].spans),
             'First and Second, The Title, https://u, 1999.')
     })

test('mdoc', 'a reference leaves %T bare without a journal or a book',
     () => {
       let r

       // ssh(1): groff prints the RFC title unquoted.
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Rs\n.%A S. Lehtinen\n' +
                  '.%A C. Lonvick\n.%D January 2006\n.%R RFC 4250\n' +
                  '.%T The Secure Shell (SSH) Protocol Assigned Numbers\n.Re\n')
       equal(flat(r.doc.blocks[0].spans),
             'S. Lehtinen and C. Lonvick, ' +
             'The Secure Shell (SSH) Protocol Assigned Numbers, ' +
             'RFC 4250, January 2006.')
     })

test('mdoc', 'a reference quotes %T when it names a journal or a book',
     () => {
       let r

       // crypt(5): %B and %J are what put the curly quotes around %T.
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Rs\n.%A Niels Provos\n' +
                  '.%A David Mazieres\n.%T A Future-Adaptable Password Scheme\n' +
                  '.%B Proceedings of the 1999 USENIX Annual Technical Conference\n' +
                  '.%D June 1999\n.Re\n')
       equal(flat(r.doc.blocks[0].spans),
             'Niels Provos and David Mazieres, ' +
             '“A Future-Adaptable Password Scheme”, ' +
             'Proceedings of the 1999 USENIX Annual Technical Conference, ' +
             'June 1999.')
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Rs\n.%A Robert Morris\n' +
                  '.%A Ken Thompson\n.%T Password Security: A Case History\n' +
                  '.%J Communications of the ACM\n.%D 1979\n.Re\n')
       equal(flat(r.doc.blocks[0].spans),
             'Robert Morris and Ken Thompson, ' +
             '“Password Security: A Case History”, ' +
             'Communications of the ACM, 1979.')
     })

test('mdoc', 'three authors take a serial comma',
     () => {
       let r

       // ssh(1) RFC 4344: groff writes "A, B, and C", not "A, B and C".
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Rs\n.%A M. Bellare\n.%A T. Kohno\n' +
                  '.%A C. Namprempre\n.%T The Title\n.Re\n')
       equal(flat(r.doc.blocks[0].spans),
             'M. Bellare, T. Kohno, and C. Namprempre, The Title.')
     })

test('mdoc', 'Ns and Pf control spacing',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Pf $ Ar file\n')
       equal(flat(r.doc.blocks[0].spans), '$file')
     })

test('mdoc', 'Ex expands to the standard exit text',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Ex -std ls\n')
       equal(flat(r.doc.blocks[0].spans), 'The ls utility exits 0 on success, and >0 if an error occurs.')
     })

test('links', 'URL and MTO make links with trailing punctuation',
     () => {
       let r, spans

       r = parsed('.TH T 1\n.URL https://example.com "The site" .\n')
       spans = r.doc.blocks[0].spans
       equal(spans[0].text, 'The site ⟨https://example.com⟩')
       equal(spans[0].href, 'https://example.com')
       equal(flat(spans), 'The site ⟨https://example.com⟩.')
     })

test('links', 'LINKSTYLE chooses the glyphs around a described URL target',
     () => {
       let r

       // util-linux writes `.LINKSTYLE blue R < >`, so man(1) prints ASCII
       // brackets; a page that only loads www.tmac keeps ⟨⟩.
       r = parsed('.TH T 1\n.LINKSTYLE blue R < >\n.URL https://example.com "The site" .\n')
       equal(flat(r.doc.blocks[0].spans), 'The site <https://example.com>.')
       r = parsed('.TH T 1\n.mso www.tmac\n.URL https://example.com "The site" .\n')
       equal(flat(r.doc.blocks[0].spans), 'The site ⟨https://example.com⟩.')
     })

test('links', 'LINKSTYLE takes any glyph pair and leaves UR/UE alone',
     () => {
       let r

       r = parsed('.TH T 1\n.LINKSTYLE blue R [ ]\n.URL https://example.com "The site" .\n')
       equal(flat(r.doc.blocks[0].spans), 'The site [https://example.com].')
       // colour and font alone keep www.tmac's default glyphs
       r = parsed('.TH T 1\n.LINKSTYLE blue R\n.URL https://example.com "The site" .\n')
       equal(flat(r.doc.blocks[0].spans), 'The site ⟨https://example.com⟩.')
       r = parsed('.TH T 1\n.LINKSTYLE blue R < >\n.UR https://example.com\nhere\n.UE .\n')
       equal(flat(r.doc.blocks[0].spans), 'here ⟨https://example.com⟩.')
     })

test('links', 'URL expands its trailing argument',
     () => {
       let r, spans

       // mount(8) line 1804: `.URL "ftp://..." "" "\fP."`. The \fP is a font
       // change, not text: groff prints "ftp://...." with the period after.
       r = parsed('.TH T 1\n.URL "ftp://ftp.namesys.com/pub/reiserfsprogs" "" "\\fP."\n')
       spans = r.doc.blocks[0].spans
       equal(spans.length, 2)
       equal(spans[0].text, 'ftp://ftp.namesys.com/pub/reiserfsprogs')
       equal(spans[1].text, '.')
       equal(flat(spans), 'ftp://ftp.namesys.com/pub/reiserfsprogs.')
       // The font change persists for what follows, as roff's does.
       r = parsed('.TH T 1\n\\fIplain \\c\n.URL https://example.com "site" "\\fP."\nafter\n')
       equal(r.doc.blocks[0].spans.at(-1).text, '. after')
       equal(r.doc.blocks[0].spans.at(-1).style, 'roman')
     })

test('links', 'URL with empty text shows the target',
     () => {
       let r

       r = parsed('.TH T 1\n.URL https://example.com "" .\n')
       equal(flat(r.doc.blocks[0].spans), 'https://example.com.')
     })

test('links', 'MTO uses a mailto link',
     () => {
       let r

       r = parsed('.TH T 1\n.MTO a@b "A Person" ,\n')
       equal(r.doc.blocks[0].spans[0].href, 'mailto:a@b')
       equal(r.doc.blocks[0].spans[0].text, 'A Person ⟨a@b⟩')
     })

test('links', 'MT uses a mailto link',
     () => {
       let r

       r = parsed('.TH T 1\n.MT a@b\nA Person\n.ME\n')
       equal(r.doc.blocks[0].spans[0].href, 'mailto:a@b')
       equal(r.doc.blocks[0].spans[0].text, 'A Person ⟨a@b⟩')
     })

test('links', 'MT keeps an address that already has a scheme',
     () => {
       let r

       r = parsed('.TH T 1\n.MT mailto:a@b\nA Person\n.ME\n')
       equal(r.doc.blocks[0].spans[0].href, 'mailto:a@b')
     })

test('links', 'the macro packages we implement are not loaded',
     () => {
       let r

       r = parsed('.TH T 1\n.mso www.tmac\n.LINKSTYLE blue R < >\n')
       equal(r.ok, 1)
     })

test('links', 'other macro packages fail the page',
     () => {
       let r

       r = parsed('.TH T 1\n.mso strange.tmac\n')
       equal(r.ok, 0)
       equal(r.fails[0].what, 'mso strange.tmac')
     })

test('spacing', 'a thin space does not make a word gap',
     () => {
       let r

       r = parsed('.TH T 1\n.RI [ OPTION .\\|.\\|.]\n')
       equal(flat(r.doc.blocks[0].spans), '[OPTION...]')
     })

test('spacing', 'a macro on its own line is a new word',
     () => {
       let r

       r = parsed('.TH T 1\n.B one\n.I two\n')
       equal(flat(r.doc.blocks[0].spans), 'one two')
     })

test('groff requests', 'pc and cp are presentation only',
     () => {
       let r

       r = parsed('.TH T 1\n.pc\n.cp 1\nvisible\n')
       equal(r.ok, 1)
       equal(flat(r.doc.blocks[0].spans), 'visible')
     })

test('conditions', 'if c is false by default',
     () => {
       equal(asText('.TH T 1\n.if c hidden\nshown\n'), 'shown\n')
     })

test('escapes', 'double star, ba and sc characters',
     () => {
       equal(flat(parsed('.TH T 1\na \\(** b \\(ba c \\(sc d\n').doc.blocks[0].spans),
             'a ∗ b | c § d')
     })

test('escapes', 'escaped underscore is an underscore',
     () => {
       equal(flat(parsed('.TH T 1\na\\_b\n').doc.blocks[0].spans), 'a_b')
     })

test('escapes', 'bracket and brace character names',
     () => {
       equal(flat(parsed('.TH T 1\na \\[lB]b\\[rB] \\[lC]c\\[rC]\n').doc.blocks[0].spans),
             'a [b] {c}')
     })

test('escapes', 'groff symbol names pl and mi',
     () => {
       equal(flat(parsed('.TH T 1\na \\(pl b \\(mi c\n').doc.blocks[0].spans),
             'a + b − c')
     })

test('escapes', 'a size escape leaves a following dot alone',
     () => {
       equal(flat(parsed('.TH T 1\na \\s-1CPAN\\s0.pm b\n').doc.blocks[0].spans),
             'a CPAN.pm b')
     })

test('escapes', 'ha is a caret',
     () => {
       equal(flat(parsed('.TH T 1\na \\[ha] b\n').doc.blocks[0].spans), 'a ^ b')
     })

test('escapes', 'a positive horizontal motion separates words',
     () => {
       equal(flat(parsed('.TH T 1\n1.\\h\'+01\'a\n').doc.blocks[0].spans), '1. a')
     })

test('escapes', 'a negative horizontal motion adds nothing',
     () => {
       equal(flat(parsed('.TH T 1\n\\h\'-04\'1.\n').doc.blocks[0].spans), '1.')
     })

test('escapes', 'an absolute horizontal motion separates words',
     () => {
       equal(flat(parsed('.TH T 1\na\\h\'|1u\'b\n').doc.blocks[0].spans), 'a b')
     })

test('escapes', 'a horizontal motion without a delimiter is accepted',
     () => {
       equal(flat(parsed('.TH T 1\n1.\\h+01\n').doc.blocks[0].spans), '1.')
     })

test('escapes', 'a trailing backslash joins the next line before parsing',
     () => {
       let r

       r = parsed('.TH T 1\n.TP\ntag \\\n... continued\nbody\n')
       equal(flat(r.doc.blocks[0].tag), 'tag ... continued')
       equal(flat(r.doc.blocks[0].blocks.filter(b => b.kind == 'para')[0].spans), 'body')
     })

test('escapes', 'a backslash at the end of the input is dropped',
     () => {
       equal(asText('.TH T 1\nabc \\'), 'abc\n')
     })

test('fonts', 'a doubled quote inside an argument is literal',
     () => {
       let r

       r = parsed('.TH T 1\n.ie n .IP """auto""" 4\n.el .IP "\\f(CWauto\\fR" 4\nbody\n')
       r = r.doc.blocks.find(b => b.kind == 'tag')
       equal(flat(r.tag), '"auto"')
     })

test('headings', 'a doubled quote inside a heading is literal',
     () => {
       let r

       r = parsed('.TH T 1\n.SS "Unknown Specials and ""TEX_HUSH"" configuration"\n')
       equal(flat(r.doc.blocks[0].spans), 'Unknown Specials and "TEX_HUSH" configuration')
     })

test('mdoc inline', 'Sy, Em and Li style their words',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sy bold\n.Em note\n.Li code\n')
       equal(r.doc.blocks[0].spans[0].style, 'bold')
       equal(r.doc.blocks[0].spans.find(s => s.text == 'note').style, 'italic')
       equal(r.doc.blocks[0].spans.find(s => s.text == 'code').style, 'mono')
       equal(r.doc.blocks[0].spans[0].role, 'sy')
       equal(r.doc.blocks[0].spans.find(s => s.text == 'note').role, 'em')
       equal(r.doc.blocks[0].spans.find(s => s.text == 'code').role, 'li')
     })

// roff man macros only say bold; mdoc says what the run means, so the parser
// keeps that name for the renderer to class.
test('mdoc inline', 'semantic macros carry a role, man font macros do not',
     () => {
       let r, spans

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Fl a\n.Ar file\n.Pa /tmp/x\n.Ev HOME\n' +
                  '.Va var\n.Ft int\n.Fn foo "int a"\n.Sx SYNOPSIS\n.Xr ls 1\n')
       spans = r.doc.blocks[0].spans
       equal(spans.find(s => s.text == '-a').role, 'fl')
       equal(spans.find(s => s.text == 'file').role, 'ar')
       equal(spans.find(s => s.text == '/tmp/x').role, 'pa')
       equal(spans.find(s => s.text == 'HOME').role, 'ev')
       equal(spans.find(s => s.text == 'var').role, 'va')
       equal(spans.find(s => s.text == 'int').role, 'ft')
       equal(spans.find(s => s.text == 'foo').role, 'fn')
       equal(spans.find(s => s.text == 'int a').role, 'fa')
       equal(spans.find(s => s.text == 'SYNOPSIS').role, 'sx')
       equal(spans.find(s => s.text == 'ls(1)').role, 'xr')
       r = parsed('.TH T 1\n.B bold\n')
       equal(r.doc.blocks[0].spans[0].role == undefined, true)
     })

test('mdoc inline', 'Dv is monospace and No, Ev, Er, Ft stay roman; Lb is a table',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Dv PATH\n.No plain\n.Ev HOME\n.Er ENOENT\n.Ft int\n.Lb libc\n')
       equal(r.doc.blocks[0].spans.find(s => s.text == 'PATH').style, 'mono')
       equal(r.doc.blocks[0].spans.find(s => s.text == 'HOME').style, 'roman')
       equal(flat(r.doc.blocks[0].spans),
             'PATH plain HOME ENOENT int Standard C Library (libc, -lc)')
     })

test('mdoc inline', 'Lb prints the library description, not its name',
     () => {
       let r

       // crypt(3) and its siblings state their library this way; groff maps
       // the name through its own table and never prints the bare argument.
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh LIBRARY\n.Lb libcrypt\n')
       equal(flat(r.doc.blocks[1].spans),
             'Crypt Library (libcrypt, -lcrypt)')
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh LIBRARY\n.Lb libc\n')
       equal(flat(r.doc.blocks[1].spans), 'Standard C Library (libc, -lc)')
       // An unknown name is `library “name”`, groff's Lq/Rq fallback.
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh LIBRARY\n.Lb libfoo\n')
       equal(flat(r.doc.blocks[1].spans), 'library “libfoo”')
       // Only the first argument is a library name; the rest print as words.
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh LIBRARY\n.Lb libc libm\n')
       equal(flat(r.doc.blocks[1].spans),
             'Standard C Library (libc, -lc) libm')
     })

test('mdoc inline', 'In is a #include in SYNOPSIS and a header name elsewhere',
     () => {
       let r

       // mdoc(7): SYNOPSIS prints `#include <header>` in bold; a body section
       // prints `<header>` in italic.
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh SYNOPSIS\n.In crypt.h\n' +
                  '.Sh DESCRIPTION\n.In crypt.h\n')
       equal(flat(r.doc.blocks[1].spans), '#include <crypt.h>')
       equal(r.doc.blocks[1].spans[0].style, 'bold')
       equal(flat(r.doc.blocks[3].spans), '<crypt.h>')
       equal(r.doc.blocks[3].spans[0].style, 'italic')
     })

test('mdoc inline', 'Tn uses the small style',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Tn ASCII\n')
       equal(r.doc.blocks[0].spans[0].style, 'small')
     })

test('mdoc inline', 'An drops a leading option marker but keeps the name',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.An -split John Doe\n.An Jane Roe\n')
       equal(flat(r.doc.blocks[0].spans), 'John Doe Jane Roe')
     })

test('mdoc inline', 'Ap attaches an apostrophe without a space',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Ar file Ap s\n')
       equal(flat(r.doc.blocks[0].spans), "file's")
     })

test('mdoc inline', 'Lk links its text or the url when there is no text',
     () => {
       let r, link

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Lk https://example.com "The site"\n.Lk https://example.com\n')
       link = r.doc.blocks[0].spans[0]
       equal(link.text, 'The site')
       equal(link.href, 'https://example.com')
       equal(r.doc.blocks[0].spans.at(-1).text, 'https://example.com')
       equal(r.doc.blocks[0].spans.at(-1).href, 'https://example.com')
     })

test('mdoc inline', 'Mt makes a mailto link',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Mt a@b\n')
       equal(r.doc.blocks[0].spans[0].href, 'mailto:a@b')
       equal(r.doc.blocks[0].spans[0].text, 'a@b')
     })

test('mdoc inline', 'Sx is a bold section reference',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sx SEE ALSO\n')
       equal(flat(r.doc.blocks[0].spans), 'SEE ALSO')
       equal(r.doc.blocks[0].spans[0].style, 'bold')
     })

test('mdoc inline', 'Fo, Fa and Fc delimit a function and separate its arguments',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Fo foo\n.Fa "int a"\n.Fa "char b"\n.Fc\n')
       equal(flat(r.doc.blocks[0].spans), 'foo(int a, char b)')
     })

test('mdoc inline', 'Fc ends a SYNOPSIS declaration with a semicolon',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh SYNOPSIS\n.Ft int\n' +
                  '.Fo crypt_checksalt\n.Fa "const char *setting"\n.Fc\n')
       equal(flat(r.doc.blocks[1].spans),
             'int crypt_checksalt(const char *setting);')
       // groff prints no semicolon outside a SYNOPSIS.
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh DESCRIPTION\n' +
                  '.Fo foo\n.Fa "int a"\n.Fc\n')
       equal(flat(r.doc.blocks[1].spans), 'foo(int a)')
     })

test('mdoc inline', 'Fn ends a SYNOPSIS declaration with a semicolon',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh SYNOPSIS\n.Ft int\n' +
                  '.Fn other "char *y" "int z"\n')
       equal(flat(r.doc.blocks[1].spans), 'int other(char *y, int z);')
       // mdoc(7): groff prints no semicolon in a body section.
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh DESCRIPTION\n' +
                  '.Fn other "char *y" "int z"\n')
       equal(flat(r.doc.blocks[1].spans), 'other(char *y, int z)')
       // A declaration with no arguments still ends in `;` (groff: `foo();`).
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh SYNOPSIS\n.Fn foo\n')
       equal(flat(r.doc.blocks[1].spans), 'foo();')
     })

test('mdoc inline', 'Ss keeps the enclosing Sh section for the semicolon',
     () => {
       let r

       // groff's doc-in-synopsis-section comes from the top-level .Sh, so a
       // subsection inside SYNOPSIS still ends a declaration with `;`.
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh SYNOPSIS\n.Ss Sub\n.Fn d "int y"\n')
       equal(r.doc.blocks[1].level, 2)
       equal(flat(r.doc.blocks[1].spans), 'Sub')
       equal(flat(r.doc.blocks[2].spans), 'd(int y);')
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh SYNOPSIS\n.Ss Sub\n' +
                  '.Fo foo\n.Fa "int a"\n.Fc\n')
       equal(flat(r.doc.blocks[2].spans), 'foo(int a);')
       // ...and a body section stays a body section, even when a subsection
       // is titled SYNOPSIS.
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh DESCRIPTION\n.Ss SYNOPSIS\n' +
                  '.Fn d "int y"\n')
       equal(flat(r.doc.blocks[2].spans), 'd(int y)')
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh DESCRIPTION\n.Ss SYNOPSIS\n' +
                  '.Fo foo\n.Fa "int a"\n.Fc\n')
       equal(flat(r.doc.blocks[2].spans), 'foo(int a)')
     })

test('mdoc inline', 'Fn without arguments has empty parentheses',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Fn foo\n')
       equal(flat(r.doc.blocks[0].spans), 'foo()')
     })

test('mdoc inline', 'Pf with no prefix only suppresses the next space',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Pf\n.Ar file\n')
       equal(flat(r.doc.blocks[0].spans), 'file')
     })

test('mdoc inline', 'Ta emits a column separator',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\na\n.Ta\nb\n')
       equal(flat(r.doc.blocks[0].spans), 'a   b')
     })

test('mdoc inline', 'Ux and the BSD names expand to their platforms',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Ux\n.At\n.Bx\n.Fx\n.Nx\n.Ox\n.Dx\n')
       equal(flat(r.doc.blocks[0].spans), 'UNIX AT&T UNIX BSD FreeBSD NetBSD OpenBSD DragonFly')
     })

test('mdoc inline', 'Ux prints its trailing words',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Ux\n.Ux 5\n')
       equal(flat(r.doc.blocks[0].spans), 'UNIX UNIX 5')
     })

test('mdoc inline', 'Ox keeps its version',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Ox\n.Ox 3.2\n')
       equal(flat(r.doc.blocks[0].spans), 'OpenBSD OpenBSD 3.2')
     })

test('mdoc inline', 'Ox 3.2 keeps a sentence\'s spacing and punctuation',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\nThe\n.Ox 3.2\noperating system.\n')
       equal(flat(r.doc.blocks[0].spans), 'The OpenBSD 3.2 operating system.')
     })

test('mdoc inline', 'Fx keeps its version',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Fx\n.Fx 12.0\n')
       equal(flat(r.doc.blocks[0].spans), 'FreeBSD FreeBSD 12.0')
     })

test('mdoc inline', 'Nx keeps its version',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Nx\n.Nx 9.3\n')
       equal(flat(r.doc.blocks[0].spans), 'NetBSD NetBSD 9.3')
     })

test('mdoc inline', 'Dx keeps its version',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Dx\n.Dx 6.0\n')
       equal(flat(r.doc.blocks[0].spans), 'DragonFly DragonFly 6.0')
     })

test('mdoc inline', 'Bsx keeps its version',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Bsx\n.Bsx 1.0\n')
       equal(flat(r.doc.blocks[0].spans), 'BSD/OS BSD/OS 1.0')
     })

test('mdoc inline', 'At prints a known version and passes an unknown one through',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.At\n.At v7\n.At v9\n')
       equal(flat(r.doc.blocks[0].spans),
             'AT&T UNIX Version 7 AT&T UNIX AT&T UNIX v9')
     })

test('mdoc inline', 'Bx prepends its version to the name',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Bx\n.Bx 4.4 .\n')
       equal(flat(r.doc.blocks[0].spans), 'BSD 4.4BSD.')
     })

test('mdoc inline', 'St strips the dash from an unknown token',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.St -foo\n')
       equal(flat(r.doc.blocks[0].spans), 'foo')
     })

test('mdoc inline', 'Ex and Rv name a missing utility and function',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Ex -std\n.Pp\n.Rv -std\n')
       equal(flat(r.doc.blocks[0].spans), 'The utility exits 0 on success, and >0 if an error occurs.')
       equal(flat(r.doc.blocks[1].spans),
             'Upon successful completion, the value 0 is returned; otherwise the ' +
             'value -1 is returned and the global variable errno is set to ' +
             'indicate the error.')
     })

test('mdoc inline', 'Ex falls back to the document name',
     () => {
       let r

       // groff: after `.Nm first` and a later `.Nm second`, `.Ex -std` still
       // says "The first utility ...", like a bare `.Nm`.
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh NAME\n.Nm first\n.Nd x\n.Sh D\n' +
                  '.Nm second\ntext.\n.Ex -std\n')
       equal(flat(r.doc.blocks[3].spans),
             'second text. The first utility exits 0 on success, and >0 if an error occurs.')
     })

test('mdoc inline', 'Ex and Rv emit nothing without -std',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\nA\n.Ex\nB\n.Pp\nC\n.Rv\nD\n')
       equal(flat(r.doc.blocks[0].spans), 'A B')
       equal(flat(r.doc.blocks[1].spans), 'C D')
     })

test('mdoc inline', '-std names the utility or function',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Ex -std ls\n.Pp\n.Rv -std memcpy\n')
       equal(flat(r.doc.blocks[0].spans),
             'The ls utility exits 0 on success, and >0 if an error occurs.')
       equal(flat(r.doc.blocks[1].spans),
             'The memcpy() function returns the value 0 if successful; ' +
              'otherwise the value -1 is returned and the global variable errno ' +
              'is set to indicate the error.')
     })

test('mdoc inline', 'Ex and Rv join the names they are given',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Ex -std a b c\n.Pp\n.Rv -std x y\n')
       equal(flat(r.doc.blocks[0].spans),
             'The a, b, and c utilities exit 0 on success, and >0 if an error occurs.')
       equal(flat(r.doc.blocks[1].spans),
             'The x() and y() functions return the value 0 if successful; ' +
             'otherwise the value -1 is returned and the global variable errno ' +
             'is set to indicate the error.')
     })

test('mdoc inline', 'Sq, Bq, Brq and Aq enclose their words',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sq a\n.Bq b\n.Brq c\n.Aq d\n')
       equal(flat(r.doc.blocks[0].spans), '‘a’ [b] {c} ⟨d⟩')
     })

test('mdoc inline', 'Ql quotes a literal and keeps its punctuation',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Ql file .\n.Ql\n')
       equal(flat(r.doc.blocks[0].spans), '‘file’. ‘’')
     })

test('mdoc inline', 'the paired enclosure macros work across lines',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Do\n.Ar a\n.Dc\n.Qo\n.Ar b\n.Qc\n' +
                  '.Ao\n.Ar c\n.Ac\n.Bo\n.Ar d\n.Bc\n.So\n.Ar e\n.Sc\n' +
                  '.Bro\n.Ar f\n.Brc\n')
       equal(flat(r.doc.blocks[0].spans), '“a” “b” ⟨c⟩ [d] ‘e’ {f}')
     })

test('mdoc inline', 'Eo and Ec take their delimiters from the arguments',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Eo <\n.Ar f\n.Ec >\n')
       equal(flat(r.doc.blocks[0].spans), '<f>')
     })

test('mdoc inline', 'Oo and Oc may open and close on their own lines',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Oo\n.Ar f\n.Oc\n')
       equal(flat(r.doc.blocks[0].spans), '[f]')
     })

test('mdoc inline', 'Nm in SYNOPSIS is bold',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh SYNOPSIS\n.Nm ls\n')
       equal(flat(r.doc.blocks[1].spans), 'ls')
       equal(r.doc.blocks[1].spans[0].style, 'bold')
     })

test('mdoc inline', 'Nm with no stored name emits nothing',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Nm\n')
       equal(r.ok, 1)
       equal(ManParse.toText(r.doc.blocks), '')
     })

test('mdoc inline', 'Xr without a section and with trailing marks',
     () => {
       let r, plain, marks, word

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Xr ls\n')
       plain = r.doc.blocks[0].spans[0]
       equal(plain.text, 'ls')
       equal(plain.href, 'man:ls')
       marks = parsed('.Dd t\n.Dt T 1\n.Os\n.Xr cat 1 ) .\n')
       equal(flat(marks.doc.blocks[0].spans), 'cat(1)).')
       word = parsed('.Dd t\n.Dt T 1\n.Os\n.Xr ksh foo .\n')
       equal(flat(word.doc.blocks[0].spans), 'kshfoo.')
     })

test('mdoc inline', 'Fl with no word is a lone dash and keeps punctuation',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Fl\n.Pp\n.Fl a .\n')
       equal(flat(r.doc.blocks[0].spans), '-')
       equal(flat(r.doc.blocks[1].spans), '-a.')
     })

test('mdoc inline', 'Ar without arguments means a list of files',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Ar\n')
       equal(flat(r.doc.blocks[0].spans), 'file ...')
       equal(r.doc.blocks[0].spans[0].style, 'italic')
     })

test('mdoc', 'It without Bl fails the page',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.It alone\n')
       equal(r.ok, 0)
       equal(r.fails[0].what, 'It without Bl')
     })

test('mdoc', 'D1 displays a single line',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.D1 $ echo\n')
       equal(r.doc.blocks[0].kind, 'para')
       equal(flat(r.doc.blocks[0].spans), '$ echo')
     })

test('mdoc', 'Dl with no arguments makes an empty literal block',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Dl\n')
       equal(r.doc.blocks[0].kind, 'pre')
       equal(flat(r.doc.blocks[0].spans), '')
     })

test('mdoc', 'Bd without -literal makes an indented group',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Bd -ragged\ninside\n.Ed\nafter\n')
       equal(r.doc.blocks[0].kind, 'group')
       equal(flat(r.doc.blocks[0].blocks[0].spans), 'inside')
       equal(flat(r.doc.blocks[1].spans), 'after')
     })

test('mdoc', 'Bk, Ek and an empty reference produce no output',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Bk -words\n.Ek\n.Rs\n.Re\nvisible\n')
       equal(r.ok, 1)
       equal(flat(r.doc.blocks[0].spans), 'visible')
     })

test('mdoc', 'Bf sets a font until Ef',
     () => {
       let r, spans

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Bf -literal\nmono\n.Ef\n.Bf -emphasis\nital\n.Ef\n' +
                  '.Bf -symbolic\nsym\n.Ef\n.Bf\nplain\n.Ef\n')
       spans = r.doc.blocks[0].spans
       equal(spans[0].style, 'mono')
       equal(spans.find(s => s.text == 'ital').style, 'italic')
       equal(spans.find(s => s.text == 'sym').style, 'bold')
       equal(spans.find(s => s.text == 'plain').style, 'roman')
     })

test('mdoc', 'an extended tag keeps taking words until Xc',
     () => {
       let r, list

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Bl -tag -width x\n.It Xo\n.Fl a\n.Xc\nbody\n.El\n')
       list = r.doc.blocks[0]
       equal(flat(list.items[0].tag), '-a')
       equal(flat(list.items[0].blocks[0].spans), 'body')
     })

test('escapes', 'a parenthesised font name has two characters',
     () => {
       let r

       r = parsed('.TH T 1\na \\f(CWbold\\fR b\n')
       equal(flat(r.doc.blocks[0].spans), 'a bold b')
       equal(r.doc.blocks[0].spans.find(s => s.text == 'bold').style, 'mono')
     })

test('escapes', 'ftr defines a font alias used by ft and font escapes',
     () => {
       let r

       r = parsed('.TH T 1\n.ftr XX B\n.ft XX\nbold\n.ft\nplain\n')
       equal(flat(r.doc.blocks[0].spans), 'bold plain')
       equal(r.doc.blocks[0].spans[0].style, 'bold')
     })

test('escapes', 'an undefined font fails the page',
     () => {
       let r

       r = parsed('.TH T 1\n\\f[G]gdbm\n')
       equal(r.ok, 0)
       equal(r.fails[0].what, 'font G')
     })

test('escapes', 'a font alias naming an undefined font fails the page',
     () => {
       let r

       r = parsed('.TH T 1\n.ftr ZF Q\n\\f[ZF]text\n')
       equal(r.ok, 0)
       equal(r.fails[0].what, 'font ZF')
     })

test('escapes', 'an unterminated character name fails the page',
     () => {
       let r

       r = parsed('.TH T 1\na \\[oops\n')
       equal(r.ok, 0)
       equal(r.fails[0].what, 'unterminated character escape')
     })

test('escapes', 'an unterminated font escape does not rewind and hang',
     () => {
       let r

       r = parsed('"\\f[ \\h < \\-')
       equal(r.ok, 0)
       equal(r.fails[0].what, 'unterminated font escape')
       equal(ManParse.toText(r.doc.blocks), '"\n')
     })

test('escapes', 'an unterminated bracket string or register name does not hang',
     () => {
       let r

       r = parsed('\\*[')
       equal(r.ok, 0)
       equal(r.fails[0].what, 'string ')
       r = parsed('\\n[')
       equal(r.ok, 0)
       equal(r.fails[0].what, 'register ')
     })

test('escapes', 'w measures its argument in units',
     () => {
       let r

       r = parsed('.TH T 1\na \\w\'abcdef\' b\n')
       equal(flat(r.doc.blocks[0].spans), 'a 144 b')
     })

test('escapes', 'w takes a delimiter other than a quote',
     () => {
       equal(flat(parsed('.TH T 1\na \\w|abcdef| b\n').doc.blocks[0].spans), 'a 144 b')
     })

test('escapes', 'an unterminated bracket argument ends the line',
     () => {
       equal(asText('.TH T 1\nx \\F[ y\n'), 'x\n')
     })

test('escapes', 'o emits the first character of its argument',
     () => {
       let r

       r = parsed('.TH T 1\na\\o\'xy\'b\n')
       equal(flat(r.doc.blocks[0].spans), 'axb')
     })

test('escapes', 'N names a character by its numeric code',
     () => {
       let r

       r = parsed('.TH T 1\na \\N\'65\' b\n')
       equal(flat(r.doc.blocks[0].spans), 'a A b')
     })

test('escapes', 'vertical, device and mark escapes are skipped',
     () => {
       let r

       r = parsed('.TH T 1\na\\v\'1\'b \\m[red]c \\F[X]d \\M[red]e \\S\'1\'f \\k(xg\n')
       equal(flat(r.doc.blocks[0].spans), 'ab c d e f')
     })

test('escapes', 'dollar at and star expand all macro arguments',
     () => {
       let r

       r = parsed('.TH T 1\n.de M\n[\\$@]\n[\\$*]\n..\n.M a b c\n')
       equal(flat(r.doc.blocks[0].spans), '[a b c] [a b c]')
     })

test('escapes', 'a two-digit argument number expands that argument',
     () => {
       let r

       r = parsed('.TH T 1\n.de M\n\\$1-\\$(12\n..\n.M a b c d e f g h i j k l\n')
       equal(flat(r.doc.blocks[0].spans), 'a-l')
     })

test('escapes', 'a raw high-bit character is kept as text',
     () => {
       let r

       r = parsed('.TH T 1\ncaf\u00e9\n')
       equal(flat(r.doc.blocks[0].spans), 'caf\u00e9')
     })

test('escapes', 'an unknown escape before a high-bit character keeps it',
     () => {
       let r

       r = parsed('.TH T 1\na \\\u80fd b\n')
       equal(r.ok, 1)
       equal(flat(r.doc.blocks[0].spans), 'a \u80fd b')
     })

test('escapes', 'an undefined string fails the page',
     () => {
       let r

       r = parsed('.TH T 1\nx \\*(AQ y\n')
       equal(r.ok, 0)
       equal(r.fails[0].what, 'string AQ')
     })

test('escapes', 'an unknown escape fails the page',
     () => {
       let r

       r = parsed('.TH T 1\na \\q b\n')
       equal(r.ok, 0)
       equal(r.fails[0].what, 'escape \\q')
     })

test('conditions', 'arithmetic in conditions supports every operator',
     () => {
       equal(asText('.TH T 1\n.if 1+2*3==7 a\n.if 7-1==6 b\n.if 8/2==4 c\n.if 5%2==1 d\n' +
                    '.if 2>=2 e\n.if 2<=3 f\n.if 2=2 g\n.if 1&1 h\n.if 0:1 i\n' +
                    '.if (1+1)*2==4 j\n.if -1<0 k\n'),
             'a b c d e f g h i j k\n')
     })

test('conditions', 'a negated condition inverts the test',
     () => {
       equal(asText('.TH T 1\n.ie !n no\n.el yes\n'), 'yes\n')
     })

test('conditions', 't is false and a negated v is true',
     () => {
       equal(asText('.TH T 1\n.if t no\n.if !v yes\n'), 'yes\n')
     })

test('conditions', 'd and r test the definition tables',
     () => {
       equal(asText('.TH T 1\n.ds S x\n.nr R 1\n.if dS d1\n.if dR d2\n.if rR r1\n' +
                    '.if dZ dz\n.if rZ rz\n'),
             'd1 d2 r1\n')
     })

test('conditions', 'an unterminated false block fails the page',
     () => {
       let r

       r = parsed('.TH T 1\n.if t \\{\\\nhidden\n')
       equal(r.ok, 0)
       equal(r.fails[0].what, 'unterminated conditional block')
     })

test('conditions', 'an empty condition skips the next line',
     () => {
       equal(asText('.TH T 1\n.if t\nhidden\nshown\n'), 'shown\n')
     })

test('headings', 'SH with no arguments takes the next line as its heading',
     () => {
       let r

       r = parsed('.TH T 1\n.SH\nNAME\ntext\n')
       equal(r.doc.blocks[0].kind, 'heading')
       equal(flat(r.doc.blocks[0].spans), 'NAME')
     })

test('tables', 'a span column widens the cell before it',
     () => {
       let r

       r = parsed('.TH T 1\n.TS\nl s l.\na\tb\tc\n.TE\n')
       equal(r.doc.blocks[0].rows[0].cells.length, 2)
       equal(r.doc.blocks[0].rows[0].cells[0].colspan, 2)
       equal(flat(r.doc.blocks[0].rows[0].cells[1].spans), 'b c')
     })

test('tables', 'an italic column modifier sets italic',
     () => {
       let r

       r = parsed('.TH T 1\n.TS\nli l.\na\tb\n.TE\n')
       equal(r.doc.blocks[0].cols[0].italic, 1)
     })

test('tables', 'cells beyond the layout join the last column',
     () => {
       let r

       r = parsed('.TH T 1\n.TS\nl l l.\na\tb\tc\td\te\n.TE\n')
       equal(r.doc.blocks[0].rows[0].cells.length, 3)
       equal(flat(r.doc.blocks[0].rows[0].cells[2].spans), 'c d e')
     })

test('tables', 'each layout line is a row layout, not another column',
     () => {
       let r, table

       // tbl(1): "Each such format line describes one line of the table
       // itself, except that the last format line (which you must end with a
       // period) describes all remaining lines." So a second line does not
       // widen the table: groff draws one column here and discards the excess
       // `b`. The model keeps the words by folding them into the last cell.
       r = parsed('.TH T 1\n.TS\nl\nl.\na\tb\nc\td\n.TE\n')
       table = r.doc.blocks[0]
       equal(table.cols.length, 1)
       equal(table.rows.length, 2)
       equal(flat(table.rows[0].cells[0].spans), 'a b')
       equal(flat(table.rows[1].cells[0].spans), 'c d')
     })

test('tables', 'the longest format line sets the column count',
     () => {
       let r, table

       // find(1) repeats `ll` for its lines: five format lines, two columns.
       // `llw(2i)` is two columns too, the second one widened. The old
       // concatenation made one column per token and drew five.
       r = parsed('.TH T 1\n.TS\nll\nll\nll\nll\nllw(2i).\n' +
                  'a\taccess time\nB\tbirth time\nc\tstatus time\n' +
                  'm\tmodification time\nt\ttime\n.TE\n')
       table = r.doc.blocks[0]
       equal(table.cols.length, 2)
       equal(table.rows.length, 5)
       table.rows.forEach(row => equal(row.cells.length, 2))
       equal(flat(table.rows[4].cells[0].spans), 't')
       equal(flat(table.rows[4].cells[1].spans), 'time')
     })

test('tables', 'a header format and a body format are separate rows',
     () => {
       let r, table

       // captoinfo(1): two centred header lines over a left-justified body,
       // four columns in all. Concatenating the format made twelve columns.
       r = parsed('.TH T 1\n.TS H\nc c c c\nc c c c\nl l l l.\n' +
                  'Nonstd\tStd\tFrom\tTerminfo\n' +
                  'name\tname\t\tcapability\n' +
                  'BO\tmr\tAT&T\tenter_reverse_mode\n.TE\n')
       table = r.doc.blocks[0]
       equal(table.cols.length, 4)
       equal(table.rows.length, 3)
       table.rows.forEach(row => equal(row.cells.length, 4))
       equal(flat(table.rows[0].cells[0].spans), 'Nonstd')
       equal(flat(table.rows[2].cells[3].spans), 'enter_reverse_mode')
       // The block's own layout is the last body format, which tbl repeats for
       // the remaining rows, so it is left; each row records the layout it was
       // laid out with, so the header rows stay centred.
       equal(table.cols[0].align, 'left')
       equal(table.rows[0].cols[0].align, 'center')
       equal(table.rows[1].cols[0].align, 'center')
       equal(table.rows[2].cols[0].align, 'left')
     })

test('tables', 'a centred header row keeps its own alignment over a left body',
     () => {
       let r, table

       r = parsed('.TH T 1\n.TS\nc c\nl l.\nHead\tTwo\na\tb\n.TE\n')
       table = r.doc.blocks[0]
       equal(table.cols[0].align, 'left')
       equal(table.rows[0].cols[0].align, 'center')
       equal(table.rows[0].cols[1].align, 'center')
     })

test('tables', 'a bold header layout does not style the body',
     () => {
       let r, table

       r = parsed('.TH T 1\n.TS\nlB lB\nl l.\nHead\tTwo\na\tb\n.TE\n')
       table = r.doc.blocks[0]
       equal(table.rows[0].cols[0].bold, 1)
       equal(table.rows[0].cols[1].bold, 1)
       equal(table.cols[0].bold, 0)
     })

test('tables', 'every row records the layout it was laid out with',
     () => {
       let r, table

       // find(1) repeats one `ll` layout and its last line widens the second
       // column; the row still records the two descriptors it was drawn with.
       r = parsed('.TH T 1\n.TS\nll\nllw(2i).\na\taccess time\nc\tstatus time\n.TE\n')
       table = r.doc.blocks[0]
       equal(table.cols[0].align, 'left')
       table.rows.forEach(row => equal(row.cols.length, 2))
       table.rows.forEach(row => equal(row.cols[1].align, 'left'))
       equal(flat(table.rows[1].cells[1].spans), 'status time')
     })

test('tables', 'a span in an early format line still spans the row',
     () => {
       let r, table

       // tbl(1)'s own title table: `c s s` over `l c n.`.
       r = parsed('.TH T 1\n.TS\ntab(;);\nc s s\nl c n.\nTitle\n' +
                  'left;centers;123\n.TE\n')
       table = r.doc.blocks[0]
       equal(table.cols.length, 3)
       equal(table.rows[0].cells.length, 1)
       equal(table.rows[0].cells[0].colspan, 3)
       equal(flat(table.rows[0].cells[0].spans), 'Title')
       equal(table.rows[1].cells.length, 3)
       equal(flat(table.rows[1].cells[2].spans), '123')
     })

test('tables', 'a format line of rules draws a rule and owns no data row',
     () => {
       let r, table

       // xkeyboard-config.7: `lB lB` over `___` over `lB l.`. The three
       // underscores are three rule entries, so the longest line makes three
       // columns; the rule takes no data row, so the body format still lines
       // up with the second data row.
       r = parsed('.TH T 1\n.TS\nbox;\nlB lB\n___\nlB l.\n' +
                  'Model\tDescription\npc86\tGeneric 86-key PC\n.TE\n')
       table = r.doc.blocks[0]
       equal(table.cols.length, 3)
       equal(table.rows.length, 2)
       equal(table.rows[0].cells.length, 3)
       equal(flat(table.rows[0].cells[0].spans), 'Model')
       equal(flat(table.rows[1].cells[0].spans), 'pc86')
       equal(flat(table.rows[1].cells[1].spans), 'Generic 86-key PC')
     })

test('tables', 'layouts may share a line, separated by commas',
     () => {
       let r, table

       // tbl(1) documents `ln,an.` as two layouts on one line.
       r = parsed('.TH T 1\n.TS\ntab(;);\nln,an.\nitem one;1\nitem two;22\n.TE\n')
       table = r.doc.blocks[0]
       equal(table.cols.length, 2)
       equal(table.rows.length, 2)
       equal(flat(table.rows[1].cells[0].spans), 'item two')
       equal(flat(table.rows[1].cells[1].spans), '22')
     })

test('groff requests', 'several requests are presentation only',
     () => {
       let r

       r = parsed('.TH T 1\n.PD 2\n.DT\n.UC\n.AT\n.in 1\n.ti 2\n.ll 3\n.ta 4\n.ev 5\n' +
                  '.ul 1\n.ce 1\n.ss 2\n.fam X\n.bd 1\nvisible\n')
       equal(r.ok, 1)
       equal(flat(r.doc.blocks[0].spans), 'visible')
     })

test('groff requests', 'do and nop invoke a control line',
     () => {
       let r

       // `.do` takes a request name with no control character of its own;
       // `.nop` takes a whole input line, so its request keeps the dot.
       r = parsed('.TH T 1\n.do B bold\n.nop .I italic\n')
       equal(r.doc.blocks[0].spans[0].style, 'bold')
       equal(r.doc.blocks[0].spans.find(s => s.text == 'italic').style, 'italic')
     })

test('groff requests', 'rr removes a register',
     () => {
       let r

       r = parsed('.TH T 1\n.nr Q 1\n.rr Q\n\\nQ\n')
       equal(r.ok, 0)
       equal(r.fails[0].what, 'register Q')
     })

test('groff requests', 'do dispatches the request instead of printing it',
     () => {
       let r

       // tbl(1) and its siblings guard against being read twice with
       // `.do nr tbl_C \n[.C]`; the line prints nothing.
       r = parsed('.TH T 1\n.SH NAME\nt \\- x\n.do nr tbl_C \\n[.C]\n')
       equal(flat(r.doc.blocks[1].spans), 't - x')
       equal(r.ok, 1)
       equal(asText('.TH T 1\n.do nr x 5\nx=\\n[x]\n'), 'x=5\n')
       // An unsupported request must fail the page as the bare request does,
       // not leak its arguments into the text.
       r = parsed('.TH T 1\n.do XYZZY arg\n')
       equal(r.ok, 0)
       equal(r.fails[0].what, 'macro XYZZY')
     })

test('groff requests', 'rn renames a macro',
     () => {
       equal(asText('.TH T 1\n.de M\nhi\n..\n.rn M N\n.N\n'), 'hi\n')
     })

test('groff requests', 'rm removes a macro',
     () => {
       let r

       r = parsed('.TH T 1\n.de M\nhi\n..\n.rm M\n.M\n')
       equal(r.ok, 0)
       equal(r.fails[0].what, 'macro M')
     })

test('groff requests', 'als aliases a macro and can point at nothing',
     () => {
       let r

       r = parsed('.TH T 1\n.de M\nhi\n..\n.als A M\n.A\n.als Z NoSuch\n.Z\n')
       equal(flat(r.doc.blocks[0].spans), 'hi')
       equal(r.fails[0].what, 'macro Z')
     })

test('groff requests', 'a recursive macro is refused',
     () => {
       let r

       r = parsed('.TH T 1\n.de R\n.R\n..\n.R\n')
       equal(r.ok, 0)
       equal(r.fails[0].what, 'macro recursion')
     })

test('groff requests', 'a definition with no terminator fails the page',
     () => {
       let r

       r = parsed('.TH T 1\n.de M\ncode\n')
       equal(r.ok, 0)
       equal(r.fails[0].what, 'unterminated definition')
     })

test('translation', 'tr with one argument maps character pairs',
     () => {
       equal(asText('.TH T 1\n.tr abcd\nadcb\n'), 'bddb\n')
     })

test('text', 'toText walks literal and group blocks',
     () => {
       equal(asText('.TH T 1\n.nf\npre\n.fi\n.RS\ngrouped\n.RE\n'), 'pre\ngrouped\n')
     })

test('fonts', 'the alternating font macros use their styles',
     () => {
       let r, spans

       r = parsed('.TH T 1\n.SM small\n.SB strong\n.BI bi\n.IB ib\n.IR ir\n.RB rb\n')
       spans = r.doc.blocks[0].spans
       equal(spans[0].style, 'small')
       equal(spans.find(s => s.text == 'strong').style, 'bold')
       equal(spans.find(s => s.text == 'bi').style, 'bold')
       equal(spans.find(s => s.text == 'ib').style, 'italic')
       equal(spans.find(s => s.text == 'ir').style, 'italic')
       equal(flat(spans), 'small strong bi ib ir rb')
     })

test('fonts', 'a font macro with no argument sets the next line',
     () => {
       let r

       r = parsed('.TH T 1\n.B\nbold\n')
       equal(r.doc.blocks[0].spans[0].style, 'bold')
     })

test('tags', 'IP with a mark but no indent still makes a tag',
     () => {
       let r

       r = parsed('.TH T 1\n.IP mark\ntext\n')
       equal(r.doc.blocks[0].kind, 'tag')
       equal(flat(r.doc.blocks[0].tag), 'mark')
       equal(r.doc.blocks[0].indent, 1)
     })

test('paragraphs', 'HP, br and sp break the paragraph',
     () => {
       let r

       // groff starts the line after `.br` flush: `one$` then `two$`.
       r = parsed('.TH T 1\none\n.br\ntwo\n.sp\nthree\n')
       equal(flat(r.doc.blocks[0].spans), 'one\ntwo')
       equal(r.doc.blocks[1].kind, 'space')
       equal(flat(r.doc.blocks[2].spans), 'three')
     })

test('paragraphs', 'a continued tag line keeps the tag open for the next macro',
     () => {
       let r

       // paperconfig(8) writes the tag as `.BR \-p ", " \-\-paper\c` and then
       // `.I papername`; groff glues both into one tag line.
       r = parsed('.TH T 1\n.SH OPTIONS\n.TP\n.BR \\-p ", " \\-\\-paper\\c\n' +
                  '.I papername\nUse papername.\n')
       equal(flat(r.doc.blocks[1].tag), '-p, --paperpapername')
       equal(asText('.TH T 1\n.SH OPTIONS\n.TP\n' +
                    '.BR \\-p ", " \\-\\-paper\\c\n.I papername\n' +
                    'Use papername.\n'),
             '\nOPTIONS\n-p, --paperpapername\nUse papername.\n')
     })

test('paragraphs', 'a continued tag text line keeps the tag open',
     () => {
       equal(asText('.TH T 1\n.TP\nfoo\\c\nbar\nbody\n'), 'foobar\nbody\n')
     })

test('paragraphs', 'a comment keeps a continued tag open and a blank ends it',
     () => {
       equal(asText('.TH T 1\n.TP\n.BR a\\c\n.\\" c\n.I b\nbody\n'),
             'ab\nbody\n')
       equal(asText('.TH T 1\n.TP\n.BR a\\c\n\n.I b\nbody\n'),
             'a\nb body\n')
     })

test('paragraphs', 'a continued tag keeps a macro that only expands to input',
     () => {
       // dmstats(8) writes `.B \-\-areasize ...\c` then `.UNITS`, whose body
       // prints the suffix list; groff keeps all of it in the tag.
       equal(asText('.TH T 1\n.TP\n.BR a\\c\n.de M\n.BR b | \\c\n' +
                    '.BR c ]\n..\n.M\nbody\n'),
             'ab|c]\nbody\n')
     })

test('paragraphs', 'a continuation before a break does not glue what follows',
     () => {
       equal(flat(parsed('.TH T 1\naa\\c\n.br\nbb\n').doc.blocks[0].spans),
             'aa\nbb')
     })

test('paragraphs', 'a break leaves the next macro line flush too',
     () => {
       // groff prints the bold `bold` at column 0 after `.br`.
       equal(flat(parsed('.TH T 1\none\n.br\n.B bold\n').doc.blocks[0].spans),
             'one\nbold')
     })

test('paragraphs', 'a break before any text adds no blank line',
     () => {
       // groff has nothing to break there: the heading is followed straight
       // by `two`, not by an empty line.
       equal(asText('.TH T 1\n.SH NAME\n.br\ntwo\n'), '\nNAME\ntwo\n')
     })

test('paragraphs', 'consecutive breaks collapse to one',
     () => {
       // groff ends the line once: `one$` then `two$`, with no blank between.
       equal(asText('.TH T 1\n.SH NAME\none\n.br\n.br\ntwo\n'),
             '\nNAME\none\ntwo\n')
     })

test('paragraphs', 'a break at the end of a paragraph adds no blank line',
     () => {
       // The paragraph already ends the line; groff prints `one` and nothing.
       equal(asText('.TH T 1\n.SH NAME\none\n.br\n'), '\nNAME\none\n')
     })

test('macros', 'an empty macro body produces nothing',
     () => {
       equal(asText('.TH T 1\n.de M\n..\n.M\nafter\n'), 'after\n')
     })

test('groff requests', 'nr with no value or a bad value gives zero',
     () => {
       let r

       r = parsed('.TH T 1\n.nr X\n.nr Y abc\nX=\\nX Y=\\nY\n')
       equal(flat(r.doc.blocks[0].spans), 'X=0 Y=0')
     })

test('groff requests', 'auto-increment register escape steps and then reads',
     () => {
       let r

       // sensible-editor(1) numbers its IP items this way: `\n+[step]` adds
       // the increment and prints the new value. `.nr step 1 1` sets step 1.
       r = parsed('.TH T 1\n.nr step 1 1\n.SH DESCRIPTION\n' +
                  '.IP \\n[step]\nfirst\n.IP \\n+[step]\nsecond\n' +
                  '.IP \\n+[step]\nthird\n')
       equal(r.doc.blocks.slice(1).map(b => flat(b.tag)).join(','), '1,2,3')
       // `-` steps down; a register with no increment does not move; and a
       // `.nr` that omits the increment keeps the one already set.
       equal(asText('.TH T 1\n.nr x 5 2\nA \\n+[x] B \\n-[x]\n'),
             'A 7 B 5\n')
       equal(asText('.TH T 1\n.nr y 7\nA \\n+[y] B \\n[y]\n'), 'A 7 B 7\n')
       equal(asText('.TH T 1\n.nr x 5 2\n.nr x 10\nA \\n+[x]\n'), 'A 12\n')
     })

test('strings', 'ds and as with no name are ignored',
     () => {
       equal(asText('.TH T 1\n.ds\n.as\nvisible\n'), 'visible\n')
     })

test('strings', 'as starts an undefined string',
     () => {
       equal(asText('.TH T 1\n.as NEW one\n.as NEW two\n\\*[NEW]\n'), 'onetwo\n')
     })

test('macros', 'rn renames a string too',
     () => {
       equal(asText('.TH T 1\n.ds S x\n.rn S T\n\\*T\n'), 'x\n')
     })

test('groff requests', 'metric and ignored requests are dropped',
     () => {
       equal(asText('.TH T 1\n.ad 1\n.tm note\nvisible\n'), 'visible\n')
     })

test('groff requests', 'hla and hpf select hyphenation without output',
     () => {
       let r

       // The Czech passwd(5) and shadow(5) open with `.do hla cs` and
       // `.do hpf hyphen.cs`. Neither draws anything; our renderer does not
       // hyphenate, so both are dropped like the other no-output requests.
       r = parsed('.TH T 1\n.SH NAME\n.do hla cs\n.do hpf hyphen.cs\nvisible\n')
       equal(r.ok, 1)
       equal(flat(r.doc.blocks[1].spans), 'visible')
       equal(r.fails.length, 0)
       equal(asText('.TH T 1\n.hla cs\n.hpf hyphen.cs\nvisible\n'), 'visible\n')
     })

test('groff requests', 'a stray TE and an empty mso are handled',
     () => {
       let r

       r = parsed('.TH T 1\n.TE\n.mso an-ext.tmac\nvisible\n')
       equal(r.ok, 1)
       equal(flat(r.doc.blocks[0].spans), 'visible')
     })

test('paragraphs', 'the blank control line adds a space block',
     () => {
       let r

       r = parsed('.TH T 1\n.\nvisible\n')
       equal(r.doc.blocks[0].kind, 'space')
       equal(flat(r.doc.blocks[1].spans), 'visible')
     })

test('literal', 'a blank line inside a literal block is kept',
     () => {
       equal(asText('.TH T 1\n.nf\n\n.fi\n'), '\n')
     })

test('links', 'UR with a man topic and no text shows the topic',
     () => {
       let r

       r = parsed('.TH T 1\n.UR man:ls\n.UE\n')
       equal(flat(r.doc.blocks[0].spans), 'ls')
       equal(r.doc.blocks[0].spans[0].href, 'man:ls')
     })

test('mdoc inline', 'macros with no arguments use their defaults',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Xr\n.Lk\n.Mt\n.St\n')
       equal(r.ok, 1)
       equal(ManParse.toText(r.doc.blocks), '\n')
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Fn\n.Fo\n.Fc\n')
       equal(flat(r.doc.blocks[0].spans), '() ()')
       r = parsed('.Dd t\n.Dt T 1\n.Os\n.OP\n.UR\n.UE\n.MT\n.ME\n')
       equal(flat(r.doc.blocks[0].spans), '[]⟨⟩⟨mailto:⟩')
     })

test('mdoc inline', 'a closing enclosure without an opener uses its default',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Dc\n.Pc\n.Ac\n.Bc\n.Brc\n.Qc\n.Sc\n.Oc\n.Ec\n')
       equal(flat(r.doc.blocks[0].spans), '”)⟩]}”’]')
     })

test('mdoc inline', 'an opening enclosure takes inline arguments',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Do Ar a Dc\n.Qo Ar b Qc\n.Ao Ar c Ac\n' +
                  '.Bo Ar d Bc\n.So Ar e Sc\n.Bro Ar f Brc\n')
       equal(flat(r.doc.blocks[0].spans), '“a” “b” ⟨c⟩ [d] ‘e’ {f}')
     })

test('mdoc', 'Dt with no arguments leaves the header empty',
     () => {
       let r

       r = parsed('.Dd t\n.Dt\n.Os\n')
       equal(r.doc.title, '')
       equal(r.doc.section, '')
     })

test('mdoc', 'El and Ef without their openers are harmless',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.El\n.Ef\nvisible\n')
       equal(r.ok, 1)
       equal(flat(r.doc.blocks[0].spans), 'visible')
     })

test('mdoc', 'Bd -literal with no lines makes an empty pre block',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Bd -literal\n.Ed\n')
       equal(r.doc.blocks[0].kind, 'pre')
       equal(flat(r.doc.blocks[0].spans), '')
     })

test('conditions', 'dividing or taking a remainder by zero gives zero',
     () => {
       equal(asText('.TH T 1\n.if 1/0==0 div\n.if 1%0==0 mod\n'), 'div mod\n')
     })

test('conditions', 'unary plus is accepted',
     () => {
       equal(asText('.TH T 1\n.if +1==1 yes\n'), 'yes\n')
     })

test('conditions', 'comparisons have their false arms too',
     () => {
       equal(asText('.TH T 1\n.if 5<=4 no\n.if 5<4 no\n.if 5>=6 no\n' +
                    '.if 5>6 no\n.if 5=6 no\nvisible\n'),
             'visible\n')
     })

test('conditions', 'and and or can be false',
     () => {
       equal(asText('.TH T 1\n.if 1&0 no\n.if 0:0 no\nvisible\n'), 'visible\n')
     })

test('conditions', 't and c are false when negated',
     () => {
       equal(asText('.TH T 1\n.ie !t yes\n.el no\n.ie !c yes\n.el no\n'), 'yes yes\n')
     })

test('conditions', 'd and r find macros, strings and predefined registers',
     () => {
       equal(asText('.TH T 1\n.de M\n..\n.ds S x\n.nr R 1\n.if dM m\n.if dS s\n' +
                    '.if rR r\n.if r% p\n.ie !dS no\n.el yes\n.ie !rR no\n' +
                    '.el yes\n'),
             'm s r p yes yes\n')
     })

test('conditions', 'an empty expansion is a false condition',
     () => {
       equal(asText('.TH T 1\n.ds E\n.if \\*E hidden\nshown\n'), 'shown\n')
     })

test('conditions', 'unequal strings are false and a negated match is true',
     () => {
       equal(asText('.TH T 1\n.ie \'a\'b\' no\n.el yes\n.ie !\'a\'a\' no\n' +
                    '.el yes\n'),
             'yes yes\n')
     })

test('conditions', 'a zero expression is false',
     () => {
       equal(asText('.TH T 1\n.if 0 no\nvisible\n'), 'visible\n')
     })

test('tables', 'allbox, center and expand are recorded',
     () => {
       let r

       r = parsed('.TH T 1\n.TS\nallbox center expand;\nl l.\na\tb\n.TE\n')
       equal(r.doc.blocks[0].options.allbox, 1)
       equal(r.doc.blocks[0].options.center, 1)
       equal(r.doc.blocks[0].options.expand, 1)
     })

test('tables', 'tab with no argument restores the default separator',
     () => {
       let r

       r = parsed('.TH T 1\n.TS\ntab();\nl l.\na\tb\n.TE\n')
       equal(flat(r.doc.blocks[0].rows[0].cells[1].spans), 'b')
     })

test('tables', 'an unknown column token is skipped and uppercase I is italic',
     () => {
       let r

       r = parsed('.TH T 1\n.TS\nl x lI.\na\tb\tc\n.TE\n')
       equal(r.doc.blocks[0].cols.length, 2)
       equal(r.doc.blocks[0].cols[1].italic, 1)
     })

test('tables', 'a blank line before the layout is skipped',
     () => {
       let r

       r = parsed('.TH T 1\n.TS\n\nl l.\na\tb\n.TE\n')
       equal(r.doc.blocks[0].cols.length, 2)
       equal(flat(r.doc.blocks[0].rows[0].cells[1].spans), 'b')
     })

test('tables', 'a row with fewer cells than columns is padded',
     () => {
       let r

       r = parsed('.TH T 1\n.TS\nl l l.\na\tb\n.TE\n')
       equal(r.doc.blocks[0].rows[0].cells.length, 3)
       equal(flat(r.doc.blocks[0].rows[0].cells[2].spans), '')
     })

test('macros', 'HP starts a fresh paragraph',
     () => {
       equal(asText('.TH T 1\n.HP 4\nhanging text\n'), 'hanging text\n')
     })

test('macros', 'nop passes plain text through',
     () => {
       equal(asText('.TH T 1\n.nop hello\n'), 'hello\n')
       equal(asText('.TH T 1\n.nop\n'), '')
     })

test('macros', 'a stray block marker is ignored',
     () => {
       equal(asText('.TH T 1\n.\\{\n.\\}\n'), '')
     })

test('fuzz', '300 malformed pages parse without throwing or hanging',
     () => {
       let started, elapsed, docs, i

       started = Date.now()
       docs = fuzzDocs(300)
       for (i = 0; i < docs.length; i++) {
         let src, res, text

         src = docs[i]
         try {
           res = ManParse.parse(src)
           text = ManParse.toText(res.doc.blocks)
         }
         catch (e) {
           throw new Error('fuzz doc ' + i + ' ' + JSON.stringify(src) + ': ' + e.message)
         }
         ok((res.ok == 0) || (res.ok == 1), 'fuzz doc ' + i + ' ok ' + res.ok)
         res.fails.forEach(f => ok((typeof f.what == 'string') && (f.what.length > 0),
                                   'fuzz doc ' + i + ' fail without what'))
         ok(typeof text == 'string', 'fuzz doc ' + i + ' toText')
         ok(typeof JSON.stringify(res.doc) == 'string', 'fuzz doc ' + i + ' doc is cyclic')
       }
       elapsed = Date.now() - started
       ok(elapsed < 2000, 'fuzz took ' + elapsed + 'ms')
     })

test('fuzz', '200 well-formed pages all parse',
     () => {
       let started, elapsed, docs, i

       started = Date.now()
       docs = fuzzPages(200)
       for (i = 0; i < docs.length; i++) {
         let src, res, fails

         src = docs[i]
         res = ManParse.parse(src)
         fails = res.fails.map(f => f.what + ' at line ' + f.line).join(', ')
         // A valid page is never refused. The source is in the message so a
         // regression can be pasted straight into a named test.
         equal(res.ok, 1, 'fuzz page ' + i + ' refused (' + fails + '):\n' + src)
       }
       elapsed = Date.now() - started
       ok(elapsed < 2000, 'page fuzz took ' + elapsed + 'ms')
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
