export
function init
(Mon) {
  let id, tokenizer

  id = 'patch'

  tokenizer = {
    root: [ [ /^---\s.*/, 'bredfill' ],
            [ /^\+\+\+\s.*/, 'bredfill' ],
            [ /^\@\@\s.*/, 'bredfill' ],
            [ /^-.*/, 'minus' ],
            [ /^\+.*/, 'plus' ] ],
  }

  Mon.languages.register({ id: id,
                           firstLine: '^diff --git.*',
                           'mime-type': [ 'text/x-diff', 'text/x-patch', 'application/x-patch' ],
                           extensions: [ '.patch', '.diff' ] })
  Mon.languages.setMonarchTokensProvider(id, { tokenizer: tokenizer })
}
