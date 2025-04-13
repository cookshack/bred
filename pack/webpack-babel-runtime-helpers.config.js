const Path = require('path')

module.exports = {
  experiments: {
    outputModule: true
  },
  entry: Path.join(__dirname, 'webpack-babel-runtime-helpers.js'),
  output: {
    path: Path.resolve(__dirname, '../lib/@babel/runtime/'),
    filename: 'helpers.js',
    library: {
      type: 'module'
    }
  },
  mode: 'none'
}
