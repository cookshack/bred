import * as Mess from './mess.mjs'

let d

d = () => {}
//d = Mess.d

export
function make
(name, spec) {
  let key, ons // ebs?
  let otherwise

  function on
  (k, to) {
    ons[k] = { key: k, to }
  }

  function setOtherwise
  (to) {
    if (to)
      return otherwise = { to }
    return otherwise = 0
  }

  function look
  (wes, // wrapped events
   cb) { // (to)
    let to

    function look1
    (w) {
      let kb // eb?

      if (to.ons) {
      }
      else {
        Mess.warn('look1 found command before end')
        return 0
      }

      if (w.mouse) {
        d('look1  ' + w.name)
        kb = to.ons[w.name]
      }
      else {
        let k

        d('look1  ' + w.e.code + ' ' + w.e.key)

        k = w.e.key

        // Have to do it this way in case capslock is set as an extra ctrl
        // in the os. If so then on down of capslock the browser sends
        // keydown event as CapsLock instead of Control.
        if (w.e.ctrlKey) {
          d('look1  ctrlKey')
          kb = to.ons['Control']
          if (kb && kb.to && kb.to.ons) {
            d('look1  Control is a map')
            to = kb.to
            // For control+space Chrome now sends: key=Unidentified, code=Space
            if (w.e.code == 'Space')
              k = ' '
          }
          else if (kb && kb.to) {
            Mess.warn('Control bound to cmd')
            return 0
          }
          else
            return 0
        }

        if (w.e.altKey) {
          d('look1  altKey')
          kb = to.ons['Alt']
          if (kb && kb.to && kb.to.ons) {
            d('look1  Alt is a map')
            to = kb.to
          }
          else if (kb && kb.to) {
            Mess.warn('Alt bound to cmd')
            return 0
          }
          else
            return 0
        }

        kb = to.ons[k]
      }

      kb = kb || otherwise

      if (kb) {
        if (kb.to) {
          d('look1  kb is a ' + (kb.to.ons ? 'map' : 'cmd'))
          to = kb.to
          return 1
        }
        Mess.log('look1 ' + key + ': kb missing to')
      }

      return 0
    }

    to = { ons }
    d('look in ' + name)
    if (wes.every(look1))
      return cb(to)
    return cb()
  }

  ons = []
  key = name || ''
  if (spec && spec.length)
    key += (': ' + spec)
  else
    key += ':'

  return { key,
           name,
           spec,
           ons,
           //
           get otherwise
           () {
             return otherwise.to
           },
           set otherwise
           (to) {
             return setOtherwise(to)
           },
           //
           look,
           on }
}
