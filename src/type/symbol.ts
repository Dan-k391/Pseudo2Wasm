import binaryen from "binaryen";
import { Type } from "./type";

type ExpressionRef = binaryen.ExpressionRef;

export const enum symbolKind {
    // TODO: maybe add param kind? now not needed
    // PARAM = "PARAM",
    GLOBAL = "GLOBAL",
    LOCAL = "LOCAL"
}

export class Symbol {
    public type: Type;
    // pointer is the absolute address of the variable
    // memory
    //       stackbase
    //           ⬇
    // -----------------------------------------
    // | globals | stack->       <-heap(maybe) |
    // -----------------------------------------
    // assign pointer in the codegen phase
    public kind: symbolKind;
    /** @deprecated Compatibility field only. Generator owns its storage map. */
    public pointer!: ExpressionRef;

    constructor(type: Type, kind: symbolKind) {
        this.type = type;
        this.kind = kind;
    }
}
