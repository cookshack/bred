// Markdown language support for bred. The lang-markdown module is passed in
// because it is loaded on demand (see wode-lang.mjs).
//
// bred's em system owns the keyboard, so CM's markdown keymap must not run: it
// is bound on the editor and so fires before bred sees the key, then changes
// the doc behind bred's back. Its Enter continues a list or quote -- and since
// a plain line after a quote counts as part of the quote, that appends a stray
// '>' line -- and its Backspace deletes markup.

export
function makeMarkdown
(m, opt) {
  return m.markdown({ addKeymap: 0,
                      ...opt })
}
