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

let fonts, predefinedStrings, predefinedRegisters, escapeChars, mdocInlineNames

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
    spans.push({ br: 1 })
    return
  }
  if (span.text == '')
    return
  last = spans[spans.length - 1]
  if (last && (last.br == undefined) && (last.style == span.style) && (last.href == span.href))
    last.text += span.text
  else
    spans.push({ text: span.text, style: span.style, href: span.href })
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
  if ((first == last) && ("'\"[]|".includes(first)))
    return text.slice(1, -1)
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
    i++
    while (i < text.length) {
      if (text[i] == ']')
        break
      i++
    }
    return i + 1
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
  if ((open == '+') || (open == '-'))
    i++
  while ((i < text.length) && /[0-9.]/.test(text[i]))
    i++
  return i
}

function stringNameOf
(text, i) { // i is the index of * or n
  let j

  j = i + 1
  if ((text[j] == '+') || (text[j] == '-'))
    j++
  if (text[j] == '(')
    return { name: text.slice(j + 1, j + 3), at: j + 3 }
  if (text[j] == '[') {
    let end

    end = text.indexOf(']', j)
    return { name: text.slice(j + 1, end), at: end + 1 }
  }
  return { name: text[j] || '', at: j + 1 }
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
function expand
(c, text, style, lineNo) {
  let spans, at, cur, join

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
        let found, val

        found = stringNameOf(text, at - 1)
        at = found.at
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
      if ((ch == 'h') || (ch == 'v') || (ch == 'm') || (ch == 'F') ||
          (ch == 'M') || (ch == 'S') || (ch == 'k')) {
        at = skipArg(text, at)
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

function appendInline
(c, spans) {
  let target

  if (c.lineTarget)
    target = c.lineTarget
  else if (c.link)
    target = c.link.spans
  else
    target = paraOf(c).spans
  if ((c.mode == 'man') && c.atLineStart && (c.lineTarget == 0) &&
      (target.length > 0) && (spans[0] && (spans[0].br == undefined)))
    pushSpan(target, { text: ' ', style: c.font })
  c.atLineStart = 0
  pushSpans(target, spans)
}

function addTextLine
(c, spans, join) {
  let target

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
    if ((target.length > 0) && (join == 0) && (c.joinNext == 0))
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

function nextInput
(c) {
  while (c.frames.length) {
    let f

    f = frame(c)
    if (f.at < f.lines.length) {
      let text

      text = f.lines[f.at]
      f.at++
      return { text, line: f.line + f.at - 1 }
    }
    if (c.frames.length == 1)
      return 0
    c.frames.pop()
  }
  return 0
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

  expanded = stripComment(expandText(c, cond, lineNo)).trim()
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

function handleFont
(c, styles, rest, lineNo) {
  let args, spans, saved, i

  args = splitArgs(rest)
  if (args.length == 0) {
    c.nextStyle = styles[0]
    return
  }
  spans = []
  saved = c.font
  if (styles.length == 1)
    pushSpans(spans, expand(c, args.join(' '), styles[0], lineNo).spans)
  else
    for (i = 0; i < args.length; i++)
      pushSpans(spans, expand(c, args[i], styles[i % styles.length], lineNo).spans)
  c.font = saved
  appendInline(c, spans)
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
  let link, spans, text, tail

  link = c.link
  if (link == undefined)
    return
  c.link = 0
  spans = link.spans
  text = textOf(spans)
  if (text == '')
    spans = [ { text: '<' + link.href + '>', style: c.font, href: link.href } ]
  else
    spans.forEach(span => {
                    if (span.br == undefined)
                      span.href = link.href
                  })
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
      if (next == '(') {
        i += 3
        continue
      }
      if (next == '[') {
        let end

        end = text.indexOf(']', i)
        i = (end < 0) ? text.length : (end + 1)
        continue
      }
      if ((next == '{') || (next == '}'))
        break
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

  opts = { tab: '\t', box: 0, allbox: 0, center: 0, expand: 0 }
  text.split(';').forEach(part => {
                            let piece

                            piece = part.trim()
                            if (piece.startsWith('tab('))
                              opts.tab = piece.slice(4, -1) || '\t'
                            else if ((piece == 'box') || (piece == 'frame') || (piece == 'doublebox'))
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

function tableColumns
(text) {
  let cols

  cols = []
  text.replace(/\|/g, ' ').split(/[ \t]+/).forEach(token => {
                                                     let align, bold, italic, i

                                                     token = token.trim()
                                                     if ((token == '') || /^[-_=]+$/.test(token))
                                                       return
                                                     if (token[0] == 's') {
                                                       cols.push({ span: 1 })
                                                       return
                                                     }
                                                     if ('lrcna'.includes(token[0]) == 0)
                                                       return
                                                     align = 'left'
                                                     bold = 0
                                                     italic = 0
                                                     if ((token[0] == 'r') || (token[0] == 'n'))
                                                       align = 'right'
                                                     else if (token[0] == 'c')
                                                       align = 'center'
                                                     for (i = 1; i < token.length; i++)
                                                       if ((token[i] == 'b') || (token[i] == 'B'))
                                                         bold = 1
                                                       else if ((token[i] == 'i') || (token[i] == 'I'))
                                                         italic = 1
                                                     cols.push({ align, bold, italic })
                                                   })
  return cols
}

function tableCell
(c, text, lineNo) {
  let saved, spans

  saved = c.font
  spans = expand(c, text, saved, lineNo).spans
  c.font = saved
  return { spans }
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

                  if (multiline) {
                    if (line.trim().endsWith('T}')) {
                      let tail

                      tail = line.trim().slice(0, -2).trim()
                      if (tail.length)
                        buffer += (buffer.length ? '\n' : '') + tail
                      cells.push(tableCell(c, buffer, lineNo))
                      rows.push(cells)
                      cells = []
                      buffer = ''
                      multiline = 0
                    }
                    else if (line.length)
                      buffer += (buffer.length ? '\n' : '') + line
                    return
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

function tableBuild
(c, lines, lineNo) {
  let opts, layout, at, cols, data

  at = 0
  while ((at < lines.length) && (lines[at].trim() == ''))
    at++
  opts = tableOptions('')
  if ((at < lines.length) && lines[at].includes(';')) {
    opts = tableOptions(lines[at])
    at++
  }
  layout = ''
  while (at < lines.length) {
    let line

    line = lines[at]
    at++
    if (line.trim().endsWith('.')) {
      layout += ' ' + line.trim().slice(0, -1)
      break
    }
    layout += ' ' + line.trim()
  }
  cols = tableColumns(layout)
  data = lines.slice(at)
  return { kind: 'table',
           options: opts,
           cols,
           rows: tableRows(c, data, opts.tab, lineNo).map(cells => ({ cells: tableFit(cells, cols) })) }
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
           tagMode: 0,
           section: '',
           name: '',
           noSpace: 0,
           fn: 0,
           ref: 0,
           sm: 1,
           opens: [],
           bfPrev: 0 }
}

function mdocAppend
(c, spans) {
  let para

  if (c.mdoc.pre) {
    if (c.mdoc.pre.started)
      pushSpan(c.mdoc.pre.spans, { text: '\n' })
    pushSpans(c.mdoc.pre.spans, spans)
    c.mdoc.pre.started = 1
    return
  }
  if (c.lineTarget) {
    pushSpans(c.lineTarget, spans)
    return
  }
  if (c.mdoc.tagMode && c.mdoc.item) {
    pushSpans(c.mdoc.item.tag, spans)
    return
  }
  para = paraOf(c).spans
  if ((para.length > 0) && (c.mdoc.noSpace == 0) && c.mdoc.sm)
    pushSpan(para, { text: ' ' })
  pushSpans(para, spans)
  c.mdoc.noSpace = 0
}

function mdocAttach
(c, spans) {
  let para

  if (c.mdoc.pre) {
    pushSpans(c.mdoc.pre.spans, spans)
    return
  }
  if (c.lineTarget) {
    pushSpans(c.lineTarget, spans)
    return
  }
  if (c.mdoc.tagMode && c.mdoc.item) {
    pushSpans(c.mdoc.item.tag, spans)
    return
  }
  para = paraOf(c).spans
  pushSpans(para, spans)
  c.mdoc.noSpace = 0
}

function mdocText
(c, text, style) {
  mdocAppend(c, expand(c, text, style || c.font, c.lineNo).spans)
}

function mdocAttachText
(c, text, style) {
  mdocAttach(c, expand(c, text, style || c.font, c.lineNo).spans)
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
                    Cm: 1,
                    Dc: 1,
                    Do: 1,
                    Dq: 1,
                    Dv: 1,
                    Dx: 1,
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

function mdocPunct
(arg) {
  return /^[,.;:!?)\]}]+$/.test(arg) ? 1 : 0
}

function mdocWords
(c, args, style) {
  args.forEach(arg => {
                 if (arg == '')
                   return
                 if (mdocPunct(arg))
                   mdocAttachText(c, arg, 'roman')
                 else
                   mdocText(c, arg, style)
               })
}

// mdoc parses a macro's arguments itself: a callable macro name ends the
// previous macro's arguments and starts a nested call. That is why
// `.Op Fl e Ar file` is "[-e file]" and not "[-e -Ar file]".
function mdocInline
(c, args) {
  let at

  at = 0
  while (at < args.length) {
    if (mdocInlineNames[args[at]]) {
      let end

      end = at + 1
      while ((end < args.length) && ((mdocInlineNames[args[end]] == undefined) ||
                                     (args[end] == args[at])))
        end++
      mdocInlineMacro(c, args[at], args.slice(at + 1, end))
      at = end
      continue
    }
    {
      let end

      end = at
      while ((end < args.length) && (mdocInlineNames[args[end]] == undefined))
        end++
      mdocText(c, args.slice(at, end).join(' '), c.font)
      at = end
    }
  }
}

function mdocEnclose
(c, args, open, close) {
  mdocAppend(c, [ { text: open } ])
  c.mdoc.noSpace = 1
  if (args.length)
    mdocInline(c, args)
  mdocAttach(c, [ { text: close } ])
}

function mdocHeading
(c, level, args) {
  let spans

  closeParas(c)
  spans = expand(c, args.join(' '), 'bold', c.lineNo).spans
  c.mdoc.section = textOf(spans)
  startHeading(c, level, spans)
}

function mdocListStart
(c, args) {
  let type

  type = 'item'
  for (let i = 0; i < args.length; i++) {
    let arg

    arg = args[i]
    if ((arg == '-width') || (arg == '-offset'))
      i++
    else if (arg.startsWith('-'))
      type = arg.slice(1)
  }
  closeParas(c)
  c.mdoc.list = addBlock(c, { kind: 'list', listType: type, items: [] })
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
  while (c.boxes.length > 1) {
    let last

    last = c.boxes[c.boxes.length - 1]
    if (last.kind == 'item') {
      c.boxes.pop()
      continue
    }
    break
  }
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
    let pre

    pre = addBlock(c, { kind: 'pre', spans: [], mono: 1, started: 0 })
    pushSpans(pre.spans, expand(c, args.join(' '), c.font, c.lineNo).spans)
    return
  }
  mdocInline(c, args)
}

function mdocRefField
(c, args) {
  if (c.mdoc.ref == undefined)
    mdocText(c, args.join(' '), c.font)
  else if (args.length)
    c.mdoc.ref.push(expandText(c, args.join(' '), c.lineNo))
}

function mdocStandard
(token) {
  let names

  names = { '-ansiC': 'ANSI C',
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

function mdocInlineMacro
(c, name, args) {
  switch (name) {
  case 'Nm': {
    let shown

    if (args.length == 0)
      shown = (c.mdoc.name == '') ? [] : [ c.mdoc.name ]
    else {
      c.mdoc.name = args[0]
      shown = args
    }
    shown.forEach(arg => mdocText(c, arg, (c.mdoc.section == 'SYNOPSIS') ? 'bold' : c.font))
    return 1
  }
  case 'Nd':
    mdocAppend(c, [ { text: '—' } ])
    mdocText(c, args.join(' '), c.font)
    return 1
  case 'Xr': {
    let topic, section, trailing

    topic = args[0] || ''
    section = (args[1] && /^[0-9]/.test(args[1])) ? args[1] : ''
    trailing = (section == '') ? (args[1] || '') : (args[2] || '')
    mdocAppend(c, [ { text: topic + (section ? '(' + section + ')' : ''),
                      style: c.font,
                      href: 'man:' + topic + (section ? '(' + section + ')' : '') } ])
    if (trailing)
      mdocAttachText(c, trailing, 'roman')
    return 1
  }
  case 'In':
    mdocAppend(c, [ { text: '<' + args.join(' ') + '>', style: 'roman' } ])
    return 1
  case 'Fl':
    if (args.length == 0)
      mdocText(c, '-', 'bold')
    else if (args[0] == 'Fl')
      mdocText(c, '--' + args.slice(1).join('-'), 'bold')
    else
      args.forEach(arg => mdocText(c, '-' + arg, 'bold'))
    return 1
  case 'Ar':
    if (args.length == 0)
      mdocText(c, 'file ...', 'italic')
    else
      mdocWords(c, args, 'italic')
    return 1
  case 'Cm':
  case 'Ic':
    mdocWords(c, args, 'bold')
    return 1
  case 'Em':
  case 'Pa':
  case 'Va':
  case 'Vt':
  case 'Fa':
    mdocWords(c, args, 'italic')
    return 1
  case 'Sy':
    mdocWords(c, args, 'bold')
    return 1
  case 'Li':
  case 'Dv':
    mdocWords(c, args, 'mono')
    return 1
  case 'No':
  case 'Ev':
  case 'Er':
  case 'Ft':
  case 'Lb':
    mdocWords(c, args, c.font)
    return 1
  case 'Tn':
    mdocWords(c, args, 'small')
    return 1
  case 'An': {
    let names

    names = args.filter(arg => (arg[0] == '-') ? 0 : 1)
    mdocWords(c, names, c.font)
    return 1
  }
  case 'Ap':
    mdocAttach(c, [ { text: "'" } ])
    return 1
  case 'Lk': {
    let url, text

    url = args[0] || ''
    text = args.slice(1).join(' ')
    mdocAppend(c, [ { text: text || url, style: c.font, href: url } ])
    return 1
  }
  case 'Mt': {
    let addr

    addr = args[0] || ''
    mdocAppend(c, [ { text: addr, style: c.font, href: 'mailto:' + addr } ])
    return 1
  }
  case 'Sx':
    mdocWords(c, args, 'bold')
    return 1
  case 'Fn': {
    let fn

    fn = args[0] || ''
    mdocAppend(c, [ { text: fn, style: 'bold' }, { text: '(', style: 'roman' } ])
    if (args.length > 1)
      mdocAttach(c, expand(c, args.slice(1).join(', '), 'italic', c.lineNo).spans)
    mdocAttach(c, [ { text: ')', style: 'roman' } ])
    return 1
  }
  case 'Fo':
    mdocAppend(c, [ { text: args[0] || '', style: 'bold' }, { text: '(', style: 'roman' } ])
    c.mdoc.fn = 1
    return 1
  case 'Fc':
    mdocAttach(c, [ { text: ')', style: 'roman' } ])
    c.mdoc.fn = 0
    return 1
  case 'Pf':
    if (args.length)
      mdocAppend(c, expand(c, args[0], c.font, c.lineNo).spans)
    c.mdoc.noSpace = 1
    if (args.length > 1)
      mdocInline(c, args.slice(1))
    return 1
  case 'Ns':
    c.mdoc.noSpace = 1
    return 1
  case 'Ta':
    mdocAppend(c, [ { text: ' ' } ])
    return 1
  case 'Ux':
    mdocText(c, 'UNIX', c.font)
    return 1
  case 'At':
    mdocText(c, 'AT&T UNIX', c.font)
    return 1
  case 'Bx':
    mdocText(c, 'BSD', c.font)
    return 1
  case 'Fx':
    mdocText(c, 'FreeBSD', c.font)
    return 1
  case 'Nx':
    mdocText(c, 'NetBSD', c.font)
    return 1
  case 'Ox':
    mdocText(c, 'OpenBSD', c.font)
    return 1
  case 'Dx':
    mdocText(c, 'DragonFly', c.font)
    return 1
  case 'St':
    mdocText(c, mdocStandard(args[0] || ''), c.font)
    return 1
  case 'Ex': {
    let cmd

    cmd = args.filter(arg => (arg[0] == '-') ? 0 : 1)[0] || ''
    mdocText(c, 'The ' + (cmd ? cmd + ' utility' : 'utility') +
             ' exits 0 on success, and >0 if an error occurs.', c.font)
    return 1
  }
  case 'Rv': {
    let fn

    fn = args.filter(arg => (arg[0] == '-') ? 0 : 1)[0] || 'function'
    mdocText(c, 'The ' + fn + '() function returns 0 on success; otherwise, it returns -1 and sets errno.', c.font)
    return 1
  }
  case 'Op':
    mdocEnclose(c, args, '[', ']')
    return 1
  case 'Dq':
  case 'Qq':
    mdocEnclose(c, args, '“', '”')
    return 1
  case 'Sq':
    mdocEnclose(c, args, '‘', '’')
    return 1
  case 'Ql':
    mdocAppend(c, [ { text: '‘' } ])
    if (args.length)
      mdocWords(c, args, 'mono')
    mdocAttach(c, [ { text: '’' } ])
    return 1
  case 'Pq':
    mdocEnclose(c, args, '(', ')')
    return 1
  case 'Bq':
    mdocEnclose(c, args, '[', ']')
    return 1
  case 'Brq':
    mdocEnclose(c, args, '{', '}')
    return 1
  case 'Aq':
    mdocEnclose(c, args, '⟨', '⟩')
    return 1
  case 'Oo':
    c.mdoc.opens.push(']')
    mdocAppend(c, [ { text: '[' } ])
    if (args.length)
      mdocInline(c, args)
    return 1
  case 'Oc':
    mdocAttach(c, [ { text: c.mdoc.opens.pop() || ']' } ])
    return 1
  case 'Po':
    c.mdoc.opens.push(')')
    mdocAppend(c, [ { text: '(' } ])
    if (args.length)
      mdocInline(c, args)
    return 1
  case 'Pc':
    mdocAttach(c, [ { text: c.mdoc.opens.pop() || ')' } ])
    return 1
  case 'Do':
    c.mdoc.opens.push('”')
    mdocAppend(c, [ { text: '“' } ])
    if (args.length)
      mdocInline(c, args)
    return 1
  case 'Dc':
    mdocAttach(c, [ { text: c.mdoc.opens.pop() || '”' } ])
    return 1
  case 'Ao':
    c.mdoc.opens.push('⟩')
    mdocAppend(c, [ { text: '⟨' } ])
    if (args.length)
      mdocInline(c, args)
    return 1
  case 'Ac':
    mdocAttach(c, [ { text: c.mdoc.opens.pop() || '⟩' } ])
    return 1
  case 'Bo':
    c.mdoc.opens.push(']')
    mdocAppend(c, [ { text: '[' } ])
    if (args.length)
      mdocInline(c, args)
    return 1
  case 'Bc':
    mdocAttach(c, [ { text: c.mdoc.opens.pop() || ']' } ])
    return 1
  case 'So':
    c.mdoc.opens.push('’')
    mdocAppend(c, [ { text: '‘' } ])
    if (args.length)
      mdocInline(c, args)
    return 1
  case 'Sc':
    mdocAttach(c, [ { text: c.mdoc.opens.pop() || '’' } ])
    return 1
  case 'Xo':
    c.mdoc.tagMode = 1
    if (args.length)
      mdocInline(c, args)
    return 1
  case 'Xc':
    c.mdoc.tagMode = 0
    return 1
  default:
    return 0
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
      mdocText(c, c.mdoc.ref.join(', '), c.font)
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
    mdocRefField(c, args)
    return 1
  case 'Sm':
    c.mdoc.sm = ((args[0] == 'off') ? 0 : 1)
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
    if (mdocInlineMacro(c, name, args))
      return 1
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
    appendInline(c, [ { br: 1 } ])
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
  case 'UR':
  case 'MT':
    c.link = { href: expandText(c, args[0] || '', c.lineNo), spans: [] }
    break
  case 'UE':
  case 'ME':
    linkEnd(c, args[0] || '')
    break
  case 'TS':
  case 'T&': {
    let blocks, lines

    blocks = []
    lines = []
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

                     table = tableBuild(c, block, c.lineNo)
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
  case 'LINKSTYLE':
    break
  case 'URL':
  case 'MTO': {
    let href, text, trailing, spans

    href = expandText(c, args[0] || '', c.lineNo)
    text = expandText(c, args[1] || '', c.lineNo) || href
    trailing = args.slice(2).join(' ')
    spans = [ { text,
                style: c.font,
                href: ((name == 'MTO') ? 'mailto:' : '') + href } ]
    if (trailing.length)
      pushSpan(spans, { text: trailing, style: 'roman' })
    appendInline(c, spans)
    break
  }
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
    let sub

    sub = rest ? controlOf(rest) : 0
    if (sub && sub.name)
      handleLine(c, sub, style)
    else if (rest) {
      let expanded

      expanded = expand(c, rest, style, c.lineNo)
      addTextLine(c, expanded.spans, expanded.join)
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
    if (args[0])
      setRegister(c, args[0], (args[1] == undefined) ? (c.reg[args[0]] || 0) :
                  expandText(c, args[1], c.lineNo))
    break
  case 'rr':
    if (args[0])
      delete c.reg[args[0]]
    break
  case 'rm':
    if (args[0]) {
      delete c.macros[args[0]]
      delete c.str[args[0]]
      delete c.reg[args[0]]
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
    included = c.spec.include ? c.spec.include(target) : 0
    if (typeof included == 'string')
      c.frames.push({ lines: included.split('\n'), at: 0, line: 1, args: [], name: target })
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
      if (take == 0)
        skipBlock(c, c.lineNo)
      break
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
      addTextLine(c, expanded.spans, expanded.join)
    }
    break
  }
  case '\\{':
  case '\\}':
    break
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
                  pushSpan(out, { text: ch.ch, style: ch.style, href: ch.href })
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
                    chars.push({ ch: span.text[at2], style: span.style, href: span.href })
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
        lineTarget: 0,
        nextTarget: 0,
        nextStyle: 0,
        atLineStart: 0,
        nextHeading: 0,
        joinNext: 0,
        nextSkip: 0,
        lastIf: 0,
        fill: 1,
        lineNo: 0,
        spec,
        doc: { title: '', section: '', date: '', source: '', blocks: [] } }
  c.boxes.push(c.root)
  c.frames.push({ lines: String(text).split('\n'), at: 0, line: 1, args: [], name: '' })

  while ((input = nextInput(c))) {
    let control, style

    c.lineNo = input.line
    c.atLineStart = 1
    if (c.nextSkip) {
      c.nextSkip = 0
      continue
    }
    style = c.nextStyle || c.font
    c.nextStyle = 0
    c.lineTarget = c.nextTarget
    c.nextTarget = 0
    if (c.nextHeading) {
      let level, heading

      level = c.nextHeading
      c.nextHeading = 0
      closeParas(c)
      heading = { kind: 'heading', level, spans: [] }
      box(c).blocks.push(heading)
      c.lineTarget = heading.spans
    }

    control = controlOf(input.text)
    if (control && (control.comment || control.blank)) {
      c.lineTarget = 0
      if (control.blank && (c.pre == 0))
        addBlock(c, { kind: 'space' })
      continue
    }
    if (control && control.block) {
      c.lineTarget = 0
      continue
    }
    if (control && control.name) {
      handleLine(c, control, style)
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
      if (c.mode == 'mdoc')
        mdocAppend(c, expanded.spans)
      else
        addTextLine(c, expanded.spans, expanded.join)
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
      b.items.forEach(item => {
                        if (item.tag.length)
                          out += textOf(item.tag) + '\n'
                        item.blocks.forEach(block)
                      })
  }

  out = ''
  blocks.forEach(block)
  return out
}
