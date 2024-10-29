export let theme
export let name
export let clrs
export let meanings
export let filters
export let filterMeanings
let rules

function copy
(token, from) {
  rules.push({ token: token,
               alias: from })
}

function rule
(token, foreground, more) {
  rules.push({ token: token,
               ...(foreground ? { foreground: foreground } : {}),
               ...(more || {}) })
}

function init
(rules) {
  function fixup1
  (rule) {
    if (rule.alias) {
      let from

      from = rules.find(r => r.token == rule.alias)
      if (from) {
        let to

        to = {}
        Object.assign(to, from)
        to.token = rule.token
        return to
      }
    }
    return rule
  }

  function fixup
  (all) {
    return all.map(fixup1)
  }

  rules = fixup(rules)

  return { base: 'vs',
           inherit: false,

           rules: rules,

           colors: { 'editor.background': meanings.light,
                     'editor.foreground': meanings.text,
                     'editor.selectionBackground': meanings.nb0Light,
                     'editor.lineHighlightBackground': meanings.nb0VeryLight,
                     'editorCursor.foreground': meanings.point,
                     'editor.hoverHighlightBackground': meanings.fill,
                     'editorHoverWidget.foreground': meanings.text,
                     'editorHoverWidget.background': meanings.fill,
                     'editorHoverWidget.border': meanings.nb0Light,
                     'editorWhitespace.foreground': '#EAE3C9' } }
}

export
function fg
(token) {
  let r

  r = theme.rules.find(r1 => r1.token == token)
  return r?.foreground
}

name = 'solarized-light'

// http://ethanschoonover.com/solarized
clrs = { base03: '#002b36',
         base02: '#073642',
         base01: '#586e75',
         base00: '#657b83',
         base0: '#839496',
         base1: '#93a1a1',
         base2: '#eee8d5',
         base3: '#fdf6e3',
         yellow: '#b58900',
         orange: '#cb4b16',
         red: '#dc322f',
         magenta: '#d33682',
         magentaLight: '#dc5c95', // magenta 80% on meanings.light
         violet: '#6c71c4',
         blue: '#268bd2',
         cyan: '#2aa198',
         green: '#859900',
         //
         blueLight: '#cbe1df', // blue 20% on meanings.light
         blueVeryLight: '#e4ebe2',
         blueVeryLightTranslucent: 'rgb(38 139 210 / 10%)',
         cyanLight:  '#cedbcb', // cyan 38% on meanings.light
         cyanVeryLight:  '#e8ead8', // cyan 18% on meanings.light
         cyanVeryVeryLight:  '#f3f0de' } // cyan 9% on meanings.light

filters = { base02: 'invert(15%) sepia(24%) saturate(2855%) hue-rotate(156deg) brightness(93%) contrast(94%)',
            base01: 'invert(44%) sepia(9%) saturate(914%) hue-rotate(148deg) brightness(89%) contrast(85%)',
            base00: 'invert(50%) sepia(18%) saturate(382%) hue-rotate(150deg) brightness(89%) contrast(88%)',
            base0: 'invert(64%) sepia(12%) saturate(320%) hue-rotate(138deg) brightness(89%) contrast(85%)',
            base1: 'invert(65%) sepia(3%) saturate(1021%) hue-rotate(131deg) brightness(99%) contrast(83%)',
            red: 'invert(20%) sepia(50%) saturate(6419%) hue-rotate(351deg) brightness(96%) contrast(79%)',
            blue: 'invert(52%) sepia(82%) saturate(2190%) hue-rotate(179deg) brightness(86%) contrast(91%)' }

meanings = { text: clrs.base01,
             textLight: clrs.base00,
             fill: clrs.base2,
             fillLight: clrs.base2Light,
             light: clrs.base3,
             fillAux: clrs.cyanLight,
             fillAuxLight: clrs.cyanVeryLight,
             fillAuxVeryLight: clrs.cyanVeryVeryLight,
             //
             nb3: clrs.red,
             nb2: clrs.magenta,
             nb2Light: clrs.magentaLight,
             nb1: clrs.yellow,
             nb0: clrs.blue,
             nb0Light: clrs.blueLight,
             nb0VeryLight: clrs.blueVeryLight,
             nb0VeryLightTranslucent: clrs.blueVeryLightTranslucent,
             //
             emph: clrs.base03,
             emphLight: clrs.base02,
             //
             syntax5: clrs.orange,
             syntax4: clrs.yellow,
             syntax3: clrs.violet,
             syntax2: clrs.blue,
             syntax1: clrs.cyan,
             syntax0: clrs.green }

//--clr-point: rgba(38 139 210 / 40%); /* nb0 at 50% */
meanings.point = meanings.nb0
//--clr-point-border: rgba(38 139 210 / 40%); /* nb0 with some transparency */
meanings.pointBorder = meanings.nb0,
//--clr-point-current: rgba(220 50 47 / 50%); /* nb3 at 50% */
meanings.pointCurrent = meanings.nb3

meanings.scroll = meanings.textLight
meanings.scrollFill = meanings.fill

filterMeanings = { text: filters.base01,
                   nb3: filters.red,
                   nb0: filters.blue,
                   emph: filters.base03 }

rules = []

rule('', meanings.text)
rule('annotation', meanings.textLight)
// eg HTML name='value'
rule('attribute', meanings.syntax3)
copy('attribute.name', meanings.syntax3)
copy('attribute.value', 'string')
rule('attribute.value.number', meanings.syntax3)
rule('attribute.value.unit', meanings.syntax3)
rule('attribute.value.xml', meanings.syntax3)
rule('bold', meanings.emph, { fontStyle: 'bold' })
rule('class', meanings.text)
rule('class.identifier', meanings.syntax2)
rule('comment', meanings.nb2)
rule('comment.doc', meanings.nb2)
rule('constant', meanings.text)
copy('constructor', 'entity.name.function')
rule('debug-token', meanings.text)
rule('delimiter', meanings.text)
copy('delimiter.angle', 'delimiter')
copy('delimiter.array', 'delimiter')
copy('delimiter.bracket', 'delimiter')
copy('delimiter.curly', 'delimiter')
copy('delimiter.parenthesis', 'delimiter')
copy('delimiter.square', 'delimiter')
rule('delimiter.html', meanings.text)
rule('delimiter.xml', meanings.text)
rule('emphasis', meanings.emph, { fontStyle: 'italic' })
rule('identifier', meanings.text)
rule('editorBracketHighlight.foreground1', meanings.syntax0) // should this work?
rule('editorBracketHighlight.foreground2', meanings.syntax1)
rule('editorBracketHighlight.foreground3', meanings.syntax2)
rule('editorBracketHighlight.foreground4', meanings.syntax3)
rule('editorBracketHighlight.foreground5', meanings.nb0)
rule('editorBracketHighlight.foreground6', meanings.nb1)
rule('entity', meanings.syntax2)
rule('entity.name.function', meanings.syntax2)
rule('error-token', meanings.nb3)
rule('function.name.def', meanings.syntax5)
rule('info-token', meanings.text)
rule('invalid', meanings.nb3)
rule('key', meanings.syntax3)
rule('keyword', meanings.syntax1)
copy('keyword.flow', 'keyword')
copy('keyword.flow.scss', 'keyword')
copy('keyword.json', 'keyword')
rule('meta.content', meanings.syntax3)
rule('meta.scss', meanings.syntax3)
rule('metatag', meanings.syntax3)
rule('metatag.content.html', meanings.syntax3)
rule('metatag.html', meanings.syntax3)
rule('metatag.xml', meanings.syntax3)
rule('metatag.php', meanings.syntax3)
rule('namespace', meanings.syntax3)
rule('number', meanings.syntax3)
copy('number.bin', 'number')
copy('number.float', 'number')
copy('number.hex', 'number')
copy('number.octal', 'number')
rule('operators', meanings.text)
rule('operator.scss', meanings.text)
rule('operator.sql', meanings.text)
rule('operator.swift', meanings.text)
rule('predefined', meanings.text)
rule('predefined.sql', meanings.text)
rule('regexp', meanings.syntax2)
rule('string', meanings.syntax0)
rule('string.escape', meanings.syntax0)
copy('string.html', 'string')
copy('string.key.json', 'key')
copy('string.sql', 'string')
copy('string.value.json', 'string')
copy('string.yaml', 'string')
copy('tag', 'entity') // eg HTML element
rule('tag.id.pug', meanings.text)
rule('tag.class.pug', meanings.text)
rule('type', meanings.text)
rule('type.identifier', meanings.syntax2)
rule('variable', meanings.text)
rule('variable.name', meanings.syntax3)
rule('variable.name.def', meanings.syntax4)
rule('variable.name.std', meanings.nb2Light)
rule('variable.predefined', meanings.text)
rule('variable.value', meanings.text)
rule('warn-token', meanings.nb1)
// bred
rule('plus', meanings.syntax1)
rule('minus', meanings.nb3)
rule('bredfill', meanings.emph, { background: meanings.fill })

theme = init(rules)
