const path = require('path')

module.exports = {
  experiments: {
    outputModule: true
  },
  entry: './lib/ace.js',
  output: {
    path: path.resolve(__dirname, 'lib'),
    filename: 'ace.bundle.js',
    library: {
      type: 'module'
    }
  },
  mode: 'none'
}
