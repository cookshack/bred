// A deterministic stream of roff documents, shared by the parser and renderer
// fuzz tests. The seeds and the token pools live here, so both tests see the
// same pages and a failure can be replayed from its index.
//
// fuzzDocs is hostile: it splices malformed lines and escapes together, and
// only about one document in thirty parses. fuzzPages composes valid man and
// mdoc pages out of the blocks the model really has, nested a few levels deep,
// so the parser and renderer meet valid-but-unusual documents as well.

let fuzzSeed, pageSeed

// Deterministic LCG, so a failing source can be reproduced from its seed.
function lcgStep
(seed) {
  return ((seed * 1664525) + 1013904223) >>> 0
}

function fuzzNext
() {
  fuzzSeed = lcgStep(fuzzSeed)
  return fuzzSeed / 4294967296
}

function pageNext
() {
  pageSeed = lcgStep(pageSeed)
  return pageSeed / 4294967296
}

function oneOf
(items) {
  return items[ Math.floor(pageNext() * items.length) ]
}

function many
(low, high) {
  return low + Math.floor(pageNext() * (high - low + 1))
}

// A short run of ordinary words. The text pool stays free of escapes and
// macros: this generator is about valid block structure, not expansion.
function sentence
(count) {
  let pool, out, i

  pool = [ 'alpha', 'beta', 'delta', 'file', 'flag', 'input', 'mode',
           'name', 'option', 'output', 'path', 'socket', 'stream', 'value' ]
  out = []
  for (i = 0; i < count; i++)
    out.push(pool[ Math.floor(pageNext() * pool.length) ])
  return out.join(' ')
}

function fuzzDocument
() {
  let tokens, parts, count, i

  tokens = [ '.TH FZ 1', '.SH NAME', '.SH', '.SS', '.PP', '.br',
             '.nf', '.fi', '.TP', '.HP', '.bl', '.de XX',
             '.de XX \\', '.ds XX value', '.ds', '.rm XX',
             '.if n 1 .PP', '.ie n .PP \\', '.el .PP', '.ig',
             '.TS', '.TE', '.T&', '.so other.1', '.Xo', '.Xc',
             '.Bl -tag -width foo', '.It', '.El', '.nr R 1',
             '.\\" a comment', 'T{', 'T}', '.', '..', '\\"',
             '\\fB', '\\f[', '\\f[roman]', '\\(', '\\[', '\\*[',
             '\\n[', '\\s', '\\s-1', '\\h', '\\h\'1\'', '\\.',
             '\\\\', '\\(ts', '\\-', '\\&', '\\c', '\\{', '\\}',
             '(', ')', '[', ']', '{', '}', '"', "'", '<<', '>>',
             '<', '>', '@', 'plain text', 'name(section)',
             'foo bar baz', 'a\tb', 'x' ]
  parts = []
  if (fuzzNext() < 0.8)
    parts.push('.TH FZ 1\n')
  count = 6 + Math.floor(fuzzNext() * 30)
  for (i = 0; i < count; i++) {
    let token

    if (fuzzNext() < 0.2) {
      let name, letters

      name = ''
      letters = 1 + Math.floor(fuzzNext() * 4)
      while (name.length < letters)
        name += String.fromCharCode(97 + Math.floor(fuzzNext() * 26))
      token = '.' + name + ((fuzzNext() < 0.5) ? ' arg' : '')
    }
    else if (fuzzNext() < 0.3)
      token = '"' + tokens[ Math.floor(fuzzNext() * tokens.length) ]
    else
      token = tokens[ Math.floor(fuzzNext() * tokens.length) ]
    parts.push(token + ((fuzzNext() < 0.55) ? '\n' : ' '))
  }
  return parts.join('')
}

// ---- well-formed man(7) -------------------------------------------------

function manTable
() {
  let shapes, shape, out, rows, i, j

  shapes = [ { layout: 'l l.', cells: 2 },
             { layout: 'l l l.', cells: 3 },
             { layout: 'lb r.', cells: 2 },
             { layout: 'l s l.', cells: 2 },
             { layout: 'li r c.', cells: 3 },
             { layout: 'l r l r.', cells: 4 } ]
  shape = oneOf(shapes)
  out = [ '.TS' ]
  if (pageNext() < 0.4)
    out.push(oneOf([ 'box;', 'allbox;', 'center;', 'box allbox;', 'expand;' ]))
  out.push(shape.layout)
  rows = many(1, 3)
  for (i = 0; i < rows; i++) {
    let cells

    cells = []
    for (j = 0; j < shape.cells; j++)
      cells.push((pageNext() < 0.2) ? '' : sentence(1))
    out.push(cells.join('\t'))
  }
  out.push('.TE')
  return out
}

// The shapes the plain table leaves out: a multiline T{ T} cell, a span with
// a box, and a T& continuation that starts a second table.
function manTableComplex
() {
  let kind

  kind = oneOf([ 'multiline', 'span', 'tand' ])
  if (kind == 'multiline')
    return [ '.TS', 'l l.', 'one\tT{', 'two lines', 'T}', '.TE' ]
  if (kind == 'span')
    return [ '.TS', 'box;', 'l s l.', 'a\tb', 'c\td', '.TE' ]
  return [ '.TS', 'l l.', 'a\tb', '.T&', 'box;', 'l l l.', 'c\td\te', '.TE' ]
}

function manBlock
(depth) {
  let kind

  kind = oneOf([ 'para', 'pp', 'tag', 'ip', 'nf', 'ex', 'table', 'ur', 'url',
                 'font', 'synopsis' ])
  if ((depth < 3) && (pageNext() < 0.2))
    kind = 'rs'
  switch (kind) {
  case 'para':
    return [ sentence(many(3, 6)) ]
  case 'pp':
    return [ '.PP', sentence(many(3, 6)) ]
  case 'tag':
    return [ '.TP',
             oneOf([ '.B \\-a', '.B \\-\\-all', '.BR ls (1)', '.I file' ]),
             sentence(many(3, 5)) ]
  case 'ip':
    return [ '.IP \\(bu 2', sentence(many(3, 5)) ]
  case 'nf':
    return [ '.nf', sentence(many(2, 4)), sentence(many(2, 4)), '.fi' ]
  case 'ex':
    return [ '.EX', '$ ' + sentence(many(2, 3)), sentence(many(2, 3)), '.EE' ]
  case 'table':
    return ((pageNext() < 0.5) ? manTable() : manTableComplex())
  case 'ur':
    return [ '.UR https://example.com/' + sentence(1),
             sentence(many(2, 4)), '.UE .' ]
  case 'url':
    return [ '.URL https://example.com/' + sentence(1) + ' "The site" .' ]
  case 'font':
    return [ '.BI ' + sentence(1) + ' ' + sentence(1), sentence(many(2, 3)) ]
  case 'synopsis':
    return [ '.SY ' + sentence(1), '.OP \\-a ' + sentence(1), '.YS' ]
  case 'rs':
    return [ '.RS' ].concat(manBlocks(depth + 1), [ '.RE' ])
  }
}

function manBlocks
(depth) {
  let out, count, i

  out = []
  count = many(1, 2)
  for (i = 0; i < count; i++)
    out = out.concat(manBlock(depth))
  return out
}

function manPage
() {
  let out, sections, i

  out = [ '.TH ' + oneOf([ 'FZ', 'PAGE', 'TOOL' ]) +
          ' 1 "2024-01-01" "GNU" "User Commands"' ]
  sections = many(1, 2)
  for (i = 0; i < sections; i++) {
    out.push('.SH ' + oneOf([ 'NAME', 'DESCRIPTION', 'OPTIONS', 'EXAMPLES',
                              'SEE ALSO', 'NOTES', 'ENVIRONMENT' ]))
    if (pageNext() < 0.3)
      out.push('.SS ' + sentence(2))
    out = out.concat(manBlocks(1))
  }
  return out.join('\n') + '\n'
}

// ---- well-formed mdoc(7) ------------------------------------------------

function mdocList
(type, depth) {
  let out, items, i

  out = [ '.Bl -' + type + ((type == 'tag') ? ' -width x' : '') ]
  items = many(1, 2)
  for (i = 0; i < items; i++) {
    if (type == 'tag')
      out.push('.It ' + oneOf([ 'Fl a', 'Cm start', 'Fl \\-\\-all',
                                'Ar file', 'Xo' ]))
    else
      out.push('.It')
    if (out[out.length - 1] == '.It Xo')
      out = out.concat([ '.Fl a', '.Xc' ])
    out.push(sentence(many(2, 4)))
    if ((depth < 3) && (pageNext() < 0.4))
      out = out.concat(mdocNested(depth + 1))
  }
  out.push('.El')
  return out
}

function mdocNested
(depth) {
  let kind

  kind = oneOf([ 'bullet', 'tag', 'literal', 'table', 'pp' ])
  if (kind == 'pp')
    return [ '.Pp', sentence(many(2, 3)) ]
  if (kind == 'literal')
    return [ '.Bd -literal', sentence(many(2, 3)),
             sentence(many(2, 3)), '.Ed' ]
  if (kind == 'table')
    return manTable()
  return mdocList(kind, depth)
}

function mdocBlock
(depth) {
  let kind

  kind = oneOf([ 'para', 'pp', 'taglist', 'bullet', 'enum', 'literal',
                 'display', 'dl', 'ref', 'inline', 'xo', 'an', 'table' ])
  switch (kind) {
  case 'para':
    return [ sentence(many(3, 6)) ]
  case 'pp':
    return [ '.Pp', sentence(many(3, 6)) ]
  case 'taglist':
    return mdocList('tag', depth)
  case 'bullet':
    return mdocList('bullet', depth)
  case 'enum':
    return mdocList('enum', depth)
  case 'literal':
    return [ '.Bd -literal', sentence(many(2, 3)),
             sentence(many(2, 3)), '.Ed' ]
  case 'display':
    return [ '.D1 $ ' + sentence(many(2, 3)) ]
  case 'dl':
    return [ '.Dl ' + sentence(many(2, 3)) ]
  case 'ref':
    return [ '.Rs', '.%A A. Author', '.%T ' + sentence(3), '.%D 2020', '.Re' ]
  case 'inline':
    return [ '.Op Fl ' + oneOf([ 'a', 'b', 'all', 'verbose' ]) ]
  case 'xo':
    return [ '.Xo', '.Fl ' + oneOf([ 'a', 'b' ]), '.Xc',
             sentence(many(2, 3)) ]
  case 'an':
    return [ '.An -split John Doe Aq addr' ]
  case 'table':
    return manTable()
  }
}

function mdocPage
() {
  let out, name

  name = oneOf([ 'fz', 'tool', 'ufz' ])
  out = [ '.Dd January 1, 2024',
          '.Dt ' + name.toUpperCase() + ' 1',
          '.Os Linux',
          '.Sh NAME',
          '.Nm ' + name,
          '.Nd ' + sentence(3),
          '.Sh DESCRIPTION' ]
  out = out.concat(mdocBlock(1))
  if (pageNext() < 0.35)
    out = out.concat(mdocBlock(1))
  out.push('.Sh SEE ALSO')
  out.push('.Xr ls 1 .')
  return out.join('\n') + '\n'
}

// The same sources in the same order for every caller: the seed is reset here
// rather than left to whoever ran the generator last.
export
function fuzzDocs
(count) {
  let docs, i

  fuzzSeed = 0x5EED
  docs = []
  for (i = 0; i < count; i++)
    docs.push(fuzzDocument())
  return docs
}

export
function fuzzPages
(count) {
  let docs, i

  pageSeed = 0x9A6E
  docs = []
  for (i = 0; i < count; i++)
    docs.push(((pageNext() < 0.5) ? manPage : mdocPage)())
  return docs
}
