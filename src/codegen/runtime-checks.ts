import binaryen from "binaryen";
import { GLOBAL_DATA_START, HEAP_START, MEMORY_END } from "../memory-layout";
import { FunctionContext } from "./function-context";

/** Emits checks only; source analysis and storage layout live in separate modules. */
export class RuntimeChecks {
    constructor(private readonly module: binaryen.Module, private readonly context: FunctionContext) { }

    stack(next: binaryen.ExpressionRef, line: number, column: number): binaryen.ExpressionRef {
        const module = this.module;
        const local = this.context.checkValueLocal;
        const current = () => module.local.get(local, binaryen.i32);
        return module.block(null, [
            module.local.set(local, next),
            module.if(module.i32.gt_u(current(), module.i32.const(HEAP_START)),
                module.call("failStack", [current(), module.i32.const(line), module.i32.const(column)], binaryen.none)),
            current(),
        ], binaryen.i32);
    }

    pointer(pointer: binaryen.ExpressionRef, size: number, line: number, column: number): binaryen.ExpressionRef {
        const module = this.module;
        const local = this.context.checkPointerLocal;
        const current = () => module.local.get(local, binaryen.i32);
        const invalidSize = size < 1 || size > MEMORY_END - GLOBAL_DATA_START;
        // Unsigned subtraction sends addresses below the lower bound above the
        // allowed extent, including null and negative i32 bit patterns.
        const invalid = invalidSize ? module.i32.const(1) : module.i32.gt_u(
            module.i32.sub(current(), module.i32.const(GLOBAL_DATA_START)),
            module.i32.const(MEMORY_END - size - GLOBAL_DATA_START));
        return module.block(null, [
            module.local.set(local, pointer),
            module.if(invalid, module.call("failPointer", [current(), module.i32.const(size),
            module.i32.const(line), module.i32.const(column)], binaryen.none)),
            current(),
        ], binaryen.i32);
    }

    index(index: binaryen.ExpressionRef, lower: number, upper: number,
        line: number, column: number): binaryen.ExpressionRef {
        const module = this.module;
        const local = this.context.checkValueLocal;
        const current = () => module.local.get(local, binaryen.i32);
        const normalized = () => lower === 0 ? current() : module.i32.sub(current(), module.i32.const(lower));
        // For a non-wrapping inclusive i32 interval, x is in [lo, hi] exactly when
        // unsigned(x - lo) <= unsigned(hi - lo). Retain x for the error report.
        return module.block(null, [
            module.local.set(local, index),
            module.if(module.i32.gt_u(normalized(), module.i32.const(upper - lower)),
                module.call("failIndex", [current(), module.i32.const(lower), module.i32.const(upper),
                module.i32.const(line), module.i32.const(column)], binaryen.none)),
            normalized(),
        ], binaryen.i32);
    }
}
