const path = require("path");

const common = {
    mode: "production",
    entry: "./src/index.ts",
    experiments: {
        topLevelAwait: true,
    },
    resolve: {
        fallback: { module: false },
        extensions: [".ts", ".js"],
    },
    module: {
        rules: [{
            test: /\.ts$/,
            use: {
                loader: "ts-loader",
                options: {
                    compilerOptions: { noEmit: false },
                },
            },
            exclude: /node_modules/,
        }],
    },
    optimization: { minimize: false },
};

module.exports = (env = {}) => {
    if (env.target !== "browser" && env.target !== "node") {
        throw new Error("Pass --env target=browser or --env target=node");
    }

    return env.target === "node"
    ? {
        ...common,
        name: "node",
        target: "node",
        experiments: { topLevelAwait: true, outputModule: true },
        externals: { binaryen: "module binaryen" },
        optimization: { minimize: false, concatenateModules: false },
        output: {
            path: path.resolve(__dirname, "dist"),
            filename: "pseudo2wasm.node.mjs",
            chunkFilename: "[id].pseudo2wasm.node.mjs",
            chunkFormat: "module",
            module: true,
            library: { type: "module" },
        },
    }
    : {
        ...common,
        name: "browser",
        target: "web",
        output: {
            path: path.resolve(__dirname, "dist"),
            filename: "pseudo2wasm.js",
            globalObject: "this",
            library: { name: "pseudo2wasm", type: "umd" },
            clean: true,
        },
    };
};
