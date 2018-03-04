const path = require('path');

module.exports = {
  entry: './src/index.js',

  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'build')
  },

  module: {
    rules: [{
      // CSS Files are loaded with the JS now. 🙄
      test: /\.css$/,
      use: ['style-loader', 'css-loader']
    },

    // The index.html is simply copied.
    {
      test: /\.html/,
      loader: 'file-loader?name=[name].[ext]',
    },

    // Static files without further processing
    {
      test: /\.(png|svg|jpg|gif|m4r)/,
      use: ['file-loader']
    }]
  },

  // I have no idea what this is but it works. 🧐
  //
  // Fix for: You are using the runtime-only build of Vue where the template
  //          compiler is not available. Either pre-compile the templates into
  //          render functions, or use the compiler-included build.
  resolve: {
    alias: {
      'vue$': 'vue/dist/vue.esm.js'
    }
  }
}
