import binaryen from "binaryen";
import { VarType } from "../type/variable";

type Type = binaryen.Type;

export class LocalTable {
    // all public here is actually very convinient
    public names: Array<string>;
    public types: Map<string, VarType>;
    public wasmTypes: Map<string, Type>;
    public indices: Map<string, number>;

    constructor() {
        this.names = new Array<string>();
        this.types = new Map<string, VarType>();
        this.wasmTypes = new Map<string, Type>();
        this.indices = new Map<string, number>();
    }

    public size(): number {
        return this.names.length;
    }

    public getWasmType(name: string): Type {
        if (!this.wasmTypes.has(name)) {
            throw new Error("Unknown variable '" + name + "'");
        }
        return this.wasmTypes.get(name) as Type;
    }

    public getType(name: string): VarType {
        if (!this.types.has(name)) {
            throw new Error("Unknown variable '" + name + "'");
        }
        return this.types.get(name) as VarType;
    }

    public getIndex(name: string): number {
        if (!this.indices.has(name)) {
            throw new Error("Unknown variable '" + name + "'");
        }
        return this.indices.get(name) as number;
    }

    public set(name: string, type: VarType, wasmType: Type, index: number): void {
        this.names.push(name);
        this.types.set(name, type);
        this.wasmTypes.set(name, wasmType);
        this.indices.set(name, index);
    }
}
