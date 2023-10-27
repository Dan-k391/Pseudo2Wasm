import { RuntimeError } from "../error";
import { Type } from "./type";

export class FunctionType {
    public paramTypes: Map<string, Type>;
    public returnType: Type;

    constructor(paramTypes: Map<string, Type>, returnType: Type) {
        this.paramTypes = paramTypes;
        this.returnType = returnType;
    }

    public getParamType(name: string): Type {
        if (!this.paramTypes.has(name)) {
            throw new RuntimeError("Unknown param '" + name + "'");
        }
        return this.paramTypes.get(name)!;
    }
}
