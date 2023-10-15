import { BaseType, typeKind, Type } from "./type";


export class PointerType extends BaseType {
    public readonly kind = typeKind.POINTER;
    public base: Type;

    constructor(base: Type) {
        super();
        this.base = base;
    }

    public toString(): string {
        return "^" + this.base.toString;
    }

    public size(): number {
        // ALL pointer type are 4 bytes
        return 4;
    }
}
