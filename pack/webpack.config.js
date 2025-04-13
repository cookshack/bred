const Path = require('path')

module.exports = {
  experiments: {
    outputModule: true
  },
  entry: Path.join(__dirname, '../lib/codemirror.js'),
  output: {
    path: Path.resolve(__dirname, '../lib'),
    filename: 'codemirror.bundle.js',
    library: {
      type: 'module'
    }
  },
  mode: 'none'
}
