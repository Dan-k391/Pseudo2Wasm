import binaryen from "binaryen";
import { 
    Type,
    typeKind,
    basicKind,
    BasicType,
    ArrayType,
    RecordType
} from "../type/type";

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
