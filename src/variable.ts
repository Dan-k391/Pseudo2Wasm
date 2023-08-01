export const enum VarType {
    INTEGER,
    REAL,
    CHAR,
    STRING,
    BOOLEAN
}

export class Variable {
    public type: VarType;
    public value: unknown;

    constructor(type: VarType, value: unknown) {
        this.type = type;
        this.value = value;
    }
}
