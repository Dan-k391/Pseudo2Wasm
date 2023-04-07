export const enum VarType {
    INTEGER = "number",
    REAL = "number",
    CHAR = "string",
    STRING = "string",
    BOOL = "boolean"
}

export class Variable {
    public type: VarType;
    public value: unknown;

    constructor(type: VarType, value: unknown) {
        this.type = type;
        this.value = value;
    }
}
