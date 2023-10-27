import binaryen from "binaryen";
import { unreachable } from "../util";
import { BaseType, typeKind } from "./type";

export const enum basicKind {
    INTEGER = "INTEGER",
    REAL = "REAL",
    CHAR = "CHAR",
    STRING = "STRING",
    BOOLEAN = "BOOLEAN",
    // NONE Type, for error handling
    NONE = "NONE"
}

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
        // keep this switch, maybe change it later
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

    public wasmType(): number {
        // keep this switch, maybe change it later
        switch (this.type) {
            case basicKind.INTEGER:
                return binaryen.i32;
            case basicKind.REAL:
                return binaryen.f64;
            case basicKind.CHAR:
                return binaryen.i32;
            case basicKind.BOOLEAN:
                return binaryen.i32;
            case basicKind.STRING:
                return binaryen.i32;
            case basicKind.NONE:
                unreachable();
        }
    }
}

