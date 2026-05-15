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
                               'wode-lang-patch.grammar'),
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

passNames('old file', '--- a/file.txt\n',
          [ 'Program', 'Line', 'OldFile' ])

passNames('new file', '+++ b/file.txt\n',
          [ 'Program', 'Line', 'NewFile' ])

passNames('hunk header', '@@ -1,5 +1,5 @@\n',
          [ 'Program', 'Line', 'HunkHeader' ])

passNames('git diff', 'diff --git a/file b/file\n',
          [ 'Program', 'Line', 'GitDiff' ])

passNames('index line', 'index abc..def 100644\n',
          [ 'Program', 'Line', 'IndexLine' ])

passNames('meta new', 'new file mode 100644\n',
          [ 'Program', 'Line', 'MetaLine' ])

passNames('meta old', 'old mode 100755\n',
          [ 'Program', 'Line', 'MetaLine' ])

passNames('meta rename', 'rename from old\n',
          [ 'Program', 'Line', 'MetaLine' ])

passNames('meta copy', 'copy from src\n',
          [ 'Program', 'Line', 'MetaLine' ])

passNames('meta similarity', 'similarity index 100%\n',
          [ 'Program', 'Line', 'MetaLine' ])

passNames('meta dissimilarity', 'dissimilarity index 0%\n',
          [ 'Program', 'Line', 'MetaLine' ])

passNames('meta deleted', 'deleted file mode\n',
          [ 'Program', 'Line', 'MetaLine' ])

passNames('meta binary', 'Binary files differ\n',
          [ 'Program', 'Line', 'MetaLine' ])

passNames('inserted', '+added line\n',
          [ 'Program', 'Line', 'Inserted' ])

passNames('deleted', '-removed line\n',
          [ 'Program', 'Line', 'Deleted' ])

passNames('no newline', '\\ No newline at end\n',
          [ 'Program', 'Line', 'NoNewline' ])

passNames('no newline bare', '\\\n',
          [ 'Program', 'Line', 'NoNewline' ])

passNames('context', ' unchanged line\n',
          [ 'Program', 'Line', 'Context' ])

passNames('context plain', 'plain text here\n',
          [ 'Program', 'Line', 'Context' ])

passNames('eol only', '\n',
          [ 'Program', 'Line' ])

passNames('empty', '',
          [ 'Program' ])

passNames('no trailing eol', '--- a/file.txt',
          [ 'Program', 'Line', 'OldFile' ])

passNames('multi line',
          '--- a/file.txt\n' +
          '+++ b/file.txt\n' +
          '@@ -1,3 +1,3 @@\n' +
          ' unchanged\n' +
          '-removed\n' +
          '+added\n' +
          ' more context\n',
          [ 'Program',
            'Line', 'OldFile',
            'Line', 'NewFile',
            'Line', 'HunkHeader',
            'Line', 'Context',
            'Line', 'Deleted',
            'Line', 'Inserted',
            'Line', 'Context' ])

test('parse', 'no error on empty',
     () => {
       let tree, cursor

       tree = lang.parser.parse('')
       cursor = tree.cursor()
       equal(cursor.name, 'Program')
       equal(cursor.from, 0)
       equal(cursor.to, 0)
     })

test('parse', 'no error on full diff',
     () => {
       let tree, input

       input = '--- a/file.txt\n' +
               '+++ b/file.txt\n' +
               '@@ -1,3 +1,3 @@\n' +
               ' unchanged\n' +
               '-deleted\n' +
               '+inserted\n' +
               ' more context\n'
       tree = lang.parser.parse(input)

       equal(tree.topNode.name, 'Program')
       equal(tree.length, input.length)
     })

Object.entries(tests).forEach(group => globalThis.describe(group[0],
                                                           () => group[1].forEach(t => globalThis.it(t.name,
                                                                                                     t.cb))))
