const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
    mode: "development",
    entry: "./test/index.ts",

    experiments: {
        topLevelAwait: true,
    },

    output: {
        path: path.resolve(__dirname, "dist-test"),
        filename: "bundle.js",
        clean: true,
    },

    resolve: {
        fallback: {
            module: false,
        },
        extensions: [".ts", ".js"],
    },

    module: {
        rules: [
            {
                test: /\.ts$/,
                use: {
                    loader: "ts-loader",
                    options: {
                        compilerOptions: { noEmit: false, sourceMap: true },
                    },
                },
                exclude: /node_modules/,
            },
        ],
    },

    devtool: "inline-source-map",

    plugins: [
        new HtmlWebpackPlugin({
            title: "Pseudo2Wasm browser tests",
        }),
    ],
};
