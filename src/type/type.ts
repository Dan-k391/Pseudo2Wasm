import { RuntimeError } from "../error";


export const enum typeKind {
    BASIC = "BASIC",
    ARRAY = "ARRAY",
    RECORD = "RECORD",
    // NONE Type, for error handling
    NONE = "NONE"
}

// empty class
export class Type {
    constructor(public kind: typeKind) { }

    public toString(): string {
        return "Type";
    }
}

export const enum basicKind {
    INTEGER = "INTEGER",
    REAL = "REAL",
    CHAR = "CHAR",
    STRING = "STRING",
    BOOLEAN = "BOOLEAN",
    // NONE Type, for error handling
    NONE = "NONE"
}

export class BasicType extends Type {
    public type: basicKind;

    constructor(type: basicKind) {
        // stupid naming, i know, plz do not blame me
        // open an issue if you have a better idea
        super(typeKind.BASIC);
        this.type = type;
    }

    public toString(): string {
        return this.type;
    }
}

export class ArrayType extends Type {
    public elem: Type;
    public lower: number;
    public upper: number;

    constructor(elem: Type, lower: number, upper: number) {
        super(typeKind.ARRAY);
        this.elem = elem;
        this.lower = lower;
        this.upper = upper;
    }

    public toString(): string {
        return "ARRAY[" + this.lower + ".." + this.upper + "] OF " + this.elem;
    }
}

export class RecordType extends Type {
    public fields: Map<string, Type>;

    constructor(fields: Map<string, Type>) {
        super(typeKind.RECORD);
        this.fields = fields;
    }

    public toString(): string {
        let str = "TYPE";
        for (let [key, value] of this.fields) {
            str += key + ": " + value + " ";
        }
        str += "ENDTYPE";
        return str;
    }
}

export function minimalCompatableBasicType(leftType: basicKind, rightType: basicKind): basicKind {
    if (leftType == basicKind.INTEGER) {
        if (rightType == basicKind.INTEGER ||
            rightType == basicKind.CHAR ||
            rightType == basicKind.BOOLEAN) {
            return basicKind.INTEGER;
        }
        else if (rightType == basicKind.REAL) {
            return basicKind.REAL;
        }
    }
    else if (leftType == basicKind.REAL) {
        if (rightType == basicKind.INTEGER || rightType == basicKind.REAL) {
            return basicKind.REAL;
        }
    }
    else if (leftType == basicKind.CHAR) {
        if (rightType == basicKind.INTEGER ||
            rightType == basicKind.CHAR ||
            rightType == basicKind.BOOLEAN) {
            return basicKind.INTEGER;
        }
    }
    // else if (leftType == VarType.STRING) {
    // }
    else if (leftType == basicKind.BOOLEAN) {
        if (rightType == basicKind.INTEGER ||
            rightType == basicKind.CHAR ||
            rightType == basicKind.BOOLEAN) {
            return basicKind.INTEGER;
        }
    }
    throw new RuntimeError("Cannot convert" + rightType + "to" + leftType);
}
