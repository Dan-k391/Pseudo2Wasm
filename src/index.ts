// TODO: add ts type to every statement

import { Compiler } from "./compiler";
import binaryen from "binaryen";


const code0 = `OUTPUT 1
`

const code1 = `DECLARE i:INTEGER
DECLARE j:INTEGER
DECLARE k:REAL

i <- 1
j <- 2
k <- 3.14
OUTPUT i + j * k
`

const code2 = `DECLARE i:INTEGER
DECLARE j:INTEGER

i <- -1.99
j <- 2.99
IF i = j + i THEN
    OUTPUT 1
ELSE
    OUTPUT 2
ENDIF
`

const code3 = `DECLARE i:STRING
i <- "Hi"
`

const code4 = `DECLARE i:INTEGER
DECLARE j:INTEGER

i <- 1
WHILE i < 10
    i <- i + 1
    j <- i
ENDWHILE

OUTPUT j
`

const code5 = `DECLARE i:INTEGER
DECLARE j:INTEGER

REPEAT
    i <- i + 1
    j <- i
UNTIL i = 10

OUTPUT j
`

const code6 = `DECLARE i:INTEGER
DECLARE j:INTEGER

FOR i <- 1 TO 11
    j <- i
NEXT i

OUTPUT j
`

const code7 = `FUNCTION add(a:INTEGER, b:INTEGER) RETURNS INTEGER
    RETURN a + b
ENDFUNCTION

DECLARE i:INTEGER
DECLARE j:INTEGER

i <- 1
j <- 2
OUTPUT add(i, j)
`

const code8 = `FUNCTION for(a:INTEGER) RETURNS INTEGER
    DECLARE b:INTEGER
    DECLARE c:INTEGER

    FOR b <- 1 TO a
        c <- b
    NEXT b
    RETURN c
ENDFUNCTION

OUTPUT for(10)
`

const code9 = `FUNCTION for(a:INTEGER) RETURNS INTEGER
    DECLARE b:INTEGER

    FOR a <- 1 TO 11
        b <- a
    NEXT a
    RETURN b
ENDFUNCTION

OUTPUT for(1)
`

const code10 = `FUNCTION recur(a:INTEGER) RETURNS INTEGER
    IF a = 10 THEN
        RETURN a
    ENDIF
    RETURN recur(a + 1)
ENDFUNCTION

OUTPUT recur(1)
`

const code11 = `TYPE a = ^INTEGER
DECLARE i:INTEGER

i <- 9
a <- ^i
OUTPUT a^
`

const code12 = `TYPE a = ^INTEGER
DECLARE i:INTEGER

i <- 9
a <- ^^^^i^^^
OUTPUT a^
`

const codes = [code0, code1, code2, code3, code4, code5, code6, code7, code8, code9, code10, code11, code12];
const expected = [1, 7.28, 2, 9/*"Hi"*/, 10, 10, 11, 3, 10, 11, 10, 9, 9];
let total = codes.length;
let compileCount = 0;
let runCount = 0;
const compileFailed: Array<number> = [];
const runFailed: Array<number> = [];

async function test() {
    for (let i = 0; i < total; i++) {
        console.log(codes[i]);
        const compiler = new Compiler(codes[i]);
        try {
            compiler.compile();
            compileCount++;
        } 
        catch (e) {
            console.log(e);
            compileFailed.push(i);
        }

        try {
            // if fail push
            if (await compiler.test(expected[i]) == false)
                runFailed.push(i);
            else
                runCount++;
        }
        catch (e) {
            console.log(e);
            runFailed.push(i);
        }
    }
}

test().then(() => {
//     fetch("http://127.0.0.1:5570/wasmtry/temp.wasm")
//     .then((response) => response.arrayBuffer())
//     .then((buffer) => new Uint8Array(buffer))
//     .then((array) => binaryen.readBinary(array))
//     .then((module) => {module.optimize(); console.log(module.emitText())});

    // const instance = new WebAssembly.Instance(module);
    console.log(`compileCount: ${compileCount}/${total}`);
    console.log(`compileFailed: ${compileFailed}`);
    console.log(`runCount: ${runCount}/${total}`);
    console.log(`runFailed: ${runFailed}`);
});
