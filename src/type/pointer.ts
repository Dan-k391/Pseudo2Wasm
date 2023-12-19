import binaryen from "binaryen";
import { BaseType, typeKind, Type } from "./type";
import { Dimension } from "../syntax/dimension";


export class PointerType extends BaseType {
    public readonly kind = typeKind.POINTER;
    public base: Type;
    // include dimensions for ARRAYs due to the rule that ARRAYs
    // can start from none zero index
    public dimensions: Array<Dimension>;

    constructor(base: Type, dimensions: Array<Dimension>) {
        super();
        this.base = base;
        this.dimensions = dimensions;
    }

    public toString(): string {
        return "^" + this.base.toString();
    }

    public size(): number {
        // ALL pointer type are 4 bytes
        return 4;
    }

    public wasmType(): number {
        return binaryen.i32;
    }
}
