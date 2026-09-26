import binaryen from "binaryen";
import { Symbol } from "../type/symbol";
import { StorageLocation } from "./storage";
import { IntegerRange } from "./loop-ranges";

/** Function-local backend state; indices never leak between emitted functions. */
export class FunctionContext {
    readonly returnLocal: number | undefined;
    readonly checkValueLocal: number;
    readonly checkPointerLocal: number;
    readonly localTypes: binaryen.Type[];
    readonly storage = new Map<Symbol, StorageLocation>();
    readonly ranges = new Map<Symbol, IntegerRange>();
    frameless = false;
    shadowWrites = false;
    frameBytes = 0;
    hasByRef = false;

    constructor(
        private readonly parameterCount = 0,
        resultType: binaryen.Type = binaryen.none,
    ) {
        const hasResult = resultType !== binaryen.none;
        this.returnLocal = hasResult ? parameterCount : undefined;
        this.checkValueLocal = parameterCount + (hasResult ? 1 : 0);
        this.checkPointerLocal = this.checkValueLocal + 1;
        this.localTypes = hasResult
            ? [resultType, binaryen.i32, binaryen.i32]
            : [binaryen.i32, binaryen.i32];
    }

    allocateLocal(type: binaryen.Type): number {
        const index = this.parameterCount + this.localTypes.length;
        this.localTypes.push(type);
        return index;
    }
}
