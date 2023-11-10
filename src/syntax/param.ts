import { Token } from "../lex/token";
import { Type } from "../type/type";
import { BaseNode, nodeKind } from "./ast";


export const enum passType {
    BYVAL, BYREF
}

export class ParamNode extends BaseNode {
    public kind: nodeKind = nodeKind.ParamNode;
    // default passtype will be done in the parser
    public ident: Token;
    public typeToken: Token;
    public passType: passType;
    public type!: Type;

    constructor(ident: Token, typeToken: Token, passType: passType) {
        super();
        this.ident = ident;
        this.typeToken = typeToken;
        this.passType = passType;
    }

    public toString(): string {
        return "ParamNode";
    }
}
