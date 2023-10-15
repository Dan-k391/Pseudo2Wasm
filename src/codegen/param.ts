import binaryen from "binaryen";
import { 
    Type,
    typeKind} from "../type/type";
import { basicKind } from "../type/basic";
import { RecordType } from "../type/record";
import { ArrayType } from "../type/array";
import { BasicType } from "../type/basic";

type WasmType = binaryen.Type;

export class Param {
    // all public here is actually very convinient
    public type: Type;
    public wasmType: WasmType;
    // stores the index of local param
    // load from this index into the memory at the start of the function
    public index: number;

    constructor(type: Type, wasmType: WasmType, index: number) {
        this.type = type;
        this.wasmType = wasmType;
        this.index = index;
    }
}
