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

export class LocalTable {
    // all public here is actually very convinient
    public names: Array<string>;
    public types: Map<string, Type>;
    public wasmTypes: Map<string, WasmType>;
    public indices: Map<string, number>;

    constructor() {
        this.names = new Array<string>();
        this.types = new Map<string, Type>();
        this.wasmTypes = new Map<string, WasmType>();
        this.indices = new Map<string, number>();
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

    public getIndex(name: string): number {
        if (!this.indices.has(name)) {
            throw new Error("Unknown variable '" + name + "'");
        }
        return this.indices.get(name) as number;
    }

    public set(name: string, type: Type, wasmType: WasmType, index: number): void {
        this.names.push(name);
        this.types.set(name, type);
        this.wasmTypes.set(name, wasmType);
        this.indices.set(name, index);
    }
}
