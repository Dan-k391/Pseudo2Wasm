// TODO: maybe change back to the one single map data structure LOL
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
    // all public here is actually very convinient
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
    public pointer!: ExpressionRef;

    constructor(type: Type, kind: symbolKind) {
        this.type = type;
        this.kind = kind;
    }
}
