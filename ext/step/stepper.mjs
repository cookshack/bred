import { button, div, divCl } from '../../dom.mjs'

import * as Css from '../../css.mjs'
import * as Style from '../../style.mjs'
import * as Tron from '../../tron.mjs'

globalThis.testButton.onclick = () => {
  if (globalThis.testButton.innerText == 'test')
    globalThis.testButton.innerText = 'OK'
  else
    globalThis.testButton.innerText = globalThis.testButton.innerText + '.'
}

let pause

Style.initCss(console.log)

pause = button('Pause', '', { 'data-run': 'Pause' })

pause.onclick = () => {
  Css.disable(pause)

  if (pause.innerText == 'Resume') {
    Tron.cmd('step.send', [ 'Debugger.resume' ], err => {
      if (err) {
        console.log('resume: ' + err.message)
        Css.enable(pause)
        return
      }
      console.log('resumed')
      pause.innerText = 'Pause'
      Css.enable(pause)
    })
    return
  }

  Tron.cmd('step.send', [ 'Debugger.enable' ], err => {
    if (err) {
      console.log('enable: ' + err.message)
      Css.enable(pause)
      return
    }
    Tron.cmd('step.send', [ 'Debugger.pause' ], err => {
      if (err) {
        console.log('pause: ' + err.message)
        Css.enable(pause)
        return
      }
      console.log('paused')
      pause.innerText = 'Resume'
      Css.enable(pause)
    })
  })
}

globalThis.testButton.after(div([ pause,
                                  divCl('test', 'hello') ]))
