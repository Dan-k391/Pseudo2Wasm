import { RuntimeError } from "../error";
import { Type } from "./type";
import { passType } from "../syntax/param";

export class ProcedureType {
    public paramTypes: Map<string, Type>;
    public paramModes: Map<string, passType>;

    constructor(paramTypes: Map<string, Type>, paramModes: Map<string, passType> = new Map()) {
        this.paramTypes = paramTypes;
        this.paramModes = paramModes;
    }

    public getParamType(name: string): Type {
        if (!this.paramTypes.has(name)) {
            throw new RuntimeError("Unknown param '" + name + "'");
        }
        return this.paramTypes.get(name)!;
    }
}
