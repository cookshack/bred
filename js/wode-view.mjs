import * as U from './util.mjs'
import * as Wode from './wodemirror.mjs'
import * as WodeCommon from './wode-common.mjs'
import { d } from './mess.mjs'

import * as CMView from '../lib/@codemirror/view.js'

export
function reopen
(view, lineNum, whenReady) {
  d('WODE ================== viewReopen')
  if (view.ele && view.ed)
    // timeout so behaves like viewInit
    setTimeout(() => {
      view.ready = 1
      //view.ed.resize()
      view.ed.focus()
      if (U.defined(lineNum))
        Wode.vgotoLine(view, lineNum)
      else
        view.ed.dispatch({ effects: CMView.EditorView.scrollIntoView(view.ed.state.selection.main.head,
                                                                     { y: 'center' }) })
      if (whenReady)
        whenReady(view)
      WodeCommon.runOnCursors(view)
    })
  else
    // probably buf was switched out before init happened.
    Wode.viewInit(view,
                  { lineNum },
                  whenReady)
}

export
function copy
(to, from, lineNum, whenReady) {
  d('WODE ================== viewCopy')
  Wode.viewInit(to,
                { text: from.ed.state.doc.toString(),
                  modeWhenText: from.buf.opt('core.lang'),
                  lineNum,
                  whenReady },
                whenReady)
}
