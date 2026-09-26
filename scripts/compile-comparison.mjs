// Separate process so build-wall measurements include tool startup consistently.
import { readFileSync, writeFileSync } from "node:fs";
import { Compiler } from "../dist/pseudo2wasm.node.mjs";

const [source, output, optimization] = process.argv.slice(2);
if (!source || !output || !["none", "binaryen-o2"].includes(optimization)) {
    throw new Error("Usage: node scripts/compile-comparison.mjs source output none|binaryen-o2");
}
const module = new Compiler(readFileSync(source, "utf8"), {optimization}).compile();
try {
    if (!module.validate()) throw new Error("Generated Wasm failed validation");
    writeFileSync(output, module.emitBinary());
} finally {
    module.dispose();
}
