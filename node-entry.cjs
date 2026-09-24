// Binaryen initializes asynchronously. Keep the CommonJS entry compatible
// with the package's original awaitable module export.
module.exports = import("./dist/pseudo2wasm.node.mjs");
