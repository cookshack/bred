import * as Css from './css.mjs'
import * as Frame from './frame.mjs'

export
function current
(frame) {
  frame = frame || Frame.current()
  if (frame)
    return frame.panes.find(p => Css.has(p.w, 'current'))
  return 0
}
