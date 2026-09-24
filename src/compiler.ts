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

    compile(log: boolean = false): binaryen.Module {
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

    async runtime(
        output: (value: number | string) => void = console.log,
        input?: () => unknown | Promise<unknown>
    ): Promise<number> {
        const result = await this.execute([], output, input);
        return result.executionTimeMs;
    }

    async execute(
        input: ReadonlyArray<unknown>,
        output?: (value: number | string) => void,
        inputProvider?: () => unknown | Promise<unknown>
    ): Promise<ExecutionResult> {
        let inputIndex = 0;
        const outputs: Array<unknown> = [];

        const module = this.compile(false);

        // module.optimize();

        if (!module.validate()) {
            throw new Error("Module validation error");
        }

        // uncomment following two lines to see the text format
        // const text = module.emitText();
        // console.log(text);
        // Give WebAssembly a fresh ArrayBuffer-backed view (TS 5.9 distinguishes it
        // from a Uint8Array that could be backed by SharedArrayBuffer).
        const wasm = new Uint8Array(module.emitBinary());

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

        const nextInput = (): unknown | Promise<unknown> => {
            if (inputProvider) {
                inputIndex++;
                return inputProvider();
            }
            if (inputIndex >= input.length) {
                throw new Error(`Program requested input ${inputIndex + 1}, but only ${input.length} value(s) were provided`);
            }
            return input[inputIndex++];
        };

        const inputInteger = async () => parseInt(String(await nextInput()), 10);
        const inputReal = async () => parseFloat(String(await nextInput()));
        const inputChar = async () => {
            const str = String(await nextInput());
            // utf-8 encoding
            const bytes = new TextEncoder().encode(str);
            return bytes[0];
        };
        const inputString = async () => {
            const str = String(await nextInput());
            const bytes = new TextEncoder().encode(str);
            // currently allocate on the heap
            // maybe allocate on a separate page later
            const ptr = heapOffSet;
            heapOffSet += bytes.length;
            const len = bytes.length;
            const view = new Uint8Array(memory.buffer, ptr, len);
            view.set(bytes);
            return ptr;
        };
        const inputBoolean = async () => {
            const value = await nextInput();
            return value === true || value === "TRUE" ? 1 : 0;
        };

        const emit = (value: number | string): void => {
            outputs.push(value);
            output?.(value);
        };

        // @ts-ignore
        const suspendingInputInteger = new WebAssembly.Suspending(
            inputInteger
        );
        // @ts-ignore
        const suspendingInputReal = new WebAssembly.Suspending(
            inputReal
        );
        // @ts-ignore
        const suspendingInputChar = new WebAssembly.Suspending(
            inputChar
        );
        // @ts-ignore
        const suspendingInputString = new WebAssembly.Suspending(
            inputString
        );
        // @ts-ignore
        const suspendingInputBoolean = new WebAssembly.Suspending(
            inputBoolean
        );

        // TODO: currently import many log functions, change to only logString later
        const importObect = {
            env: {
                buffer: memory,
                logInteger: (output: number) => {
                    emit(output);
                },
                logReal: (output: number) => {
                    emit(output);
                },
                logChar: (output: number) => {
                    // TODO: utf-8 encoding
                    emit(String.fromCharCode(output));
                },
                logString: (output: number) => {
                    const bytes = new Uint8Array(memory.buffer, output, maxSize - output);
                    let str = new TextDecoder("utf8").decode(bytes);
                    str = str.split('\0')[0];
                    emit(str);
                },
                logBoolean: (output: number) => {
                    emit(output === 0 ? "FALSE" : "TRUE");
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
        const main = WebAssembly.promising(
            instance.exports.main
        );

        // for debug
        // debugger;
        const start = new Date().getTime();
        await main();
        const end = new Date().getTime();

        return {
            outputs,
            inputsConsumed: inputIndex,
            executionTimeMs: end - start,
        };
    }

    /**
     * Compatibility helper for the previously published package API.
     * New code should use execute() and assert against its outputs directly.
     */
    async test(expected: number | string): Promise<boolean>;
    async test(input: ReadonlyArray<unknown>, expected: ReadonlyArray<unknown>): Promise<boolean>;
    async test(
        inputOrExpected: ReadonlyArray<unknown> | number | string,
        expected?: ReadonlyArray<unknown>
    ): Promise<boolean> {
        const legacyCall = !Array.isArray(inputOrExpected);
        const input = legacyCall ? [] : inputOrExpected as ReadonlyArray<unknown>;
        const expectedOutputs = legacyCall ? [inputOrExpected] : expected;

        if (expectedOutputs === undefined) {
            throw new Error("Expected outputs must be provided");
        }

        const result = await this.execute(input);
        return result.outputs.length === expectedOutputs.length &&
            result.outputs.every((output, index) => Object.is(output, expectedOutputs[index]));
    }
}

export interface ExecutionResult {
    outputs: Array<unknown>;
    inputsConsumed: number;
    executionTimeMs: number;
}
