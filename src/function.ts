import { FuncDefNode } from "./ast";
import { Callable } from "./callable";
import { Environment } from "./environment";
import { Return } from "./return";
import { convertToVarType } from "./util";
import { Variable } from "./variable";


export class Function implements Callable {
    private declaration: FuncDefNode;

    constructor(declaration: FuncDefNode) {
        this.declaration = declaration;
    }

    public arity(): number {
        return this.declaration.params.length;
    }

    public call(env: Environment, args: Array<unknown>): unknown {
        const environment: Environment = new Environment(env);

        // argument number has been checked in evaluate()
        for (let i = 0; i < this.declaration.params.length; i++) {
            const param = new Variable(convertToVarType(this.declaration.params[i].type), args[i]);
            environment.define(this.declaration.params[i].ident, param);
        }

        try {
            for (const stmt of this.declaration.body) {
                stmt.evaluate(environment);
            }
        } catch (returnValue) {
            if (returnValue instanceof Return) {
                return returnValue.value;
            }
            else {
                throw returnValue;
            }
        }
        return;
    }
}
