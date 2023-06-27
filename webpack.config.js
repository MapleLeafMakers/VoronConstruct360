const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  devtool: 'source-map',
  module: {

    rules: [
      {
        resolve: {
          extensions: ['.js', '.jsx'],
        },

        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],

  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'plugin', to: '' },
        { from: 'public/base.css', to: '' },
      ],
    }),
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: './palette.html',
    }),
  ],
};
