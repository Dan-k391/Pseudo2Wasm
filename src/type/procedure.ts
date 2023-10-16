import { Type } from "./type";

export class ProcedureType {
    public paramTypes: Map<string, Type>;

    constructor(paramTypes: Map<string, Type>) {
        this.paramTypes = paramTypes;
    }

    public getParamType(name: string): Type {
        return this.paramTypes.get(name)!;
    }
}
