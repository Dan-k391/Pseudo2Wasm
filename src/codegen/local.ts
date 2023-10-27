// TODO: maybe change back to the one single map data structure LOL
import binaryen from "binaryen";
import { Type } from "../type/type";

type WasmType = binaryen.Type;

export class Local {
    // all public here is actually very convinient
    public type: Type;
    // offset is relative to stackbase
    // memory
    //       stackbase
    //           ⬇
    // -----------------------------------------
    // | globals | stack->       <-heap(maybe) |
    // -----------------------------------------
    public offset: number;

    constructor(type: Type, offset: number) {
        this.type = type;
        this.offset = offset;
    }
}
