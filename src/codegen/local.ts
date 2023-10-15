// TODO: maybe change back to the one single map data structure LOL
import binaryen from "binaryen";
import { 
    Type,
    typeKind} from "../type/type";
import { basicKind } from "../type/basic";
import { RecordType } from "../type/record";
import { ArrayType } from "../type/array";
import { BasicType } from "../type/basic";

type WasmType = binaryen.Type;

export class Local {
    // all public here is actually very convinient
    public type: Type;
    public wasmType: WasmType;
    // offset is relative to stackbase
    // memory
    //       stackbase
    //           ⬇
    // -----------------------------------------
    // | globals | stack->       <-heap(maybe) |
    // -----------------------------------------
    public offset: number;

    constructor(type: Type, wasmType: WasmType, offset: number) {
        this.type = type;
        this.wasmType = wasmType;
        this.offset = offset;
    }
}
