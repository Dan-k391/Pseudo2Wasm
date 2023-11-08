import { RuntimeError } from "../error";
import { Type } from "./type";

export class ProcedureType {
    public paramTypes: Map<string, Type>;

    constructor(paramTypes: Map<string, Type>) {
        this.paramTypes = paramTypes;
    }

    public getParamType(name: string): Type {
        if (!this.paramTypes.has(name)) {
            throw new RuntimeError("Unknown param '" + name + "'");
        }
        return this.paramTypes.get(name)!;
    }
}
