const path = require('path')

module.exports = {
  experiments: {
    outputModule: true
  },
  entry: './lib/codemirror.js',
  output: {
    path: path.resolve(__dirname, 'lib'),
    filename: 'codemirror.bundle.js',
    library: {
      type: 'module'
    }
  },
  mode: 'none'
}
