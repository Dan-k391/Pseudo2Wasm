// 引入一个路径包
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const { webpack } = require("webpack");

module.exports = {
    mode: "development",
    entry: "./src/index.ts",

    experiments: {
        topLevelAwait: true,
    },

    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "bundle.js",
    },

    resolve: {
        extensions: [".ts", ".js"],
    },

    module: {
        rules: [
            {
                test: /\.ts$/,
                use: "ts-loader",
                exclude: /node-modules/,
            },
        ],
    },

    devtool: "inline-source-map",

    plugins: [
        new CleanWebpackPlugin(),
        new HtmlWebpackPlugin({
            title: "Temp",
        }),
    ],
};
