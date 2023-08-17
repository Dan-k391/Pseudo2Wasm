import { RuntimeError } from "../error";
import { VarType } from "./variable";


export function minimalCompatableType(leftType: VarType, rightType: VarType): VarType {
    if (leftType == VarType.INTEGER) {
        if (rightType == VarType.INTEGER || rightType == VarType.CHAR || rightType == VarType.BOOLEAN) {
            return VarType.INTEGER;
        }
        else if (rightType == VarType.REAL) {
            return VarType.REAL;
        }
    }
    else if (leftType == VarType.REAL) {
        if (rightType == VarType.INTEGER || rightType == VarType.REAL) {
            return VarType.REAL;
        }
    }
    else if (leftType == VarType.CHAR) {
        if (rightType == VarType.INTEGER || rightType == VarType.CHAR || rightType == VarType.BOOLEAN) {
            return VarType.INTEGER;
        }
    }
    // else if (leftType == VarType.STRING) {
    // }
    else if (leftType == VarType.BOOLEAN) {
        if (rightType == VarType.INTEGER || rightType == VarType.CHAR || rightType == VarType.BOOLEAN) {
            return VarType.INTEGER;
        }
    }
    throw new RuntimeError("Cannot convert" + rightType + "to" + leftType);
}
