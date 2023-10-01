import binaryen from "binaryen";
import { Token } from "./scanning/token";
import { RuntimeError } from "./error";
import { BasicType, basicKind } from "./type/type";

export function convertToBasicType(type: Token): BasicType {
    switch (type.lexeme) {
        case "INTEGER":
            return new BasicType(basicKind.INTEGER);
        case "REAL":
            return new BasicType(basicKind.REAL);
        case "CHAR":
            return new BasicType(basicKind.CHAR);
        case "STRING":
            return new BasicType(basicKind.STRING);
        case "BOOLEAN":
            return new BasicType(basicKind.BOOLEAN);
        default:
            throw new RuntimeError("Unknown type '" + type.lexeme + "'");
    }
}


export function convertToWasmType(type: Token): binaryen.Type {
    switch (type.lexeme) {
        case "INTEGER":
            return binaryen.i32;
        case "REAL":
            return binaryen.f64;
        case "CHAR":
            return binaryen.i32;
        case "STRING":
            return binaryen.i32;
        case "BOOLEAN":
            return binaryen.i32;
        default:
            throw new RuntimeError("Unknown type '" + type.lexeme + "'");
    }
}

export function unreachable(): never {
    throw new RuntimeError("Unreachable code");
}
