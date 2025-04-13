const Path = require('path')

module.exports = {
  experiments: {
    outputModule: true
  },
  entry: Path.join(__dirname, 'webpack-orga.js'),
  output: {
    path: Path.resolve(__dirname, '../lib'),
    filename: 'orga.js',
    library: {
      type: 'module'
    }
  },
  mode: 'none'
}
