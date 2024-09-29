const path = require('path')

module.exports = {
  experiments: {
    outputModule: true,
  },
  entry: './webpack-orga.js',
  output: {
    path: path.resolve(__dirname, 'lib'),
    filename: 'orga.js',
    library: {
      type: "module",
    },
  },
  mode: 'none',
}
