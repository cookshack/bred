import { append, div, divCl } from './dom.mjs'
import * as Css from './css.mjs'
import * as Ed from './ed.mjs'
import * as Loc from './loc.mjs'
import * as Mess from './mess.mjs'
import * as Mode from './mode.mjs'
import * as Tron from './tron.mjs'
import * as U from './util.mjs'
import * as WodeMode from './wode-mode.mjs'
import * as WodePatch from './wode-patch.mjs'
import * as WodeLangIni from './wode-lang-ini.mjs'
import * as WodeLangPatch from './wode-lang-patch.mjs'
import * as WodeTheme from './wode-theme.mjs'
import { d } from './mess.mjs'

import * as CMData from '../lib/@codemirror/language-data.js'
import * as CMLang from '../lib/@codemirror/language.js'
import * as CMState from '../lib/@codemirror/state.js'
import { buildParser } from '../lib/@lezer/generator.js'
import { makeJsIndents } from './wode-lang-js.mjs'

export let langs

export
function init
() {
  let languages

  function addLang
  (lang, ed, opt) {
    //d('WODE LANG addLang ' + lang.name + ' (' + lang.id + ')')
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
    if (lang.id == 'patch') {
      opt.assist.pages = 0
      opt.assist.extras = []
      opt.assist.extras.push({ key: 'patch-files',
                               end: 1,
                               head
                               () {
                                 return 'Files'
                               },
                               co
                               (view) {
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
                                               load
                                               () {
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

                                                     WodeTheme.handleCustomTags(m)

                                                     d('WODE LANG initialised: ' + file)
                                                   }
                                                   catch (err2) {
                                                     d('loadLang load: ' + file + ': ' + err2.message)
                                                     //debugger
                                                   }

                                                   return ls
                                                 })
                                               } })
        if (U.isDefined(opt.module))
          lang.module = opt.module
        else
          lang.module = file.match(/^.\/lib\/(.*)\.js$/)?.at(1)
        languages.push(lang)
        addLang(lang, opt.ed ?? 1, opt)
      }
      else
        Mess.warn('Missing: ' + file)
    })
  }

  // Patch mode must exist synchronously so Vc Equal's b.mode = 'patch' always
  // finds a mode with append.  The grammar loads async below.
  Mode.add('patch', { initFns: Ed.initModeFns, parentsForEm: 'ed' })

  languages = CMData.languages.filter(l => [ 'diff', 'javascript', 'markdown' ].includes(l.name.toLowerCase()) ? 0 : 1)
  langs = []

  languages.forEach(l => addLang(l, 1))
  langs.unshift({ id: 'text',
                  alias: [],
                  name: 'Text',
                  extensions: [ '.txt' ] })
  WodeMode.addMode(langs[0],
                   { assist: { pages: 1 } })
  d({ langs })

  loadLang(Loc.appDir().join('lib/@codemirror/lang-javascript.js'),
           'JavaScript',
           { ext: [ 'js', 'mjs', 'cjs' ],
             firstLine: '^#!.*\\b(node|gjs)',
             preload
             (m) {
               let lang, props, indents

               indents = makeJsIndents(CMLang)
               props = [ CMLang.indentNodeProp.add(indents) ]
               lang = m.javascriptLanguage
               lang.parser = lang.parser.configure({ props })
             } })

  loadLang(Loc.appDir().join('lib/@replit/codemirror-lang-csharp.js'), 'Csharp', { ext: [ 'cs', 'csx' ] })
  loadLang(Loc.appDir().join('lib/@cookshack/codemirror-lang-csv.js'), 'Csv', { ext: [ 'csv' ] })
  Tron.cmd('file.get', [ Loc.appDir().join('js/wode-lang-patch.grammar') ], (err, data) => {
    let parser, langDesc, patchLang

    if (err) {
      Mess.yell('🚨 Failed to load patch grammar: ' + err.message)
      return
    }

    try {
      parser = buildParser(data.data)
    }
    catch (e) {
      Mess.yell('🚨 Failed to build patch grammar: ' + e.message)
      return
    }

    patchLang = WodeLangPatch.makeFromParser(parser)
    langDesc = CMLang.LanguageDescription.of({ name: 'Patch',
                                               extensions: [ 'diff', 'patch', 'PATCH', 'rej' ],
                                               load
                                               () {
                                                 d('WODE LANG initialised: patch (internal)')
                                                 WodeTheme.handleCustomTags(WodeLangPatch)
                                                 return Promise.resolve(patchLang)
                                               } })
    addLang(langDesc,
            1,
            { wexts: [ { backend: 'cm',
                         name: 'extPatch',
                         make: () => ([ WodePatch.extPatch, WodePatch.extPatchDecor ]),
                         part: new CMState.Compartment } ] })
  })
  loadLang(Loc.appDir().join('lib/codemirror-lang-elixir.js'), 'Elixir', { ext: [ 'ex', 'exs' ] })
  loadLang(Loc.appDir().join('lib/@codemirror/lang-lezer.js'), 'Lezer', { ext: [ 'grammar' ] })
  loadLang(Loc.appDir().join('lib/codemirror-lang-git-log.js'), 'Git Log',
           { ed: 0 }) // prevent mode creation, already have VC Log mode
  Tron.cmd('file.get', [ Loc.appDir().join('js/wode-lang-ini.grammar') ], (err, data) => {
    let parser, langDesc, iniLang

    if (err) {
      Mess.yell('🚨 Failed to load ini grammar: ' + err.message)
      return
    }

    try {
      parser = buildParser(data.data)
    }
    catch (e) {
      Mess.yell('🚨 Failed to build ini grammar: ' + e.message)
      return
    }

    iniLang = WodeLangIni.makeFromParser(parser)
    langDesc = CMLang.LanguageDescription.of({ name: 'Ini',
                                               extensions: [ 'ini', 'cfg', 'conf', 'desktop', 'service', 'gitconfig' ],
                                               path: /\.git\/config$/,
                                               load
                                               () {
                                                 d('WODE LANG initialised: ini (internal)')
                                                 return Promise.resolve(iniLang)
                                               } })
    addLang(langDesc,
            1,
            {})
  })
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
             load
             (m) {
               return m.markdown({ codeLanguages: langs })
             } })

  loadLang(Loc.appDir().join('lib/codemirror-lang-richdown.js'),
           'Richdown',
           { front: 0, // priority goes to markdown
             ext: [ 'md' ],
             module: 0,
             load
             (m) {
               return m.richdown({ lezer: { codeLanguages: langs } })
             } })
}
