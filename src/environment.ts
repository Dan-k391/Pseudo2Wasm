import { VarType, Variable } from "./variable";

import { Token } from "./scanning/token";
import { RuntimeError } from "./error";
import { convertToVarType } from "./utils";

export class Environment {
    private enclosing?: Environment;
    private values: Map<string, any>;

    constructor(enclosing?: Environment) {
        if (enclosing) {
            this.enclosing = enclosing;
        }
        this.values = new Map();
    }

    public get(ident: Token): unknown {
        if (this.values.has(ident.lexeme)) {
            if ((this.values.get(ident.lexeme) as Variable).value === null) {
                throw new RuntimeError("Variable '" + ident.lexeme + "' is not initialized");
            }
            return this.values.get(ident.lexeme);
        }

        if (this.enclosing) {
            return this.enclosing.get(ident);
        }

        throw new RuntimeError("Variable '" + ident.lexeme + "' is not declared");
    }

    public declare(ident: Token, type: Token): void {
        if (this.values.has(ident.lexeme)) {
            throw new RuntimeError("Variable '" + ident + "' is already declared");
        }

        if (this.enclosing) {
            this.enclosing.declare(ident, type);
            return;
        }

        this.values.set(ident.lexeme, new Variable(convertToVarType(type), null));
    }

    public assign(ident: Token, value: any): void {
        if (this.values.has(ident.lexeme)) {
            (this.values.get(ident.lexeme) as Variable).value = value;
            return;
        }

        if (this.enclosing) {
            this.enclosing.assign(ident, value);
            return;
        }

        throw new RuntimeError("Variable '" + ident.lexeme + "' is not declared");
    }

    public define(ident: Token, value: any): void {
        this.values.set(ident.lexeme, value);
    }
}

