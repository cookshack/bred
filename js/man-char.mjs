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
            'hy': '\u2010', // typographic hyphen; a bare - and \- stay ASCII
            'ha': '^',
            'ti': '~',
            'sl': '/',
            'rs': '\\',
            'or': '|',
            'br': '│',
            'bv': '⎪',
            'an': '⎯',
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
            'va': '↕',
            'vA': '⇕',
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
          '*f': 'ϕ', // groff prints GREEK PHI SYMBOL, not the letter phi
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
          '*G': 'Γ',
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

// groff refuses a printable ASCII `u` code point unless it has a special
// character name: `\[u0041]` is the plain glyph `A` and warns "can't find
// special character '\A'", while `\[u0040]` is \(at and prints. Digits,
// letters and the punctuation below are plain glyphs; space, the control
// range and DEL are synthesised from the code point itself and work.
function plainGlyph
(code) {
  if ((code >= 0x30) && (code <= 0x39))
    return 1
  if ((code >= 0x41) && (code <= 0x5A))
    return 1
  if ((code >= 0x61) && (code <= 0x7A))
    return 1
  return '!%&()*,.:;<>?'.includes(String.fromCharCode(code)) ? 1 : 0
}

// A `u` name is a code point only in groff's own spelling: at least four
// upper-case hex digits, with no padding beyond four. `\[uA]` is the named
// arrow, not hex, and `\[uAB]` is a name groff cannot find.
function unicodeCode
(name) {
  let digits, code

  digits = name.slice(1)
  if (digits.length < 4)
    return 0
  if (digits.length > 6)
    return 0
  if (/[^0-9A-F]/.test(digits))
    return 0
  if ((digits.length > 4) && (digits[0] == '0'))
    return 0
  code = Number('0x' + digits)
  if (plainGlyph(code))
    return 0
  return charByNumber(code)
}

// A `char` name is a code point in canonical decimal. groff takes `charNNN`
// and refuses `char0x41`, `char+65`, `char065` and `char1e2`.
function charDecimal
(name) {
  let digits

  digits = name.slice(4)
  if (/^(0|[1-9][0-9]*)$/.test(digits))
    return charByNumber(digits)
  return 0
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
    ch = charDecimal(name)
  return ch || 0
}
