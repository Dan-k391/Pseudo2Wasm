import { RuntimeError } from "../error";
import { BasicType } from "./basic";
import { ArrayType } from "./array";
import { RecordType } from "./record";
import { PointerType } from "./pointer";
import { basicKind } from "./basic";
import { unreachable } from "../util";
import binaryen from "binaryen";

type WasmType = binaryen.Type;

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

    public abstract wasmType(): WasmType;
}

export class NoneType extends BaseType {
    public readonly kind = typeKind.NONE;

    public toString(): string {
        return "NONE";
    }

    public size(): number {
        return 0;
    }

    public wasmType(): number {
        return binaryen.none;
    }
}

// this kind of design omits the 'type as BasicType' statements
export type Type = NoneType |
    BasicType |
    ArrayType |
    RecordType |
    PointerType;
