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

export class GlobalTable {
    // all public here is actually very convinient
    public names: Array<string>;
    private types: Map<string, Type>;
    private wasmTypes: Map<string, WasmType>;

    constructor() {
        this.names = new Array<string>();
        this.types = new Map<string, Type>();
        this.wasmTypes = new Map<string, WasmType>();
    }

    public size(): number {
        return this.names.length;
    }

    public getWasmType(name: string): WasmType {
        if (!this.wasmTypes.has(name)) {
            throw new Error("Unknown variable '" + name + "'");
        }
        return this.wasmTypes.get(name) as WasmType;
    }

    public getType(name: string): Type {
        if (!this.types.has(name)) {
            throw new Error("Unknown variable '" + name + "'");
        }
        return this.types.get(name) as Type;
    }

    public set(name: string, type: Type, wasmType: WasmType): void {
        this.names.push(name);
        this.types.set(name, type);
        this.wasmTypes.set(name, wasmType);
    }
}
