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

