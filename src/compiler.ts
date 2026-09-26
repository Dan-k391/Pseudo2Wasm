/** Public compilation pipeline and execution host. */
import binaryen from "binaryen";

import { Scanner } from "./lex/scanner";
import { Parser } from "./syntax/parser";
import { Generator } from "./codegen/generator";
import { Checker } from "./type/checker";
import { CompilationError, Diagnostic, RuntimeError, SyntaxError, toDiagnostic } from "./error";
import { ProgramNode } from "./syntax/ast";
import { Token } from "./lex/token";
import { Execution, ExecutionResult, InputProvider, OutputConsumer } from "./runtime/execution";
export type { ExecutionResult, InputProvider, OutputConsumer, OutputValue } from "./runtime/execution";

export interface CompilerOptions {
    /** Default is "none"; O2 trades compile time for smaller Wasm. */
    optimization?: "none" | "binaryen-o2";
}

export class Compiler {
    private input: string;
    private options: CompilerOptions;

    constructor(input: string, options: CompilerOptions = {}) {
        this.input = input;
        this.options = options;
    }

    private analyze(): { tokens: Array<Token>; ast?: ProgramNode; failures: Array<SyntaxError | RuntimeError> } {
        const lexicalErrors: Array<SyntaxError> = [];
        const tokens = new Scanner(this.input).scan(lexicalErrors);
        if (lexicalErrors.length) return { tokens, failures: lexicalErrors };

        const syntaxErrors: Array<SyntaxError> = [];
        const ast = new Parser(tokens).parse(syntaxErrors);
        if (syntaxErrors.length) return { tokens, failures: syntaxErrors };

        const semanticErrors: Array<RuntimeError> = [];
        new Checker(ast).check(semanticErrors);
        return { tokens, ast, failures: semanticErrors };
    }

    /** Collect up to 20 errors from the earliest failing phase, without generating Wasm. */
    diagnose(): ReadonlyArray<Diagnostic> {
        return this.analyze().failures.map(toDiagnostic);
    }

    /** The caller owns the returned Binaryen module and must dispose it after use. */
    compile(log: boolean = false): binaryen.Module {
        const { tokens, ast, failures } = this.analyze();
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
        if (this.options.optimization !== "binaryen-o2") return module;
        // Binaryen 132's LocalCSE can assert on the live expression graph;
        // round-trip through Wasm to optimize a canonicalized module.
        let optimized: binaryen.Module;
        const features = module.getFeatures();
        try {
            optimized = binaryen.readBinary(module.emitBinary());
        } finally {
            module.dispose();
        }
        const previousLevel = binaryen.getOptimizeLevel();
        try {
            // BulkMemoryOpt is an optimizer feature flag, not encoded in Wasm.
            optimized.setFeatures(features);
            binaryen.setOptimizeLevel(2);
            optimized.optimize();
        } catch (error) {
            optimized.dispose();
            throw error;
        } finally {
            binaryen.setOptimizeLevel(previousLevel);
        }
        return optimized;
    }

    /** Validate and emit an owned byte array; no Binaryen module escapes. */
    compileBinary(): Uint8Array<ArrayBuffer> {
        const module = this.compile(false);
        try {
            if (!module.validate()) {
                throw new Error("Internal compiler error: generated WebAssembly failed validation; please report this pseudocode as a bug");
            }
            return new Uint8Array(module.emitBinary());
        } finally {
            module.dispose();
        }
    }

    /** Compatibility timing helper; includes awaited I/O, excludes compilation. */
    async runtime(output: OutputConsumer = console.log, input?: InputProvider): Promise<number> {
        const result = await this.execute([], output, input);
        return result.executionTimeMs;
    }

    /** Always returns a Promise; asynchronous callbacks require JSPI. */
    async execute(
        input: ReadonlyArray<unknown> = [],
        output?: OutputConsumer,
        inputProvider?: InputProvider
    ): Promise<ExecutionResult> {
        return new Execution(this.compileBinary(), this.input, input, output, inputProvider).run();
    }

    /** Runs to completion without JSPI; Promise-returning callbacks are rejected. */
    executeSync(
        input: ReadonlyArray<unknown> = [],
        output?: OutputConsumer,
        inputProvider?: InputProvider
    ): ExecutionResult {
        return new Execution(this.compileBinary(), this.input, input, output, inputProvider).runSync();
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
