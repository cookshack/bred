import { append, divCl } from '../../js/dom.mjs'
import * as Buf from '../../js/Buf.mjs'
import * as Ed from '../../js/ed.mjs'

export { choose, yn } from '../../js/prompt.mjs'

export
function nestBuf
(buf, hist) {
  let promptBuf

  function addPromptBuf
  () {
    let b, placeholder

    placeholder = hist?.nth(0)?.toString()

    b = Buf.make({ name: 'Code Prompt',
                   modeKey: 'markdown',
                   content: Ed.divW(buf.dir, 'Code Prompt', { hideMl: 1 }),
                   dir: buf.dir,
                   placeholder,
                   single: 1 })
    b.opts.set('blankLines.enabled', 0)
    b.opts.set('core.autocomplete.enabled', 0)
    b.opts.set('core.brackets.close.enabled', 0)
    b.opts.set('core.folding.enabled', 0)
    b.opts.set('core.highlight.activeLine.enabled', 0)
    b.opts.set('core.head.enabled', 0)
    b.opts.set('core.line.numbers.show', 0)
    b.opts.set('core.lint.enabled', 0)
    b.opts.set('minimap.enabled', 0)
    b.opts.set('ruler.enabled', 0)
    b.icon = 'prompt'

    buf.vars('code').promptBuf = b
    return b
  }

  promptBuf = buf.vars('code').promptBuf || addPromptBuf()
  promptBuf.addMode('Code Prompt')

  buf.views.forEach(view => {
    let container

    container = view.ele.querySelector('.code-prompt-w .bred-nested-pane-w')
    append(container, divCl('bred-nested-pane-w', [], { 'data-bred-nested-buf-id': promptBuf.id }))
  })

  buf.nest(promptBuf)
}
