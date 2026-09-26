import binaryen from "binaryen";
import { ParameterReads } from "./parameter-reads";

/** Function-local backend state; indices never leak between emitted functions. */
export class FunctionContext {
    readonly returnLocal: number | undefined;
    readonly checkValueLocal: number;
    readonly checkPointerLocal: number;
    readonly localTypes: binaryen.Type[];

    constructor(
        parameterCount = 0,
        resultType: binaryen.Type = binaryen.none,
        readonly parameterReads: ParameterReads = new Map(),
    ) {
        const hasResult = resultType !== binaryen.none;
        this.returnLocal = hasResult ? parameterCount : undefined;
        this.checkValueLocal = parameterCount + (hasResult ? 1 : 0);
        this.checkPointerLocal = this.checkValueLocal + 1;
        this.localTypes = hasResult
            ? [resultType, binaryen.i32, binaryen.i32]
            : [binaryen.i32, binaryen.i32];
    }
}
