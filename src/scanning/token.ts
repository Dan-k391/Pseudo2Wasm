export const enum tokenType {
    // single character tokens
    LEFT_PAREN, RIGHT_PAREN, LEFT_BRACKET, RIGHT_BRACKET,
    COMMA, DOT, MINUS, PLUS, STAR, SLASH, COLON, AMPERSAND, // &

    // one or two character tokens
    LESS_GREATER, LESS_MINUS,
    EQUAL, GREATER, GREATER_EQUAL, LESS, LESS_EQUAL,

    // literals
    IDENTIFIER, STRING_CONST, INT_CONST, REAL_CONST, CHAR_CONST, BOOL_CONST,

    // keywords
    FUNCTION, ENDFUNCTION,
    PROCEDURE, ENDPROCEDURE,
    RETURNS, RETURN,
    CALL,
    DECLARE,
    ARRAY, OF,
    TYPE, ENDTYPE,
    IF, THEN, ELSE, ENDIF,
    WHILE, ENDWHILE,
    REPEAT, UNTIL,
    FOR, TO, STEP, NEXT,
    MOD, AND, OR, NOT,
    OUTPUT, INPUT, RND, TIME,
    TRUE, FALSE,

    // types
    INTEGER, REAL, CHAR, STRING, BOOLEAN,

    EOF
};

export class Token {
    public type: tokenType;
    public lexeme: string;
    public literal: any;
    public line: number;
    public startColumn: number;
    public endColumn: number;

    constructor(type: tokenType, lexeme: string, literal: any, line: number, startColumn: number, endColumn: number) {
        this.type = type;
        this.lexeme = lexeme;
        this.literal = literal;
        this.line = line;
        this.startColumn = startColumn;
        this.endColumn = endColumn;
    }
}
