import { RuntimeError } from "../error";
import { unreachable } from "../util";


export const enum typeKind {
    BASIC = "BASIC",
    ARRAY = "ARRAY",
    RECORD = "RECORD",
    // NONE Type, for error handling
    NONE = "NONE"
}

// empty class
export abstract class Type {
    constructor(public kind: typeKind) { }

    public abstract toString(): string;

    // calculate the size (in bytes) of each type
    public abstract size(): number;
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

    public size(): number {
        switch (this.type) {
            case basicKind.INTEGER:
                return 4;
            case basicKind.REAL:
                return 8;
            case basicKind.CHAR:
                return 4;
            case basicKind.BOOLEAN:
                return 4;
            case basicKind.STRING:
                return 4;
            case basicKind.NONE:
                unreachable();
        }
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
        return "ARRAY[" + this.lower + ": " + this.upper + "] OF " + this.elem;
    }

    public size(): number {
        return this.elem.size() * (this.upper - this.lower);
    }

    // returns the offset relative to the array
    public offset(index: number): number {
        if (index >= this.upper) {
            throw new RuntimeError("Index out of bounds for " + this.toString());
        }
        return this.elem.size() * (index - this.lower);
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

    public size() {
        let total: number = 0;
        for (let [key, value] of this.fields) {
            total += value.size();
        }
        return total;
    }

    // returns the offset relative to the start of the record
    public offset(name: string): number {
        if (!this.fields.has(name)) {
            throw new RuntimeError("No member named " + name + "in " + this.toString);
        }
        // find the offset of the value by going over every field before it
        let offset: number = 0;
        for (let [key, value] of this.fields) {
            if (key === name) {
                break;
            }
            offset += value.size();            
        }
        return offset;
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
