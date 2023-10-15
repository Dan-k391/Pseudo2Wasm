import { Type } from "./type";

export class FunctionType {
    public paramTypes: Map<string, Type>;
    public returnType: Type;

    constructor(paramTypes: Map<string, Type>, returnType: Type) {
        this.paramTypes = paramTypes;
        this.returnType = returnType;
    }
}
