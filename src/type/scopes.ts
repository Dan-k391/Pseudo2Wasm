import { RuntimeError } from "../error";
import { FunctionType } from "./function";
import { Type } from "./type";

export class Scope {
    // if is function, enable return statement
    public isFunc: boolean;
    public parent?: Scope;
    public children: Array<Scope>;
    public elems: Map<string, Type>;
    public functions: Map<string, FunctionType>;

    constructor(isFunc: boolean, parent?: Scope) {
        this.isFunc = isFunc;
        if (parent) {
            this.parent = parent;
        }
        this.children = new Array<Scope>();
        this.elems = new Map<string, Type>();
        this.functions = new Map<string, FunctionType>();
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

    public insertFunc(name: string, functionType: FunctionType) {
        this.functions.set(name, functionType);
    }

    public getFuncReturnType(name: string): Type {
        if (!this.functions.has(name)) {
            if (!this.parent) {
                throw new RuntimeError("Unknown Function '" + name + "'");
            }
            return this.parent.getFuncReturnType(name);
        }
        return this.functions.get(name)!.returnType;
    }
}
