import { Compiler } from "../src/compiler";

import { code0 } from "./code0";
import { code1 } from "./code1";

const tests = [
    code0,
    code1,
];

let total = tests.length;
let compileCount = 0;
let runCount = 0;
const compileFailed: Array<string> = [];
const runFailed: Array<string> = [];

async function compileTest() {
    for (let test of tests) {
        // console.log(codes);
        const compiler = new Compiler(test.code);
        try {
            // log the tokens and ast
            compiler.compile(false);
            compileCount++;
        } catch (e) {
            console.error(e);
            compileFailed.push(test.name);
        }

        try {
            // if fail push
            if ((await compiler.test(test.input, test.expected)) === false)
                runFailed.push(test.name);
            else runCount++;
        } catch (e) {
            console.error(e);
            runFailed.push(test.name);
        }
    }
}

// The interpreter part now is under the interpreter branch, and it is not finished

compileTest().then(() => {
    // fetch("http://127.0.0.1:5570/wasmtry/pointer.wasm")
    // .then((response) => response.arrayBuffer())
    // .then((buffer) => new Uint8Array(buffer))
    // .then((array) => binaryen.readBinary(array))
    // .then((module) => {console.log(module.emitText())});

    // const instance = new WebAssembly.Instance(module);
    console.log(`compileCount: ${compileCount}/${total}`);
    console.log(`compileFailed: ${compileFailed}`);
    console.log(`runCount: ${runCount}/${total}`);
    console.log(`runFailed: ${runFailed}`);
});
