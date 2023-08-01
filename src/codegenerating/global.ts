import binaryen from "binaryen";
import { VarType } from "../variable";

type Type = binaryen.Type;

export class GlobalTable {
    // all public here is actually very convinient
    public names: Array<string>;
    private types: Map<string, VarType>;
    private wasmTypes: Map<string, Type>;

    constructor() {
        this.names = new Array<string>();
        this.types = new Map<string, VarType>();
        this.wasmTypes = new Map<string, Type>();
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

    public set(name: string, type: VarType, wasmType: Type): void {
        this.names.push(name);
        this.types.set(name, type);
        this.wasmTypes.set(name, wasmType);
    }
}
