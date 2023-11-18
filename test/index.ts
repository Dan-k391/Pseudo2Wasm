import { Compiler } from "../src/compiler";

import { code0 } from "./samples/code0";
import { code1 } from "./samples/code1";
import { code2 } from "./samples/code2";
import { code3 } from "./samples/code3";
import { code4 } from "./samples/code4";
import { code5 } from "./samples/code5";
import { code6 } from "./samples/code6";
import { code7 } from "./samples/code7";


const tests = [
    code0,
    code1,
    code2,
    code3,
    code4,
    code5,
    code6,
    code7,
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

compileTest().then(() => {
    console.log(`compileCount: ${compileCount}/${total}`);
    console.log(`compileFailed: ${compileFailed}`);
    console.log(`runCount: ${runCount}/${total}`);
    console.log(`runFailed: ${runFailed}`);
});
