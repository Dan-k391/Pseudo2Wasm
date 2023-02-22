import { Variable } from "./variable";

import { Token } from "../scanning/token";
import { RuntimeError } from "../error";

class Environment {
    public values: Map<string, unknown>;

    constructor() {
        this.values = new Map();
    }

    get(ident: Token): unknown {
        if (this.values.has(ident.lexeme)) {
            return this.values.get(ident.lexeme);
        }

        throw new RuntimeError("Variable '" + ident.lexeme + "' is not declared");
    }

    declare(ident: Token, type: Token): void {
        if (this.values.has(ident.lexeme)) {
            throw new RuntimeError("Variable '" + ident + "' is already declared");
        }

        this.values.set(ident.lexeme, new Variable(type.lexeme, null));
    }

    assign(ident: Token, value: any) {
        if (this.values.has(ident.lexeme)) {
            (this.values.get(ident.lexeme) as Variable).value = value;
            return;
        }

        throw new RuntimeError("Variable '" + ident.lexeme + "' is not declared");
    }
}

export {
    Environment
}
