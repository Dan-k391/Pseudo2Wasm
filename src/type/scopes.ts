import { RuntimeError } from "../error";
import { FunctionType } from "./function";
import { ProcedureType } from "./procedure";
import { Type } from "./type";

export class Scope {
    // if is function, enable return statement
    public isFunc: boolean;
    public parent?: Scope;
    public returnType?: Type;
    public children: Array<Scope>;
    public elems: Map<string, Type>;
    public functions: Map<string, FunctionType>;
    public procedures: Map<string, ProcedureType>;

    constructor(isFunc: boolean, parent?: Scope, returnType?: Type) {
        this.isFunc = isFunc;
        if (parent) {
            this.parent = parent;
        }
        if (returnType) {
            this.returnType = returnType;
        }
        this.children = new Array<Scope>();
        this.elems = new Map<string, Type>();
        this.functions = new Map<string, FunctionType>();
        this.procedures = new Map<string, ProcedureType>();
    }

    public insert(name: string, type: Type) {
        this.elems.set(name, type);
    }

    public lookUp(name: string): Type {
        if (!this.elems.has(name)) {
            if (!this.parent) {
                throw new RuntimeError("Unknown variable '" + name + "'");
            }
            return this.parent.lookUp(name);
        }
        return this.elems.get(name)!;
    }

    public insertFunc(name: string, funcType: FunctionType): void {
        this.functions.set(name, funcType);
    }

    public getFuncType(name: string): FunctionType {
        if (!this.functions.has(name)) {
            if (!this.parent) {
                throw new RuntimeError("Unknown Function '" + name + "'");
            }
            return this.parent.getFuncType(name);
        }
        return this.functions.get(name)!;
    }

    public insertProc(name: string, procType: ProcedureType): void {
        this.procedures.set(name, procType);
    }

    public getProcType(name: string): ProcedureType {
        if (!this.procedures.has(name)) {
            if (!this.parent) {
                throw new RuntimeError("Unknown Procudure '" + name + "'");
            }
            return this.parent.getProcType(name);
        }
        return this.procedures.get(name)!;
    }

    public getReturnType(): Type {
        return this.returnType!;
    }
}
