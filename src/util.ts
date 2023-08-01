import binaryen from "binaryen";
import { Token } from "./scanning/token";
import { VarType } from "./variable";
import { RuntimeError } from "./error";

export function convertToVarType(type: Token): VarType {
    switch (type.lexeme) {
        case "INTEGER":
            return VarType.INTEGER;
        case "REAL":
            return VarType.REAL;
        case "CHAR":
            return VarType.CHAR;
        case "STRING":
            return VarType.STRING;
        case "BOOLEAN":
            return VarType.BOOLEAN;
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
