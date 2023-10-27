import { Token } from "../lex/token";
import { Type } from "../type/type";
import { passType } from "./passtype";


export class ParamNode {
    // default passtype will be done in the parser
    public ident: Token;
    public typeToken: Token;
    public passType: passType;
    public type!: Type;

    constructor(ident: Token, typeToken: Token, passType: passType) {
        this.ident = ident;
        this.typeToken = typeToken;
        this.passType = passType;
    }
}
