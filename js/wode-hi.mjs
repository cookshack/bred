import { d } from './mess.mjs'

import * as CMState from '../lib/@codemirror/state.js'
import Mk from './mk.mjs'

export let highlighters
export let stateHighlighters

export
function init
() {
  let all, id, effectHighlighters

  id = 0
  all = Mk.array

  highlighters = {
    add(highlight, update) {
      let h

      h = { id: id++,
            //
            highlight,
            remove() {
              all.removeIf(h1 => h1.id == h.id)
            },
            update }
      all.push(h)
      return h
    },
    forEach(cb) {
      all.forEach(cb)
    }
  }

  /// failed attempt to fake view change to refresh highlights

  //view.ed.dispatch({ effects: effectHighlighters.of('dummy') })

  effectHighlighters = CMState.StateEffect.define()

  {
    let tick

    tick = 0

    stateHighlighters = CMState.StateField.define({
      create() {
        return { tick: ++tick }
      },
      update(value, tr) {
        for (let effect of tr.effects)
          if (effect.is(effectHighlighters))
            value = { tick: ++tick }
        return value
      }
    })
    d({ stateHighlighters })
  }
}
