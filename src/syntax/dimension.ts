import { Token } from "../lex/token";


export interface Dimension {
    // use number instead of Token because we don't need the lexeme
    lower: number;
    upper: number;
}
