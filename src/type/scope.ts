import type binaryen from "binaryen";
import { RuntimeError } from "../error";
import { FunctionType } from "./function";
import { ProcedureType } from "./procedure";
import { Symbol } from "./symbol";
import { Type } from "./type";

/** Semantic namespaces and lexical parent links; backend locations live elsewhere. */
export class Scope {
    children: Scope[] = [];
    elems = new Map<string, Symbol>();
    functions = new Map<string, FunctionType>();
    procedures = new Map<string, ProcedureType>();
    types = new Map<string, Type>();

    constructor(
        public isFunc: boolean,
        public parent?: Scope,
        public returnType?: Type,
        /** @deprecated Backend return locals are owned by FunctionContext. */
        public returnIndex?: number,
    ) { }

    size(): number {
        let total = 0;
        for (const symbol of this.elems.values()) total += symbol.type.size();
        return total;
    }

    insert(name: string, symbol: Symbol): void {
        this.elems.set(name, symbol);
    }

    lookUp(name: string): Symbol {
        return this.lookup(name, scope => scope.elems, "variable");
    }

    /** @deprecated Legacy metadata setter; Generator no longer reads this field. */
    setPointer(name: string, pointer: binaryen.ExpressionRef): void {
        this.lookUp(name).pointer = pointer;
    }

    insertFunc(name: string, type: FunctionType): void {
        this.functions.set(name, type);
    }

    lookUpFunc(name: string): FunctionType {
        return this.lookup(name, scope => scope.functions, "FUNCTION");
    }

    insertProc(name: string, type: ProcedureType): void {
        this.procedures.set(name, type);
    }

    lookUpProc(name: string): ProcedureType {
        return this.lookup(name, scope => scope.procedures, "PROCEDURE");
    }

    getReturnType(): Type {
        return this.returnType!;
    }

    insertType(name: string, type: Type): void {
        this.types.set(name, type);
    }

    lookUpType(name: string): Type {
        return this.lookup(name, scope => scope.types, "TYPE");
    }

    /** One lookup per lexical level, without recursive JS calls or namespace mixing. */
    private lookup<T>(name: string, namespace: (scope: Scope) => ReadonlyMap<string, T>, kind: string): T {
        for (let scope: Scope | undefined = this; scope; scope = scope.parent) {
            const value = namespace(scope).get(name);
            if (value !== undefined) return value;
        }
        throw new RuntimeError(`Unknown ${kind} '${name}'`);
    }
}
