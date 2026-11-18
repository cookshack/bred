import { equal } from 'node:assert/strict'
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
       equal(link.text, 'the site')
       equal(flat(r.doc.blocks[0].spans).endsWith('.') == 1, true)
     })

test('links', 'UR with no text shows the target',
     () => {
       let r

       r = parsed('.TH T 1\n.UR https://example.com\n.UE\n')
       equal(flat(r.doc.blocks[0].spans), '<https://example.com>')
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

test('escapes', 'continue joins lines without a space',
     () => {
       equal(flat(parsed('.TH T 1\njoin\\c\ned\n').doc.blocks[0].spans), 'joined')
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

test('mdoc', 'In brackets its header',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Sh SYNOPSIS\n.In stdio.h\n')
       equal(flat(r.doc.blocks[1].spans), '<stdio.h>')
     })

test('mdoc', 'Fl makes options and Fl Fl makes a long option',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Fl a b\n.Op Fl Fl all\n')
       equal(flat(r.doc.blocks[0].spans), '-a -b [--all]')
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

test('mdoc', 'Dl attaches trailing punctuation',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Dl $ \\*[Lt]newline\\*[Gt] .\n')
       equal(flat(r.doc.blocks[0].spans), '$ <newline>.')
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

test('mdoc', 'Rs and Re collect a reference',
     () => {
       let r

       r = parsed('.Dd t\n.Dt T 1\n.Os\n.Rs\n.%A A. Author\n.%T A Title\n.%D 2020\n.Re\n')
       equal(flat(r.doc.blocks[0].spans), 'A. Author, A Title, 2020')
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
       equal(spans[0].text, 'The site')
       equal(spans[0].href, 'https://example.com')
       equal(flat(spans), 'The site.')
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
       equal(r.doc.blocks[0].spans[0].text, 'A Person')
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

test('escapes', 'a trailing backslash joins the next line before parsing',
     () => {
       let r

       r = parsed('.TH T 1\n.TP\ntag \\\n... continued\nbody\n')
       equal(flat(r.doc.blocks[0].tag), 'tag ... continued')
       equal(flat(r.doc.blocks[0].blocks.filter(b => b.kind == 'para')[0].spans), 'body')
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

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
