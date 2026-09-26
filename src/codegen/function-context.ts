import binaryen from "binaryen";
import { Symbol } from "../type/symbol";
import { StorageLocation } from "./storage";
import { IntegerRange } from "../analysis/loop-ranges";

/** Function-local backend state; indices never leak between emitted functions. */
export class FunctionContext {
    readonly returnLocal: number | undefined;
    readonly returnLabel = "__return";
    private valueScratch?: number;
    private pointerScratch?: number;
    private readonly caseLocals = new Map<binaryen.Type, number>();
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
        this.localTypes = hasResult ? [resultType] : [];
    }

    get checkValueLocal(): number {
        return this.valueScratch ??= this.allocateLocal(binaryen.i32);
    }

    get checkPointerLocal(): number {
        return this.pointerScratch ??= this.allocateLocal(binaryen.i32);
    }

    caseLocal(type: binaryen.Type): number {
        let index = this.caseLocals.get(type);
        if (index === undefined) {
            index = this.allocateLocal(type);
            this.caseLocals.set(type, index);
        }
        return index;
    }

    allocateLocal(type: binaryen.Type): number {
        const index = this.parameterCount + this.localTypes.length;
        this.localTypes.push(type);
        return index;
    }
}
