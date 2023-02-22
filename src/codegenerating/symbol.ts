import binaryen from "binaryen";

// to not overlap with the orgin ts Symbol
export class _Symbol {
    public index: number;
    public type: binaryen.Type;

    constructor(index: number, type: binaryen.Type) {
        this.index = index;
        this.type = type;
    }
}
