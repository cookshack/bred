// Roff interpreter for man(7) pages.
//
// parse() turns a manual page into a small block model a renderer can draw
// without knowing roff: headings, paragraphs, tagged paragraphs, insets,
// literal blocks and inline styled runs.
//
// A page either renders or is refused. Anything the interpreter cannot
// represent is reported in `fails` and the page is marked not ok; there is no
// silently degraded output.

import * as Char from './man-char.mjs'
import * as Roff from './man-roff.mjs'

let fonts, predefinedStrings, predefinedRegisters, escapeChars, mdocAtNames, mdocLbNames, mdocInlineNames, mdocNoArg, mdocEncloseNames
let tableRequests, tableKeyChars, tableRuleChars, tableSpecifiers, expandDepth
let manFontStyles, tableCellMacros

fonts = { B: 'bold',
          BI: 'bold',
          I: 'italic',
          R: 'roman',
          P: 'roman',
          CW: 'mono',
          CR: 'roman',
          CB: 'bold',
          CI: 'italic',
          C: 'mono',
          S: 'small',
          1: 'roman',
          2: 'italic',
          3: 'bold',
          4: 'bold' }

predefinedStrings = { 'lq': '“',
                      'rq': '”',
                      'Aq': '’',
                      'aq': "'",
                      'oq': '‘',
                      'cq': '’',
                      'dq': '”',
                      'Bq': '„',
                      'bq': '‚',
                      'ga': '`',
                      'aa': '´',
                      'ti': '~',
                      'sl': '/',
                      'rs': '\\',
                      'at': '@',
                      'co': '©',
                      'rg': '®',
                      'tm': '™',
                      'de': '°',
                      'dg': '†',
                      'ss': 'ß',
                      'ae': 'æ',
                      'oe': 'œ',
                      'la': '⟨',
                      'ra': '⟩',
                      'Fo': '«',
                      'Fc': '»',
                      '--': '—',
                      'PI': 'π',
                      'L"': '“',
                      'R"': '”',
                      'C+': 'C++',
                      'C`': '‘',
                      "C'": '’',
                      '.T': 'utf8',
                      'Tr': '',
                      'Gt': '>',
                      'Lt': '<',
                      'Am': '&',
                      'Le': '≤',
                      'Ge': '≥',
                      'Eq': '=',
                      'Ne': '≠',
                      'Ba': '|',
                      'q': '"',
                      'Pm': '±',
                      'Do': '“',
                      'Dc': '”',
                      'Sq': '’',
                      'Aq': '’',
                      'Na': 'NaN',
                      'If': '∞',
                      'Em': '—',
                      'EN': '–' }

predefinedRegisters = { '.g': 1,
                        '.H': 24,
                        '.V': 40,
                        '.l': 78,
                        '.i': 0,
                        '.j': 1,
                        '.c': 1,
                        '.d': 0,
                        '.f': 1,
                        '.k': 0,
                        '.p': 1,
                        '.s': 10,
                        '.v': 12,
                        '.w': 0,
                        '.u': 0,
                        '.A': 1,
                        '.P': 1,
                        '.R': 1,
                        '.C': 1,
                        '.Y': 0,
                        '.y': 0,
                        '.z': 0,
                        '.ss': 12,
                        '.fam': 1,
                        'F': 1,
                        '%': 0,
                        'dn': 0,
                        'mH': 0,
                        'x': 0,
                        'y': 0,
                        'HY': 1,
                        'PN': 1,
                        'an-margin': 0,
                        'rst2man-indent-level': 1,
                        'rst2man-indent0': 1,
                        'rst2man-indent1': 2,
                        'rst2man-indent2': 3 }

escapeChars = { '\\': '\\',
                '_': '_',
                '-': '-',
                '&': '',
                'e': '\\',
                '.': '.',
                "'": '´',
                '`': '`',
                ' ': ' ',
                '~': ' ',
                '|': '',
                '^': '',
                ']': ']',
                '%': '',
                ':': '',
                ',': '',
                '/': '',
                '0': ' ',
                '+': '+',
                '{': '',
                '}': '',
                'T': 'utf8',
                '\t': '\t',
                't': '\t' }

function pushSpan
(spans, span) {
  let last

  if (span.br) {
    last = spans[spans.length - 1]
    // A break only ends a line that has text on it: at the start of a target,
    // or straight after another break, there is nothing to end, and groff
    // prints no empty line for it.
    if (last && (last.br == undefined))
      spans.push({ br: 1 })
    return
  }
  if (span.text == '')
    return
  last = spans[spans.length - 1]
  if (last && (last.br == undefined) && (last.style == span.style) &&
      (last.href == span.href) && (last.role == span.role))
    last.text += span.text
  else
    spans.push({ text: span.text,
                 style: span.style,
                 href: span.href,
                 role: span.role })
}

// An mdoc macro can say what a run means, not only how it looks: a flag, a
// path, an environment variable. Carry that on the span so the renderer can
// add a class for it, while the style stays the font the macro prints with.
function setRole
(spans, role) {
  if (role)
    spans.forEach(span => {
                    if (span.br == undefined)
                      span.role = role
                  })
  return spans
}

function pushSpans
(into, spans) {
  spans.forEach(span => pushSpan(into, span))
}

function textOf
(spans) {
  let out

  out = ''
  spans.forEach(span => {
                  if (span.br)
                    out += '\n'
                  else
                    out += span.text
                })
  return out
}

function trans
(c, text) {
  let out

  out = ''
  for (let i = 0; i < text.length; i++)
    out += (c.tr[text[i]] == undefined) ? text[i] : c.tr[text[i]]
  return out
}

function frame
(c) {
  return c.frames[c.frames.length - 1]
}

function argOf
(c, n) {
  let f

  f = frame(c)
  return (f && f.args && (n > 0)) ? (f.args[n - 1] || '') : ''
}

function unquote
(text) {
  let first, last

  first = text[0]
  last = text[text.length - 1]
  if ((first == last) && ("'\"[]|".includes(first))) {
    let inner

    inner = text.slice(1, -1)
    if (first == '"')
      inner = inner.replace(/""/g, '"')
    return inner
  }
  return text
}

function skipArg
(text, i) { // i is just after the escape letter
  let open

  if (i >= text.length)
    return i
  open = text[i]
  if ((open == "'") || (open == '"')) {
    i++
    while (i < text.length) {
      if (text[i] == open)
        break
      i++
    }
    return i + 1
  }
  if (open == '[') {
    let depth

    depth = 1
    i++
    while (i < text.length) {
      if (text[i] == '\\') {
        // An escape's own bracket argument nests: `\F[\n[.fam]]` closes the
        // register's `]` first, then the font's. Treating `\n` as a plain
        // pair leaves that inner `]` behind as text. A `\(` name and any
        // other escape have no brackets of their own, so skipping the pair
        // is enough.
        i += 2
        if (text[i] == '[') {
          depth++
          i++
        }
        continue
      }
      if (text[i] == ']') {
        depth--
        if (depth == 0)
          return i + 1
      }
      i++
    }
    return i
  }
  if (open == '(')
    return i + 3
  {
    let end

    end = text.indexOf(open, i + 1)
    return (end < 0) ? text.length : (end + 1)
  }
}

function skipSize
(text, i) {
  let open

  if (i >= text.length)
    return i
  open = text[i]
  if ((open == '(') || (open == '['))
    return skipArg(text, i)
  // `\s-1` takes one digit, so `\s-133` is a smaller "33"; without a sign
  // two digits are the absolute size (`\s12`), and `\s123` leaves the "3".
  if ((open == '+') || (open == '-')) {
    i++
    if ((i < text.length) && /[0-9]/.test(text[i]))
      i++
    return i
  }
  {
    let n

    n = 0
    while ((i < text.length) && /[0-9]/.test(text[i]) && (n < 2)) {
      i++
      n++
    }
  }
  return i
}

function skipMotion
(text, i) {
  let open

  if (i >= text.length)
    return i
  open = text[i]
  if ((open == "'") || (open == '"') || (open == '[') || (open == '('))
    return skipArg(text, i)
  if ((text[i] == '+') || (text[i] == '-'))
    i++
  while ((i < text.length) && /[0-9.]/.test(text[i]))
    i++
  while ((i < text.length) && /[a-zA-Z]/.test(text[i]))
    i++
  return i
}

// \F, \m, \M and \k name a font family, a colour or a register. The argument
// is a single character unless it is bracketed or parenthesised (`\FI`,
// `\m[red]`, `\F[\n[.fam]]`), so tracking a pair would swallow the text after
// it: `\FI$BOOT` is family I followed by `$BOOT`, not a delimited argument.
function skipName
(text, i) {
  let open

  if (i >= text.length)
    return i
  open = text[i]
  if ((open == '[') || (open == '('))
    return skipArg(text, i)
  return i + 1
}

// \S and \v take a quoted or bracketed value (`\S'2'`, `\v[2m]`); an
// undelimited one is a single character, which is also how groff recovers
// from `\v2m` (it warns, then reads one character).
function skipValue
(text, i) {
  let open

  if (i >= text.length)
    return i
  open = text[i]
  if ((open == "'") || (open == '"') || (open == '[') || (open == '('))
    return skipArg(text, i)
  return i + 1
}

// The name part of `\*` or `\n`: `x`, `(xx` or `[name]`. i is the first
// character of the name.
function nameAfter
(text, i) {
  if (text[i] == '(')
    return { name: text.slice(i + 1, i + 3), at: i + 3 }
  if (text[i] == '[') {
    let end

    end = text.indexOf(']', i)
    if (end < 0)
      return { name: text.slice(i + 1), at: text.length }
    return { name: text.slice(i + 1, end), at: end + 1 }
  }
  return { name: text[i] || '', at: i + 1 }
}

function stringNameOf
(text, i) { // i is the index of * or n
  let j

  j = i + 1
  if ((text[j] == '+') || (text[j] == '-'))
    j++
  return nameAfter(text, j)
}

function fail
(c, lineNo, what, cls) {
  let key

  key = what
  if (c.seen[key])
    return
  c.seen[key] = 1
  c.fails.push({ line: lineNo, what, cls: cls || 'unsupported' })
}

function registerValue
(c, name, lineNo) {
  let val

  if (name == '.$')
    return frame(c)?.args?.length || 0
  val = (c.reg[name] == undefined) ? predefinedRegisters[name] : c.reg[name]
  if (val == undefined) {
    // groff reads an undefined register as 0. In a condition that is the
    // whole answer, so do not refuse the page; man-audit's static inventory
    // still lists the register as unresolved.
    if (c.condDepth)
      return 0
    fail(c, lineNo, 'register ' + name, 'unknown')
    return 0
  }
  return val
}

function lookupString
(c, name, lineNo) {
  if (name in c.str)
    return c.str[name]
  if (name in predefinedStrings)
    return predefinedStrings[name]
  fail(c, lineNo, 'string ' + name, 'unknown')
  return ''
}

// Expand one input line into styled runs. Mutates the current font, as roff
// does. Returns join=1 when the line ends with \c.
expandDepth = 0

function expand
(c, text, style, lineNo) {
  let spans, at, cur, join

  expandDepth++
  if (expandDepth > 100) {
    expandDepth--
    fail(c, lineNo, 'expansion recursion')
    return { spans: [], join: 0 }
  }

  spans = []
  cur = style || c.font
  join = 0
  at = 0

  while (at < text.length) {
    let ch

    ch = text[at]
    if (ch == '\\') {
      at++
      if (at >= text.length) {
        join = 1
        break
      }
      ch = text[at]
      at++
      if ((ch == '"') || (ch == '#'))
        break
      if (ch == 'c') {
        join = 1
        break
      }
      if (ch == 'p') {
        pushSpan(spans, { br: 1 })
        continue
      }
      if (ch == 'z')
        continue
      if (ch == 'f') {
        let name

        if (at >= text.length)
          name = ''
        else if (text[at] == '(') {
          name = text.slice(at + 1, at + 3)
          at += 3
        }
        else if (text[at] == '[') {
          let end

          end = text.indexOf(']', at)
          if (end < 0) {
            fail(c, lineNo, 'unterminated font escape')
            break
          }
          name = text.slice(at + 1, end)
          at = end + 1
        }
        else {
          name = text[at]
          at++
        }
        cur = resolveFont(c, name, cur, lineNo)
        continue
      }
      if (ch == '(') {
        let name, value

        name = text.slice(at, at + 2)
        at += 2
        value = Char.charOf(name)
        if (value == 0)
          fail(c, lineNo, 'character \\(' + name + ')', 'unknown')
        else
          pushSpan(spans, { text: trans(c, value), style: cur })
        continue
      }
      if (ch == '[') {
        let end, name, value

        end = text.indexOf(']', at)
        if (end < 0) {
          fail(c, lineNo, 'unterminated character escape')
          break
        }
        name = text.slice(at, end)
        at = end + 1
        value = Char.charOfBracket(name)
        if (value == 0)
          fail(c, lineNo, 'character \\[' + name + ']', 'unknown')
        else
          pushSpan(spans, { text: trans(c, value), style: cur })
        continue
      }
      if (ch == '*') {
        let found, sub

        found = stringNameOf(text, at - 1)
        at = found.at
        sub = expand(c, lookupString(c, found.name, lineNo), cur, lineNo)
        pushSpans(spans, sub.spans)
        if (sub.join)
          join = 1
        continue
      }
      if (ch == 'n') {
        let sign, found, val

        // `\n+[name]` steps the register and then prints it; `\n-[name]`
        // steps it down. A register with no increment does not move.
        sign = 0
        if ((text[at] == '+') || (text[at] == '-')) {
          sign = (text[at] == '+') ? 1 : -1
          at++
        }
        found = nameAfter(text, at)
        at = found.at
        if (sign && (found.name in c.reg))
          c.reg[found.name] = c.reg[found.name] +
                              (sign * (c.inc[found.name] || 0))
        val = registerValue(c, found.name, lineNo)
        pushSpan(spans, { text: String(val), style: cur })
        continue
      }
      if (ch == '$') {
        let val

        if ((text[at] == '@') || (text[at] == '*')) {
          val = frame(c)?.args?.join(' ') || ''
          at++
        }
        else if (text[at] == '(') {
          val = argOf(c, Number(text.slice(at + 1, at + 3)))
          at += 3
        }
        else {
          val = argOf(c, Number(text[at]))
          at++
        }
        pushSpans(spans, expand(c, val, cur, lineNo).spans)
        continue
      }
      if (ch == 's') {
        at = skipSize(text, at)
        continue
      }
      if (ch == 'w') {
        let end, inner, width

        end = skipArg(text, at)
        inner = unquote(text.slice(at, end))
        width = expandText(c, inner, lineNo).length * 24
        pushSpan(spans, { text: String(width), style: cur })
        at = end
        continue
      }
      if (ch == 'o') {
        let end, inner, first

        end = skipArg(text, at)
        inner = expandText(c, unquote(text.slice(at, end)), lineNo)
        first = inner.slice(0, 1)
        if (first.length)
          pushSpan(spans, { text: first, style: cur })
        at = end
        continue
      }
      if (ch == 'N') {
        let end, num, value

        end = skipArg(text, at)
        num = unquote(text.slice(at, end))
        value = Char.charByNumber(num)
        if (value == 0)
          fail(c, lineNo, 'character \\N' + num + "'", 'unknown')
        else
          pushSpan(spans, { text: value, style: cur })
        at = end
        continue
      }
      if (ch == 'h') {
        let end, inner, motion

        end = skipMotion(text, at)
        inner = unquote(text.slice(at, end))
        motion = Number.parseFloat(inner)
        if (inner.startsWith('|') || (motion > 0))
          pushSpan(spans, { text: ' ', style: cur })
        at = end
        continue
      }
      if ((ch == 'v') || (ch == 'S')) {
        at = skipValue(text, at)
        continue
      }
      if ((ch == 'F') || (ch == 'm') || (ch == 'M') || (ch == 'k')) {
        at = skipName(text, at)
        continue
      }
      if ((ch == 'u') || (ch == 'd'))
        continue
      if (ch in escapeChars) {
        pushSpan(spans, { text: trans(c, escapeChars[ch]), style: cur })
        continue
      }
      if (ch.charCodeAt(0) > 127) {
        pushSpan(spans, { text: ch, style: cur })
        continue
      }
      fail(c, lineNo, 'escape \\' + ch, 'unknown')
      continue
    }
    pushSpan(spans, { text: trans(c, ch), style: cur })
    at++
  }

  c.font = cur
  expandDepth--
  return { spans, join }
}

// A font name may be a built-in, a numeric position, a local alias set by
// .ftr, or empty (meaning the previous font).
function resolveFont
(c, name, cur, lineNo) {
  let font, alias

  if (name == '')
    return c.fontStack.pop() || 'roman'
  font = fonts[name]
  if (font) {
    c.fontStack.push(cur)
    return font
  }
  alias = c.ftr[name]
  if (alias == undefined) {
    fail(c, lineNo, 'font ' + name, 'unknown')
    return cur
  }
  font = fonts[alias]
  if (font) {
    c.fontStack.push(cur)
    return font
  }
  fail(c, lineNo, 'font ' + name, 'unknown')
  return cur
}

function expandText
(c, text, lineNo) {
  let saved, out

  saved = c.font
  out = textOf(expand(c, text, saved, lineNo).spans)
  c.font = saved
  return out
}

function box
(c) {
  return c.boxes[c.boxes.length - 1]
}

function trimSpans
(spans) {
  let last

  last = spans[spans.length - 1]
  if (last && (last.br == undefined)) {
    let at

    at = last.text.length
    while ((at > 0) && (last.text[at - 1] == ' '))
      at--
    last.text = last.text.slice(0, at)
    if (last.text == '')
      spans.pop()
  }
  // A break at the very end of a paragraph has no line left to end: the
  // paragraph already ends there, and groff prints no empty line for it.
  else if (last && (last.br == 1))
    spans.pop()
}

function closeParas
(c) {
  if (c.para)
    trimSpans(c.para.spans)
  c.para = 0
  c.syn = 0
}

function closeTag
(c) {
  closeParas(c)
  while (c.boxes.length > 1) {
    let last

    last = c.boxes[c.boxes.length - 1]
    if (last.kind == 'tag') {
      c.boxes.pop()
      continue
    }
    break
  }
  c.tag = 0
}

function addBlock
(c, block) {
  closeParas(c)
  box(c).blocks.push(block)
  return block
}

function paraOf
(c) {
  let p

  if (c.para)
    return c.para
  p = addBlock(c, { kind: 'para', spans: [] })
  c.para = p
  return p
}

// A `.br` leaves the output at the start of a fresh line, so the line after it
// is flush; only a line that follows text takes the separator space.
function afterBreak
(spans) {
  let last

  last = spans[spans.length - 1]
  return (last && (last.br == 1)) ? 1 : 0
}

function appendInline
(c, spans) {
  let target

  c.textOut = 1
  if (c.lineTarget)
    target = c.lineTarget
  else if (c.link)
    target = c.link.spans
  else
    target = paraOf(c).spans
  if ((c.mode == 'man') && c.atLineStart && (c.lineTarget == 0) &&
      (c.joinPrev == 0) && (target.length > 0) && (afterBreak(target) == 0) &&
      (spans[0] && (spans[0].br == undefined)))
    pushSpan(target, { text: ' ', style: c.font })
  c.atLineStart = 0
  pushSpans(target, spans)
}

// A `.br` ends the current output line. With no paragraph open there is no
// line yet, so it prints nothing at all rather than opening an empty one; a
// repeat straight after another break collapses in `pushSpan`.
function breakLine
(c) {
  let target

  if (c.lineTarget)
    target = c.lineTarget
  else if (c.link)
    target = c.link.spans
  else if (c.para)
    target = c.para.spans
  else
    return
  c.textOut = 1
  pushSpan(target, { br: 1 })
}

function addTextLine
(c, spans, join, joining) {
  let target

  c.textOut = 1
  if (c.pre) {
    if (c.pre.started)
      pushSpan(c.pre.spans, { text: '\n', style: 'roman' })
    pushSpans(c.pre.spans, spans)
    c.pre.started = 1
    return
  }
  if (c.lineTarget)
    target = c.lineTarget
  else if (c.link)
    target = c.link.spans
  else {
    target = paraOf(c).spans
    // The separator before this line depends only on the previous line's `\c`
    // (`joining`); this line's own trailing `\c` joins it to the next one.
    if ((target.length > 0) && (joining == 0) && (afterBreak(target) == 0))
      pushSpan(target, { text: ' ', style: c.font })
  }
  c.joinNext = join
  pushSpans(target, spans)
}

function startPre
(c, mono) {
  closeTag(c)
  c.pre = addBlock(c, { kind: 'pre', spans: [], mono: mono ? 1 : 0, started: 0 })
  c.fill = 0
}

function endPre
(c) {
  if (c.pre) {
    if (c.pre.spans.length == 0)
      c.pre.spans.push({ text: '', style: 'roman' })
    c.pre = 0
  }
  c.fill = 1
}

function splitArgs
(text) {
  let args, i, n

  args = []
  i = 0
  n = text.length
  while (i < n) {
    let arg, quote

    while ((i < n) && ((text[i] == ' ') || (text[i] == '\t')))
      i++
    if (i >= n)
      break
    quote = 0
    if (text[i] == '"') {
      quote = 1
      i++
    }
    arg = ''
    while (i < n) {
      if (text[i] == '\\') {
        arg += text[i]
        i++
        if (i < n)
          arg += text[i++]
        continue
      }
      if (quote) {
        if (text[i] == '"') {
          if (text[i + 1] == '"') {
            arg += '"'
            i += 2
            continue
          }
          i++
          break
        }
      }
      else if ((text[i] == ' ') || (text[i] == '\t'))
        break
      arg += text[i++]
    }
    args.push(arg)
  }
  return args
}

// Strip a comment to end of line: \" or \# outside an escaped backslash.
function stripComment
(text) {
  let i

  i = 0
  while (i < text.length) {
    if (text[i] == '\\') {
      if ((text[i + 1] == '"') || (text[i + 1] == '#'))
        return text.slice(0, i)
      i += 2
      continue
    }
    i++
  }
  return text
}

function copyMode
(text) {
  return text.replace(/\\\\/g, '\\').replace(/\\\./g, '.').replace(/\\ /g, ' ')
}

function valueAfter
(rest, name) {
  let after

  after = rest.slice(name.length).replace(/^[ \t]+/, '')
  if (after.startsWith('"'))
    after = after.slice(1)
  return after
}

// A line ending in an odd number of backslashes continues on the next line:
// the backslash and the newline are both removed. This happens before macro
// detection, so a continued macro argument can start with a dot.
function continues
(text) {
  let n

  n = 0
  // `\{\` opens a block here and the trailing backslash is not a
  // continuation: the block body starts on the next line.
  if (text.endsWith('\\{\\'))
    return 0
  while ((n < text.length) && (text[text.length - 1 - n] == '\\'))
    n++
  return (n % 2) ? 1 : 0
}

function nextInput
(c) {
  for (;;) {
    let f

    f = frame(c)
    if (f.at < f.lines.length) {
      let text

      text = f.lines[f.at].replace(/\r$/, '')
      f.at++
      while (continues(text) && (f.at < f.lines.length)) {
        text = text.slice(0, -1) + f.lines[f.at].replace(/\r$/, '')
        f.at++
      }
      return { text, line: f.line + f.at - 1 }
    }
    if (c.frames.length == 1)
      return 0
    c.frames.pop()
  }
}

// A definition ends at a control line whose name is the end name: `..`,
// `.END`, or the padded `.  .` that some generators emit.
function endsBlock
(text, endName) {
  if (text[0] == '.') {
    let after

    after = text.slice(1).replace(/^[ \t]+/, '')
    if ((after == '.') || (after == endName))
      return 1
  }
  return 0
}

function readBlockEnd
(c, endName, lineNo) {
  let lines

  lines = []
  while (c.frames.length) {
    let next

    next = nextInput(c)
    if (next == 0)
      break
    if (endsBlock(next.text, endName))
      return lines
    lines.push(next.text)
  }
  fail(c, lineNo, 'unterminated definition')
  return lines
}

function callMacro
(c, name, args, lineNo) {
  let body, real

  real = c.aliases[name] || name
  body = c.macros[real]
  if (body == undefined) {
    fail(c, lineNo, 'macro ' + name, 'unknown')
    return
  }
  if (body.length == 0)
    return
  if (c.frames.length > 80) {
    fail(c, lineNo, 'macro recursion')
    return
  }
  c.frames.push({ lines: body, at: 0, line: lineNo, args, name })
}

function braceDelta
(line) {
  let open, close

  open = line.split('\\{').length - 1
  close = line.split('\\}').length - 1
  return open - close
}

function skipBlock
(c, lineNo) {
  let depth

  depth = 1
  while (c.frames.length) {
    let next

    next = nextInput(c)
    if (next == 0)
      break
    depth += braceDelta(next.text)
    if (depth < 1)
      return
  }
  fail(c, lineNo, 'unterminated conditional block')
}

function skipSpace
(text, at) {
  while ((at < text.length) && ((text[at] == ' ') || (text[at] == '\t')))
    at++
  return at
}

function readNumber
(p) {
  let start, value

  start = p.at
  while ((p.at < p.text.length) && /[0-9.]/.test(p.text[p.at]))
    p.at++
  if (p.at == start)
    return NaN
  value = parseFloat(p.text.slice(start, p.at))
  while ((p.at < p.text.length) && /[a-zA-Z]/.test(p.text[p.at]))
    p.at++
  return value
}

function parseAtom
(p) {
  p.at = skipSpace(p.text, p.at)
  if (p.text[p.at] == '(') {
    let value

    p.at++
    value = parseOr(p)
    p.at = skipSpace(p.text, p.at)
    if (p.text[p.at] == ')')
      p.at++
    return value
  }
  if ((p.text[p.at] == '-') || (p.text[p.at] == '+')) {
    let sign

    sign = (p.text[p.at] == '-') ? -1 : 1
    p.at++
    return sign * parseAtom(p)
  }
  return readNumber(p)
}

function parseProduct
(p) {
  let value

  value = parseAtom(p)
  for (;;) {
    let op

    p.at = skipSpace(p.text, p.at)
    op = p.text[p.at]
    if ((op == '*') || (op == '/') || (op == '%')) {
      let rhs

      p.at++
      rhs = parseAtom(p)
      if (op == '*')
        value *= rhs
      else if (op == '/')
        value = (rhs == 0) ? 0 : value / rhs
      else
        value = (rhs == 0) ? 0 : value % rhs
      continue
    }
    break
  }
  return value
}

function parseSum
(p) {
  let value

  value = parseProduct(p)
  for (;;) {
    let op

    p.at = skipSpace(p.text, p.at)
    op = p.text[p.at]
    if ((op == '+') || (op == '-')) {
      let rhs

      p.at++
      rhs = parseProduct(p)
      value = (op == '+') ? (value + rhs) : (value - rhs)
      continue
    }
    break
  }
  return value
}

function parseCompare
(p) {
  let value

  value = parseSum(p)
  for (;;) {
    let op

    p.at = skipSpace(p.text, p.at)
    op = p.text[p.at]
    if ((op == '<') || (op == '>') || (op == '=')) {
      let rhs, second

      p.at++
      second = p.text[p.at]
      if (second == '=')
        p.at++
      rhs = parseSum(p)
      if (op == '<')
        value = (second == '=') ? ((value <= rhs) ? 1 : 0) : ((value < rhs) ? 1 : 0)
      else if (op == '>')
        value = (second == '=') ? ((value >= rhs) ? 1 : 0) : ((value > rhs) ? 1 : 0)
      else
        value = (value == rhs) ? 1 : 0
      continue
    }
    break
  }
  return value
}

function parseAnd
(p) {
  let value

  value = parseCompare(p)
  for (;;) {
    let op

    p.at = skipSpace(p.text, p.at)
    op = p.text[p.at]
    if (op == '&') {
      let rhs

      p.at++
      rhs = parseCompare(p)
      value = (value && rhs) ? 1 : 0
      continue
    }
    break
  }
  return value
}

function parseOr
(p) {
  let value

  value = parseAnd(p)
  for (;;) {
    let op

    p.at = skipSpace(p.text, p.at)
    op = p.text[p.at]
    if (op == ':') {
      let rhs

      p.at++
      rhs = parseAnd(p)
      value = (value || rhs) ? 1 : 0
      continue
    }
    break
  }
  return value
}

function evalExpr
(text) {
  let p, value

  p = { text, at: 0 }
  value = parseOr(p)
  p.at = skipSpace(p.text, p.at)
  if (p.at < p.text.length)
    return NaN
  return value
}

// Evaluate .if/.ie conditions. Anything not understood fails the page rather
// than guessing a branch.
function condition
(c, text, lineNo) {
  let cond, negate, expanded, m, rest

  cond = text.trim()
  negate = 0
  if (cond.startsWith('!')) {
    negate = 1
    cond = cond.slice(1).trim()
  }
  rest = cond.slice(1)
  if ((rest == '') && (cond == 'n'))
    return negate ? 0 : 1
  if ((rest == '') && (cond == 't'))
    return negate ? 1 : 0
  if ((rest == '') && (cond == 'v'))
    return negate ? 1 : 0
  if ((rest == '') && (cond == 'c'))
    // compatibility mode is off by default
    return negate ? 1 : 0
  if (cond[0] == 'd') {
    let name

    name = cond.slice(1).trim()
    if (name.length) {
      let found

      found = 0
      if (name in c.macros)
        found = 1
      if (name in c.str)
        found = 1
      if (name in c.reg)
        found = 1
      return negate ? (found ? 0 : 1) : (found ? 1 : 0)
    }
  }
  if (cond[0] == 'r') {
    let name

    name = cond.slice(1).trim()
    if (name.length) {
      let found

      found = 0
      if (name in c.reg)
        found = 1
      if (name in predefinedRegisters)
        found = 1
      return negate ? (found ? 0 : 1) : (found ? 1 : 0)
    }
  }

  c.condDepth++
  expanded = stripComment(expandText(c, cond, lineNo)).trim()
  c.condDepth--
  if (expanded == '')
    return negate ? 1 : 0
  m = expanded.match(/^'([^']*)'([^']*)'/)
  if (m == null)
    m = expanded.match(/^"([^"]*)"([^"]*)"/)
  if (m) {
    let same

    same = (m[1] == m[2]) ? 1 : 0
    return negate ? (same ? 0 : 1) : same
  }
  m = evalExpr(expanded)
  if (Number.isFinite(m) == 0) {
    fail(c, lineNo, 'condition ' + expanded, 'unknown')
    return negate ? 1 : 0
  }
  if (negate)
    return m ? 0 : 1
  return m ? 1 : 0
}

function setRegister
(c, name, value) {
  let n

  n = parseFloat(value)
  c.reg[name] = Number.isFinite(n) ? n : 0
}

// The step `\n+`/`\n-` applies. `.nr name value` without a third argument
// keeps the one already set (`.nr x 5 2` then `.nr x 10` steps by 2).
function setIncrement
(c, name, value) {
  let n

  n = parseFloat(value)
  c.inc[name] = Number.isFinite(n) ? n : 0
}

// A font macro's arguments as styled runs: `.BR a b` alternates bold and
// roman, `.B a b` prints every argument bold. The caller decides where the
// runs go, so a table cell can hold them without a paragraph.
function fontSpans
(c, styles, rest, lineNo) {
  let args, spans, saved, join, out, i

  args = splitArgs(rest)
  if (args.length == 0) {
    c.nextStyle = styles[0]
    return undefined
  }
  spans = []
  saved = c.font
  join = 0
  if (styles.length == 1) {
    out = expand(c, args.join(' '), styles[0], lineNo)
    pushSpans(spans, out.spans)
    join = out.join
  }
  else
    for (i = 0; i < args.length; i++) {
      out = expand(c, args[i], styles[i % styles.length], lineNo)
      pushSpans(spans, out.spans)
      join = out.join
    }
  c.font = saved
  return { spans, join }
}

function handleFont
(c, styles, rest, lineNo) {
  let out

  out = fontSpans(c, styles, rest, lineNo)
  if (out == undefined)
    return
  appendInline(c, out.spans)
  // `\c` at the end of the last argument continues the line, so the next
  // input line must not get a separating space (egrep(1)'s `\e n\c`).
  c.joinNext = out.join
}

function startTag
(c, indent, trap) {
  let tag

  closeTag(c)
  closeParas(c)
  tag = addBlock(c, { kind: 'tag', indent: indent || 1, tag: [], blocks: [] })
  c.tag = tag
  c.boxes.push(tag)
  if (trap)
    c.nextTarget = tag.tag
}

function startHeading
(c, level, spans) {
  let h

  h = { kind: 'heading', level, spans: [] }
  addBlock(c, h)
  pushSpans(h.spans, spans)
}

function linkEnd
(c, trailing) {
  let link, shown, spans, text, tail

  link = c.link
  if (link == undefined)
    return
  c.link = 0
  spans = link.spans
  text = textOf(spans)
  shown = link.shown || link.href
  if (text == '')
    // A link with no text would be invisible. A man reference shows its topic
    // (the renderer does the same for a bare span), everything else its URL.
    if (link.href.startsWith('man:'))
      spans = [ { text: link.href.slice(4), style: c.font, href: link.href } ]
    else
      spans = [ { text: '⟨' + shown + '⟩', style: c.font, href: link.href } ]
  else {
    spans.forEach(span => {
                    if (span.br == undefined)
                      span.href = link.href
                  })
    // an-ext prints the target after the link text as well, in angle brackets.
    spans.push({ text: ' ⟨' + shown + '⟩', style: c.font, href: link.href })
  }
  tail = trailing ? expand(c, trailing, c.font, c.lineNo) : { spans: [] }
  appendInline(c, spans.concat(tail.spans))
}

function synopsisStart
(c, args) {
  let p

  closeTag(c)
  p = addBlock(c, { kind: 'para', synopsis: 1, spans: [] })
  c.syn = p
  c.para = p
  if (args.length) {
    pushSpan(p.spans, { text: args[0], style: 'bold' })
    if (args[1])
      pushSpan(p.spans, { text: args[1], style: 'bold' })
  }
}

function define
(c, append, rest) {
  let args, name, end, body

  args = splitArgs(rest)
  name = args[0] || ''
  if (name == '')
    return
  end = args[1] || '..'
  body = readBlockEnd(c, end, c.lineNo)
  body = body.map(line => copyMode(line))
  if (append && c.macros[name])
    c.macros[name] = c.macros[name].concat(body)
  else
    c.macros[name] = body
}

function doString
(c, name, value, append) {
  if (name == '')
    return
  if (append)
    c.str[name] = (c.str[name] || '') + value
  else
    c.str[name] = value
}

function doTranslation
(c, rest, lineNo) {
  let args, from, i

  args = splitArgs(rest)
  if (args.length > 1) {
    let to

    from = expandText(c, args[0], lineNo)
    to = expandText(c, args[1], lineNo)
    for (i = 0; (i < from.length) && (i < to.length); i++)
      c.tr[from[i]] = to[i]
    return
  }
  from = expandText(c, rest, lineNo)
  i = 0
  while (i + 1 < from.length) {
    c.tr[from[i]] = from[i + 1]
    i += 2
  }
}

function controlOf
(line) {
  let first

  first = line[0]
  if ((first == '.') || (first == "'")) {
    let rest, cut, name

    rest = line.slice(1)
    if (rest.startsWith('\\"') || rest.startsWith('\\#'))
      return { comment: 1 }
    rest = rest.replace(/^[ \t]+/, '')
    if (rest.length == 0)
      return { blank: 1 }
    if (rest.startsWith('\\{') || rest.startsWith('\\}'))
      return { block: rest.slice(0, 2) }
    cut = rest.search(/[ \t\\]/)
    name = (cut < 0) ? rest : rest.slice(0, cut)
    if ((name.length == 0) || (name[0] == '.'))
      return { blank: 1 }
    return { name, rest: rest.slice(name.length) }
  }
  return 0
}

function splitCond
(rest) {
  let text, i

  text = rest.trim()
  i = 0
  while (i < text.length) {
    if (text[i] == '\\') {
      let next

      next = text[i + 1]
      if ((next == '{') || (next == '}'))
        break
      // A named character (`\[..]`, `\(..`) has no space in its name, so
      // skipping the two-character escape leaves the condition intact.
      i += 2
      continue
    }
    if ((text[i] == ' ') || (text[i] == '\t'))
      break
    i++
  }
  return { cond: text.slice(0, i), rest: text.slice(i).trim() }
}

// tbl(1): .TS, an optional options line ending in ';', a layout section ending
// in '.', data rows separated by a tab (or tab(x)), then .TE.
function tableOptions
(text) {
  let opts

  function takeTab
  (all, tab) {
    opts.tab = tab || '\t'
    return ' '
  }

  opts = { tab: '\t', box: 0, allbox: 0, center: 0, expand: 0 }
  // Options are separated by spaces, commas or semicolons, and tab(...) may
  // itself contain a space or a semicolon, so take it out before splitting.
  text = text.replace(/tab\s*\(([^)]*)\)/g, takeTab)
  text.split(/[\s,;]+/).forEach(piece => {
                                  if ((piece == 'box') || (piece == 'frame') || (piece == 'doublebox'))
                                    opts.box = 1
                                  else if (piece == 'allbox')
                                    opts.allbox = 1
                                  else if (piece == 'center')
                                    opts.center = 1
                                  else if (piece == 'expand')
                                    opts.expand = 1
                                })
  return opts
}

// tbl reads a format line character by character: a key character starts a
// column and the characters after it are that column's specifiers. Key
// characters and specifier letters never collide, so a page may glue them
// together. find(1) writes `ll` for two left columns and `llw(2i)` for two
// where the second has a width; syscalls(2) writes `Lw(26n)2 L Lx`. Each key
// character is one entry, so the `___` row xkeyboard-config.7 uses as a rule is
// three entries, not one. Only alignment, font, span and the rule marker change
// the text model; the rest of the specifiers are metric.
tableKeyChars = 'lcrnas'
tableRuleChars = '^_-='
tableSpecifiers = 'bdefimptuvwxz'

function tableParen
(text, at) {
  let depth

  depth = 1
  at++
  while (at < text.length) {
    if (text[at] == '(')
      depth++
    else if (text[at] == ')') {
      depth--
      if (depth == 0)
        return at + 1
    }
    at++
  }
  return at
}

function tableNumber
(text, at) {
  if ((text[at] == '+') || (text[at] == '-'))
    at++
  while ((at < text.length) && /[0-9.]/.test(text[at]))
    at++
  return at
}

function tableSpecify
(text, at, col) {
  while (at < text.length) {
    let ch

    ch = text[at].toLowerCase()
    if (/[0-9]/.test(text[at])) {
      at++
      continue
    }
    if (text[at] == '(') {
      at = tableParen(text, at)
      continue
    }
    if (tableSpecifiers.includes(ch) == 0)
      break
    at++
    if ((ch == 'b') && col)
      col.bold = 1
    else if ((ch == 'i') && col)
      col.italic = 1
    // A font or macro name is one or two letters, or a parenthesised name.
    else if (((ch == 'f') || (ch == 'm')) && (text[at] == '('))
      at = tableParen(text, at)
    else if (((ch == 'f') || (ch == 'm')) && (at < text.length))
      at++
    else if ((ch == 'w') && (text[at] == '('))
      at = tableParen(text, at)
    else if (ch == 'w')
      while ((at < text.length) && /[0-9]/.test(text[at]))
        at++
    else if ((ch == 'p') || (ch == 'v'))
      at = tableNumber(text, at)
  }
  return at
}

function tableColumns
(text) {
  let cols, at

  cols = []
  at = 0
  while (at < text.length) {
    let ch, col

    ch = text[at].toLowerCase()
    if (/[ \t,]/.test(text[at]) || (text[at] == '|')) {
      at++
      continue
    }
    if (text[at] == '\\') {
      // A format line holds only keys and specifiers, but skip a whole escape
      // or junk word rather than reading its letters as columns.
      while ((at < text.length) && (/[ \t]/.test(text[at]) == 0))
        at++
      continue
    }
    if (ch == 's') {
      col = { span: 1, rule: 0 }
      at = tableSpecify(text, at + 1, 0)
    }
    else if (tableKeyChars.includes(ch)) {
      col = { align: 'left', bold: 0, italic: 0, rule: 0 }
      if ('rn'.includes(ch))
        col.align = 'right'
      else if (ch == 'c')
        col.align = 'center'
      at = tableSpecify(text, at + 1, col)
    }
    else if (tableRuleChars.includes(ch)) {
      col = { rule: 0 }
      if (ch == '^')
        col.spanDown = 1
      else
        col.rule = 1
      at++
    }
    else {
      at++
      continue
    }
    cols.push(col)
  }
  return cols
}

// tbl's rule row: every entry is a horizontal rule and no data row belongs to
// it (xkeyboard-config.7 writes `lB lB` over `___` over `lB l.`).
function tableRuleRow
(cols) {
  let i

  if (cols.length == 0)
    return 0
  for (i = 0; i < cols.length; i++)
    if (cols[i].rule == 0)
      return 0
  return 1
}

// tbl passes a control line in a table body to roff, so a text macro inside a
// `T{ }` cell still runs and prints its arguments: ps(1) ends its %cpu cell
// with `.BR pcpu ).` and writes `.BR s ". (alias" \ s ).` in the state cell.
// A cell has no paragraph to append to, so the macro expands into the spans
// the cell holds. Only macros that print their arguments and nothing else are
// run; a request that draws nothing is dropped before the cell is built
// (tableRequest), and any other control line stays as the text it was rather
// than half-running roff.
manFontStyles = { B: [ 'bold' ],
                  I: [ 'italic' ],
                  SM: [ 'small' ],
                  SB: [ 'bold' ],
                  BI: [ 'bold', 'italic' ],
                  BR: [ 'bold', 'roman' ],
                  IB: [ 'italic', 'bold' ],
                  IR: [ 'italic', 'roman' ],
                  RB: [ 'roman', 'bold' ],
                  RI: [ 'roman', 'italic' ] }

// mdoc's inline text macros print only their arguments, so a cell can hold
// their expansion. A macro that opens a block, a link or a list is not here:
// it needs a line of its own, which a cell does not have.
tableCellMacros = { Nm: 1,
                    Xr: 1,
                    Fl: 1,
                    Ar: 1,
                    Cm: 1,
                    Ic: 1,
                    Cd: 1,
                    Fd: 1,
                    Ad: 1,
                    Em: 1,
                    Pa: 1,
                    Va: 1,
                    Vt: 1,
                    Fa: 1,
                    Sy: 1,
                    Li: 1,
                    Dv: 1,
                    No: 1,
                    Ev: 1,
                    Er: 1,
                    Ft: 1,
                    Lb: 1,
                    Tn: 1,
                    An: 1,
                    Sx: 1,
                    Ux: 1,
                    Bx: 1,
                    Fx: 1,
                    Nx: 1,
                    Ox: 1,
                    Dx: 1,
                    Bsx: 1,
                    At: 1,
                    St: 1 }

// The macro a cell line would run, with its arguments, if this model runs it
// there. The name is matched without expanding anything, so the caller can
// find a macro line before it decides how to build the cell.
function tableCellControl
(c, line) {
  let text, name, known

  if (line.startsWith('.') == 0)
    return undefined
  text = line.slice(1).replace(/^[ \t]+/, '')
  name = text.split(/[ \t\\]/)[0]
  known = (c.mode == 'man') ? manFontStyles[name] : tableCellMacros[name]
  if (known == undefined)
    return undefined
  return { name,
           rest: stripComment(text.slice(name.length).replace(/^[ \t]+/, '')) }
}

function tableCellMacro
(c, line, lineNo) {
  let control, out, saved

  control = tableCellControl(c, line)
  if (control == undefined)
    return undefined
  if (c.mode == 'man') {
    let args

    args = splitArgs(control.rest)
    // A font macro with no argument sets the font for the lines that follow.
    // A cell has no nextStyle step to carry that, so apply it to the cell.
    if (args.length == 0) {
      c.font = manFontStyles[control.name][0]
      return []
    }
    return fontSpans(c, manFontStyles[control.name], control.rest, lineNo).spans
  }
  out = []
  saved = c.lineTarget
  c.lineTarget = out
  mdocInlineMacro(c, control.name, splitArgs(control.rest), 1)
  c.lineTarget = saved
  return out
}

function tableCell
(c, text, lineNo) {
  let saved, lines, spans, control, i

  saved = c.font
  lines = text.split('\n')
  control = 0
  for (i = 0; i < lines.length; i++)
    if (tableCellControl(c, lines[i]))
      control = 1
  if (control == 0)
    spans = expand(c, text, saved, lineNo).spans
  else {
    let join

    spans = []
    join = 0
    for (i = 0; i < lines.length; i++) {
      let out

      // A `\c` at the end of the previous line joins it to this one without
      // taking the cell's newline.
      if ((i > 0) && (join == 0))
        pushSpan(spans, { text: '\n' })
      out = tableCellMacro(c, lines[i], lineNo)
      if (out == undefined) {
        let expanded

        expanded = expand(c, lines[i], c.font, lineNo)
        pushSpans(spans, expanded.spans)
        join = expanded.join
      }
      else {
        pushSpans(spans, out)
        join = 0
      }
    }
  }
  c.font = saved
  return { spans }
}

// tbl passes a control line in a table body through to roff instead of reading
// it as data, so a request that draws nothing is not a cell. Only a line whose
// first character is `.` is a request: groff prints an indented `  .sp` in the
// cell as data. A request that produces text (`.B`, `.IP`) still needs roff to
// run it, which this model does not do; the ones dropped here are the spacing
// and fill requests, of which mount(8) writes `.sp` at the top of every T{
// cell and ps(1) writes `.br` inside them.
tableRequests = { sp: 1, br: 1, nf: 1, fi: 1 }

function tableRequest
(line) {
  let name

  name = (line[0] == '.') ? line.slice(1) : ''
  name = name.replace(/^[ \t]+/, '').split(/[ \t\\]/)[0]
  return tableRequests[name] ? 1 : 0
}

function tableRows
(c, lines, tab, lineNo) {
  let rows, cells, multiline, buffer

  rows = []
  cells = []
  multiline = 0
  buffer = ''
  lines.forEach(line => {
                  let parts

                  if (tableRequest(line))
                    return
                  if (multiline) {
                    let cut

                    cut = line.indexOf('T}')
                    if (cut < 0) {
                      if (line.length)
                        buffer += (buffer.length ? '\n' : '') + line
                      return
                    }
                    if (cut > 0) {
                      let tail

                      tail = line.slice(0, cut).trim()
                      if (tail.length)
                        buffer += (buffer.length ? '\n' : '') + tail
                    }
                    cells.push(tableCell(c, buffer, lineNo))
                    buffer = ''
                    multiline = 0
                    // `T}` can close a cell and `T{` open the next one on the
                    // same tab-separated line, as the TIFF tables do.
                    line = line.slice(cut + 2).replace(/^[ \t]+/, '')
                    // The table's own separator between the two cells is not
                    // an empty cell of its own: mount(8) writes `T}:T{` in a
                    // tab(:) table, where the colon belongs to neither.
                    if (line.startsWith(tab))
                      line = line.slice(tab.length).replace(/^[ \t]+/, '')
                    if (line.trim() == '') {
                      rows.push(cells)
                      cells = []
                      return
                    }
                  }
                  if (line.trim() == '')
                    return
                  parts = line.split(tab)
                  for (let i = 0; i < parts.length; i++) {
                    let piece

                    piece = parts[i].trim()
                    if (piece == 'T{') {
                      multiline = 1
                      buffer = ''
                      break
                    }
                    cells.push(tableCell(c, piece, lineNo))
                  }
                  if (multiline == 0)
                    if (cells.length) {
                      rows.push(cells)
                      cells = []
                    }
                })
  return rows
}

function tableFit
(cells, cols) {
  let out, at

  out = []
  at = 0
  cols.forEach(col => {
                 if (col.span && out.length) {
                   out[out.length - 1].colspan = (out[out.length - 1].colspan || 1) + 1
                   return
                 }
                 out.push({ spans: (cells[at] || { spans: [] }).spans })
                 at++
               })
  while (at < cells.length) {
    let last

    last = out[out.length - 1]
    if (last) {
      pushSpan(last.spans, { text: ' ' })
      pushSpans(last.spans, cells[at].spans)
    }
    at++
  }
  return out
}

// The format section is one layout per table line, not one table. Each line is
// a row layout, the last one repeats for the remaining rows, and a line that is
// only rules draws a rule and owns no data row. A page may also run several
// layouts together on one line, separated by commas (tbl(1) writes `ln,an.`).
function tableLayouts
(lines, at) {
  let layouts

  layouts = []
  while (at < lines.length) {
    let line

    line = lines[at]
    at++
    if (line.trim().endsWith('.')) {
      layouts.push(...line.trim().slice(0, -1).split(','))
      break
    }
    layouts.push(...line.trim().split(','))
  }
  return { layouts, at }
}

// tbl applies the last format line to all remaining rows and assumes `l` for
// the descriptors missing at the end of a line, so a short row format still
// reaches every column of the table. The copy matters: two rows may share a
// layout, but each owns the list it was laid out with.
function tableRowCols
(body, row, ncols) {
  let cols

  cols = body.length ? body[(row < body.length) ? row : body.length - 1].slice() : []
  while (cols.length < ncols)
    cols.push({ align: 'left', bold: 0, italic: 0, rule: 0 })
  return cols
}

function tableBuild
(c, lines, lineNo) {
  let opts, parsed, ncols, body, cols, rows, at

  at = 0
  while ((at < lines.length) && (lines[at].trim() == ''))
    at++
  opts = tableOptions('')
  if ((at < lines.length) && lines[at].includes(';')) {
    opts = tableOptions(lines[at])
    at++
  }
  parsed = tableLayouts(lines, at)
  ncols = 0
  body = []
  parsed.layouts.forEach(text => {
                           let layout

                           layout = tableColumns(text)
                           if (layout.length > ncols)
                             ncols = layout.length
                           if (tableRuleRow(layout) == 0)
                             body.push(layout)
                         })
  // The block's own layout is the last body format, the one tbl repeats for the
  // remaining rows. Each row also records the layout it was fitted with.
  cols = body.length ? body[body.length - 1] : []
  while (cols.length < ncols)
    cols.push({ align: 'left', bold: 0, italic: 0, rule: 0 })
  rows = tableRows(c, lines.slice(parsed.at), opts.tab, lineNo)
  // tbl refuses a table with no column tokens in its format section ("no
  // format", "giving up on this table") and draws nothing, so there is no
  // layout to fall back on. Refuse the page instead of letting tableFit()
  // drop every cell; the words must not vanish from the model quietly.
  if ((ncols == 0) && rows.length)
    fail(c, lineNo, (parsed.layouts.join(' ').trim() == '') ? 'table with no format' : 'table format without columns')
  // A row is drawn by the layout it was fitted with, so a centred or bold
  // header holds that styling over a plain body.
  return { kind: 'table',
           options: opts,
           cols,
           rows: rows.map((cells, i) => {
                           let rowCols

                           rowCols = tableRowCols(body, i, ncols)
                           return { cells: tableFit(cells, rowCols), cols: rowCols }
                         }) }
}

// ---- mdoc(7) ------------------------------------------------------------
//
// mdoc is a different macro language: most macros are callable and nest
// (`.Op Fl a`), lists and displays are blocks, and the prologue is Dd/Dt/Os.
// It shares the escape engine, the block model and the requests (.de/.if/...)
// with man, but has its own macro semantics.

function mdocState
() {
  return { list: 0,
           lists: [],
           item: 0,
           pre: 0,
           preLine: 0,
           spaceNext: 0,
           tagMode: 0,
           section: '',
           docName: '',
           noSpace: 0,
           fn: 0,
           ref: 0,
           sm: 1,
           smPending: 0,
           opens: [],
           bfPrev: 0 }
}

function mdocAppend
(c, spans) {
  let para

  if (c.mdoc.pre) {
    if (c.mdoc.pre.started)
      if (c.mdoc.preLine) {
        if ((c.mdoc.noSpace == 0) &&
            (c.mdoc.spaceNext || c.mdoc.sm || c.mdoc.smPending))
          pushSpan(c.mdoc.pre.spans, { text: ' ' })
      }
      else
        pushSpan(c.mdoc.pre.spans, { text: '\n' })
    pushSpans(c.mdoc.pre.spans, spans)
    c.mdoc.pre.started = 1
    c.mdoc.noSpace = 0
    c.mdoc.spaceNext = 0
    c.mdoc.smPending = 0
    return
  }
  if (c.lineTarget) {
    mdocPush(c, c.lineTarget, spans)
    return
  }
  if (c.mdoc.tagMode && c.mdoc.item) {
    mdocPush(c, c.mdoc.item.tag, spans)
    return
  }
  para = paraOf(c).spans
  mdocPush(c, para, spans)
}

function mdocPush
(c, target, spans) {
  // `Sm off` drops the space between macro calls, but a line of ordinary
  // text still separates what follows it (mdoc(7) `Sm`). The first call after
  // `.Sm off` keeps its separator too: groff renders `.Cm a` / `.Sm off` /
  // `.Ar b` / `.Ar c` as "a bc", so the suppression starts with the second
  // call (`smPending`).
  if ((target.length > 0) && (c.mdoc.noSpace == 0) && (afterBreak(target) == 0) &&
      (c.mdoc.spaceNext || c.mdoc.sm || c.mdoc.smPending))
    pushSpan(target, { text: ' ' })
  pushSpans(target, spans)
  c.mdoc.noSpace = 0
  c.mdoc.spaceNext = 0
  c.mdoc.smPending = 0
}

function mdocAttach
(c, spans) {
  let para

  if (c.mdoc.pre) {
    pushSpans(c.mdoc.pre.spans, spans)
    c.mdoc.noSpace = 0
    c.mdoc.spaceNext = 0
    return
  }
  if (c.lineTarget) {
    pushSpans(c.lineTarget, spans)
    c.mdoc.noSpace = 0
    c.mdoc.spaceNext = 0
    return
  }
  if (c.mdoc.tagMode && c.mdoc.item) {
    pushSpans(c.mdoc.item.tag, spans)
    c.mdoc.noSpace = 0
    c.mdoc.spaceNext = 0
    return
  }
  para = paraOf(c).spans
  pushSpans(para, spans)
  c.mdoc.noSpace = 0
  c.mdoc.spaceNext = 0
}

function mdocExpand
(c, text, style) {
  let saved, spans

  saved = c.font
  spans = expand(c, text, style || c.font, c.lineNo).spans
  if (style)
    c.font = saved
  return spans
}

function mdocText
(c, text, style, role) {
  mdocAppend(c, setRole(mdocExpand(c, text, style), role))
}

function mdocAttachText
(c, text, style) {
  mdocAttach(c, mdocExpand(c, text, style))
}

mdocInlineNames = { Ap: 1,
                    An: 1,
                    Ao: 1,
                    Ac: 1,
                    Ar: 1,
                    At: 1,
                    Bo: 1,
                    Bc: 1,
                    Bq: 1,
                    Bx: 1,
                    Brq: 1,
                    Bro: 1,
                    Brc: 1,
                    Ad: 1,
                    Bsx: 1,
                    Cd: 1,
                    Cm: 1,
                    Fd: 1,
                    Dc: 1,
                    Do: 1,
                    Dq: 1,
                    Dv: 1,
                    Dx: 1,
                    Ec: 1,
                    Eo: 1,
                    Em: 1,
                    Er: 1,
                    Ev: 1,
                    Ex: 1,
                    Fa: 1,
                    Fc: 1,
                    Fl: 1,
                    Fn: 1,
                    Fo: 1,
                    Ft: 1,
                    Fx: 1,
                    Ic: 1,
                    In: 1,
                    Lb: 1,
                    Li: 1,
                    Lk: 1,
                    Mt: 1,
                    Nm: 1,
                    Nd: 1,
                    No: 1,
                    Ns: 1,
                    Nx: 1,
                    Oc: 1,
                    Oo: 1,
                    Op: 1,
                    Ox: 1,
                    Pa: 1,
                    Pc: 1,
                    Pf: 1,
                    Po: 1,
                    Pq: 1,
                    Ql: 1,
                    Qq: 1,
                    Qo: 1,
                    Qc: 1,
                    Rv: 1,
                    Sc: 1,
                    So: 1,
                    Sq: 1,
                    St: 1,
                    Sx: 1,
                    Sy: 1,
                    Ta: 1,
                    Tn: 1,
                    Ux: 1,
                    Va: 1,
                    Vt: 1,
                    Xc: 1,
                    Xo: 1,
                    Xr: 1,
                    Aq: 1 }

mdocNoArg = { Ns: 1, Ap: 1, Oc: 1, Pc: 1, Dc: 1, Ac: 1, Bc: 1, Sc: 1, Qc: 1, Brc: 1, Ta: 1 }

// Macros that enclose everything to the end of the current argument list:
// `.Op Fl e Ar file` is one group, and a nested call afterwards belongs
// inside it.
mdocEncloseNames = { Op: 1, Dq: 1, Qq: 1, Sq: 1, Ql: 1, Pq: 1, Bq: 1, Brq: 1, Aq: 1 }

function mdocPunct
(arg) {
  return ((arg.length == 1) && '.,;:!?)]'.includes(arg)) ? 1 : 0
}

function mdocSplitPunct
(args) {
  let at, punct

  at = args.length
  punct = []
  while ((at > 0) && mdocPunct(args[at - 1])) {
    at--
    punct.unshift(args[at])
  }
  return { words: args.slice(0, at), punct }
}

function mdocBar
(c, arg) {
  if (arg == '|')
    return 1
  if (arg.includes('\\') && (expandText(c, arg, c.lineNo) == '|'))
    return 1
  return 0
}

function mdocOpenPunct
(arg) {
  return ((arg.length == 1) && '(['.includes(arg)) ? 1 : 0
}

function mdocWords
(c, args, style, role) {
  args.forEach(arg => {
                 if (arg == '')
                   return
                 if (mdocPunct(arg))
                   mdocAttachText(c, arg, 'roman')
                 else if (mdocOpenPunct(arg)) {
                   mdocText(c, arg, 'roman')
                   c.mdoc.noSpace = 1
                 }
                 else
                   mdocText(c, arg, style, role)
               })
}

// mdoc parses a macro's arguments itself: a callable macro name ends the
// previous macro's arguments and starts a nested call. That is why
// `.Op Fl e Ar file` is "[-e file]" and not "[-e -Ar file]".
function mdocArgEnd
(c, args, at) {
  let end

  end = at + 1
  while ((end < args.length) && (mdocBar(c, args[end]) == 0) && (mdocPunct(args[end]) == 0))
    if (mdocInlineNames[args[end]] == undefined)
      end++
    else if ((args[end] == args[at]) && (end == at + 1))
      end++
    else
      break
  return end
}

function mdocInline
(c, args, ownLine) {
  let at

  at = 0
  while (at < args.length) {
    if (mdocInlineNames[args[at]]) {
      let end

      end = mdocArgEnd(c, args, at)
      if (mdocNoArg[args[at]])
        end = at + 1
      else if (mdocEncloseNames[args[at]])
        end = args.length
      mdocInlineMacro(c, args[at], args.slice(at + 1, end), ownLine)
      at = end
      continue
    }
    {
      let end, group

      end = at
      while ((end < args.length) && (mdocInlineNames[args[end]] == undefined))
        end++
      group = args.slice(at, end)
      mdocWords(c, group, c.font)
      at = end
    }
  }
}

function mdocEnclose
(c, args, open, close, ownLine) {
  let split

  split = mdocSplitPunct(args)
  mdocAppend(c, [ { text: open } ])
  c.mdoc.noSpace = 1
  if (split.words.length)
    mdocInline(c, split.words, ownLine)
  mdocAttach(c, [ { text: close } ])
  if (split.punct.length)
    mdocAttachText(c, split.punct.join(''), 'roman')
}

// `section` is the top-level `.Sh` heading, which is what mdoc's
// doc-in-synopsis-section tracks: a `.Ss` subsection does not clear it, so a
// declaration under `SYNOPSIS -> Ss` keeps its `;` (and a body `.Ss` titled
// SYNOPSIS does not gain one).
function mdocHeading
(c, level, args) {
  let spans

  closeParas(c)
  spans = expand(c, args.join(' '), 'bold', c.lineNo).spans
  if (level == 1)
    c.mdoc.section = textOf(spans)
  startHeading(c, level, spans)
}

function mdocListStart
(c, args) {
  let type, types

  // Only these name a list layout: `-offset`, `-compact` and friends are
  // options, so seeing one must not replace the type. `ssh_config(5)` writes
  // `.Bl -enum -offset indent -compact`, which used to end up a "compact"
  // list with no numbers.
  types = { bullet: 1,
            dash: 1,
            hyphen: 1,
            item: 1,
            enum: 1,
            tag: 1,
            diag: 1,
            hang: 1,
            ohang: 1,
            inset: 1,
            column: 1 }
  type = 'item'
  for (let i = 0; i < args.length; i++) {
    let arg

    arg = args[i]
    if ((arg == '-width') || (arg == '-offset'))
      i++
    else if (arg.startsWith('-')) {
      arg = arg.slice(1)
      if (types[arg])
        type = arg
    }
  }
  closeParas(c)
  c.mdoc.list = addBlock(c, { kind: 'list', listType: type, items: [] })
  c.mdoc.list.depth = c.boxes.length
  c.mdoc.lists.push(c.mdoc.list)
}

function mdocItemStart
(c, args) {
  let item, tagged

  c.mdoc.list = c.mdoc.lists[c.mdoc.lists.length - 1]
  if (c.mdoc.list == undefined) {
    fail(c, c.lineNo, 'It without Bl', 'unknown')
    return
  }
  closeParas(c)
  item = { kind: 'item', tag: [], blocks: [] }
  c.mdoc.list.items.push(item)
  c.mdoc.item = item
  c.boxes.push(item)
  c.mdoc.tagMode = 0
  tagged = ((c.mdoc.list.listType == 'tag') || (c.mdoc.list.listType == 'hang') ||
            (c.mdoc.list.listType == 'ohang') || (c.mdoc.list.listType == 'diag') ||
            (c.mdoc.list.listType == 'inset'))
  if (tagged) {
    if (args.length == 1 && (args[0] == 'Xo')) {
      c.mdoc.tagMode = 1
      return
    }
    c.lineTarget = item.tag
    mdocInline(c, args)
    c.lineTarget = 0
  }
  else if (args.length)
    mdocInline(c, args)
}

function mdocListEnd
(c) {
  closeParas(c)
  while (c.boxes.length > (c.mdoc.list ? c.mdoc.list.depth : 1))
    c.boxes.pop()
  c.mdoc.lists.pop()
  c.mdoc.list = c.mdoc.lists[c.mdoc.lists.length - 1] || 0
  c.mdoc.item = 0
  c.mdoc.tagMode = 0
}

function mdocDisplayStart
(c, args) {
  let literal

  literal = 0
  args.forEach(arg => {
                 if ((arg == '-literal') || (arg == '-unfilled'))
                   literal = 1
               })
  closeParas(c)
  if (literal) {
    c.mdoc.pre = addBlock(c, { kind: 'pre', spans: [], mono: 1, started: 0 })
    return
  }
  c.boxes.push(addBlock(c, { kind: 'group', indent: 1, blocks: [] }))
}

function mdocDisplayEnd
(c) {
  closeParas(c)
  if (c.mdoc.pre) {
    if (c.mdoc.pre.spans.length == 0)
      c.mdoc.pre.spans.push({ text: '', style: 'roman' })
    c.mdoc.pre = 0
    return
  }
  while (c.boxes.length > 1) {
    let last

    last = c.boxes.pop()
    if (last.kind == 'group')
      break
  }
}

function mdocDisplayOne
(c, args, literal) {
  closeParas(c)
  if (literal) {
    let pre, saved

    pre = addBlock(c, { kind: 'pre', spans: [], mono: 1, started: 0 })
    saved = c.mdoc.preLine
    c.mdoc.pre = pre
    c.mdoc.preLine = 1
    mdocInline(c, args, 1)
    c.mdoc.preLine = saved
    c.mdoc.pre = 0
    if (pre.spans.length == 0)
      pre.spans.push({ text: '', style: 'roman' })
    return
  }
  mdocInline(c, args, 1)
}

function mdocRefField
(c, key, args) {
  if (Array.isArray(c.mdoc.ref)) {
    if (args.length)
      c.mdoc.ref.push({ key, text: expandText(c, args.join(' '), c.lineNo) })
  }
  else
    mdocText(c, args.join(' '), c.font)
}

// mdoc prints the fields in its own order rather than the source order,
// joins authors with "and", quotes the title and finishes a reference with a
// period; the rest are comma separated.
function mdocRefText
(fields) {
  let authors, parts, quoted, refOrder, text

  refOrder = [ '%A', '%T', '%B', '%I', '%J', '%R', '%N', '%V', '%U',
               '%Q', '%C', '%D', '%O', '%P' ]
  authors = fields.filter(field => (field.key == '%A')).map(field => field.text)
  // Only an article title takes the curly quotes: §%T is the title of the
  // piece inside a %B book or a %J journal, and mdoc quotes it only when one
  // of those names the container. A bare RFC or manual title is left plain
  // (ssh(1)'s references, rpc_soc(3t)'s guides).
  quoted = 0
  for (let i = 0; i < fields.length; i++)
    if ((fields[i].key == '%B') || (fields[i].key == '%J'))
      quoted = 1
  parts = []
  for (let i = 0; i < refOrder.length; i++) {
    let key

    key = refOrder[i]
    if (key == '%A')
      continue
    for (let j = 0; j < fields.length; j++)
      if (fields[j].key == key)
        if ((key == '%T') && quoted)
          parts.push('“' + fields[j].text + '”')
        else
          parts.push(fields[j].text)
  }
  if (authors.length == 1)
    parts.unshift(authors[0])
  else if (authors.length == 2)
    parts.unshift(authors[0] + ' and ' + authors[1])
  else if (authors.length > 2)
    parts.unshift(authors.slice(0, -1).join(', ') + ', and ' +
                 authors[authors.length - 1])
  text = parts.join(', ')
  if (text.length && ('.,;:!?'.includes(text[text.length - 1]) == 0))
    text = text + '.'
  return text
}

// "a", "a and b", "a, b, and c": the joining the Ex/Rv sentences use.
function mdocJoin
(names) {
  if (names.length == 0)
    return ''
  if (names.length == 1)
    return names[0]
  if (names.length == 2)
    return names[0] + ' and ' + names[1]
  return names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1]
}

function mdocStandard
(token) {
  let names

  names = { '-ansiC': 'ANSI X3.159-1989 (“ANSI C89”)',
            '-isoC': 'ISO C',
            '-isoC99': 'ISO C99',
            '-posix': 'POSIX.1',
            '-p1003.1': 'POSIX.1',
            '-xpg4': 'XPG4',
            '-susv2': 'SUSv2',
            '-susv3': 'SUSv3',
            '-c99': 'ISO C99',
            '-ieee754': 'IEEE Std 754-1985' }
  return names[token] || token.replace(/^-/, '')
}

// `At`'s known versions, as groff -Tutf8 -mdoc prints them. An unknown
// version keeps its own text after the platform name: `.At v9` is
// "AT&T UNIX v9", and `.At` alone is "AT&T UNIX".
mdocAtNames = { v1: 'Version 1 AT&T UNIX',
                v2: 'Version 2 AT&T UNIX',
                v3: 'Version 3 AT&T UNIX',
                v4: 'Version 4 AT&T UNIX',
                v5: 'Version 5 AT&T UNIX',
                v6: 'Version 6 AT&T UNIX',
                v7: 'Version 7 AT&T UNIX',
                '32v': 'Version 32V AT&T UNIX',
                III: 'AT&T System III UNIX',
                V: 'AT&T System V UNIX',
                'V.1': 'AT&T System V Release 1 UNIX',
                'V.2': 'AT&T System V Release 2 UNIX',
                'V.3': 'AT&T System V Release 3 UNIX',
                'V.4': 'AT&T System V Release 4 UNIX' }

// `.Lb`'s table, from groff's doc-syms with its `\~`, `\-` and `\*[Px]`
// expansions applied: man(1) prints the description, never the argument.
// A name groff does not know is `library “name”` (doc-syms' Lq/Rq fallback).
mdocLbNames = { libarchive: 'Reading and Writing Streaming Archives Library (libarchive, -larchive)',
                libarm: 'ARM Architecture Library (libarm, -larm)',
                libarm32: 'ARM32 Architecture Library (libarm32, -larm32)',
                libbluetooth: 'Bluetooth Library (libbluetooth, -lbluetooth)',
                libbsm: 'Basic Security Module Library (libbsm, -lbsm)',
                libc: 'Standard C Library (libc, -lc)',
                libc_r: 'Reentrant C Library (libc_r, -lc_r)',
                libcalendar: 'Calendar Arithmetic Library (libcalendar, -lcalendar)',
                libcam: 'Common Access Method User Library (libcam, -lcam)',
                libcdk: 'Curses Development Kit Library (libcdk, -lcdk)',
                libcipher: 'FreeSec Crypt Library (libcipher, -lcipher)',
                libcompat: 'Compatibility Library (libcompat, -lcompat)',
                libcrypt: 'Crypt Library (libcrypt, -lcrypt)',
                libcurses: 'Curses Library (libcurses, -lcurses)',
                libdevinfo: 'Device and Resource Information Utility Library (libdevinfo, -ldevinfo)',
                libdevstat: 'Device Statistics Library (libdevstat, -ldevstat)',
                libdisk: 'Interface to Slice and Partition Labels Library (libdisk, -ldisk)',
                libdwarf: 'DWARF Access Library (libdwarf, -ldwarf)',
                libedit: 'Command Line Editor Library (libedit, -ledit)',
                libelf: 'ELF Access Library (libelf, -lelf)',
                libevent: 'Event Notification Library (libevent, -levent)',
                libfetch: 'File Transfer Library for URLs (libfetch, -lfetch)',
                libform: 'Curses Form Library (libform, -lform)',
                libgeom: 'Userland API Library for kernel GEOM subsystem (libgeom, -lgeom)',
                libgpib: 'General-Purpose Instrument Bus (GPIB) library (libgpib, -lgpib)',
                libi386: 'i386 Architecture Library (libi386, -li386)',
                libintl: 'Internationalized Message Handling Library (libintl, -lintl)',
                libipsec: 'IPsec Policy Control Library (libipsec, -lipsec)',
                libipx: 'IPX Address Conversion Support Library (libipx, -lipx)',
                libiscsi: 'iSCSI protocol library (libiscsi, -liscsi)',
                libjail: 'Jail Library (libjail, -ljail)',
                libkiconv: 'Kernel side iconv library (libkiconv, -lkiconv)',
                libkse: 'N:M Threading Library (libkse, -lkse)',
                libkvm: 'Kernel Data Access Library (libkvm, -lkvm)',
                libm: 'Math Library (libm, -lm)',
                libm68k: 'm68k Architecture Library (libm68k, -lm68k)',
                libmagic: 'Magic Number Recognition Library (libmagic, -lmagic)',
                libmd: 'Message Digest (MD4, MD5, etc.) Support Library (libmd, -lmd)',
                libmemstat: 'Kernel Memory Allocator Statistics Library (libmemstat, -lmemstat)',
                libmenu: 'Curses Menu Library (libmenu, -lmenu)',
                libnetgraph: 'Netgraph User Library (libnetgraph, -lnetgraph)',
                libnetpgp: 'Netpgp signing, verification, encryption and decryption (libnetpgp, -lnetpgp)',
                libossaudio: 'OSS Audio Emulation Library (libossaudio, -lossaudio)',
                libpam: 'Pluggable Authentication Module Library (libpam, -lpam)',
                libpcap: 'Packet Capture Library (libpcap, -lpcap)',
                libpci: 'PCI Bus Access Library (libpci, -lpci)',
                libpmc: 'Performance Counters Library (libpmc, -lpmc)',
                libposix: 'POSIX Compatibility Library (libposix, -lposix)',
                libprop: 'Property Container Object Library (libprop, -lprop)',
                libpthread: 'POSIX Threads Library (libpthread, -lpthread)',
                libpuffs: 'puffs Convenience Library (libpuffs, -lpuffs)',
                librefuse: 'File System in Userspace Convenience Library (librefuse, -lrefuse)',
                libresolv: 'DNS Resolver Library (libresolv, -lresolv)',
                librpcsec_gss: 'RPC GSS-API Authentication Library (librpcsec_gss, -lrpcsec_gss)',
                librpcsvc: 'RPC Service Library (librpcsvc, -lrpcsvc)',
                librt: 'POSIX Real-time Library (librt, -lrt)',
                libsdp: 'Bluetooth Service Discovery Protocol User Library (libsdp, -lsdp)',
                libssp: 'Buffer Overflow Protection Library (libssp, -lssp)',
                libSystem: 'System Library (libSystem, -lSystem)',
                libtermcap: 'Termcap Access Library (libtermcap, -ltermcap)',
                libterminfo: 'Terminal Information Library (libterminfo, -lterminfo)',
                libthr: '1:1 Threading Library (libthr, -lthr)',
                libufs: 'UFS File System Access Library (libufs, -lufs)',
                libugidfw: 'File System Firewall Interface Library (libugidfw, -lugidfw)',
                libulog: 'User Login Record Library (libulog, -lulog)',
                libusbhid: 'USB Human Interface Devices Library (libusbhid, -lusbhid)',
                libutil: 'System Utilities Library (libutil, -lutil)',
                libvgl: 'Video Graphics Library (libvgl, -lvgl)',
                libx86_64: 'x86_64 Architecture Library (libx86_64, -lx86_64)',
                libz: 'Compression Library (libz, -lz)' }

// The platform macros print their name and then, in the same font, any
// version or further words: `.Ox 3.2` is "OpenBSD 3.2" and `.Ox 3.2 .` is
// "OpenBSD 3.2.".
function mdocOsName
(c, name, args) {
  mdocText(c, name, c.font)
  mdocWords(c, args, c.font)
}

// `ownLine` is set when the macro is the request itself, or a `.Dl`/`.D1`
// line (mdoc treats their arguments as a line of their own): mdoc(7) prints
// the delimiter macros with Unicode brackets there and ASCII ones when they
// are an argument of another macro (`.An Name Aq address`).
function mdocInlineMacro
(c, name, args, ownLine) {
  switch (name) {
  case 'Nm': {
    let shown, split, style

    // A bare `.Nm` prints the document name: the first `.Nm` that has an
    // argument, which mdoc calls `doc-command-name` and never overwrites
    // (doc.tmac sets it only while it is empty). A later `.Nm` with an
    // argument prints that argument but leaves the document name alone.
    split = mdocSplitPunct(args)
    if (split.words.length == 0)
      shown = (c.mdoc.docName == '') ? [] : [ c.mdoc.docName ]
    else {
      if (c.mdoc.docName == '')
        c.mdoc.docName = split.words[0]
      shown = split.words
    }
    style = (c.mdoc.section == 'SYNOPSIS') ? 'bold' : c.font
    shown.forEach(arg => mdocText(c, arg, style, 'nm'))
    if (split.punct.length)
      mdocAttachText(c, split.punct.join(''), 'roman')
    return 1
  }
  case 'Nd':
    mdocAppend(c, [ { text: '—' } ])
    mdocText(c, args.join(' '), c.font)
    return 1
  case 'Xr': {
    let topic, section, trailing

    // The name is a word like any other: init-d-script(5) writes
    // `.Xr start\-stop\-daemon 8 .`, and groff prints "start-stop-daemon(8)".
    topic = expandText(c, args[0] || '', c.lineNo)
    section = (args[1] && /^[0-9]/.test(args[1])) ? args[1] : ''
    trailing = args.slice(section ? 2 : 1).join('')
    mdocAppend(c, [ { text: topic + (section ? '(' + section + ')' : ''),
                      style: c.font,
                      href: 'man:' + topic + (section ? '(' + section + ')' : ''),
                      role: 'xr' } ])
    if (trailing)
      mdocAttachText(c, trailing, 'roman')
    return 1
  }
  case 'In': {
    let split, synopsis

    // mdoc(7): the SYNOPSIS prints `#include <header>` in bold; a body
    // section prints `<header>` in italic. The header text is verbatim.
    synopsis = (c.mdoc.section == 'SYNOPSIS')
    split = mdocSplitPunct(args)
    mdocAppend(c, [ { text: (synopsis ? '#include ' : '') + '<' +
                           split.words.join(' ') + '>',
                      style: (synopsis ? 'bold' : 'italic'),
                      role: 'in' } ])
    if (split.punct.length)
      mdocAttachText(c, split.punct.join(''), 'roman')
    return 1
  }
  case 'Fl': {
    let split

    split = mdocSplitPunct(args)
    if (split.words.length == 0)
      mdocText(c, '-', 'bold', 'fl')
    else if (split.words[0] == 'Fl')
      mdocText(c, '--' + split.words.slice(1).join('-'), 'bold', 'fl')
    else
      split.words.forEach(arg => mdocText(c, '-' + arg, 'bold', 'fl'))
    if (split.punct.length)
      mdocAttachText(c, split.punct.join(''), 'roman')
    return 1
  }
  case 'Ar':
    if (args.length == 0)
      mdocText(c, 'file ...', 'italic', 'ar')
    else
      mdocWords(c, args, 'italic', 'ar')
    return 1
  case 'Cm':
  case 'Ic':
  case 'Cd':
  case 'Fd':
    mdocWords(c, args, 'bold', name.toLowerCase())
    return 1
  case 'Ad':
    mdocWords(c, args, 'italic', 'ad')
    return 1
  case 'Bsx':
    mdocText(c, 'BSD/OS', c.font)
    if (args.length)
      mdocWords(c, args, c.font)
    return 1
  case 'Em':
  case 'Pa':
  case 'Va':
  case 'Vt':
    mdocWords(c, args, 'italic', name.toLowerCase())
    return 1
  case 'Fa':
    if (c.mdoc.fn) {
      if (c.mdoc.fn > 1)
        mdocAttach(c, [ { text: ',', style: 'roman' } ])
      c.mdoc.fn++
    }
    mdocWords(c, args, 'italic', 'fa')
    return 1
  case 'Sy':
    mdocWords(c, args, 'bold', 'sy')
    return 1
  case 'Li':
  case 'Dv':
    mdocWords(c, args, 'mono', name.toLowerCase())
    return 1
  case 'No':
  case 'Ev':
  case 'Er':
  case 'Ft':
    mdocWords(c, args, c.font, name.toLowerCase())
    return 1
  case 'Lb': {
    let lib

    lib = mdocLbNames[args[0]] ||
          ((args[0] || '') ? 'library “' + args[0] + '”' : '')
    if (lib.length)
      mdocAppend(c, [ { text: lib, style: c.font, role: 'lb' } ])
    // Only the first argument names a library: `.Lb libc libm` prints the
    // libc description and then "libm" as a plain word.
    if (args.length > 1)
      mdocWords(c, args.slice(1), c.font, 'lb')
    return 1
  }
  case 'Tn':
    mdocWords(c, args, 'small', 'tn')
    return 1
  case 'An': {
    let names

    names = args.filter(arg => (arg[0] == '-') ? 0 : 1)
    mdocWords(c, names, c.font, 'an')
    return 1
  }
  case 'Ap':
    mdocAttach(c, [ { text: "'" } ])
    c.mdoc.noSpace = 1
    return 1
  case 'Lk': {
    let url, text

    url = args[0] || ''
    text = args.slice(1).join(' ')
    mdocAppend(c, [ { text: text || url, style: c.font, href: url, role: 'lk' } ])
    return 1
  }
  case 'Mt': {
    let addr

    addr = args[0] || ''
    mdocAppend(c, [ { text: addr,
                      style: c.font,
                      href: 'mailto:' + addr,
                      role: 'mt' } ])
    return 1
  }
  case 'Sx':
    mdocWords(c, args, 'bold', 'sx')
    return 1
  case 'Fn': {
    let fn

    fn = args[0] || ''
    mdocAppend(c, [ { text: fn, style: 'bold', role: 'fn' },
                    { text: '(', style: 'roman' } ])
    if (args.length > 1)
      mdocAttach(c, setRole(mdocExpand(c, args.slice(1).join(', '), 'italic'),
                            'fa'))
    mdocAttach(c, [ { text: ')', style: 'roman' } ])
    // Like `.Fc`, a `.Fn` declaration in a SYNOPSIS ends with a semicolon:
    // `.Ft int` / `.Fn other "char *y" "int z"` prints
    // `int other(char *y, int z);`. A body section prints it without.
    if (c.mdoc.section == 'SYNOPSIS')
      mdocAttach(c, [ { text: ';', style: 'roman' } ])
    return 1
  }
  case 'Fo':
    mdocAppend(c, [ { text: args[0] || '', style: 'bold', role: 'fn' },
                    { text: '(', style: 'roman' } ])
    c.mdoc.noSpace = 1
    c.mdoc.fn = 1
    return 1
  case 'Fc':
    // `.Fc` closes the declaration and, in a SYNOPSIS, ends it with a
    // semicolon: `.Fo crypt_checksalt` / `.Fa "const char *setting"` / `.Fc`
    // prints `crypt_checksalt(const char *setting);`.  In a body groff prints
    // the same declaration without the semicolon.
    mdocAttach(c, [ { text: ')', style: 'roman' } ])
    if (c.mdoc.section == 'SYNOPSIS')
      mdocAttach(c, [ { text: ';', style: 'roman' } ])
    c.mdoc.fn = 0
    return 1
  case 'Pf':
    if (args.length)
      mdocAppend(c, expand(c, args[0], c.font, c.lineNo).spans)
    c.mdoc.noSpace = 1
    if (args.length > 1)
      mdocInline(c, args.slice(1), ownLine)
    return 1
  case 'Ns':
    c.mdoc.noSpace = 1
    return 1
  case 'Ta':
    mdocAppend(c, [ { text: ' ' } ])
    return 1
  case 'Ux':
    mdocOsName(c, 'UNIX', args)
    return 1
  case 'At': {
    let known

    known = mdocAtNames[args[0]]
    if (known) {
      mdocText(c, known, c.font)
      mdocWords(c, args.slice(1), c.font)
    }
    else
      mdocOsName(c, 'AT&T UNIX', args)
    return 1
  }
  case 'Bx': {
    let split

    split = mdocSplitPunct(args)
    if (split.words.length)
      mdocText(c, split.words[0] + 'BSD', c.font)
    else
      mdocText(c, 'BSD', c.font)
    mdocWords(c, split.words.slice(1), c.font)
    if (split.punct.length)
      mdocAttachText(c, split.punct.join(''), 'roman')
    return 1
  }
  case 'Fx':
    mdocOsName(c, 'FreeBSD', args)
    return 1
  case 'Nx':
    mdocOsName(c, 'NetBSD', args)
    return 1
  case 'Ox':
    mdocOsName(c, 'OpenBSD', args)
    return 1
  case 'Dx':
    mdocOsName(c, 'DragonFly', args)
    return 1
  case 'St':
    mdocText(c, mdocStandard(args[0] || ''), c.font)
    return 1
  // The canned sentences mdoc(7) emits, but only with `-std`: without the
  // flag the macro expands to nothing. With no names `Ex` falls back to the
  // document name, not the most recent `.Nm` (groff: `.Nm first` ... `.Nm
  // second` ... `.Ex -std` says "The first utility ...").
  case 'Ex': {
    let names, subject, verb

    if (args.includes('-std') == 0)
      return 1

    names = args.filter(arg => (arg[0] == '-') ? 0 : 1)
    if ((names.length == 0) && c.mdoc.docName)
      names = [ c.mdoc.docName ]
    subject = mdocJoin(names)
    if (subject.length == 0)
      subject = 'utility'
    else
      subject = subject + ((names.length > 1) ? ' utilities' : ' utility')
    verb = (names.length > 1) ? 'exit' : 'exits'
    mdocText(c, 'The ' + subject + ' ' + verb +
             ' 0 on success, and >0 if an error occurs.', c.font)
    return 1
  }
  case 'Rv': {
    let names

    if (args.includes('-std') == 0)
      return 1
    names = args.filter(arg => (arg[0] == '-') ? 0 : 1)
    if (names.length == 0)
      mdocText(c, 'Upon successful completion, the value 0 is returned; ' +
                  'otherwise the value -1 is returned and the global ' +
                  'variable errno is set to indicate the error.', c.font)
    else
      mdocText(c, 'The ' + mdocJoin(names.map(fn => fn + '()')) +
               ((names.length > 1) ? ' functions return' : ' function returns') +
               ' the value 0 if successful; otherwise the value -1 is ' +
               'returned and the global variable errno is set to indicate ' +
               'the error.', c.font)
    return 1
  }
  case 'Op':
    mdocEnclose(c, args, '[', ']', ownLine)
    return 1
  case 'Dq':
    mdocEnclose(c, args, '“', '”', ownLine)
    return 1
  case 'Qq':
    mdocEnclose(c, args, '"', '"', ownLine)
    return 1
  case 'Sq':
    mdocEnclose(c, args, '‘', '’', ownLine)
    return 1
  case 'Ql': {
    let split

    split = mdocSplitPunct(args)
    mdocAppend(c, [ { text: '‘' } ])
    c.mdoc.noSpace = 1
    if (split.words.length)
      mdocWords(c, split.words, 'mono')
    mdocAttach(c, [ { text: '’' } ])
    if (split.punct.length)
      mdocAttachText(c, split.punct.join(''), 'roman')
    return 1
  }
  case 'Pq':
    mdocEnclose(c, args, '(', ')', ownLine)
    return 1
  case 'Bq':
    mdocEnclose(c, args, '[', ']', ownLine)
    return 1
  case 'Brq':
    mdocEnclose(c, args, '{', '}', ownLine)
    return 1
  case 'Aq':
    mdocEnclose(c, args, ownLine ? '⟨' : '<', ownLine ? '⟩' : '>', ownLine)
    return 1
  case 'Oo':
    c.mdoc.opens.push(']')
    mdocAppend(c, [ { text: '[' } ])
    c.mdoc.noSpace = 1
    if (args.length)
      mdocInline(c, args, ownLine)
    return 1
  case 'Oc':
    mdocAttach(c, [ { text: c.mdoc.opens.pop() || ']' } ])
    return 1
  case 'Po':
    c.mdoc.opens.push(')')
    mdocAppend(c, [ { text: '(' } ])
    c.mdoc.noSpace = 1
    if (args.length)
      mdocInline(c, args, ownLine)
    return 1
  case 'Pc':
    mdocAttach(c, [ { text: c.mdoc.opens.pop() || ')' } ])
    return 1
  case 'Do':
    c.mdoc.opens.push('”')
    mdocAppend(c, [ { text: '“' } ])
    c.mdoc.noSpace = 1
    if (args.length)
      mdocInline(c, args, ownLine)
    return 1
  case 'Dc':
    mdocAttach(c, [ { text: c.mdoc.opens.pop() || '”' } ])
    return 1
  case 'Ao':
    c.mdoc.opens.push(ownLine ? '⟩' : '>')
    mdocAppend(c, [ { text: ownLine ? '⟨' : '<' } ])
    c.mdoc.noSpace = 1
    if (args.length)
      mdocInline(c, args, ownLine)
    return 1
  case 'Ac':
    mdocAttach(c, [ { text: c.mdoc.opens.pop() || '⟩' } ])
    return 1
  case 'Bo':
    c.mdoc.opens.push(']')
    mdocAppend(c, [ { text: '[' } ])
    c.mdoc.noSpace = 1
    if (args.length)
      mdocInline(c, args, ownLine)
    return 1
  case 'Bc':
    mdocAttach(c, [ { text: c.mdoc.opens.pop() || ']' } ])
    return 1
  case 'Bro':
    c.mdoc.opens.push('}')
    mdocAppend(c, [ { text: '{' } ])
    c.mdoc.noSpace = 1
    if (args.length)
      mdocInline(c, args, ownLine)
    return 1
  case 'Brc':
    mdocAttach(c, [ { text: c.mdoc.opens.pop() || '}' } ])
    return 1
  case 'Qo':
    c.mdoc.opens.push('”')
    mdocAppend(c, [ { text: '“' } ])
    c.mdoc.noSpace = 1
    if (args.length)
      mdocInline(c, args, ownLine)
    return 1
  case 'Qc':
    mdocAttach(c, [ { text: c.mdoc.opens.pop() || '”' } ])
    return 1
  case 'Eo': {
    let open

    open = args[0] || ''
    c.mdoc.opens.push('')
    if (open.length)
      mdocAppend(c, mdocExpand(c, open, c.font))
    c.mdoc.noSpace = 1
    if (args.length > 1)
      mdocInline(c, args.slice(1), ownLine)
    return 1
  }
  case 'Ec': {
    let close

    close = c.mdoc.opens.pop() || ''
    mdocAttach(c, [ { text: args[0] || close } ])
    return 1
  }
  case 'So':
    c.mdoc.opens.push('’')
    mdocAppend(c, [ { text: '‘' } ])
    c.mdoc.noSpace = 1
    if (args.length)
      mdocInline(c, args, ownLine)
    return 1
  case 'Sc':
    mdocAttach(c, [ { text: c.mdoc.opens.pop() || '’' } ])
    return 1
  case 'Xo':
    c.mdoc.tagMode = 1
    if (args.length)
      mdocInline(c, args, ownLine)
    return 1
  case 'Xc':
    c.mdoc.tagMode = 0
    return 1
  }
}

function mdocLine
(c, control) {
  let name, rest, args

  name = control.name
  rest = stripComment((control.rest || '').replace(/^[ \t]+/, ''))
  args = splitArgs(rest)

  switch (name) {
  case 'Dd':
    c.doc.date = expandText(c, args.join(' '), c.lineNo)
    return 1
  case 'Dt':
    c.doc.title = args[0] || ''
    c.doc.section = args[1] || ''
    return 1
  case 'Os':
    c.doc.source = expandText(c, args.join(' '), c.lineNo)
    return 1
  case 'Sh':
    mdocHeading(c, 1, args)
    return 1
  case 'Ss':
    mdocHeading(c, 2, args)
    return 1
  case 'Pp':
    closeParas(c)
    return 1
  case 'Bl':
    mdocListStart(c, args)
    return 1
  case 'It':
    mdocItemStart(c, args)
    return 1
  case 'El':
    mdocListEnd(c)
    return 1
  case 'Bd':
    mdocDisplayStart(c, args)
    return 1
  case 'Ed':
    mdocDisplayEnd(c)
    return 1
  case 'D1':
    mdocDisplayOne(c, args, 0)
    return 1
  case 'Dl':
    mdocDisplayOne(c, args, 1)
    return 1
  case 'Rs':
    c.mdoc.ref = []
    return 1
  case 'Re':
    if (c.mdoc.ref && c.mdoc.ref.length)
      mdocText(c, mdocRefText(c.mdoc.ref), c.font)
    c.mdoc.ref = 0
    return 1
  case '%A':
  case '%B':
  case '%C':
  case '%D':
  case '%I':
  case '%J':
  case '%N':
  case '%O':
  case '%P':
  case '%Q':
  case '%R':
  case '%T':
  case '%U':
  case '%V':
    mdocRefField(c, name, args)
    return 1
  case 'Tg':
    return 1
  case 'Sm':
    if (args[0] == 'off') {
      // Only a transition hands the first following call its separator back;
      // a repeated `.Sm off` must not.
      c.mdoc.smPending = c.mdoc.sm
      c.mdoc.sm = 0
    }
    else {
      c.mdoc.sm = 1
      c.mdoc.smPending = 0
    }
    return 1
  case 'Bk':
  case 'Ek':
    return 1
  case 'Bf':
    c.mdoc.bfPrev = c.font
    c.font = (args[0] == '-literal') ? 'mono' :
             (args[0] == '-emphasis') ? 'italic' :
             (args[0] == '-symbolic') ? 'bold' : 'roman'
    return 1
  case 'Ef':
    c.font = c.mdoc.bfPrev || 'roman'
    return 1
  default:
    if (name == 'Ao') {
      mdocInlineMacro(c, name, args, 1)
      return 1
    }
    if (mdocEncloseNames[name]) {
      mdocInlineMacro(c, name, args, 1)
      return 1
    }
    if (mdocNoArg[name]) {
      mdocInlineMacro(c, name, [])
      if (args.length)
        mdocInline(c, args)
      return 1
    }
    if (mdocInlineNames[name]) {
      mdocInline(c, [ name, ...args ])
      return 1
    }
    return 0
  }
}

function handleLine
(c, control, style) {
  let name, rest, args

  name = control.name
  if (c.mode == 'mdoc')
    if (mdocLine(c, control))
      return
  rest = stripComment((control.rest || '').replace(/^[ \t]+/, ''))
  args = splitArgs(rest)

  switch (name) {
  case 'TH':
    c.doc.title = expandText(c, args[0] || '', c.lineNo)
    c.doc.section = expandText(c, args[1] || '', c.lineNo)
    c.doc.date = expandText(c, args[2] || '', c.lineNo)
    c.doc.source = expandText(c, args[3] || '', c.lineNo)
    break
  case 'SH':
  case 'SS':
    if (args.length == 0)
      c.nextHeading = (name == 'SH') ? 1 : 2
    else
      startHeading(c, (name == 'SH') ? 1 : 2, expand(c, args.join(' '), style, c.lineNo).spans)
    break
  case 'PP':
  case 'LP':
  case 'P':
    closeTag(c)
    closeParas(c)
    break
  case 'TP':
  case 'TQ':
    startTag(c, parseFloat(args[0]) || 1, 1)
    break
  case 'IP': {
    if ((args[0] || '') == '') {
      closeTag(c)
      closeParas(c)
    }
    else {
      startTag(c, parseFloat(args[1]) || 1, 0)
      if (c.tag)
        pushSpans(c.tag.tag, expand(c, args[0], style, c.lineNo).spans)
    }
    break
  }
  case 'HP':
    closeTag(c)
    closeParas(c)
    break
  case 'RS':
    closeTag(c)
    c.boxes.push(addBlock(c, { kind: 'group', indent: 1, blocks: [] }))
    break
  case 'RE':
    closeTag(c)
    while (c.boxes.length > 1) {
      let last

      last = c.boxes.pop()
      if (last.kind == 'group')
        break
    }
    break
  case 'nf':
    startPre(c, 0)
    break
  case 'fi':
    endPre(c)
    break
  case 'EX':
    startPre(c, 1)
    break
  case 'EE':
    endPre(c)
    break
  case 'br':
    breakLine(c)
    break
  case 'sp':
    addBlock(c, { kind: 'space' })
    break
  case 'B':
    handleFont(c, [ 'bold' ], rest, c.lineNo)
    break
  case 'I':
    handleFont(c, [ 'italic' ], rest, c.lineNo)
    break
  case 'SM':
    handleFont(c, [ 'small' ], rest, c.lineNo)
    break
  case 'SB':
    handleFont(c, [ 'bold' ], rest, c.lineNo)
    break
  case 'BI':
    handleFont(c, [ 'bold', 'italic' ], rest, c.lineNo)
    break
  case 'BR':
    handleFont(c, [ 'bold', 'roman' ], rest, c.lineNo)
    break
  case 'IB':
    handleFont(c, [ 'italic', 'bold' ], rest, c.lineNo)
    break
  case 'IR':
    handleFont(c, [ 'italic', 'roman' ], rest, c.lineNo)
    break
  case 'RB':
    handleFont(c, [ 'roman', 'bold' ], rest, c.lineNo)
    break
  case 'RI':
    handleFont(c, [ 'roman', 'italic' ], rest, c.lineNo)
    break
  case 'SY':
    synopsisStart(c, args)
    break
  case 'YS':
    closeParas(c)
    break
  case 'OP': {
    let spans

    spans = [ { text: '[', style: 'roman' } ]
    pushSpans(spans, expand(c, args[0] || '', 'bold', c.lineNo).spans)
    if ((args[1] || '').length) {
      pushSpan(spans, { text: ' ', style: 'roman' })
      pushSpans(spans, expand(c, args[1], 'italic', c.lineNo).spans)
    }
    pushSpan(spans, { text: ']', style: 'roman' })
    appendInline(c, spans)
    break
  }
  case 'UR': {
    let url

    url = expandText(c, args[0] || '', c.lineNo)
    c.link = { href: url, shown: url, spans: [] }
    break
  }
  case 'MT': {
    let href

    href = expandText(c, args[0] || '', c.lineNo)
    // .MT takes a bare address; .UR takes a complete URL.
    c.link = { href: /^[a-z][a-z0-9+.-]*:/i.test(href) ? href : 'mailto:' + href,
               shown: href,
               spans: [] }
    break
  }
  case 'UE':
  case 'ME':
    linkEnd(c, args[0] || '')
    break
  case 'TS':
  case 'T&': {
    let blocks, lines, tableLine

    blocks = []
    lines = []
    tableLine = c.lineNo
    for (;;) {
      let next

      next = nextInput(c)
      if (next == 0)
        break
      if (next.text.trim() == '.TE')
        break
      if (next.text.trim() == '.T&') {
        blocks.push(lines)
        lines = []
        continue
      }
      lines.push(next.text)
    }
    blocks.push(lines)
    blocks.forEach(block => {
                     let table

                     table = tableBuild(c, block, tableLine)
                     closeTag(c)
                     addBlock(c, table)
                   })
    break
  }
  case 'TE':
    break
  case 'mso': {
    let target

    target = args[0] || ''
    // The macros those packages provide (URL/MTO/LINKSTYLE, MT/ME, UR/UE)
    // are implemented here, so loading them is not needed.
    if ((target == 'www.tmac') || (target == 'an-ext.tmac'))
      break
    fail(c, c.lineNo, 'mso ' + target)
    break
  }
  case 'LINKSTYLE': {
    let close, open

    // LINKSTYLE colour [fontstyle [open close]] picks the glyphs an-ext puts
    // around a target that has a description. www.tmac's own default is ⟨⟩;
    // util-linux asks for ASCII brackets.
    open = expandText(c, args[2] || '', c.lineNo)
    close = expandText(c, args[3] || '', c.lineNo)
    if (open.length && close.length)
      c.linkGlyph = { open, close }
    break
  }
  case 'URL':
  case 'MTO': {
    let href, target, text, trailing, spans

    // Both www.tmac and the util-linux pages render the label and then the
    // target between brackets, so the address stays visible in the text.
    target = expandText(c, args[0] || '', c.lineNo)
    href = ((name == 'MTO') ? 'mailto:' : '') + target
    text = expandText(c, args[1] || '', c.lineNo)
    spans = []
    if (text.length)
      pushSpan(spans, { text, style: c.font, href })
    // man(1) shows the bare target when the macro has no description, and
    // the description followed by the target in the bracket glyphs LINKSTYLE
    // chose (⟨⟩ by default, <> on the util-linux pages) otherwise.
    if (text.length) {
      let bracket

      bracket = c.linkGlyph.open + target + c.linkGlyph.close
      pushSpan(spans, { text: ' ' + bracket, style: c.font, href })
    }
    else if (target.length)
      pushSpan(spans, { text: target, style: c.font, href })
    // The rest is roff like the other arguments: mount(8) writes
    // `.URL "..." "" "\fP."`, so the `\fP` is a font change that also applies
    // to what follows, and only the period belongs in the text.
    trailing = expand(c, args.slice(2).join(' '), c.font, c.lineNo)
    pushSpans(spans, trailing.spans)
    appendInline(c, spans)
    break
  }
  case 'pc':
  case 'cp':
    // page character and compatibility mode: presentation only
    break
  case 'PD':
  case 'DT':
  case 'UC':
  case 'AT':
  case 'in':
  case 'ti':
  case 'll':
  case 'ta':
  case 'ev':
  case 'ul':
  case 'ce':
  case 'ss':
  case 'fam':
  case 'bd':
    break
  case 'ft':
    c.font = resolveFont(c, args[0] || 'R', c.font, c.lineNo)
    break
  case 'ftr':
    if (args[0] && args[1])
      c.ftr[args[0]] = args[1]
    break
  case 'do':
  case 'nop': {
    let sub, line

    // `.nop` runs its argument as an input line, text included. `.do` runs
    // it as a request, which has no control character of its own:
    // `.do nr tbl_C \n[.C]` is `.nr tbl_C \n[.C]`.
    line = ((name == 'do') && rest) ? '.' + rest : rest
    sub = line ? controlOf(line) : 0
    if (sub && sub.name)
      handleLine(c, sub, style)
    else if ((name == 'nop') && rest) {
      let expanded

      expanded = expand(c, rest, style, c.lineNo)
      addTextLine(c, expanded.spans, expanded.join, 0)
    }
    break
  }
  case 'de':
  case 'de1':
    define(c, 0, rest)
    break
  case 'am':
    define(c, 1, rest)
    break
  case 'ds':
    doString(c, args[0] || '', copyMode(valueAfter(rest, args[0] || '')), 0)
    break
  case 'as':
    doString(c, args[0] || '', copyMode(valueAfter(rest, args[0] || '')), 1)
    break
  case 'nr':
    if (args[0]) {
      setRegister(c, args[0], (args[1] == undefined) ? (c.reg[args[0]] || 0) :
                  expandText(c, args[1], c.lineNo))
      if (args[2])
        setIncrement(c, args[0], expandText(c, args[2], c.lineNo))
    }
    break
  case 'rr':
    if (args[0]) {
      delete c.reg[args[0]]
      delete c.inc[args[0]]
    }
    break
  case 'rm':
    if (args[0]) {
      delete c.macros[args[0]]
      delete c.str[args[0]]
      delete c.reg[args[0]]
      delete c.inc[args[0]]
    }
    break
  case 'rn':
    if (args[0] && args[1]) {
      if (args[0] in c.macros) {
        c.macros[args[1]] = c.macros[args[0]]
        delete c.macros[args[0]]
      }
      if (args[0] in c.str) {
        c.str[args[1]] = c.str[args[0]]
        delete c.str[args[0]]
      }
    }
    break
  case 'als':
    if (args[0] && args[1])
      c.aliases[args[0]] = args[1]
    break
  case 'tr':
    doTranslation(c, rest, c.lineNo)
    break
  case 'ig':
    readBlockEnd(c, args[0] || '..', c.lineNo)
    break
  case 'so': {
    let target, included

    target = expandText(c, args[0] || '', c.lineNo)
    if (c.frames.some(f => f.include == target)) {
      fail(c, c.lineNo, 'include cycle ' + target)
      break
    }
    included = c.spec.include ? c.spec.include(target) : 0
    if (typeof included == 'string')
      c.frames.push({ lines: included.split('\n'),
                      at: 0,
                      line: 1,
                      args: [],
                      name: target,
                      include: target })
    else
      fail(c, c.lineNo, 'include ' + target)
    break
  }
  case 'if':
  case 'ie':
  case 'el': {
    let take

    if (name == 'el')
      take = c.lastIf ? 0 : 1
    else {
      let split

      split = splitCond(rest)
      rest = split.rest
      take = condition(c, split.cond, c.lineNo)
      if (name == 'ie')
        c.lastIf = take
    }
    if (rest.startsWith('\\{')) {
      if (take == 0) {
        skipBlock(c, c.lineNo)
        break
      }
      // groff treats the rest of a `\{` line as the block's first input
      // line, so `.el \{ text` still prints `text` when the branch is taken
      // (bash(1)'s RESTRICTED SHELL).
      rest = rest.slice(2).trim()
    }
    if (rest.trim() == '') {
      c.nextSkip = take ? 0 : 1
      break
    }
    if (take == 0)
      break
    if ((rest[0] == '.') || (rest[0] == "'"))
      handleLine(c, controlOf(rest), style)
    else {
      let expanded

      expanded = expand(c, rest, style, c.lineNo)
      addTextLine(c, expanded.spans, expanded.join, 0)
    }
    break
  }
  default:
    if (c.macros[name] || c.aliases[name])
      callMacro(c, name, args, c.lineNo)
    else if (Roff.macroClass(name) == 'metric')
      0
    else if (Roff.macroClass(name) == 'ignore')
      0
    else if (Roff.macroClass(name))
      fail(c, c.lineNo, 'macro ' + name)
    else
      fail(c, c.lineNo, 'macro ' + name, 'unknown')
  }
}

// Linkify man conventions in text: name(section). The reference is often
// split across font changes (`.BR ls (1)`), so the scan runs over the whole
// span list and then regroups it.
function pushChars
(out, chars) {
  chars.forEach(ch => {
                  if (ch.br) {
                    out.push({ br: 1 })
                    return
                  }
                  pushSpan(out, { text: ch.ch,
                                  style: ch.style,
                                  href: ch.href,
                                  role: ch.role })
                })
}

function linkifySpans
(spans) {
  let chars, text, out, re, m, i

  chars = []
  spans.forEach(span => {
                  if (span.br) {
                    chars.push({ br: 1 })
                    return
                  }
                  for (let at2 = 0; at2 < span.text.length; at2++)
                    chars.push({ ch: span.text[at2],
                                 style: span.style,
                                 href: span.href,
                                 role: span.role })
                })
  text = chars.map(ch => (ch.br ? '\n' : ch.ch)).join('')
  re = /([A-Za-z_][\w.+-]*)\(([1-9][a-z]*)\)/g
  out = []
  while ((m = re.exec(text))) {
    let first, last

    first = chars[m.index]
    last = chars[m.index + m[0].length - 1]
    if (first == undefined || last == undefined)
      continue
    if (first.href || last.href)
      continue
    for (i = 0; i < m[0].length; i++)
      chars[m.index + i] = { ch: chars[m.index + i].ch,
                             style: chars[m.index + i].style,
                             role: chars[m.index + i].role,
                             href: 'man:' + m[1] + '(' + m[2] + ')' }
  }
  pushChars(out, chars)
  return out
}

function linkifyBlocks
(blocks) {
  blocks.forEach(block => {
                   if (block.spans)
                     if (block.kind == 'pre')
                       0
                     else
                       block.spans = linkifySpans(block.spans)
                   if (block.tag)
                     block.tag = linkifySpans(block.tag)
                   if (block.blocks)
                     linkifyBlocks(block.blocks)
                   if (block.items)
                     block.items.forEach(item => {
                                           item.tag = linkifySpans(item.tag)
                                           linkifyBlocks(item.blocks)
                                         })
                   if (block.rows)
                     block.rows.forEach(row => {
                                          row.cells.forEach(cell => {
                                                              cell.spans = linkifySpans(cell.spans)
                                                            })
                                        })
                 })
}

export
function parse
(text, spec) {
  let c, input

  spec = spec || {}
  c = { fails: [],
        seen: {},
        frames: [],
        macros: {},
        aliases: {},
        str: {},
        reg: {},
        inc: {},
        tr: {},
        ftr: {},
        font: 'roman',
        fontStack: [],
        mode: (Roff.scan(text).kind == 'mdoc') ? 'mdoc' : 'man',
        mdoc: mdocState(),
        root: { kind: 'doc', blocks: [] },
        boxes: [],
        para: 0,
        pre: 0,
        tag: 0,
        syn: 0,
        link: 0,
        linkGlyph: { open: '⟨', close: '⟩' },
        lineTarget: 0,
        nextTarget: 0,
        nextStyle: 0,
        atLineStart: 0,
        nextHeading: 0,
        joinNext: 0,
        joinPrev: 0,
        tagResume: 0,
        textOut: 0,
        nextSkip: 0,
        lastIf: 0,
        condDepth: 0,
        fill: 1,
        lineNo: 0,
        spec,
        doc: { title: '', section: '', date: '', source: '', blocks: [] } }
  c.boxes.push(c.root)
  c.frames.push({ lines: String(text).split('\n'), at: 0, line: 1, args: [], name: '' })

  while ((input = nextInput(c))) {
    let control, fromTrap, resumed, style

    c.lineNo = input.line
    c.atLineStart = 1
    if (c.nextSkip) {
      c.nextSkip = 0
      continue
    }
    style = c.nextStyle || c.font
    c.nextStyle = 0
    // A `.TP` trap makes the next line its tag. A `\c` at the end of a tag
    // line keeps the tag open, so the line after it resumes the same target
    // (paperconfig(8)'s `.BR \-p ", " \-\-paper\c` then `.I papername`).
    resumed = c.tagResume
    c.tagResume = 0
    fromTrap = c.nextTarget
    c.nextTarget = 0
    c.lineTarget = fromTrap || resumed
    resumed = c.lineTarget
    if (c.nextHeading) {
      let level, heading

      level = c.nextHeading
      c.nextHeading = 0
      closeParas(c)
      heading = { kind: 'heading', level, spans: [] }
      box(c).blocks.push(heading)
      c.lineTarget = heading.spans
      resumed = 0
    }

    control = controlOf(input.text)
    if (control && (control.comment || control.blank)) {
      // A comment line is not an input line for a `\c`; a blank line is.
      // The line a `.TP` only just trapped for survives either.
      if (control.comment || fromTrap)
        c.tagResume = resumed
      c.lineTarget = 0
      if (control.blank && (c.pre == 0))
        addBlock(c, { kind: 'space' })
      continue
    }
    if (control && control.block) {
      c.lineTarget = 0
      continue
    }
    // A bare `\}` line closes the block an inline `.ie \{` opened. groff
    // prints no text and no space for it, so its empty text line must not add
    // a separator: the next inline macro adds its own (bash(1)'s
    // `above),  rbash`).
    if (input.text.trim() == '\\}') {
      c.lineTarget = 0
      continue
    }
    if (control && control.name) {
      // A `\c` on the line before this one suppresses the leading space; the
      // macro's own last argument may start a new continuation.
      c.joinPrev = c.joinNext
      c.joinNext = 0
      c.textOut = 0
      handleLine(c, control, style)
      c.joinPrev = 0
      // A tag line ending in `\c` continues, and so does a macro call that
      // only expanded to more input lines (dmstats(8)'s `.UNITS`); a macro
      // that printed text ends the tag unless its own last argument `\c`d.
      if (resumed && ((c.textOut == 0) || c.joinNext))
        c.tagResume = resumed
      c.lineTarget = 0
      continue
    }
    if ((control == 0) && (input.text.trim() == '') && (c.pre == 0)) {
      c.lineTarget = 0
      addBlock(c, { kind: 'space' })
      continue
    }
    {
      let expanded

      expanded = expand(c, input.text, style, input.line)
      c.atLineStart = 0
      if (c.mode == 'mdoc') {
        c.mdoc.spaceNext = 1
        mdocAppend(c, expanded.spans)
        // A text line separates the macro call that follows it even when
        // `Sm off` has suppressed spaces between macro calls.
        c.mdoc.spaceNext = 1
      }
      else
        addTextLine(c, expanded.spans, expanded.join, c.joinNext)
      if (c.joinNext && resumed)
        c.tagResume = resumed
      c.lineTarget = 0
    }
  }

  closeTag(c)
  endPre(c)
  c.doc.blocks = c.root.blocks
  linkifyBlocks(c.doc.blocks)
  return { ok: c.fails.length ? 0 : 1, fails: c.fails, doc: c.doc }
}

export
function toText
(blocks) {
  let out

  function block
  (b) {
    if (b.kind == 'heading')
      out += '\n' + textOf(b.spans) + '\n'
    else if (b.kind == 'para')
      out += textOf(b.spans) + '\n'
    else if (b.kind == 'tag') {
      out += textOf(b.tag) + '\n'
      b.blocks.forEach(block)
    }
    else if (b.kind == 'pre')
      out += textOf(b.spans) + '\n'
    else if (b.kind == 'table')
      b.rows.forEach(row => {
                       out += row.cells.map(cell => textOf(cell.spans)).join(' | ') + '\n'
                     })
    else if (b.kind == 'group')
      b.blocks.forEach(block)
    else if (b.kind == 'list')
      b.items.forEach((item, i) => {
                        if (item.tag.length)
                          out += textOf(item.tag) + '\n'
                        else if (b.listType == 'enum')
                          out += (i + 1) + '.\n'
                        item.blocks.forEach(block)
                      })
  }

  out = ''
  blocks.forEach(block)
  return out
}
