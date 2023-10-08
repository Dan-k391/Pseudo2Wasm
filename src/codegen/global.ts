// TODO: maybe change back to the one single map data structure LOL
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

export class Global {
    // all public here is actually very convinient
    public type: Type;
    public wasmType: WasmType;
    // it is named 'offset' but it starts from 0 because globals
    // are stored at the start of the memory
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
