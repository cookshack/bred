import { deepStrictEqual, equal } from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildParser } from '../lib/@lezer/generator.js'

let tests, lang, parser, grammarSrc

function test
(group, name, cb) {
  tests[group] = tests[group] || []
  tests[group].push({ name, cb })
}

grammarSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)),
                               '..',
                               'js',
                               'wode-lang-ini.grammar'),
                          'utf8')

function treeNames
(tree) {
  let cursor, names

  function walk
  (c) {
    names.push(c.name)
    if (c.firstChild()) {
      do walk(c)
      while (c.nextSibling())
      c.parent()
    }
  }

  cursor = tree.cursor()
  names = []
  walk(cursor)

  return names
}

function passNames
(name, input, expectedNames) {
  test('node names', name,
       () => deepStrictEqual(treeNames(lang.parser.parse(input)),
                             expectedNames))
}

tests = {}

parser = buildParser(grammarSrc)
lang = { parser }

// Comments
passNames('semicolon comment', '; comment\n',
          [ 'IniDoc', 'IniLine', 'Comment' ])

passNames('hash comment', '# comment\n',
          [ 'IniDoc', 'IniLine', 'Comment' ])

// Section headers
passNames('section header', '[section]\n',
          [ 'IniDoc', 'IniLine', 'SectionHeader' ])

passNames('section header dotted', '[section.subsection]\n',
          [ 'IniDoc', 'IniLine', 'SectionHeader' ])

passNames('section header quoted', '[section "subsection"]\n',
          [ 'IniDoc', 'IniLine', 'SectionHeader' ])

// Properties
passNames('key=value', 'key=value\n',
          [ 'IniDoc', 'IniLine', 'Property' ])

passNames('key:value', 'key:value\n',
          [ 'IniDoc', 'IniLine', 'Property' ])

passNames('key = value', 'key = value\n',
          [ 'IniDoc', 'IniLine', 'Property' ])

passNames('key: value', 'key: value\n',
          [ 'IniDoc', 'IniLine', 'Property' ])

passNames('empty value', 'key=\n',
          [ 'IniDoc', 'IniLine', 'Property' ])

// Context (catch-all lines)
passNames('context line', 'just some text\n',
          [ 'IniDoc', 'IniLine', 'Context' ])

// Edge cases
passNames('eol only', '\n',
          [ 'IniDoc', 'IniLine' ])

passNames('empty', '',
          [ 'IniDoc' ])

passNames('no trailing eol', '; comment',
          [ 'IniDoc', 'IniLine', 'Comment' ])

passNames('no trailing eol property', 'key=value',
          [ 'IniDoc', 'IniLine', 'Property' ])

// Multi-line
passNames('multi line',
          '[global]\n' +
          'name=test\n' +
          '; a comment\n' +
          'port: 8080\n',
          [ 'IniDoc',
            'IniLine', 'SectionHeader',
            'IniLine', 'Property',
            'IniLine', 'Comment',
            'IniLine', 'Property' ])

test('parse', 'no error on empty',
     () => {
       let tree, cursor

       tree = lang.parser.parse('')
       cursor = tree.cursor()
       equal(cursor.name, 'IniDoc')
       equal(cursor.from, 0)
       equal(cursor.to, 0)
     })

test('parse', 'no error on full ini',
     () => {
       let tree, input

       input = '[global]\n' +
               'name=test\n' +
               '# comment\n' +
               'port: 8080\n'
       tree = lang.parser.parse(input)

       equal(tree.topNode.name, 'IniDoc')
       equal(tree.length, input.length)
     })

test('parse', 'handles gitconfig',
     () => {
       let tree, input

       input = '[core]\n' +
               '    repositoryformatversion = 0\n' +
               '    filemode = true\n' +
               '\n' +
               '[remote "origin"]\n' +
               '    url = https://example.com/repo.git\n' +
               '    fetch = +refs/heads/*:refs/remotes/origin/*\n'
       tree = lang.parser.parse(input)

       equal(tree.topNode.name, 'IniDoc')
       equal(tree.length, input.length)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
