export
function init
(Mon) {
  let id, tokenizer

  id = 'makefile'

  tokenizer = { root: [ [ /^[^\s]+:/, 'entity.name.function' ],
                        [ /^\s*(#.*)$/, [ 'comment' ] ],
                        [ /'([^'\\]|\\.)*'/, 'string' ],
                        [ /'([^'\\]|\\.)*'/, 'string' ] ] }

  Mon.languages.register({ id: id,
                           filenames: [ 'GNUmakefile', 'makefile', 'Makefile' ] })
  Mon.languages.setMonarchTokensProvider(id, { tokenizer: tokenizer })
}
