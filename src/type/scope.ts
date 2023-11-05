import binaryen from "binaryen";
import { RuntimeError } from "../error";
import { FunctionType } from "./function";
import { ProcedureType } from "./procedure";
import { RecordType } from "./record";
import { Symbol } from "./symbol";
import { Type } from "./type";

type ExpressionRef = binaryen.ExpressionRef;


export class Scope {
    // if is function, enable return statement
    public isFunc: boolean;
    public parent?: Scope;
    public returnType?: Type;
    // if is function, returnIndex is the local index of the return value
    public returnIndex?: number;
    public children: Array<Scope>;
    public elems: Map<string, Symbol>;
    public functions: Map<string, FunctionType>;
    public procedures: Map<string, ProcedureType>;
    // RECORDs, ENUMs, and POINTERs
    public types: Map<string, Type>;

    constructor(isFunc: boolean, parent?: Scope, returnType?: Type, returnIndex?: number) {
        this.isFunc = isFunc;
        if (parent) {
            this.parent = parent;
        }
        if (returnType) {
            this.returnType = returnType;
        }
        if (returnIndex) {
            this.returnIndex = returnIndex;
        }
        this.children = new Array<Scope>();
        this.elems = new Map<string, Symbol>();
        this.functions = new Map<string, FunctionType>();
        this.procedures = new Map<string, ProcedureType>();
        this.types = new Map<string, RecordType>;
    }

    public size(): number {
        let total: number = 0;
        for (let symbol of this.elems.values()) {
            total += symbol.type.size();
        }
        return total;
    }

    public insert(name: string, symbol: Symbol) {
        this.elems.set(name, symbol);
    }

    public lookUp(name: string): Symbol {
        if (!this.elems.has(name)) {
            if (!this.parent) {
                throw new RuntimeError("Unknown variable '" + name + "'");
            }
            return this.parent.lookUp(name);
        }
        return this.elems.get(name)!;
    }

    public setPointer(name: string, ptr: ExpressionRef) {
        if (!this.elems.has(name)) {
            if (!this.parent) {
                throw new RuntimeError("Unknown variable '" + name + "'");
            }
            this.parent.setPointer(name, ptr);
        }
        this.elems.get(name)!.pointer = ptr;
    }

    public insertFunc(name: string, funcType: FunctionType): void {
        this.functions.set(name, funcType);
    }

    public lookUpFunc(name: string): FunctionType {
        if (!this.functions.has(name)) {
            if (!this.parent) {
                throw new RuntimeError("Unknown FUNCTION '" + name + "'");
            }
            return this.parent.lookUpFunc(name);
        }
        return this.functions.get(name)!;
    }

    public insertProc(name: string, procType: ProcedureType): void {
        this.procedures.set(name, procType);
    }

    public lookUpProc(name: string): ProcedureType {
        if (!this.procedures.has(name)) {
            if (!this.parent) {
                throw new RuntimeError("Unknown PROCUDURE '" + name + "'");
            }
            return this.parent.lookUpProc(name);
        }
        return this.procedures.get(name)!;
    }

    public getReturnType(): Type {
        return this.returnType!;
    }

    public insertType(name: string, type: Type): void {
        this.types.set(name, type);
    }

    public lookUpType(name: string): Type {
        if (!this.types.has(name)) {
            if (!this.parent) {
                throw new RuntimeError("Unknown TYPE '" + name + "'");
            }
            return this.parent.lookUpType(name);
        }
        return this.types.get(name)!;
    }
}
