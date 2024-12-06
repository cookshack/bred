let have

export
function setHave
(yes) {
  have = yes
}

export
function path
(name) {
  if (name == 'bred')
    return 'img/bred.svg'

  if (name == 'csv')
    return 'img/csv.svg'

  if (name == 'prompt')
    return 'img/prompt-square.svg'

  if (name == 'warning')
    return 'img/warning.svg'

  if (have) {
    if (name == 'c_cpp')
      return 'lib/svg/file-icons/C++.svg'

    if (name == 'clipboard')
      return 'lib/svg/fluentui-system-icons/ic_fluent_clipboard_32_regular.svg'

    if (name == 'close')
      return 'lib/svg/vscode-codicons/close.svg'

    if (name == 'css')
      return 'lib/svg/mfixx/css.svg'

    if (name == 'diagnostic')
      return 'lib/svg/fontawesome-4/heartbeat.svg'

    if (name == 'dir')
      return 'lib/svg/octicons/file-directory-24.svg'

    if (name == 'dom')
      return 'lib/svg/file-icons/DOM.svg'

    if (name == 'elisp')
      return 'lib/svg/file-icons/Emacs.svg'

    if (name == 'handwave')
      return 'lib/svg/fluentui-system-icons/ic_fluent_hand_wave_24_regular.svg'

    if (name == 'help')
      return 'lib/svg/file-icons/Manpage.svg'

    if (name == 'html')
      return 'lib/svg/mfixx/html.svg'

    if (name == 'javascript')
      return 'lib/svg/devopicons/js.svg'

    if (name == 'json')
      return 'lib/svg/vscode-codicons/json.svg'

    if (name == 'lisp')
      return 'lib/svg/file-icons/Common-Lisp.svg'

    if (name == 'list')
      return 'lib/svg/octicons/list-unordered-24.svg'

    if (name == 'log')
      return 'lib/svg/octicons/log-24.svg'

    if (name == 'manpage')
      return 'lib/svg/file-icons/Manpage.svg'

    if (name == 'markdown')
      return 'lib/svg/devopicons/markdown.svg'

    if (name == 'patch')
      return 'lib/svg/file-icons/Patch.svg'

    if (name == 'perl')
      return 'lib/svg/mfixx/perl.svg'

    if (name == 'python')
      return 'lib/svg/mfixx/python.svg'

    if (name == 'save')
      return 'lib/svg/fluentui-system-icons/ic_fluent_save_24_regular.svg'

    if (name == 'save_edit')
      return 'lib/svg/fluentui-system-icons/ic_fluent_save_edit_24_regular.svg'

    if (name == 'sh')
      return 'lib/svg/mfixx/shell.svg'

    if (name == 'shell')
      return 'lib/svg/file-icons/Terminal.svg'

    if (name == 'tex')
      return 'lib/svg/file-icons/LaTeX.svg'

    if (name == 'text')
      return 'lib/svg/fluentui-system-icons/ic_fluent_text_32_filled.svg'

    if (name == 'trash')
      return 'lib/svg/octicons/trash-24.svg'

    if (name == 'tree')
      return 'lib/svg/material-icons/account_tree/materialiconsoutlined/24px.svg'

    if (name == 'welcome')
      return 'lib/svg/fluentui-system-icons/ic_fluent_hand_wave_24_regular.svg'

    if (name == 'x')
      return 'lib/svg/vscode-codicons/close.svg'

    if (name == 'zig')
      return 'lib/svg/file-icons/Zig.svg'
  }

  if (name.startsWith('letter-'))
    return 'img/letter/' + name + '.svg'
  if (name == 'blank')
    return 'img/blank.svg'
  if (name.length)
    return 'img/letter/letter-' + name[0].toLowerCase() + '.svg'
  return 'img/blank.svg'
}

export
function alt
(name) {
  return name
}

export
function mode
(name) {
  if (name) {
    if (name == 'c_cpp') return { name: 'c_cpp' }
    if (name == 'css') return { name: 'css' }
    if (name == 'csv') return { name: 'csv' }
    if (name == 'diff') return { name: 'patch' }
    if (name == 'dir') return { name: 'dir' }
    if (name == 'elisp') return { name: 'elisp' }
    if (name == 'html') return { name: 'html' }
    if (name == 'javascript') return { name: 'javascript' }
    if (name == 'json') return { name: 'json' }
    if (name == 'latex') return { name: 'tex' }
    if (name == 'lisp') return { name: 'lisp' }
    if (name == 'markdown') return { name: 'markdown' }
    if (name == 'patch') return { name: 'patch' }
    if (name == 'plaintext') return { name: 'text' }
    if (name == 'perl') return { name: 'perl' }
    if (name == 'python') return { name: 'python' }
    if (name == 'sh') return { name: 'sh' }
    if (name == 'tex') return { name: 'tex' }
    if (name == 'text') return { name: 'text' }
    if (name == 'zig') return { name: 'zig' }
    if (name.length) return { name: 'letter-' + name.slice(0, 1) }
  }
  return 0
}

export
function modePath
(name) {
  return path(mode(name)?.name)
}
