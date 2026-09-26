// useless interfaces
/** Legacy host interface declarations retained for low-level compatibility.
 * The active Wasm ABI is specified in codegen/runtime-abi.ts.
 */

export interface ImportObject {
    env: Environment;
}

export interface Environment {
    buffer: WebAssembly.Memory;
    output: OutputFunction;
}

export interface OutputFunction {
    (output: number | string): void;
}
