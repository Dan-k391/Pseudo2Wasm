import type binaryen from "binaryen";
import { Type } from "./type";

type ExpressionRef = binaryen.ExpressionRef;

export const enum symbolKind {
    GLOBAL = "GLOBAL",
    LOCAL = "LOCAL"
}

/** Resolved source identity and type, independent of a particular Wasm module. */
export class Symbol {
    public type: Type;
    public kind: symbolKind;
    /** @deprecated Compatibility field only. Generator owns its storage map. */
    public pointer!: ExpressionRef;

    constructor(type: Type, kind: symbolKind) {
        this.type = type;
        this.kind = kind;
    }
}
