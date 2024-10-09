let vals, elements

vals = {}

vals.tip = globalThis.tip

elements = {
  get tip() {
    return vals.tip
  },

  set tip(v) {
    return vals.tip = v
  }
}

export { elements as default }
