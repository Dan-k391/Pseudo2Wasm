export const enum VarType {
    INTEGER = "INTEGER",
    REAL = "REAL",
    CHAR = "CHAR",
    STRING = "STRING",
    BOOLEAN = "BOOLEAN",
    // NONE Type, for error handling
    NONE = "NONE"
}

export class Variable {
    public type: VarType;
    public value: unknown;

    constructor(type: VarType, value: unknown) {
        this.type = type;
        this.value = value;
    }
}
