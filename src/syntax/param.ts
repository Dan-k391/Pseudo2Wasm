import { Token } from "../lex/token";
import { Type } from "../type/type";
import { BaseNode, nodeKind } from "./ast";
import { TypeNode } from "./typenode";


export const enum passType {
    BYVAL, BYREF
}

export class ParamNode extends BaseNode {
    public kind: nodeKind = nodeKind.ParamNode;
    // default passtype will be done in the parser
    public ident: Token;
    public typeNode: TypeNode;
    public passType: passType;
    public type!: Type;

    constructor(ident: Token, typeNode: TypeNode, passType: passType) {
        super();
        this.ident = ident;
        this.typeNode = typeNode;
        this.passType = passType;
    }

    public toString(): string {
        return "ParamNode";
    }
}
