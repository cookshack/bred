const path = require('path')

module.exports = {
  experiments: {
    outputModule: true
  },
  entry: './webpack-babel-runtime-helpers.js',
  output: {
    path: path.resolve(__dirname, 'lib/@babel/runtime/'),
    filename: 'helpers.js',
    library: {
      type: 'module'
    }
  },
  mode: 'none'
}
