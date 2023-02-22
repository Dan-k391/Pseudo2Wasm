// useless interfaces

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
