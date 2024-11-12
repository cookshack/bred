let mk

class _Array extends Array {
  removeIf(cb) {
    for (let i = this.length - 1; i >= 0; i--)
      if (cb(this.at(i)))
        this.splice(i, 1)
    return this
  }
}

mk = { get array() {
  return new _Array()
} }

export { mk as default }
