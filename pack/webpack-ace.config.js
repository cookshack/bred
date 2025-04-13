const Path = require('path')

module.exports = {
  experiments: {
    outputModule: true
  },
  entry: Path.join(__dirname, '../lib/ace.js'),
  output: {
    path: Path.resolve(__dirname, '../lib'),
    filename: 'ace.bundle.js',
    library: {
      type: 'module'
    }
  },
  mode: 'none'
}
