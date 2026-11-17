// Roff inventory for manual pages.
//
// A page either renders faithfully or the viewer refuses it; there is no
// degraded fallback. This module owns the vocabulary that decision uses. Every
// construct in a page is classified as
//
//   render       we produce output for it
//   metric       spacing or placement only; dropping it loses no content
//   ignore       produces no output
//   unsupported  the page is refused
//
// Anything not recognised is unsupported too. bin/man-audit reports an
// installed corpus against these tables; the parser uses the same ones, so
// the audit predicts what the parser refuses.
//
// The audit is static, so it cannot evaluate `.if`/`.ie` conditions. It
// therefore reports an upper bound: a page refused here may still render if
// the construct lives in a branch that is never taken. The parser evaluates
// conditions and decides for real.

let names, escapes, predefinedStrings, predefinedRegisters

function table
(cls, text) {
  let out, list, i

  out = {}
  list = text.split(' ')
  for (i = 0; i < list.length; i++)
    if (list[i])
      out[list[i]] = cls
  return out
}

function nameList
(text) {
  let out, list, i

  out = {}
  list = text.split(' ')
  for (i = 0; i < list.length; i++)
    if (list[i])
      out[list[i]] = 1
  return out
}

// man(7), mdoc(7) and roff requests share one namespace: names are
// case-sensitive, so `B` (bold) and `b` (unknown) stay distinct.
names = Object.assign({},
                      table('render', 'TH SH SS PP LP P IP TP HP RS RE B I BR IR BI RB RI IB ' +
                            'SM SB TQ DT UC EX EE SY YS OP UR UE MT ME PD ' +
                            'Dd Dt Os Sh Ss Pp D1 Dl Bd Ed Bl El It Ad An Ap Ar Bc Bo Bq ' +
                            'Brc Bro Brq Bsx Bx Cd Cm Db Dc Do Dq Dv Dx Ec Em En Eo Er Es Ev ' +
                            'Ex Fa Fc Fd Fl Fn Fo Fr Ft Fx Hf Ic In Lb Li Lk Lp Ms Mt Nd Nm ' +
                            'No Ns Nx Oc Oo Op Ot Ox Pa Pc Pf Po Pq Qc Ql Qo Qq Re Rs Rv Sc ' +
                            'Sm So Sq St Sx Sy Ta Tn Ud Ux Va Vt Xc Xo Xr At Bf Bk Ek ' +
                            'Ao Ac Aq Ef ' +
                            '%A %B %C %D %I %J %N %O %P %Q %R %T %U %V %a %b %c %d %e ' +
                            '%i %j %k %n %o %p %q %r %s %t %u %v ' +
                            'de am de1 ds as nr if ie el ig rm rn als rr so do tr ta ft ' +
                            'ce in ti nf fi br sp nop ul ev TS TE T&'),
                      table('ignore', 'tm hw lf cc c2 eo ec'),
                      table('metric', 'ad na nh hy ne ns rs ll po pl ps vs ss fam ftr ' +
                            'bd mc mk rt bp it'),
                      table('unsupported', 'EQ EN mso di da tl char rchar'))

escapes = Object.assign({},
                        table('render', '- f ( [ * n $ c e z o N t p . { } " \' ` + S ' +
                              '\\ | ^ w'),
                        table('ignore', '& T'),
                        table('metric', '0 % k : , / s h v u d m F M'),
                        table('unsupported', '!'))
escapes[' '] = 'render'
escapes['\t'] = 'render'

// Strings and registers groff or the man macros provide. Pages that use these
// without defining them are still renderable; anything else undefined is
// reported, because we cannot know its value.
predefinedStrings = nameList('lq rq Aq aq oq cq dq sq Do Dc Fo Fc Ba Am Ge Pm Tr ' +
                             'Uc La Ha aa ga -- PI L" R" C+ C` C\' Em EN ' +
                             '.T Gt Lt Le Eq Ne If Na q la ra')

predefinedRegisters = nameList('% x y .g .H .V .l .i .j .T .t .c .d .f .k .p .s .v ' +
                               '.ss .fam .w .u .C .Y .y .z .A .P .R .L .M .cd .ne ' +
                               '.ps .sr .n .o .Hp .Vp .in F dn mH')

function addCount
(counts, name) {
  counts[name] = (counts[name] || 0) + 1
}

// Split a control line into its name. Returns 0 for a text line, or an object
// describing a comment, a blank control line, a `\{`/`\}` block marker or a
// named macro. Leading whitespace after the control character is ignored, as
// in `.    ds Aq \(aq` inside a conditional block.
function splitControl
(line) {
  let first

  first = line[0]
  if ((first == '.') || (first == "'")) {
    let rest

    rest = line.slice(1)
    if (rest.startsWith('\\"') || rest.startsWith('\\#'))
      return { comment: 1 }
    rest = rest.replace(/^[ \t]+/, '')
    if (rest.length == 0)
      return { blank: 1 }
    if (rest.startsWith('\\{') || rest.startsWith('\\}'))
      return { block: rest.slice(0, 2) }
    {
      let cut, name

      cut = rest.search(/[ \t\\]/)
      name = (cut < 0) ? rest : rest.slice(0, cut)
      // A name starting with a control character is empty as far as roff is
      // concerned (old pod2man emits `'.ft R`), so the line is ignored.
      if ((name.length == 0) || (name[0] == '.'))
        return { blank: 1 }
      return { name }
    }
  }
  return 0
}

// Collect names defined anywhere, including after a leading conditional
// (pod2man writes `.ie \n(.g .ds Aq \(aq` on one line).
// Register the names defined on this line, in document order: a definition
// only counts from the line it appears on. pod2man writes `.ie \n(.g .ds Aq
// \(aq`, so definitions are picked up inline as well as at line start.
function registerDefines
(line, defines) {
  let sets

  sets = [ [ 'macros', /(?:^|\s)\.\s*(?:de|am|de1|als)[ \t]+([^ \t\\\r\n]+)/g ],
           [ 'strings', /(?:^|\s)\.\s*(?:ds|as)[ \t]+([^ \t\\\r\n]+)/g ],
           [ 'registers', /(?:^|\s)\.\s*(?:nr|rr)[ \t]+([^ \t\\\r\n]+)/g ] ]
  for (let i = 0; i < sets.length; i++) {
    let re, m

    re = sets[i][1]
    while ((m = re.exec(line)))
      defines[sets[i][0]][m[1]] = 1
  }
}

function escapeName
(text, i) { // i is the backslash; text[i + 1] is * or n
  let j

  j = i + 2
  if ((text[j] == '+') || (text[j] == '-')) // \n+ / \n- auto-increment
    j++
  if (text[j] == '(')
    return text.slice(j + 1, j + 3)
  if (text[j] == '[') {
    let end

    end = text.indexOf(']', j)
    if (end > j)
      return text.slice(j + 1, end)
    return ''
  }
  return text[j] || ''
}

// A page that is nothing but `.so man1/other.1`.
function includeOf
(lines) {
  let found

  found = ''
  for (let i = 0; i < lines.length; i++) {
    let trimmed

    trimmed = lines[i].trim()
    if (trimmed.length == 0)
      continue
    if (trimmed.startsWith('.\\"') || trimmed.startsWith("'\\\"") || trimmed.startsWith('\\#'))
      continue
    if (trimmed.startsWith('.so ')) {
      if (found.length)
        return 0
      found = trimmed.slice(4).trim()
      continue
    }
    return 0
  }
  return found
}

function kindOf
(lines) {
  let include

  include = includeOf(lines)
  if (include)
    return 'include'
  for (let i = 0; i < lines.length; i++) {
    let control

    control = splitControl(lines[i])
    if (control && control.name) {
      if ((control.name == 'Dd') || (control.name == 'Dt'))
        return 'mdoc'
      return 'man'
    }
  }
  return 'man'
}

export
function macroClass
(name) {
  return names[name]
}

export
function escapeClass
(name) {
  return escapes[name]
}

export
function stringIsKnown
(name) {
  return predefinedStrings[name]
}

export
function registerIsKnown
(name) {
  return predefinedRegisters[name]
}

export
function scan
(text) {
  let lines, defines, result, seenFail, seenTolerate, seenUnresolved, ig, kinds

  function fail
  (kind, name, cls, lineNum) {
    let key

    key = kind + ':' + name
    if (seenFail[key])
      return
    seenFail[key] = 1
    result.fails.push({ kind,
                        name,
                        cls,
                        line: lineNum })
  }

  function tolerate
  (kind, name, cls, lineNum) {
    let key

    key = kind + ':' + name
    if (seenTolerate[key])
      return
    seenTolerate[key] = 1
    result.tolerated.push({ kind,
                            name,
                            cls,
                            line: lineNum })
  }

  function unresolved
  (kind, name, lineNum) {
    let key

    key = kind + ':' + name
    if (seenUnresolved[key])
      return
    seenUnresolved[key] = 1
    result.unresolved.push({ kind,
                             name,
                             line: lineNum })
  }

  function classOf
  (kind, name) {
    if (kind == 'macro')
      return names[name] || (defines.macros[name] ? 'render' : 0)
    return escapes[name] || (name.charCodeAt(0) > 127 ? 'render' : 0)
  }

  function use
  (kind, name, lineNum) {
    let cls, counts

    counts = (kind == 'macro') ? result.counts.macros : result.counts.escapes
    addCount(counts, name)
    cls = classOf(kind, name)
    if (cls == 'render')
      return
    if ((cls == 'metric') || (cls == 'ignore'))
      tolerate(kind, name, cls, lineNum)
    else
      fail(kind, name, cls || 'unknown', lineNum)
  }

  function scanEscapes
  (co, lineNum) {
    let at

    at = 0
    while (at < co.length) {
      let c

      at = co.indexOf('\\', at)
      if (at < 0)
        break
      c = co[at + 1]
      if (c == undefined)
        break
      if ((c == '"') || (c == '#'))
        break
      if ((c == '*') || (c == 'n')) {
        let name

        name = escapeName(co, at)
        if (name.length == 0) {
          at += 2
          continue
        }
        addCount(result.counts.escapes, c + '(' + name + ')')
        if (c == '*') {
          if ((predefinedStrings[name] == undefined) && (defines.strings[name] == undefined))
            unresolved('string', name, lineNum)
        }
        else if ((predefinedRegisters[name] == undefined) && (defines.registers[name] == undefined))
          unresolved('register', name, lineNum)
      }
      else
        use('escape', c, lineNum)
      at += 2
    }
  }

  text = String(text)
  lines = text.split('\n')
  defines = { macros: {}, strings: {}, registers: {} }
  seenFail = {}
  seenTolerate = {}
  seenUnresolved = {}
  ig = 0
  kinds = kindOf(lines)
  result = { kind: kinds,
             include: includeOf(lines),
             ok: 1,
             fails: [],
             tolerated: [],
             unresolved: [],
             counts: { macros: {}, escapes: {} },
             defines }

  for (let i = 0; i < lines.length; i++) {
    let line, control

    line = lines[i]
    if (ig) {
      if ((line.trim() == '..') || (line.trim() == ('.' + ig)))
        ig = 0
      continue
    }
    control = splitControl(line)
    registerDefines(line, defines)
    if (control) {
      if (control.comment || control.blank)
        continue
      if (control.block) {
        addCount(result.counts.macros, control.block)
        continue
      }
      if (control.name == 'ig') {
        ig = line.replace(/^[.'][ \t]*ig[ \t]*/, '').trim() || '..'
        continue
      }
      if ((control.name == '.') || (control.name == '..'))
        continue
      use('macro', control.name, i + 1)
    }
    scanEscapes(line, i + 1)
  }

  if (result.fails.length || result.unresolved.length)
    result.ok = 0
  return result
}
