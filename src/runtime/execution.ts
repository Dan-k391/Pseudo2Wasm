import { RuntimeError } from "../error";
import { GLOBAL_DATA_START, HEAP_START, MEMORY_END, MEMORY_PAGES } from "../memory-layout";
import { InputKind, parseInput } from "./input";

export type OutputValue = number | string;
export type InputProvider = () => unknown | PromiseLike<unknown>;
/** Non-Promise return values are ignored, retaining ordinary void-callback compatibility. */
export type OutputConsumer = (value: OutputValue) => unknown;

export interface ExecutionResult {
    outputs: Array<OutputValue>;
    inputsConsumed: number;
    /** Main execution and awaited I/O only; excludes compilation and instantiation. */
    executionTimeMs: number;
}

interface Jspi {
    Suspending: new (callback: (...args: number[]) => unknown) => WebAssembly.ImportValue;
    promising: (main: () => unknown) => () => Promise<unknown>;
}

function jspiApi(): Jspi | undefined {
    const api = WebAssembly as unknown as Partial<Jspi>;
    return typeof api.Suspending === "function" && typeof api.promising === "function" ? api as Jspi : undefined;
}

export function getRuntimeCapabilities(): { readonly jspi: boolean } {
    return { jspi: jspiApi() !== undefined };
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
    return value !== null && (typeof value === "object" || typeof value === "function") &&
        typeof (value as { then?: unknown }).then === "function";
}

/** Owns all mutable state for one invocation; never caches memory between runs. */
export class Execution {
    private readonly memory = new WebAssembly.Memory({ initial: MEMORY_PAGES, maximum: MEMORY_PAGES });
    private readonly encoder = new TextEncoder();
    private readonly decoder = new TextDecoder("utf8");
    private readonly outputs: OutputValue[] = [];
    private readonly input: ReadonlyArray<unknown>;
    private inputIndex = 0;
    private heapOffset = HEAP_START;

    constructor(
        private readonly wasm: Uint8Array<ArrayBuffer>,
        private readonly source: string,
        input: ReadonlyArray<unknown>,
        private readonly output?: OutputConsumer,
        private readonly inputProvider?: InputProvider,
    ) {
        // Snapshot the queue before any callback can mutate the caller's array.
        this.input = [...input];
    }

    private fail(message: string, line = 0, column = 0, code = "E_RUNTIME"): never {
        const error = new RuntimeError(message);
        error.source = this.source;
        error.code = code;
        if (line > 0) {
            error.line = line;
            error.startColumn = Math.max(0, column - 1);
            error.endColumn = error.startColumn + 1;
        }
        throw error;
    }

    private checkPointer(ptr: number, size: number, line: number, column: number): void {
        if (ptr === 0) this.fail("Null pointer dereference", line, column);
        if (ptr < GLOBAL_DATA_START || size < 1 || ptr + size > MEMORY_END) {
            this.fail(`Pointer access outside linear memory at address ${ptr}`, line, column);
        }
    }

    private createMain(synchronous: boolean): () => unknown {
        const api = synchronous ? undefined : jspiApi();
        const complete = <T>(value: unknown, convert: (value: unknown) => T, line = 0, column = 0): T | Promise<T> => {
            if (!isThenable(value)) return convert(value);
            const promise = Promise.resolve(value);
            if (!api) {
                // A callback may already have started work. Do not replay it or
                // let its eventual rejection become an unhandled rejection.
                void promise.catch(() => undefined);
                this.fail(synchronous
                    ? "executeSync() cannot await a Promise-returning callback; use execute() in a JSPI-capable runtime"
                    : "Asynchronous callbacks require WebAssembly.Suspending and WebAssembly.promising (JSPI); use synchronous callbacks or preloaded input in this runtime",
                    line, column, synchronous ? "E_ASYNC_CALLBACK" : "E_JSPI_UNAVAILABLE");
            }
            return promise.then(convert);
        };
        const read = (kind: InputKind, line: number, column: number): number | Promise<number> => {
            if (!this.inputProvider && this.inputIndex >= this.input.length) {
                this.fail(`Program requested input ${this.inputIndex + 1}, but only ${this.input.length} value(s) were provided`,
                    line, column, "E_INPUT_EXHAUSTED");
            }
            const index = this.inputIndex++;
            const value = this.inputProvider ? this.inputProvider() : this.input[index];
            // Queues contain values, not lazy input operations. Only providers may suspend.
            if (!this.inputProvider && isThenable(value)) {
                void Promise.resolve(value).catch(() => undefined);
                this.fail("Input queues must contain resolved values; use an input provider for asynchronous input",
                    line, column, "E_INPUT_VALUE");
            }
            return complete(value, raw => {
                const parsed = parseInput(kind, raw, message => this.fail(message, line, column, "E_INPUT_VALUE"));
                if (typeof parsed === "number") return parsed;
                const bytes = this.encoder.encode(parsed);
                if (this.heapOffset + bytes.length + 1 > MEMORY_END) {
                    this.fail("Input string exceeds heap memory limit", line, column);
                }
                const ptr = this.heapOffset;
                this.heapOffset += bytes.length + 1;
                const view = new Uint8Array(this.memory.buffer, ptr, bytes.length + 1);
                view.set(bytes);
                view[bytes.length] = 0;
                return ptr;
            }, line, column);
        };
        const emit = (value: OutputValue): void | Promise<void> => {
            this.outputs.push(value);
            return complete(this.output?.(value), () => undefined);
        };
        const env: Record<string, WebAssembly.ImportValue> = {
            buffer: this.memory,
            logInteger: emit,
            logReal: emit,
            logChar: (value: number) => emit(String.fromCharCode(value)),
            logBoolean: (value: number) => emit(value === 0 ? "FALSE" : "TRUE"),
            logString: (ptr: number) => {
                this.checkPointer(ptr, 1, 0, 0);
                const bytes = new Uint8Array(this.memory.buffer, ptr, MEMORY_END - ptr);
                const terminator = bytes.indexOf(0);
                return emit(this.decoder.decode(terminator < 0 ? bytes : bytes.subarray(0, terminator)));
            },
            inputInteger: (line: number, column: number) => read("INTEGER", line, column),
            inputReal: (line: number, column: number) => read("REAL", line, column),
            inputChar: (line: number, column: number) => read("CHAR", line, column),
            inputString: (line: number, column: number) => read("STRING", line, column),
            inputBoolean: (line: number, column: number) => read("BOOLEAN", line, column),
            failIndex: (index: number, lower: number, upper: number, line: number, column: number) =>
                this.fail(`Array index ${index} outside [${lower}:${upper}]`, line, column),
            failPointer: (ptr: number, size: number, line: number, column: number) => {
                this.checkPointer(ptr, size, line, column);
                this.fail(`Invalid pointer access at address ${ptr}`, line, column);
            },
            failStack: (_next: number, line: number, column: number) => this.fail("Stack memory limit exceeded", line, column),
            // includes 0 and range
            randomInteger: (range: number) => Math.floor(Math.random() * (range + 1)),
            startTime: () => console.time("Execution time"),
            endTime: () => console.timeEnd("Execution time"),
        };
        const module = new WebAssembly.Module(this.wasm);
        let suspending = false;
        if (api) {
            for (const entry of WebAssembly.Module.imports(module)) {
                if (entry.module !== "env" || entry.kind !== "function") continue;
                if ((entry.name.startsWith("input") && this.inputProvider) ||
                    (entry.name.startsWith("log") && this.output)) {
                    env[entry.name] = new api.Suspending(env[entry.name] as (...args: number[]) => unknown);
                    suspending = true;
                }
            }
        }
        const instance = new WebAssembly.Instance(module, { env });
        const main = instance.exports.main as () => unknown;
        return suspending ? api!.promising(main) : main;
    }

    private result(start: number): ExecutionResult {
        return { outputs: this.outputs, inputsConsumed: this.inputIndex, executionTimeMs: performance.now() - start };
    }

    runSync(): ExecutionResult {
        const main = this.createMain(true);
        const start = performance.now();
        main();
        return this.result(start);
    }

    async run(): Promise<ExecutionResult> {
        const main = this.createMain(false);
        const start = performance.now();
        const pending = main();
        if (isThenable(pending)) await pending;
        return this.result(start);
    }
}
