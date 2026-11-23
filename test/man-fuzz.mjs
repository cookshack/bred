// A deterministic stream of hostile roff documents, shared by the parser and
// renderer fuzz tests. The seed and the token pool live here, so both tests
// see the same pages and a failure can be replayed from its index.

let fuzzSeed

// Deterministic LCG, so a failing source can be reproduced from its seed.
function fuzzNext
() {
  fuzzSeed = ((fuzzSeed * 1664525) + 1013904223) >>> 0
  return fuzzSeed / 4294967296
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
