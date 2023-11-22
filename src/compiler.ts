// TODO: get rid of the main function
import binaryen from "binaryen";

import { Scanner } from "./lex/scanner";
import { Parser } from "./syntax/parser";
import { Generator } from "./codegen/generator";
import { Checker } from "./type/checker";

export class Compiler {
    private input: string;

    constructor(input: string) {
        this.input = input;
    }

    compile(log: boolean): binaryen.Module {
        const scanner = new Scanner(this.input);
        const tokens = scanner.scan();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        const checker = new Checker(ast);
        const typedAst = checker.check();
        if (log) {
            console.log(tokens);
            console.log(ast);
            console.log(typedAst);
        }
        const generator = new Generator(typedAst);
        const module = generator.generate();
        return module;
    }

    async runtime(): Promise<number> {
        const module = this.compile(false);

        // module.optimize();

        console.log(module.emitText());
        const wasm = module.emitBinary();

        // initialize import objects
        const memory = new WebAssembly.Memory({ initial: 1, maximum: 2 });
        const importObect = {
            env: {
                buffer: memory,
                logNumber: (output: number) => {
                    console.log(output);
                },
                logString: (output: number) => {
                    const bytes = new Uint8Array(memory.buffer, output);
                    const str = bytes.toString();
                    console.log(str);
                }
            },
        }

        // FIXME: not updated version, test() has the newest functions
        const { instance } = await WebAssembly.instantiate(wasm, importObect);

        const main = instance.exports.main as CallableFunction;
        const start = new Date().getTime();
        main();
        const end = new Date().getTime();
        return end - start;
    }

    // the test function
    async test(input: Array<any>, expected: Array<any>): Promise<Boolean> {
        let correct = true;
        let inputIndex = 0;
        let expectedIndex = 0;

        const module = this.compile(false);

        // module.optimize();

        if (!module.validate()) {
            throw new Error("Module validation error");
        }

        // uncomment following two lines to see the text format
        // const text = module.emitText();
        // console.log(text);
        const wasm = module.emitBinary();

        // 0-10: global variables
        // 11-20: stack
        // 21-30: heap
        // takes up totally 1.875MB
        const pages = 30;
        const pageSize = 65536;
        const heapStart = 20 * pageSize;
        // initialize import objects
        const memory = new WebAssembly.Memory({ initial: pages, maximum: pages });
        const maxSize = pageSize * pages - 1;
        let heapOffSet = heapStart;

        // TODO: input validation
        // input test
        const inputInteger = () => new Promise<number>(resolve => {
            const num = input[inputIndex++];
            resolve(parseInt(num));
        });
        const inputReal = () => new Promise<number>(resolve => {
            const num = input[inputIndex++];
            resolve(parseFloat(num));
        });
        const inputChar = () => new Promise<number>(resolve => {
            const str = input[inputIndex++];
            // utf-8 encoding
            const bytes = new TextEncoder().encode(str);
            resolve(bytes[0]);
        });
        const inputString = () => new Promise<number>(resolve => {
            const str = input[inputIndex++];
            const bytes = new TextEncoder().encode(str);
            // currently allocate on the heap
            // maybe allocate on a separate page later
            const ptr = heapOffSet;
            heapOffSet += bytes.length;
            const len = bytes.length;
            const view = new Uint8Array(memory.buffer, ptr, len);
            view.set(bytes);
            resolve(ptr);
        });
        const inputBoolean = () => new Promise<number>(resolve => {
            const str = input[inputIndex++];
            if (str === "TRUE") resolve(1);
            else resolve(0);
        });

        // @ts-ignore
        const suspendingInputInteger = new WebAssembly.Function(
            { parameters: ["externref"], results: ["i32"] },
            inputInteger,
            { suspending: "first" }
        );
        // @ts-ignore
        const suspendingInputReal = new WebAssembly.Function(
            { parameters: ["externref"], results: ["f64"] },
            inputReal,
            { suspending: "first" }
        );
        // @ts-ignore
        const suspendingInputChar = new WebAssembly.Function(
            { parameters: ["externref"], results: ["i32"] },
            inputChar,
            { suspending: "first" }
        );
        // @ts-ignore
        const suspendingInputString = new WebAssembly.Function(
            { parameters: ["externref"], results: ["i32"] },
            inputString,
            { suspending: "first" }
        );
        // @ts-ignore
        const suspendingInputBoolean = new WebAssembly.Function(
            { parameters: ["externref"], results: ["i32"] },
            inputBoolean,
            { suspending: "first" }
        );

        // TODO: currently import many log functions, change to only logString later
        const importObect = {
            env: {
                buffer: memory,
                logInteger: (output: number) => {
                    if (output !== expected[expectedIndex++]) {
                        correct = false;
                    }
                    console.log(`Expected: ${expected[expectedIndex - 1]}, Actual: ${output}`);
                },
                logReal: (output: number) => {
                    if (output !== expected[expectedIndex++]) {
                        correct = false;
                    }
                    console.log(`Expected: ${expected[expectedIndex - 1]}, Actual: ${output}`);
                },
                logChar: (output: number) => {
                    // TODO: utf-8 encoding
                    if (String.fromCharCode(output) !== expected[expectedIndex++]) {
                        correct = false;
                    }
                    console.log(`Expected: ${expected[expectedIndex - 1]}, Actual: ${String.fromCharCode(output)}`);
                },
                logString: (output: number) => {
                    const bytes = new Uint8Array(memory.buffer, output, maxSize - output);
                    let str = new TextDecoder("utf8").decode(bytes);
                    str = str.split('\0')[0];
                    if (str !== expected[expectedIndex++]) {
                        correct = false;
                    }
                    console.log(`Expected: ${expected[expectedIndex - 1]}, Actual: ${str}`);
                },
                logBoolean: (output: number) => {
                    if (output == 0) {
                        if (expected[expectedIndex++] === "TRUE") {
                            correct = false;
                        }
                        console.log(`Expected: ${expected[expectedIndex - 1]}, Actual: FALSE`);
                    }
                    else {
                        if (expected[expectedIndex++] === "FALSE") {
                            correct = false;
                        }
                        console.log(`Expected: ${expected[expectedIndex - 1]}, Actual: TRUE`);
                    }
                },
                inputInteger: suspendingInputInteger,
                inputReal: suspendingInputReal,
                inputChar: suspendingInputChar,
                inputString: suspendingInputString,
                inputBoolean: suspendingInputBoolean,
                randomInteger: (range: number) => {
                    // includes 0 and range
                    return Math.floor(Math.random() * (range + 1));
                },
                startTime: () => {
                    console.time("Execution time");
                },
                endTime: () => {
                    console.timeEnd("Execution time");
                },
            },
        }

        const { instance } = await WebAssembly.instantiate(wasm, importObect);

        // @ts-ignore
        const main = new WebAssembly.Function(
            { parameters: [], results: ["externref"] },
            instance.exports.main,
            { promising: "first" }
        );

        // for debug
        // debugger;
        const start = new Date().getTime();
        await main();
        const end = new Date().getTime();
        console.log("Execution time: ", end - start);

        return correct;
    }
}
