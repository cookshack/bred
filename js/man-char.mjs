// Special character names used by roff escapes: \(xx and \[name].
//
// A name that is not here fails the page, so this table is a closed set. It
// covers every name in the installed Debian corpus plus common neighbours;
// bin/man-audit reports anything missing.

let chars, accents, symbols, greek

accents = { "'a": 'á',
            "'c": 'ć',
            "'e": 'é',
            "'i": 'í',
            "'o": 'ó',
            "'u": 'ú',
            "'A": 'Á',
            "'C": 'Ć',
            "'E": 'É',
            "'I": 'Í',
            "'O": 'Ó',
            "'U": 'Ú',
            '`a': 'à',
            '`e': 'è',
            '`i': 'ì',
            '`o': 'ò',
            '`u': 'ù',
            '`A': 'À',
            '`E': 'È',
            '`I': 'Ì',
            '`O': 'Ò',
            '`U': 'Ù',
            ':a': 'ä',
            ':e': 'ë',
            ':i': 'ï',
            ':o': 'ö',
            ':u': 'ü',
            ':A': 'Ä',
            ':E': 'Ë',
            ':I': 'Ï',
            ':O': 'Ö',
            ':U': 'Ü',
            '~a': 'ã',
            '~n': 'ñ',
            '~o': 'õ',
            '~A': 'Ã',
            '~N': 'Ñ',
            '~O': 'Õ',
            ',c': 'ç',
            ',C': 'Ç',
            '^a': 'â',
            '^e': 'ê',
            '^i': 'î',
            '^o': 'ô',
            '^u': 'û',
            '^A': 'Â',
            '^E': 'Ê',
            '^I': 'Î',
            '^O': 'Ô',
            '^U': 'Û',
            'oa': 'å',
            'oA': 'Å',
            '/l': 'ł',
            '/L': 'Ł',
            '/o': 'ø',
            '/O': 'Ø',
            'ae': 'æ',
            'AE': 'Æ',
            'oe': 'œ',
            'OE': 'Œ',
            'ss': 'ß',
            'aa': '´',
            'ga': '`' }

symbols = { 'aq': "'",
            'dq': '"',
            'lq': '“',
            'rq': '”',
            'oq': '‘',
            'cq': '’',
            'Bq': '„',
            'bq': '‚',
            'bu': '•',
            'ba': '|',
            'sc': '§',
            '**': '∗',
            'em': '—',
            'en': '–',
            'hy': '-',
            'ha': '^',
            'ti': '~',
            'sl': '/',
            'rs': '\\',
            'or': '|',
            'br': '│',
            'bv': '⎪',
            '..': '‥',
            'at': '@',
            'co': '©',
            'rg': '®',
            'tm': '™',
            'de': '°',
            'dg': '†',
            'dd': '‡',
            'mc': 'µ',
            'mu': '×',
            'di': '÷',
            '+-': '±',
            '->': '→',
            '<-': '←',
            'lA': '⇐',
            'rA': '⇒',
            'hA': '⇔',
            'ua': '↑',
            'uA': '⇑',
            'da': '↓',
            'dA': '⇓',
            '>=': '≥',
            '<=': '≤',
            '!=': '≠',
            '==': '≡',
            '~~': '≈',
            'if': '∞',
            'sr': '√',
            'is': '∫',
            'pd': '∂',
            'no': '¬',
            'la': '⟨',
            'ra': '⟩',
            'lB': '[',
            'rB': ']',
            'lC': '{',
            'rC': '}',
            'Fo': '«',
            'Fc': '»',
            '12': '½',
            '14': '¼',
            '34': '¾',
            'S1': '¹',
            'S2': '²',
            'S3': '³',
            'pl': '+',
            'mi': '−',
            'tmu': '×' }

greek = { 'ts': 'ς', // teliko sigma, the final form of `*s`
          '*a': 'α',
          '*b': 'β',
          '*g': 'γ',
          '*d': 'δ',
          '*e': 'ε',
          '*z': 'ζ',
          '*y': 'η',
          '*h': 'θ',
          '*i': 'ι',
          '*k': 'κ',
          '*l': 'λ',
          '*m': 'μ',
          '*n': 'ν',
          '*c': 'ξ',
          '*o': 'ο',
          '*p': 'π',
          '*r': 'ρ',
          '*s': 'σ',
          '*t': 'τ',
          '*u': 'υ',
          '*f': 'φ',
          '*x': 'χ',
          '*q': 'ψ',
          '*w': 'ω',
          '*D': 'Δ',
          '*Q': 'Ψ',
          '*L': 'Λ',
          '*C': 'Ξ',
          '*P': 'Π',
          '*S': 'Σ',
          '*F': 'Φ',
          '*Y': 'Η',
          '*W': 'Ω',
          '*A': 'Α',
          '*B': 'Β',
          '*E': 'Ε',
          '*Z': 'Ζ',
          '*H': 'Θ',
          '*I': 'Ι',
          '*K': 'Κ',
          '*M': 'Μ',
          '*N': 'Ν',
          '*O': 'Ο',
          '*R': 'Ρ',
          '*T': 'Τ',
          '*U': 'Υ',
          '*X': 'Χ' }

chars = Object.assign({}, accents, symbols, greek)

export
function charOf
(name) {
  let ch

  ch = chars[name]
  return (ch == undefined) ? 0 : ch
}

export
function charByNumber
(num) {
  let code

  code = Number(num)
  if (Number.isFinite(code) && (code > 0) && (code < 0x110000))
    return String.fromCodePoint(code)
  return 0
}

// A `u` name is a code point only in groff's own spelling: at least four
// upper-case hex digits, with no padding beyond four. `\[uA]` is the named
// arrow, not hex, and `\[uAB]` is a name groff cannot find.
function unicodeCode
(name) {
  let digits

  digits = name.slice(1)
  if (digits.length < 4)
    return 0
  if (digits.length > 6)
    return 0
  if (/[^0-9A-F]/.test(digits))
    return 0
  if ((digits.length > 4) && (digits[0] == '0'))
    return 0
  return charByNumber('0x' + digits)
}

export
function charOfBracket
(name) {
  let ch

  ch = charOf(name)
  if (ch)
    return ch
  if (name.startsWith('u'))
    ch = unicodeCode(name)
  else if (name.startsWith('char'))
    ch = charByNumber(name.slice(4))
  return ch || 0
}
