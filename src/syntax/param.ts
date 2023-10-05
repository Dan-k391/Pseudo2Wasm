import { Token } from "../lex/token";
import { passType } from "./passtype";


export class Param {
    // default passtype will be done in the parser
    public ident: Token;
    public type: Token;
    public passType: passType;

    constructor(ident: Token, type: Token, passType: passType) {
        this.ident = ident;
        this.type = type;
        this.passType = passType;
    }
}
