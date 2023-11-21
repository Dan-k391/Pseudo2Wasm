import { Token, tokenType } from "../lex/token";
import { BaseNode, nodeKind } from "./ast";
import { Dimension } from "./dimension";


export type TypeNode = BasicTypeNode |
    ArrTypeNode;

export class BasicTypeNode extends BaseNode {
    public readonly kind = nodeKind.BasicTypeNode;
    // including an identifier token for the type
    public type: Token;

    constructor(type: Token) {
        super();
        this.type = type;
    }

    public toString(): string {
        return "BasicTypeNode";
    }
}

export class ArrTypeNode extends BaseNode {
    public readonly kind = nodeKind.ArrTypeNode;
    public type: TypeNode;
    public dimensions: Array<Dimension>;

    constructor(type: TypeNode, dimensions: Array<Dimension>) {
        super();
        this.type = type;
        this.dimensions = dimensions;
    }

    public toString(): string {
        return "ArrTypeNode";
    }
}

