import { append, div, divCl } from './dom.mjs'
import * as Css from './css.mjs'
import * as Ed from './ed.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Tron from './tron.mjs'
import * as Wode from './wodemirror.mjs'
import * as WodeMode from './wode-mode.mjs'
import * as WodeTheme from './wode-theme.mjs'
import { d } from './mess.mjs'

import * as CMData from '../lib/@codemirror/language-data.js'
import * as CMLang from '../lib/@codemirror/language.js'
import * as CMState from '../lib/@codemirror/state.js'

export let langs

export
function init
() {
  let languages

  function addLang
  (langs, lang, ed, opt) {
    //d('lang: ' + lang.name + ' (' + lang.id + ')')
    opt = opt || {}
    opt.assist = opt.assist ?? {}
    opt.assist.pages = opt.assist.pages ?? 1
    lang.id = lang.name.toLowerCase()
    lang.extensions = lang.extensions?.map(e => '.' + e)
    if (lang.id == 'dockerfile')
      lang.extensions = [ ...(lang.extensions || []), '.Dockerfile' ]
    if (lang.id == 'latex')
      lang.extensions = [ ...(lang.extensions || []), '.aux' ]
    if (lang.id == 'properties files')
      lang.extensions = [ ...(lang.extensions || []), '.desktop', '.conf', '.service' ]
    if (lang.id == WodeMode.patchModeKey()) {
      lang.extensions = [ ...(lang.extensions || []), '.PATCH', '.rej' ]
      opt.assist.pages = 0
      opt.assist.extras = []
      opt.assist.extras.push({ key: 'patch-files',
                               head() {
                                 return 'Files'
                               },
                               co(view) {
                                 let point, prev, el

                                 el = new globalThis.DocumentFragment()
                                 prev = { start: Ed.offToBep(view, 0) }
                                 point = view.bep
                                 Ed.vforLines(view, line => {
                                   if (line.text.startsWith('---')) {
                                     let text

                                     if (Ed.bepLtEq(prev.start, point) && Ed.bepGt(line.from, point))
                                       Css.add(prev.el, 'assist-patch-files-current')
                                     text = line.text.slice(3).trim()
                                     prev = { start: line.from,
                                              el: divCl('assist-patch-files-file',
                                                        [ div(text,
                                                              { 'data-run': 'open link',
                                                                'data-path': view.buf.path,
                                                                'data-line': line.number }) ]) }
                                     append(el, prev.el)
                                   }
                                 })
                                 if (prev.el && Ed.bepLtEq(prev.start, point))
                                   Css.add(prev.el, 'assist-patch-files-current')

                                 return el
                               } })
    }
    lang.path = opt.path
    if (opt.firstLine)
      lang.firstLine = opt.firstLine
    if (lang.id == 'cmake')
      lang.filenames = [ ...(lang.filenames || []), 'CMakeLists.txt' ]
    else if (lang.id == 'ruby')
      lang.filenames = [ ...(lang.filenames || []), 'Vagrantfile' ]
    if (lang.id == 'rust')
      lang.alias = [ ...(lang.alias || []), 'rs' ]
    if (lang.load)
      lang.load().then(l => lang.language = l)
    if (opt.front)
      langs.unshift(lang)
    else
      langs.push(lang)
    if (ed)
      WodeMode.addMode(lang, opt)
  }

  function loadLang
  (file, name, opt) {
    d('Loading lang: ' + file)
    opt = opt || {}
    Tron.cmd('file.exists', file, (err, data) => {
      if (err) {
        Mess.log('file: ' + file)
        Mess.toss('Wode init: ' + err.message)
        return
      }
      if (data.exists) {
        let lang

        lang = CMLang.LanguageDescription.of({ name,
                                               extensions: opt.ext,
                                               filename: opt.filename,
                                               load() {
                                                 return import(file).then(m => {
                                                   let ls

                                                   try {
                                                     if (opt.preload)
                                                       opt.preload(m)

                                                     if (opt.load)
                                                       ls = opt.load(m)
                                                     else if (m['language'])
                                                       ls = m['language']()
                                                     else if (m[name.toLowerCase()])
                                                       ls = m[name.toLowerCase()]()
                                                     else
                                                       Mess.toss('missing loader for ' + name)

                                                     if (opt.postload)
                                                       opt.postload(m, ls)

                                                     WodeTheme.Theme.handleCustomTags(m)

                                                     d('Initialised lang: ' + file)
                                                   }
                                                   catch (err) {
                                                     d('loadLang load: ' + file + ': ' + err.message)
                                                     //debugger
                                                   }

                                                   return ls
                                                 })
                                               } })
        if (opt.module === undefined)
          lang.module = file.match(/^.\/lib\/(.*)\.js$/)?.at(1)
        else
          lang.module = opt.module
        languages.push(lang)
        addLang(langs, lang, opt.ed ?? 1, opt)
      }
      else
        Mess.warn('Missing: ' + file)
    })
  }

  languages = CMData.languages.filter(l => [ 'diff', 'javascript', 'markdown' ].includes(l.name.toLowerCase()) ? 0 : 1)
  langs = []

  languages.forEach(l => addLang(langs, l, 1))
  langs.unshift({ id: 'text',
                  alias: [],
                  name: 'Text',
                  extensions: [ '.txt' ] })
  WodeMode.addMode(langs[0])
  d({ langs })

  loadLang(Loc.appDir().join('lib/@codemirror/lang-javascript.js'),
           'JavaScript',
           { ext: [ 'js', 'mjs', 'cjs' ],
             firstLine: '^#!.*\\b(node|gjs)',
             preload(m) {
               let lang, props, indents

               indents = {
                 // Prevent indent when export/params are on their own line.
                 'ExportDeclaration FunctionDeclaration': CMLang.flatIndent,
                 // Flush switch case to block
                 SwitchBody: ctx => {
                   let closed, isCase

                   closed = /^\s*\}/.test(ctx.textAfter)
                   isCase = /^\s*(case|default)\b/.test(ctx.textAfter)
                   return ctx.baseIndent + (((closed || isCase) ? 0 : 1) * ctx.unit)
                 }
                 // always indent ternary like eslint (eg in array def overhang was flat)
                 // too weird, turned off eslint ternary indent instead
                 //ConditionalExpression: CMLang.continuedIndent({ units: 1 })
               }
               props = [ CMLang.indentNodeProp.add(indents) ]
               lang = m.javascriptLanguage
               lang.parser = lang.parser.configure({ props })
             } })

  loadLang(Loc.appDir().join('lib/@replit/codemirror-lang-csharp.js'), 'Csharp', { ext: [ 'cs', 'csx' ] })
  loadLang(Loc.appDir().join('lib/@cookshack/codemirror-lang-csv.js'), 'Csv', { ext: [ 'csv' ] })
  loadLang(Loc.appDir().join('lib/codemirror-lang-diff.js'), 'Diff',
           { ext: [ 'diff', 'patch' ],
             wexts: [ { backend: 'cm',
                        name: 'extPatch',
                        make: () => ([ Wode.extPatch, Wode.extPatchDecor ]),
                        part: new CMState.Compartment } ] })
  loadLang(Loc.appDir().join('lib/codemirror-lang-elixir.js'), 'Elixir', { ext: [ 'ex', 'exs' ] })
  loadLang(Loc.appDir().join('lib/@codemirror/lang-lezer.js'), 'Lezer', { ext: [ 'grammar' ] })
  loadLang(Loc.appDir().join('lib/codemirror-lang-git-log.js'), 'Git Log',
           { ed: 0 }) // prevent mode creation, already have VC Log mode
  loadLang(Loc.appDir().join('lib/@cookshack/codemirror-lang-ini.js'), 'Ini',
           { exts: [ 'ini', 'cfg', 'conf', 'desktop', 'service', 'gitconfig' ],
             path: /\.git\/config$/ })
  loadLang(Loc.appDir().join('lib/@cookshack/codemirror-lang-lezer-tree.js'), 'Lezer Tree', { ext: [ 'leztree' ] })
  loadLang(Loc.appDir().join('lib/codemirror-lang-makefile.js'), 'Makefile',
           { filename: /^(GNUmakefile|makefile|Makefile)$/,
             onAddMode: m => m.opts.set('core.highlight.leadingSpace.enabled', 1) })
  loadLang(Loc.appDir().join('lib/@cookshack/codemirror-lang-nasl.js'), 'NASL', { ext: [ 'nasl' ] })
  //loadLang(Loc.appDir().join('lib/@kittycad/codemirror-lang-kcl.js'), 'Kcl', { ext: [ 'kcl' ] })
  loadLang(Loc.appDir().join('lib/@replit/codemirror-lang-nix.js'), 'Nix', { ext: [ 'nix' ] })
  loadLang(Loc.appDir().join('lib/@orgajs/codemirror-lang-org.js'), 'Org', { ext: [ 'org' ] })
  loadLang(Loc.appDir().join('lib/@cookshack/codemirror-lang-peg.js'), 'PEG', { ext: [ 'peg' ] })
  loadLang(Loc.appDir().join('lib/@cookshack/codemirror-lang-zig.js'), 'Zig', { ext: [ 'zig' ] })

  loadLang(Loc.appDir().join('lib/@codemirror/lang-markdown.js'),
           'Markdown',
           { ext: [ 'md', 'markdown', 'mkd' ],
             load(m) {
               return m.markdown({ codeLanguages: langs })
             } })

  loadLang(Loc.appDir().join('lib/codemirror-lang-richdown.js'),
           'Richdown',
           { front: 0, // priority goes to markdown
             ext: [ 'md' ],
             module: 0,
             load(m) {
               return m.richdown({ lezer: { codeLanguages: langs } })
             } })
}
