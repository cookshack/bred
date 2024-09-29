let vals, elements

vals = {}

vals.echo = globalThis.echo
vals.diag = globalThis.diag
vals.hover = globalThis.hover
vals.mini = globalThis.mini
vals.outer = globalThis.outer

elements = {
  get echo() {
    return vals.echo
  },
  get diag() {
    return vals.diag
  },
  get hover() {
    return vals.hover
  },
  get mini() {
    return vals.mini
  },
  get outer() {
    return vals.outer
  },

  set echo(v) {
    return vals.echo = v
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
  set outer(v) {
    return vals.outer = v
  }
}

export { elements as default }
