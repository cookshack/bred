import * as Wode from './wode.mjs'

export
function make
(view, from, to) {
  let r

  function order
  () {
    if (from > to) {
      let tmp

      tmp = to
      to = from
      from = tmp
    }
    return r
  }

  r = { get from() {
    return from
  },
        get to() {
          return to
        },
        get text() {
          order()
          return view.ed.state.sliceDoc(from, to)
        },
        get empty() {
          return from == to
        },
        get start() {
          return Wode.bepToPos(view, from)
        },
        get end() {
          return Wode.bepToPos(view, to)
        },
        get startBep() {
          return from
        },
        get endBep() {
          return to
        },
        //
        set from(val) {
          return from = val
        },
        set to(val) {
          return to = val
        },
        //
        order,
        contains(pos) {
          let bep

          bep = Wode.posToBep(view, pos)
          return (from <= bep) && (to >= bep)
        },
        remove() {
          order()
          view?.ed?.dispatch({ changes: { from, to, insert: '' } })
        } }

  return r
}

export
function fromPoints
(view, pos1, pos2) {
  return make(view, Wode.posToBep(view, pos1), Wode.posToBep(view, pos2))
}
