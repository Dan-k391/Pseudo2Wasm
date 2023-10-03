import { Dimension } from "../ast";
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
export abstract class BaseType {
    public abstract readonly kind: typeKind;

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

// this kind of design omits the 'type as BasicType' statements
export type Type = BasicType | ArrayType | RecordType;

export class BasicType extends BaseType {
    // stupid naming, i know, plz do not blame me
    // open an issue if you have a better idea
    public readonly kind = typeKind.BASIC;
    public type: basicKind;

    constructor(type: basicKind) {
        super();
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

export class ArrayType extends BaseType {
    public readonly kind = typeKind.ARRAY;
    public elem: Type;
    public dimensions: Array<Dimension>;

    constructor(elem: Type, dimensions: Array<Dimension>) {
        super();
        this.elem = elem;
        this.dimensions = dimensions;
    }

    public toString(): string {
        let msg = "";
        for (const dimension of this.dimensions) {
            msg += dimension.upper.lexeme + ': ' + dimension.lower.lexeme + ', ';
        }
        return "ARRAY[" + msg + "] OF " + this.elem;
    }

    public size(): number {
        let length = 1;
        for (const dimension of this.dimensions) {
            length *= (dimension.upper.literal - dimension.lower.literal)
        }
        return this.elem.size() * length;
    }

    // returns the offset relative to the array
    public offset(index: number): number {
        // useless for now
        return 0;
        // if (index >= this.length) {
        //     throw new RuntimeError("Index out of bounds for " + this.toString());
        // }
        // return this.elem.size() * index;
    }
}

export class RecordType extends BaseType {
    public readonly kind = typeKind.RECORD;
    public fields: Map<string, Type>;

    constructor(fields: Map<string, Type>) {
        super();
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
