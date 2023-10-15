import { RuntimeError } from "../error";
import { BasicType } from "./basic";
import { ArrayType } from "./array";
import { RecordType } from "./record";
import { PointerType } from "./pointer";
import { basicKind } from "./basic";


export const enum typeKind {
    BASIC = "BASIC",
    ARRAY = "ARRAY",
    RECORD = "RECORD",
    POINTER = "POINTER",
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

// this kind of design omits the 'type as BasicType' statements
export type Type = BasicType |
    ArrayType |
    RecordType |
    PointerType;

    
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
