import { RuntimeError } from "../error";
import { BasicType } from "./basic";
import { ArrayType } from "./array";
import { RecordType } from "./record";
import { PointerType } from "./pointer";
import { basicKind } from "./basic";
import { unreachable } from "../util";


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

export class NoneType extends BaseType {
    public readonly kind = typeKind.NONE;

    public toString(): string {
        return "NONE";
    }

    public size(): number {
        return 0;
    }
}

// this kind of design omits the 'type as BasicType' statements
export type Type = NoneType |
    BasicType |
    ArrayType |
    RecordType |
    PointerType;


export function compatableBasic(leftBasicType: basicKind, rightBasicType: basicKind): boolean {
    if (leftBasicType === basicKind.STRING &&
        rightBasicType !== basicKind.STRING) {
        return false;
    }
    if (leftBasicType !== basicKind.STRING &&
        rightBasicType === basicKind.STRING) {
        return false;
    }
    // compatable if both are not strings
    return true;
}

export function compatable(leftType: Type, rightType: Type): boolean {
    if (leftType === rightType) {
        return true;
    }

    switch (leftType.kind) {
        case typeKind.BASIC:
            if (rightType.kind !== typeKind.BASIC) {
                return false;
            }
            return compatableBasic(leftType.type, rightType.type);
        case typeKind.ARRAY:
            if (rightType.kind !== typeKind.ARRAY) {
                return false;
            }
            // if the element types are same ARRAYs are compatable
            return compatable(leftType.elem, rightType.elem);
        case typeKind.RECORD:
            if (rightType.kind !== typeKind.RECORD) {
                return false;
            }
            if (leftType.fields.size !== rightType.fields.size) {
                return false;
            }
            for (let i = 0,
                leftFields = Array.from(leftType.fields.values()),
                rightFields = Array.from(leftType.fields.values());
                i < leftType.fields.size; i++) {
                if (!compatable(leftFields[i], rightFields[i])) {
                    return false;
                }
            }
            return true;
        case typeKind.POINTER:
            if (rightType.kind !== typeKind.POINTER) {
                return false;
            }
            return compatable(leftType.base, rightType.base);
        default:
            unreachable();
    }
}
    
export function commonBasicType(leftBasicType: basicKind, rightBasicType: basicKind): basicKind {
    if (leftBasicType === basicKind.STRING) {
        if (rightBasicType !== basicKind.STRING) {
            throw new RuntimeError("Cannot convert " + leftBasicType + " to " + leftBasicType);
        }
        return basicKind.STRING;
    }
    else if (rightBasicType === basicKind.STRING) {
        throw new RuntimeError("Cannot convert " + leftBasicType + " to " + leftBasicType);
    }
    else if (leftBasicType === basicKind.REAL ||
        rightBasicType === basicKind.REAL) {
        return basicKind.REAL;
    }
    return basicKind.INTEGER;
}
