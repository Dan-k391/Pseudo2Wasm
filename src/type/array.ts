import binaryen from "binaryen";
import { Dimension } from "../syntax/ast";
import { BaseType, typeKind, Type } from "./type";


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
        return "ARRAY[" + msg + "] OF " + this.elem.toString();
    }

    public size(): number {
        let length = 1;
        for (const dimension of this.dimensions) {
            // add 1 because the upper and lower bounds are included
            length *= (dimension.upper.literal - dimension.lower.literal + 1);
        }
        return this.elem.size() * length;
    }

    public length(): number {
        let length = 1;
        for (const dimension of this.dimensions) {
            // add 1 because the upper and lower bounds are included
            length *= (dimension.upper.literal - dimension.lower.literal + 1);
        }
        return length;
    }

    public wasmType(): number {
        return binaryen.i32;
    }
}
