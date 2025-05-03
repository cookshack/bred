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
    if (name == 'assist')
      return 'lib/svg/file-icons/Manpage.svg'

    if (name == 'binary')
      return 'lib/svg/octicons/file-binary-24.svg'

    if (name == 'c_cpp')
      return 'lib/svg/file-icons/C++.svg'

    if (name == 'chat')
      return 'lib/svg/material-icons/chat/materialiconsoutlined/24px.svg'

    if (name == 'clipboard')
      return 'lib/svg/fluentui-system-icons/ic_fluent_clipboard_32_regular.svg'

    if (name == 'close')
      return 'lib/svg/vscode-codicons/close.svg'

    if (name == 'config')
      return 'lib/svg/material-icons/settings_applications/materialicons/24px.svg'

    if (name == 'css')
      return 'lib/svg/mfixx/css.svg'

    if (name == 'dark')
      return 'lib/svg/material-icons/dark_mode/materialiconsoutlined/24px.svg'

    if (name == 'diagnostic')
      return 'lib/svg/fontawesome-4/heartbeat.svg'

    if (name == 'dir')
      return 'lib/svg/octicons/file-directory-24.svg'

    if (name == 'docker')
      return 'lib/svg/file-icons/Docker.svg'

    if (name == 'dom')
      return 'lib/svg/file-icons/DOM.svg'

    if (name == 'elisp')
      return 'lib/svg/file-icons/Emacs.svg'

    if (name == 'external')
      return 'lib/svg/octicons/link-external-24.svg'

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

    if (name == 'light')
      return 'lib/svg/material-icons/light_mode/materialiconsoutlined/24px.svg'

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

    if (name == 'browse')
      return 'lib/svg/material-icons/open_in_browser/materialicons/24px.svg'

    if (name == 'patch')
      return 'lib/svg/file-icons/Patch.svg'

    if (name == 'perl')
      return 'lib/svg/mfixx/perl.svg'

    if (name == 'python')
      return 'lib/svg/mfixx/python.svg'

    if (name == 'refresh')
      return 'lib/svg/material-icons/refresh/materialicons/24px.svg'

    if (name == 'rust')
      return 'lib/svg/devopicons/rust.svg'

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
(key) {
  if (key) {
    if (key == 'c_cpp') return { name: 'c_cpp' }
    if (key == 'css') return { name: 'css' }
    if (key == 'csv') return { name: 'csv' }
    if (key == 'diff') return { name: 'patch' }
    if (key == 'dockerfile') return { name: 'docker' }
    if (key == 'dir') return { name: 'dir' }
    if (key == 'elisp') return { name: 'elisp' }
    if (key == 'html') return { name: 'html' }
    if (key == 'javascript') return { name: 'javascript' }
    if (key == 'json') return { name: 'json' }
    if (key == 'latex') return { name: 'tex' }
    if (key == 'lisp') return { name: 'lisp' }
    if (key == 'markdown') return { name: 'markdown' }
    if (key == 'patch') return { name: 'patch' }
    if (key == 'plaintext') return { name: 'text' }
    if (key == 'properties files') return { name: 'config' }
    if (key == 'perl') return { name: 'perl' }
    if (key == 'python') return { name: 'python' }
    if (key == 'rust') return { name: 'rust' }
    if (key == 'sh') return { name: 'sh' }
    if (key == 'tex') return { name: 'tex' }
    if (key == 'text') return { name: 'text' }
    if (key == 'zig') return { name: 'zig' }
    if (key.length) return { name: 'letter-' + key.slice(0, 1) }
  }
  return 0
}

export
function modePath
(name) {
  return path(mode(name)?.name)
}
