import { Token } from "./scanning/token";
import { VarType } from "./variable";

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
            return VarType.BOOL;
        default:
            throw new Error("Unknown type '" + type.lexeme + "'");
    }
}
