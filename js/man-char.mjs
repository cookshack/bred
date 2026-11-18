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
            'da': '↓',
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
            'tmu': '™' }

greek = { '*a': 'α',
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
          '*Q': 'Θ',
          '*L': 'Λ',
          '*C': 'Ξ',
          '*P': 'Π',
          '*S': 'Σ',
          '*F': 'Φ',
          '*Y': 'Ψ',
          '*W': 'Ω',
          '*A': 'Α',
          '*B': 'Β',
          '*E': 'Ε',
          '*Z': 'Ζ',
          '*H': 'Η',
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

export
function charOfBracket
(name) {
  let ch

  ch = charOf(name)
  if (ch)
    return ch
  if (name.startsWith('u'))
    ch = charByNumber('0x' + name.slice(1))
  else if (name.startsWith('char'))
    ch = charByNumber(name.slice(4))
  return ch || 0
}
