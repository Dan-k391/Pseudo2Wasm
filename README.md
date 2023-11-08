# OAC

#### 介绍
OAC (Oh a compiler)
灵感来源于zjj

###
Pseudo2Wasm,
is an improvement to OAC(Web version),
adds an IR generation layer implemented with binaryen.
still in progress

### Usage

Use `runCode(inputCode, outputFunction)`
```js
import * as promise from "pseudo2wasm";

let pseudo2wasm = await promise;

pseudo2wasm.runCode(`OUTPUT 1`, console.log)
```
OR construct your own compiler
```js
function compile(input) {
    if (!input) {
        return;
    }
    const scanner = new pseudo2wasm.Scanner(input);
    const tokens = scanner.scan();
    console.log(tokens);
    const parser = new pseudo2wasm.Parser(tokens);
    const ast = parser.parse();
    console.log(ast);
    const checker = new Checker(ast);
    const typedAst = checker.check();
    console.log(typedAst);
    const generator = new pseudo2wasm.Generator(ast);
    const module = generator.generate();
    return module;
}

async function runtime(input, output) {
    const module = compile(input);

    // module.optimize();

    console.log(module.emitText());
    const wasm = module.emitBinary();

    // initialize import objects
    // inittial size has to be 2
    const memory = new WebAssembly.Memory({ initial: 2, maximum: 10 });
    const maxSize = 65536 * 2 - 1;
    const importObect = {
        env: {
            buffer: memory,
            logInteger: (value) => {
                output(value);
            },
            logReal: (value) => {
                console.log(value);
            },
            logChar: (value) => {
                console.log(String.fromCharCode(value));
            },
            logString: (value) => {
                const bytes = new Uint8Array(memory.buffer, maxSize - value);
                const str = bytes.toString();
                console.log(str);
            }
        },
    }
    const { instance } = await WebAssembly.instantiate(wasm, importObect);

    const main = instance.exports.main;
    const start = new Date().getTime();
    main();
    const end = new Date().getTime();
    return end - start;
}
```
