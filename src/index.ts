// TODO: add ts type to every statement

import binaryen from "binaryen";
import { Compiler } from "./compiler";


const code0 = `OUTPUT 1 + 9
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
OUTPUT i
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

i <- 1
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

const code11 = `DECLARE a:INTEGER
a <- 1

FUNCTION scope() RETURNS INTEGER
    DECLARE b:INTEGER
    DECLARE c:INTEGER

    b <- 1
    c <- 2
    RETURN a + b + c
ENDFUNCTION

OUTPUT scope()
`

const code12 = `PROCEDURE print(a:INTEGER)
    DECLARE b:INTEGER
    DECLARE c:INTEGER

    b <- 2
    c <- 2
    OUTPUT a + b + c
ENDPROCEDURE

CALL print(1)
`

const code13 = `DECLARE i: INTEGER
i <- 1

PROCEDURE increment(BYREF a:INTEGER)
    a <- a + 1
ENDPROCEDURE

CALL increment(i)
OUTPUT i
`

const code14 = `DECLARE i: INTEGER
i <- 1

PROCEDURE increment()
    i <- i + 1
ENDPROCEDURE

CALL increment()
OUTPUT i
`

const code15 = `FUNCTION add(a:REAL, b:REAL) RETURNS REAL
    DECLARE c: REAL
    c <- a + b
    RETURN c
ENDFUNCTION

DECLARE i: REAL
DECLARE j: REAL

i <- 1.1
j <- 2.2
OUTPUT add(i, j)
`

const code16 = `OUTPUT 'a'`

const code17 = `DECLARE i: CHAR
i <- 'v'

OUTPUT i
`

const code18 = `DECLARE i: INTEGER

i <- 1
OUTPUT -i
`

const code19 = `DECLARE i: REAL

i <- 1
OUTPUT -i
`


// const code11 = `TYPE a = ^INTEGER
// DECLARE i:INTEGER

// i <- 9
// a <- ^i
// OUTPUT a^
// `

// const code12 = `TYPE a = ^INTEGER
// DECLARE i:INTEGER

// i <- 9
// a <- ^^^^i^^^
// OUTPUT a^
// `

const codes = [
    code0,
    code1,
    code2,
    code3,
    code4,
    code5,
    code6,
    code7,
    code8,
    code9,
    code10,
    code11,
    code12,
    code13,
    code14,
    code15,
    code16,
    code17,
    code18,
    code19
];
const expected = [10, 7.28, 2, 9/*"Hi"*/, 10, 10, 11, 3, 10, 11, 10, 4, 5, 2, 2, 1.1+2.2/*floating point inaccuracy*/
    , 'a', 'v', -1, -1];
let total = codes.length;
let compileCount = 0;
let runCount = 0;
const compileFailed: Array<number> = [];
const runFailed: Array<number> = [];

async function compileTest() {
    for (let i = 0; i < total; i++) {
        console.log(i);
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
            if (await compiler.test(expected[i]) === false)
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


// The interpreter part now is under the interpreter branch, and it is not finished

// compileTest().then(() => {
    // fetch("http://127.0.0.1:5570/wasmtry/pointer.wasm")
    // .then((response) => response.arrayBuffer())
    // .then((buffer) => new Uint8Array(buffer))
    // .then((array) => binaryen.readBinary(array))
    // .then((module) => {console.log(module.emitText())});

    // const instance = new WebAssembly.Instance(module);
//     console.log(`compileCount: ${compileCount}/${total}`);
//     console.log(`compileFailed: ${compileFailed}`);
//     console.log(`runCount: ${runCount}/${total}`);
//     console.log(`runFailed: ${runFailed}`);
// });

export async function runCode(code: string, output: (a: number) => void): Promise<number> {
    const compiler = new Compiler(code);
    const time = await compiler.runtime(output);

    return time;
}

export function testCompiler(): number {
    return 2;
}
