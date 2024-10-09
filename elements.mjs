let vals, elements

vals = {}

vals.diag = globalThis.diag
vals.tip = globalThis.tip

elements = {
  get diag() {
    return vals.diag
  },
  get tip() {
    return vals.tip
  },

  set diag(v) {
    return vals.diag = v
  },
  set tip(v) {
    return vals.tip = v
  }
}

export { elements as default }
