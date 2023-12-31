// Main entry at /test/index.ts
// Author: Dan-K391

/*
import { Compiler } from "./compiler";

const code0 = `OUTPUT 9 + 1`;

const code1 = `DECLARE i: INTEGER
DECLARE j: INTEGER
DECLARE k: REAL

i <- 1
j <- 2
k <- 3.14
OUTPUT i + j * k
`;

const code2 = `DECLARE i: INTEGER
DECLARE j: INTEGER

i <- -1.99
j <- 2.99
IF i = j + i THEN
    OUTPUT 1
ELSE
    OUTPUT 2
ENDIF
`;

const code3 = `DECLARE i: STRING
i <- "Hi"
OUTPUT i
`;

const code4 = `DECLARE i: INTEGER
DECLARE j: INTEGER

i <- 1
WHILE i < 10
    i <- i + 1
    j <- i
ENDWHILE

OUTPUT j
`;

const code5 = `DECLARE i: INTEGER
DECLARE j: INTEGER

i <- 1
REPEAT
    i <- i + 1
    j <- i
UNTIL i = 10

OUTPUT j
`;

const code6 = `DECLARE i: INTEGER
DECLARE j: INTEGER

FOR i <- 1 TO 11
    j <- i
NEXT i

OUTPUT j
`;

const code7 = `FUNCTION add(a: INTEGER, b: INTEGER) RETURNS INTEGER
    RETURN a + b
ENDFUNCTION

DECLARE i: INTEGER
DECLARE j: INTEGER

i <- 1
j <- 2
OUTPUT add(i, j)
`;

const code8 = `FUNCTION for(a: INTEGER) RETURNS INTEGER
    DECLARE b: INTEGER
    DECLARE c: INTEGER

    FOR b <- 1 TO a
        c <- b
    NEXT b
    RETURN c
ENDFUNCTION

OUTPUT for(10)
`;

const code9 = `FUNCTION for(a: INTEGER) RETURNS INTEGER
    DECLARE b: INTEGER

    FOR a <- 1 TO 11
        b <- a
    NEXT a
    RETURN b
ENDFUNCTION

OUTPUT for(1)
`;

const code10 = `FUNCTION recur(a: INTEGER) RETURNS INTEGER
    IF a = 10 THEN
        RETURN a
    ENDIF
    RETURN recur(a + 1)
ENDFUNCTION

OUTPUT recur(1)
`;

const code11 = `DECLARE a: INTEGER
a <- 1

FUNCTION scope() RETURNS INTEGER
    DECLARE b: INTEGER
    DECLARE c: INTEGER

    b <- 1
    c <- 2
    RETURN a + b + c
ENDFUNCTION

OUTPUT scope()
`;

const code12 = `PROCEDURE print(a: INTEGER)
    DECLARE b: INTEGER
    DECLARE c: INTEGER

    b <- 2
    c <- 2
    OUTPUT a + b + c
ENDPROCEDURE

CALL print(1)
`;

const code13 = `DECLAR  E i: INTEGER
i <- 1

PROCEDURE increment(BYREF a: INTEGER)
    a <- a + 1
ENDPROCEDURE

CALL increment(i)
OUTPUT i
`;

const code14 = `DECLARE i: INTEGER
i <- 1

PROCEDURE increment()
    i <- i + 1
ENDPROCEDURE

CALL increment()
OUTPUT i
`;

const code15 = `FUNCTION add(a: REAL, b: REAL) RETURNS REAL
    DECLARE c: REAL
    c <- a + b
    RETURN c
ENDFUNCTION

DECLARE i: REAL
DECLARE j: REAL

i <- 1.1
j <- 2.2
OUTPUT add(i, j)
`;

const code16 = `OUTPUT 'a'`;

const code17 = `DECLARE i: CHAR
i <- 'v'

OUTPUT i
`;

const code18 = `DECLARE i: INTEGER

i <- 1
OUTPUT -i
`;

const code19 = `DECLARE i: REAL

i <- 1
OUTPUT -i
`;

const code20 = `DECLARE arr: ARRAY[0: 3] OF INTEGER

arr[0] <- 1
arr[1] <- 2
arr[2] <- 3

OUTPUT arr[0] + arr[1] + arr[2]`;

const code21 = `DECLARE arr: ARRAY[0: 9] OF INTEGER

arr[0] <- 1
arr[1] <- 2
arr[2] <- 3
arr[3] <- 4
arr[4] <- 5
arr[5] <- 6
arr[6] <- 7
arr[7] <- 8
arr[8] <- 9
arr[9] <- 10

OUTPUT arr[0] + arr[1] + arr[2] + arr[3] + arr[4] + arr[5] + arr[6] + arr[7] + arr[8] + arr[9]
`;

const code22 = `DECLARE arr: ARRAY[0: 10] OF INTEGER
DECLARE i: INTEGER

FOR i <- 0 TO 10
    arr[i] <- i
NEXT i

DECLARE sum: INTEGER
sum <- 0
FOR i <- 0 TO 10
    sum <- sum + arr[i]
NEXT i

OUTPUT sum
`;

const code23 = `DECLARE i: INTEGER
DECLARE j: INTEGER
DECLARE arr: ARRAY[0: 10, 0: 10] OF INTEGER

FOR i <- 0 TO 10
    FOR j <- 0 TO 10
        arr[i, j] <- i + j
    NEXT j
NEXT i

DECLARE sum: INTEGER
sum <- 0
FOR i <- 0 TO 10
    FOR j <- 0 TO 10
        sum <- sum + arr[i, j]
    NEXT j
NEXT i

OUTPUT sum
`;

const code24 = `DECLARE i: INTEGER
DECLARE j: INTEGER

DECLARE sum: INTEGER

FOR i <- 0 TO 10
    FOR j <- 0 TO 10
        sum <- sum + i + j
    NEXT j
NEXT i

OUTPUT sum
`;

const code25 = `OUTPUT "Hello World"`;

const code26 = `DECLARE i: ARRAY[0: 1] OF INTEGER

i[0] <- 2147483647
OUTPUT i[0]
`;

const code27 = `DECLARE i: ARRAY[0: 2] OF INTEGER

i[0] <- 2147483647
i[1] <- -2147483648
OUTPUT i[0] + i[1]
`;

const code28 = `DECLARE i: STRING
DECLARE j: STRING

i <- "Hello"
j <- "World"

OUTPUT i & j
`;

const code29 = `IF 3 THEN
    OUTPUT 2
ENDIF
`;

const code30 = `DECLARE i: ARRAY[0: 10] OF STRING

i[0] <- "nihao"

OUTPUT i[0]
`;

const code31 = `OUTPUT "编码测试"`;

const code32 = `DECLARE arr: ARRAY[0: 9] OF REAL
DECLARE i: INTEGER

FOR i <- 0 TO 9
    // i / 10 makes an integer value
    arr[i] <- i + i / 10.0
NEXT i

DECLARE sum: REAL

FOR i <- 0 TO 9
    sum <- sum + arr[i]
NEXT i

OUTPUT sum
`;

const code33 = `OUTPUT 1.0 / 20`;

const code34 = `OUTPUT 1 / 20`;

const code35 = `FUNCTION print() RETURNS STRING
    DECLARE str: STRING
    str <- "Hi"
    RETURN str
ENDFUNCTION

OUTPUT print()
`;

const code36 = `PROCEDURE print()
    DECLARE str: STRING
    str <- "Hi"
    OUTPUT str
ENDPROCEDURE

CALL print()
`;

const code37 = `FUNCTION sum() RETURNS INTEGER
    DECLARE sum: INTEGER
    DECLARE arr: ARRAY[0: 10] OF INTEGER
    DECLARE i: INTEGER
    FOR i <- 0 TO 10
        arr[i] <- i
    NEXT i
    
    FOR i <- 0 TO 10
        sum <- sum + arr[i]
    NEXT i
    RETURN sum
ENDFUNCTION

OUTPUT sum()
`;

const code38 = `FUNCTION sum(arr: ARRAY) RETURNS INTEGER
    DECLARE sum: INTEGER
    DECLARE i: INTEGER

    FOR i <- 0 TO 10
        sum <- sum + arr[i]
    NEXT i
    RETURN sum
ENDFUNCTION

DECLARE arr: ARRAY[0: 10] OF INTEGER
DECLARE i: INTEGER
FOR i <- 0 TO 10
    arr[i] <- i
NEXT i

OUTPUT sum(arr)
`;

const code39 = `PROCEDURE print(str: STRING)
    OUTPUT str
ENDPROCEDURE

CALL print("procedure")
`;

const code40 = `OUTPUT LENGTH("Happy Days") + LENGTH("Hi")`;

const code41 = `OUTPUT LENGTH("你好")`;

const code42 = `DECLARE i: ARRAY[2: 5] OF INTEGER

i[2] <- 9
i[3] <- 10
i[4] <- 3

OUTPUT i[2] + i[3] + i[4]
`;

const code43 = `DECLARE arr: ARRAY[0: 3, 0: 3] OF INTEGER
DECLARE i: INTEGER
DECLARE j: INTEGER

FOR i <- 0 TO 3
    FOR j <- 0 TO 3
        arr[i, j] <- i + j
    NEXT j
NEXT i

DECLARE sum: INTEGER
sum <- 0
FOR i <- 0 TO 3
    FOR j <- 0 TO 3
        sum <- sum + arr[i, j]
    NEXT j
NEXT i

OUTPUT sum
`;

const code44 = `DECLARE arr: ARRAY[0: 3, 0: 3, 0: 3] OF INTEGER
DECLARE i: INTEGER
DECLARE j: INTEGER
DECLARE k: INTEGER

FOR i <- 0 TO 3
    FOR j <- 0 TO 3
        FOR k <- 0 TO 3
            arr[i, j, k] <- i + j + k
        NEXT k
    NEXT j
NEXT i

DECLARE sum: INTEGER
sum <- 0
FOR i <- 0 TO 3
    FOR j <- 0 TO 3
        FOR k <- 0 TO 3
            sum <- sum + arr[i, j, k]
        NEXT k
    NEXT j
NEXT i

OUTPUT sum
`;

const code45 = `DECLARE arr: ARRAY[1: 4, 1: 4] OF INTEGER
DECLARE i: INTEGER
DECLARE j: INTEGER

FOR i <- 1 TO 4
    FOR j <- 1 TO 4
        arr[i, j] <- i + j
    NEXT j
NEXT i

DECLARE sum: INTEGER
sum <- 0
FOR i <- 1 TO 4
    FOR j <- 1 TO 4
        sum <- sum + arr[i, j]
    NEXT j
NEXT i

OUTPUT sum
`;

const code46 = `PROCEDURE temp()
    DECLARE arr: ARRAY[0: 3, 0: 3, 0: 3] OF INTEGER
    DECLARE i: INTEGER
    DECLARE j: INTEGER
    DECLARE k: INTEGER

    FOR i <- 0 TO 3
        FOR j <- 0 TO 3
            FOR k <- 0 TO 3
                arr[i, j, k] <- i + j + k
            NEXT k
        NEXT j
    NEXT i

    DECLARE sum: INTEGER
    sum <- 0
    FOR i <- 0 TO 3
        FOR j <- 0 TO 3
            FOR k <- 0 TO 3
                sum <- sum + arr[i, j, k]
            NEXT k
        NEXT j
    NEXT i
    OUTPUT sum
ENDPROCEDURE

CALL temp()
`;

const code47 = `FUNCTION temp() RETURNS INTEGER
    DECLARE arr: ARRAY[0: 3, 0: 3, 0: 3] OF INTEGER
    DECLARE i: INTEGER
    DECLARE j: INTEGER
    DECLARE k: INTEGER

    FOR i <- 0 TO 3
        FOR j <- 0 TO 3
            FOR k <- 0 TO 3
                arr[i, j, k] <- i + j + k
            NEXT k
        NEXT j
    NEXT i

    DECLARE sum: INTEGER
    sum <- 0
    FOR i <- 0 TO 3
        FOR j <- 0 TO 3
            FOR k <- 0 TO 3
                sum <- sum + arr[i, j, k]
            NEXT k
        NEXT j
    NEXT i
    RETURN sum
ENDFUNCTION

OUTPUT temp()
`;

const code48 = `DECLARE i: STRING
DECLARE j: STRING
i <- "Happy Days"
j <- "Not happy"

OUTPUT LENGTH(i) + LENGTH(j)
`;

const code49 = `TYPE nums 
    DECLARE i: INTEGER
    DECLARE j: INTEGER
ENDTYPE
DECLARE k: nums
k.i <- 9
k.j <- 3

OUTPUT k.i + k.j
`;

const code50 = `TYPE nums 
    DECLARE i: ARRAY[0: 7] OF INTEGER
    DECLARE j: INTEGER
ENDTYPE
DECLARE k: nums
k.i[0] <- 8
k.j <- 3

OUTPUT k.i[0] + k.j
`;

const code51 = `TYPE nums 
    DECLARE i: ARRAY[0: 7] OF INTEGER
    DECLARE j: INTEGER
ENDTYPE

DECLARE k: ARRAY[0: 7] OF nums
k[0].i[0] <- 8
k[0].j <- 9

OUTPUT k[0].i[0] + k[0].j
`;

const code52 = `TYPE intptr = ^INTEGER
DECLARE i: INTEGER
DECLARE a: intptr

i <- 19
a <- ^i
OUTPUT a^
`;

const code53 = `TYPE intptr = ^INTEGER
DECLARE i: INTEGER
DECLARE a: intptr

i <- 21
a <- ^^^^i^^^
OUTPUT a^
`;

const code54 = `TYPE intptr = ^INTEGER
TYPE intptrptr = ^intptr

DECLARE i: INTEGER
DECLARE a: intptr
DECLARE b: intptrptr

i <- 34
a <- ^i
b <- ^a
OUTPUT b^^
`;

const code55 = `TYPE nums 
    DECLARE i: INTEGER
    DECLARE j: REAL
ENDTYPE
DECLARE k: nums
k.i <- 9
k.j <- 3.88

OUTPUT k.i + k.j
`;

const code56 = `TYPE nums
    DECLARE j: STRING
ENDTYPE
DECLARE k: nums
k.j <- "Type test"

OUTPUT k.j
`;

const code57 = `TYPE nums
    DECLARE j: STRING
ENDTYPE

TYPE numptr = ^nums

DECLARE i: nums
DECLARE k: numptr
k <- ^i
(k^).j <- "test"

OUTPUT (k^).j
`;

const code58 = `TYPE intptr = ^INTEGER
DECLARE a: intptr
DECLARE b: INTEGER

a <- ^b
a^ <- 4
OUTPUT a^
`;

const code59 = `TYPE intptr = ^INTEGER

FUNCTION deref(i: intptr) RETURNS INTEGER
    RETURN i^
ENDFUNCTION

DECLARE a: INTEGER
a <- 33
OUTPUT deref(^a)
`;

const code60 = `TYPE intptr = ^INTEGER

PROCEDURE change(i: intptr)
    i^ <- 31
ENDPROCEDURE

DECLARE a: INTEGER
a <- 33
CALL change(^a)
OUTPUT a
`;

const code61 = `TYPE strptr = ^STRING

DECLARE a: STRING
DECLARE b: strptr

a <- "Hi"
b <- ^a
OUTPUT b^
`;

const code62 = `TYPE nums
    DECLARE j: INTEGER
    DECLARE f: REAL
ENDTYPE

TYPE numptr = ^nums

PROCEDURE print(i: numptr)
    OUTPUT (i^).j + (i^).f
ENDPROCEDURE

DECLARE i: nums
i.j <- 2
i.f <- 9.28
CALL print(^i)
`;

const code63 = `DECLARE i: INTEGER

INPUT i
OUTPUT i
`;

const code64 = `DECLARE i: REAL

INPUT i
OUTPUT i
`;

const code65 = `DECLARE i: CHAR

INPUT i
OUTPUT i
`;;

const code66 = `DECLARE i: STRING

INPUT i
OUTPUT i
`;

const code67 = `DECLARE i: ARRAY[0: 3] OF INTEGER

INPUT i[0]
INPUT i[1]
i[2] <- 2
i[3] <- 3
OUTPUT i[0] + i[1] + i[2] + i[3]
`;

const code68 = `FUNCTION add() RETURNS REAL
    DECLARE i: REAL
    DECLARE j: REAL

    INPUT i
    INPUT j
    RETURN i + j
ENDFUNCTION

OUTPUT add()
`;

const code69 = `DECLARE i: INTEGER
DECLARE j: INTEGER

INPUT i
INPUT j
// FIXME: no OUTPUT for bools yet
OUTPUT (i < j) + 1
`;

const code70 = `DECLARE i: BOOLEAN
i <- TRUE
OUTPUT i
`;

const code71 = `DECLARE i: INTEGER

INPUT i
CASE OF i
    32: OUTPUT 1;
    33: OUTPUT 2;
ENDCASE
`;

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
    code19,
    code20,
    code21,
    code22,
    code23,
    code24,
    code25,
    code26,
    code27,
    code28,
    code29,
    code30,
    code31,
    code32,
    code33,
    code34,
    code35,
    code36,
    code37,
    code38,
    code39,
    code40,
    code41,
    code42,
    code43,
    code44,
    code45,
    code46,
    code47,
    code48,
    code49,
    code50,
    code51,
    code52,
    code53,
    code54,
    code55,
    code56,
    code57,
    code58,
    code59,
    code60,
    code61,
    code62,
    code63,
    code64,
    code65,
    code66,
    code67,
    code68,
    code69,
    code70,
    code71,
];
const expected = [
    10,
    7.28,
    2,
    "Hi",
    10,
    10,
    11,
    3,
    10,
    11,
    10,
    4,
    5,
    2,
    2,
    1.1 + 2.2,
    "a",
    "v",
    -1,
    -1,
    6,
    55,
    55,
    1210,
    1210,
    "Hello World",
    2147483647,
    -1,
    "Hello World",
    2,
    "nihao",
    "编码测试",
    49.5,
    0.05,
    0,
    "Hi",
    "Hi",
    55,
    55,
    "procedure",
    12,
    2,
    22,
    48,
    288,
    80,
    288,
    288,
    19,
    12,
    11,
    17,
    19,
    21,
    34,
    9 + 3.88,
    "Type test",
    "test",
    4,
    33,
    31,
    "Hi",
    11.28,
    32,
    3.14,
    'a',
    "Hello World!",
    69,
    6.28,
    1,
    "TRUE",
    1,
];
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
            // log the tokens and ast
            compiler.compile(true);
            compileCount++;
        } catch (e) {
            console.error(e);
            compileFailed.push(i);
        }

        try {
            // if fail push
            if ((await compiler.test(expected[i])) === false) runFailed.push(i);
            else runCount++;
        } catch (e) {
            console.error(e);
            runFailed.push(i);
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

*/
