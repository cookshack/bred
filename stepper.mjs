import { button, div, divCl } from './dom.mjs'

import * as Css from './css.mjs'
import * as Tron from './tron.mjs'

globalThis.testButton.onclick = () => {
  globalThis.testButton.innerText = 'OK'
}

let pause

pause = button('Pause', '', { 'data-run': 'Pause' })

pause.onclick = () => {
  Css.disable(pause)
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
      pause.innerText = 'Continue'
      Css.enable(pause)
    })
  })
}

globalThis.testButton.after(div([ pause,
                                  divCl('test', 'hello') ]))
