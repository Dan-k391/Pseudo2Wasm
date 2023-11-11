/**
 * I have abandoned the version 1 scanner. Although it did not have any problems, I believe
 * that changing it would be a good idea. (maybe I will switch to a better one in the future)
 * 
 * This new scanner is highly overlapping with "https://craftinginterpreters.com/scanning.html",
 * I personally do not like doing this. However, I decided to make this whole project more normalised 
 * so that more people can understand how it is done. My own code often makes it harder to understand
 * so I decided to do it all based on the book with a better top down structure than my own.
 * 
 * Furthermore, I strongly recommend the book above (It really helped on my first hand-writen parser).
 */

import { SyntaxError } from "../error";
import { tokenType, Token } from "./token";


// built-in functions are also combined in KEYWORDS
const KEYWORDS: Map<string, tokenType> = new Map([
    ["FUNCTION", tokenType.FUNCTION],
    ["ENDFUNCTION", tokenType.ENDFUNCTION],
    ["PROCEDURE", tokenType.PROCEDURE],
    ["ENDPROCEDURE", tokenType.ENDPROCEDURE],
    ["BYVAL", tokenType.BYVAL],
    ["BYREF", tokenType.BYREF],
    ["RETURNS", tokenType.RETURNS],
    ["RETURN", tokenType.RETURN],
    ["CALL", tokenType.CALL],
    ["DECLARE", tokenType.DECLARE],
    ["ARRAY", tokenType.ARRAY],
    ["OF", tokenType.OF],
    ["TYPE", tokenType.TYPE],
    ["ENDTYPE", tokenType.ENDTYPE],
    ["IF", tokenType.IF],
    ["THEN", tokenType.THEN],
    ["ELSE", tokenType.ELSE],
    ["ENDIF", tokenType.ENDIF],
    ["WHILE", tokenType.WHILE],
    ["ENDWHILE", tokenType.ENDWHILE],
    ["REPEAT", tokenType.REPEAT],
    ["UNTIL", tokenType.UNTIL],
    ["FOR", tokenType.FOR],
    ["TO", tokenType.TO],
    ["STEP", tokenType.STEP],
    ["NEXT", tokenType.NEXT],
    ["MOD", tokenType.MOD],
    ["AND", tokenType.AND],
    ["OR", tokenType.OR],
    ["NOT", tokenType.NOT],
    ["OUTPUT", tokenType.OUTPUT],
    ["INPUT", tokenType.INPUT],
    ["RND", tokenType.RND],
    ["TIME", tokenType.TIME],
    ["TRUE", tokenType.TRUE],
    ["FALSE", tokenType.FALSE],

    ["INTEGER", tokenType.INTEGER],
    ["REAL", tokenType.REAL],
    ["CHAR", tokenType.CHAR],
    ["STRING", tokenType.STRING],
    ["BOOLEAN", tokenType.BOOLEAN]
]);


export class Scanner {
    private source: string;
    private tokens: Array<Token>;

    private start: number;
    private current: number;
    private line: number;

    private startColumn: number;
    private endColumn: number;

    constructor(source: string) {
        this.source = source;
        // advanced way to initialize an array haha
        this.tokens = new Array<Token>();
        this.start = 0;
        this.current = 0;
        this.line = 1;
        this.startColumn = 0;
        this.endColumn = 0;
    }

    public scan(): Array<Token> {
        while (!this.isAtEnd()) {
            this.start = this.current;
            this.startColumn = this.endColumn;
            this.scanToken();
        }

        this.tokens.push(new Token(tokenType.EOF, "", null, this.line, this.startColumn, this.endColumn));
        return this.tokens;
    }

    private scanToken(): void {
        const c: string = this.advance();
        switch (c) {
            case '(': this.addToken(tokenType.LEFT_PAREN); break;
            case ')': this.addToken(tokenType.RIGHT_PAREN); break;
            case '[': this.addToken(tokenType.LEFT_BRACKET); break;
            case ']': this.addToken(tokenType.RIGHT_BRACKET); break;
            case ',': this.addToken(tokenType.COMMA); break;
            case '.': this.addToken(tokenType.DOT); break;
            case '-': this.addToken(tokenType.MINUS); break;
            case '+': this.addToken(tokenType.PLUS); break;
            case '*': this.addToken(tokenType.STAR); break;
            case '/':
                if (this.match('/')) {
                    // a comment goes until the end of the line
                    while (this.peek() != '\n' && !this.isAtEnd()) this.advance();
                }
                else {
                    this.addToken(tokenType.SLASH);
                }
                break;
            case ':': this.addToken(tokenType.COLON); break;
            case '&': this.addToken(tokenType.AMPERSAND); break;
            case '^': this.addToken(tokenType.CARET); break;
            case '=': this.addToken(tokenType.EQUAL); break;
            case '<': this.addToken(this.match('>') ? tokenType.LESS_GREATER : (this.match('-') ? tokenType.LESS_MINUS : (this.match('=') ? tokenType.LESS_EQUAL : tokenType.LESS))); break;
            case '>': this.addToken(this.match('=') ? tokenType.GREATER_EQUAL : tokenType.GREATER); break;
            case '"': this.string(); break;
            case "'": this.char(); break;
            case ' ': break;
            case '\r': break;
            case '\t': break;
            case '\n': this.addToken(tokenType.NEWLINE); this.line++; this.startColumn = 0; this.endColumn = 0; break;
            default: 
                if (this.isDigit(c)) {
                    this.number();
                }
                else if (this.isAlpha(c)) {
                    this.identifier();
                }
                else {
                    throw new SyntaxError("Unexpected character", this.line, this.startColumn, this.endColumn);
                }
                break;
        }
    }

    private peek(): string {
        if (this.isAtEnd()) return '\0';
        return this.source.charAt(this.current);
    }

    private peekNext(): string {
        if (this.current + 1 >= this.source.length) return '\0';
        return this.source.charAt(this.current + 1);
    }

    private match(expected: string): boolean {
        if (this.isAtEnd()) return false;
        if (this.source.charAt(this.current) !== expected) return false;

        this.current++;
        return true;
    }

    private advance(): string {
        this.endColumn++;
        return this.source.charAt(this.current++);
    }

    private addToken(type: tokenType, literal: unknown = null): void {
        const text: string = this.source.substring(this.start, this.current);
        this.tokens.push(new Token(type, text, literal, this.line, this.startColumn, this.endColumn));
    }

    private isAtEnd(): boolean {
        return this.current >= this.source.length;
    }

    private isDigit(c: string): boolean {
        return c >= '0' && c <= '9';
    }

    private isAlpha(c: string): boolean {
        return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_';
    }

    private isAlphaNumeric(c: string): boolean {
        return this.isAlpha(c) || this.isDigit(c);
    }

    private char(): void {
        while (this.peek() != "'" && !this.isAtEnd()) {
            if (this.peek() == '\n') this.line++;
            this.advance();
        }

        if (this.isAtEnd()) {
            throw new SyntaxError("Unterminated char", this.line, this.startColumn, this.endColumn);
        }
        // char only contains a single character
        // the first character is the '
        else if (this.current - this.start > 2) {
            throw new SyntaxError("Char contains only a single character", this.line, this.startColumn, this.endColumn);
        }

        this.advance();

        const value: string = this.source.substring(this.start + 1, this.current - 1);
        this.addToken(tokenType.CHAR_CONST, value);
    }

    private string(): void {
        while (this.peek() != '"' && !this.isAtEnd()) {
            if (this.peek() == '\n') this.line++;
            this.advance();
        }

        if (this.isAtEnd()) {
            throw new SyntaxError("Unterminated string", this.line, this.startColumn, this.endColumn);
        }

        this.advance();

        const value: string = this.source.substring(this.start + 1, this.current - 1);
        this.addToken(tokenType.STRING_CONST, value);
    }

    private number(): void {
        let isReal = false;

        while (this.isDigit(this.peek())) this.advance();

        if (this.peek() == '.' && this.isDigit(this.peekNext())) {
            isReal = true;
            this.advance();

            while (this.isDigit(this.peek())) this.advance();
        }

        const value: number = parseFloat(this.source.substring(this.start, this.current));
        this.addToken(isReal ? tokenType.REAL_CONST : tokenType.INT_CONST, value);
    }
    
    private identifier(): void {
        while (this.isAlphaNumeric(this.peek())) this.advance();

        const text: string = this.source.substring(this.start, this.current);
        const type: tokenType = KEYWORDS.get(text) || tokenType.IDENTIFIER;
        this.addToken(type);
    }
}
