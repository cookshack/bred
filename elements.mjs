let vals, elements

vals = {}

vals.diag = globalThis.diag
vals.hover = globalThis.hover
vals.mini = globalThis.mini
vals.tip = globalThis.tip

elements = {
  get diag() {
    return vals.diag
  },
  get hover() {
    return vals.hover
  },
  get mini() {
    return vals.mini
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
  set mini(v) {
    return vals.mini = v
  },
  set tip(v) {
    return vals.tip = v
  }
}

export { elements as default }
