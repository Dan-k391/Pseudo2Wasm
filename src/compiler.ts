// TODO: get rid of the main function
import binaryen from "binaryen";

import { Scanner } from "./lex/scanner";
import { Parser } from "./syntax/parser";
import { Generator } from "./codegen/generator";
import { Checker } from "./type/checker";
import { CompilationError, Diagnostic, RuntimeError, SyntaxError, toDiagnostic } from "./error";
import { ProgramNode } from "./syntax/ast";
import { Token } from "./lex/token";
import { GLOBAL_DATA_START, HEAP_START, MEMORY_END, MEMORY_PAGES, STACK_START } from "./memory-layout";

export class Compiler {
    private input: string;

    constructor(input: string) {
        this.input = input;
    }

    private analyze(): {tokens: Array<Token>; ast?: ProgramNode; failures: Array<SyntaxError | RuntimeError>} {
        const lexicalErrors: Array<SyntaxError> = [];
        const tokens = new Scanner(this.input).scan(lexicalErrors);
        if (lexicalErrors.length) return {tokens, failures: lexicalErrors};

        const syntaxErrors: Array<SyntaxError> = [];
        const ast = new Parser(tokens).parse(syntaxErrors);
        if (syntaxErrors.length) return {tokens, failures: syntaxErrors};

        const semanticErrors: Array<RuntimeError> = [];
        new Checker(ast).check(semanticErrors);
        return {tokens, ast, failures: semanticErrors};
    }

    /** Inspect all user-source errors without generating WebAssembly. */
    diagnose(): ReadonlyArray<Diagnostic> {
        return this.analyze().failures.map(toDiagnostic);
    }

    compile(log: boolean = false): binaryen.Module {
        const {tokens, ast, failures} = this.analyze();
        if (failures.length === 1) {
            failures[0].source = this.input;
            throw failures[0];
        }
        if (failures.length > 1) {
            throw new CompilationError(failures.map(toDiagnostic), this.input);
        }
        const typedAst = ast!;
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
            throw new Error("Internal compiler error: generated WebAssembly failed validation; please report this pseudocode as a bug");
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
        const memory = new WebAssembly.Memory({ initial: MEMORY_PAGES, maximum: MEMORY_PAGES });
        let heapOffSet = HEAP_START;

        const runtimeFailure = (message: string, line = 0, column = 0): never => {
            const error = new RuntimeError(message);
            error.source = this.input;
            if (line > 0) {
                error.line = line;
                error.startColumn = Math.max(0, column - 1);
                error.endColumn = error.startColumn + 1;
            }
            throw error;
        };

        const checkPointer = (ptr: number, size: number, line: number, column: number): number => {
            if (ptr === 0) runtimeFailure("Null pointer dereference", line, column);
            if (ptr < GLOBAL_DATA_START || size < 1 || ptr + size > MEMORY_END) {
                runtimeFailure(`Pointer access outside linear memory at address ${ptr}`, line, column);
            }
            return ptr;
        };

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
        const inputString = async (line: number, column: number) => {
            const str = String(await nextInput());
            const bytes = new TextEncoder().encode(str);
            if (heapOffSet + bytes.length + 1 > MEMORY_END) {
                runtimeFailure("Input string exceeds heap memory limit", line, column);
            }
            const ptr = heapOffSet;
            heapOffSet += bytes.length + 1;
            const view = new Uint8Array(memory.buffer, ptr, bytes.length + 1);
            view.set(bytes);
            view[bytes.length] = 0;
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
                    checkPointer(output, 1, 0, 0);
                    const bytes = new Uint8Array(memory.buffer, output, MEMORY_END - output);
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
                checkIndex: (index: number, lower: number, upper: number, line: number, column: number) => {
                    if (index < lower || index > upper) {
                        runtimeFailure(`Array index ${index} outside [${lower}:${upper}]`, line, column);
                    }
                    return index - lower;
                },
                checkPointer,
                checkStack: (next: number, line: number, column: number) => {
                    if (next < STACK_START || next > HEAP_START) {
                        runtimeFailure("Stack memory limit exceeded", line, column);
                    }
                    return next;
                },
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
