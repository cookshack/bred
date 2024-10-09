let vals, elements

vals = {}

vals.diag = globalThis.diag
vals.hover = globalThis.hover
vals.tip = globalThis.tip

elements = {
  get diag() {
    return vals.diag
  },
  get hover() {
    return vals.hover
  },
  get tip() {
    return vals.tip
  },

  set diag(v) {
    return vals.diag = v
  },
  set hover(v) {
    return vals.hover = v
  },
  set tip(v) {
    return vals.tip = v
  }
}

export { elements as default }
