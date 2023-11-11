/**
 * This parser is also highly overlapping with "https://craftinginterpreters.com/parsing-expressions.html"
 * (perhaps I would change it in the future)
 * 
 * I strongly recommend the book above (It really helped on my first hand-writen parser).
 * 
 */

import {
    nodeKind,

    Expr,
    Stmt,
    ProgramNode,
    FuncDefNode,
    ProcDefNode,
    ReturnNode,
    VarDeclNode,
    ArrDeclNode,
    PtrDeclNode,
    TypeDeclNode,
    IfNode,
    WhileNode,
    RepeatNode,
    ForNode,
    ExprStmtNode,
    VarExprNode,
    IndexExprNode,
    SelectExprNode,
    CallFuncExprNode,
    CallProcExprNode,
    UnaryExprNode,
    BinaryExprNode,
    DerefExprNode,
    AddrExprNode,
    IntegerExprNode,
    RealExprNode,
    CharExprNode,
    StringExprNode,
    BoolExprNode,
    OutputNode,
    InputNode,
    AssignNode,
    Dimension
} from "./ast";
import { passType, ParamNode } from "./param";
import { SyntaxError } from "../error";
import { tokenType, Token } from "../lex/token";


export class Parser {
    private tokens: Array<Token>;
    private current: number;
    
    constructor(tokens: Array<Token>) {
        this.tokens = tokens;
        this.current = 0;
    }

    public parse(): ProgramNode {
        const statements: Array<Stmt> = new Array<Stmt>();
        while (!this.isAtEnd()) {
            // FIXME: is there a better way to do this?
            if (this.isNewLine()) this.advance(); // ignore newline 
            else if (this.match(tokenType.FUNCTION)) statements.push(this.funcDefinition());
            else if (this.match(tokenType.PROCEDURE)) statements.push(this.procDefinition());
            else statements.push(this.statement());
        }
        return new ProgramNode(statements);
    }

    private expression(): Expr {
        return this.assignment();
    }

    private assignment(): Expr {
        const expr: Expr = this.equality();

        if (this.match(tokenType.LESS_MINUS)) {
            const equals: Token = this.previous();
            const value: Expr = this.assignment();

            return new AssignNode(expr, value);
        }
        return expr;
    }

    private equality(): Expr {
        let expr: Expr = this.comparison();
        while (this.match(tokenType.EQUAL, tokenType.LESS_GREATER, tokenType.OR)) {
            const operator: Token = this.previous();
            const right: Expr = this.comparison();
            expr = new BinaryExprNode(expr, operator, right);
        }
        return expr;
    }

    private comparison(): Expr {
        let expr: Expr = this.term();
        while (this.match(tokenType.GREATER, tokenType.GREATER_EQUAL, tokenType.LESS, tokenType.LESS_EQUAL, tokenType.AND)) {
            const operator: Token = this.previous();
            const right: Expr = this.term();
            expr = new BinaryExprNode(expr, operator, right);
        }
        return expr;
    }

    private term(): Expr {
        let expr: Expr = this.factor();
        while (this.match(tokenType.MINUS, tokenType.PLUS, tokenType.AMPERSAND)) {
            const operator: Token = this.previous();
            const right: Expr = this.factor();
            expr = new BinaryExprNode(expr, operator, right);
        }
        return expr;
    }

    private factor(): Expr {
        let expr: Expr = this.unary();
        while (this.match(tokenType.SLASH, tokenType.STAR, tokenType.MOD)) {
            const operator: Token = this.previous();
            const right: Expr = this.unary();
            expr = new BinaryExprNode(expr, operator, right);
        }
        return expr;
    }

    private unary(): Expr {
        if (this.match(tokenType.PLUS, tokenType.MINUS, tokenType.NOT)) {
            const operator: Token = this.previous();
            const right: Expr = this.unary();
            return new UnaryExprNode(operator, right);
        }
        return this.pointer();
    }

    private pointer(): Expr {
        if (this.match(tokenType.CARET)) {
            const leftValue: Expr = this.pointer();
            return new AddrExprNode(leftValue);
        }

        // FIXME: A very hard problem here, this.call() should be this.pointer().
        let expr = this.call();

        while (this.match(tokenType.CARET)) expr = new DerefExprNode(expr);
        return expr;
    }           

    private call(): Expr {
        if (this.match(tokenType.CALL)) {
            const expr: Expr = this.index();

            this.consume("Expect '(' after 'CALL'.", tokenType.LEFT_PAREN);
            return this.finishProcedureCall(expr);
        }

        const expr: Expr = this.index();

        if (this.match(tokenType.LEFT_PAREN)) return this.finishFunctionCall(expr);
        return expr;
    }

    private finishFunctionCall(callee: Expr): CallFuncExprNode {
        const args: Array<Expr> = new Array<Expr>();
        if (!this.check(tokenType.RIGHT_PAREN)) {
            do {
                // keep it
                if (args.length >= 255) {
                    this.error(this.peek(), "Cannot have more than 255 arguments.");
                }
                args.push(this.expression());
            }
            while (this.match(tokenType.COMMA));
        }
        this.consume("Expect ')' after arguments.", tokenType.RIGHT_PAREN);
        return new CallFuncExprNode(callee, args);
    }

    private finishProcedureCall(callee: Expr): CallProcExprNode {
        const args: Array<Expr> = new Array<Expr>();
        if (!this.check(tokenType.RIGHT_PAREN)) {
            do {
                // keep it
                if (args.length >= 255) {
                    this.error(this.peek(), "Cannot have more than 255 arguments.");
                }
                args.push(this.expression());
            }
            while (this.match(tokenType.COMMA));
        }
        this.consume("Expect ')' after arguments.", tokenType.RIGHT_PAREN);
        return new CallProcExprNode(callee, args);
    }

    // this implementation looks ugly, but works fine
    private index(): Expr {
        let expr: Expr = this.primary();
        while (true) {
            if (this.match(tokenType.LEFT_BRACKET)) {
                const indexes: Array<Expr> = new Array<Expr>();
                if (!this.check(tokenType.RIGHT_BRACKET)) {
                    do {
                        // keep it
                        if (indexes.length >= 255) {
                            this.error(this.peek(), "Cannot have more than 255 indexes.");
                        }
                        indexes.push(this.expression());
                    }
                    while (this.match(tokenType.COMMA));
                }
                this.consume("Expected ']'", tokenType.RIGHT_BRACKET);
                expr = new IndexExprNode(expr, indexes);
            }
            else if (this.match(tokenType.DOT)) {
                const ident: Token = this.consume("Expected field name", tokenType.IDENTIFIER);
                expr = new SelectExprNode(expr, ident);
            }
            else {
                break;
            }
        }
        return expr;
    }

    private primary(): Expr {
        if (this.match(tokenType.FALSE)) return new BoolExprNode(false);
        if (this.match(tokenType.TRUE)) return new BoolExprNode(true);
        if (this.match(tokenType.INT_CONST)) return new IntegerExprNode(this.previous().literal);
        if (this.match(tokenType.REAL_CONST)) return new RealExprNode(this.previous().literal);
        if (this.match(tokenType.CHAR_CONST)) return new CharExprNode(this.previous().literal);
        if (this.match(tokenType.STRING_CONST)) return new StringExprNode(this.previous().literal);
        if (this.match(tokenType.IDENTIFIER)) return new VarExprNode(this.previous());
        if (this.match(tokenType.LEFT_PAREN)) {
            const expr: Expr = this.expression();
            this.consume("Expected ')' after expression.", tokenType.RIGHT_PAREN);
            return expr;
        }

        throw this.error(this.peek(), "Expected expression.");
    }

    private statement(): Stmt {
        if (this.match(tokenType.OUTPUT)) return this.outputStatement();
        if (this.match(tokenType.RETURN)) return this.returnStatement();
        // FIXME: declaration only supports variable
        if (this.match(tokenType.DECLARE)) return this.declaration();
        // FIXME: type declaration only supports pointer
        if (this.match(tokenType.TYPE)) return this.typeDeclaration();

        if (this.match(tokenType.IF)) return this.ifStatement();
        if (this.match(tokenType.WHILE)) return this.whileStatement();
        if (this.match(tokenType.REPEAT)) return this.repeatStatement();
        if (this.match(tokenType.FOR)) return this.forStatement();

        return this.expressionStatement();
    } 

    private outputStatement(): Stmt {
        const expr = this.expression();
        return new OutputNode(expr);
    }

    private returnStatement(): ReturnNode {
        const expr = this.expression();
        return new ReturnNode(expr);
    }

    private declaration(): VarDeclNode | ArrDeclNode {
        const ident: Token = this.consume("Expected variable name", tokenType.IDENTIFIER);
        this.consume("Expected colon", tokenType.COLON);
        if (this.match(tokenType.ARRAY)) {
            this.consume("Expected '['", tokenType.LEFT_BRACKET);
            const dimensions: Array<Dimension> = new Array<Dimension>;
            if (!this.check(tokenType.RIGHT_BRACKET)) {
                do {
                    // keep it
                    if (dimensions.length >= 255) {
                        this.error(this.peek(), "Cannot have more than 255 dimensions.");
                    }
                    const lower: Token = this.consume("Expected INTEGER for ARRAY lower bound", tokenType.INT_CONST);
                    this.consume("Expected colon", tokenType.COLON);
                    const upper: Token = this.consume("Expected INTEGER for ARRAY upper bound", tokenType.INT_CONST);
                    // use interfaces
                    dimensions.push({lower, upper});
                }
                while (this.match(tokenType.COMMA));
            }
            this.consume("Expected ']'", tokenType.RIGHT_BRACKET);
            this.consume("Expected 'OF'", tokenType.OF);
            const type: Token = this.consume("Expected type", tokenType.INTEGER, tokenType.REAL, tokenType.CHAR, tokenType.STRING, tokenType.BOOLEAN, tokenType.IDENTIFIER);
            return new ArrDeclNode(ident, type, dimensions);
        }
        const type: Token = this.consume("Expected type", tokenType.INTEGER, tokenType.REAL, tokenType.CHAR, tokenType.STRING, tokenType.BOOLEAN, tokenType.IDENTIFIER);
        return new VarDeclNode(ident, type);
    }

    private typeDeclaration(): Stmt {
        const ident: Token = this.consume("Expected type name", tokenType.IDENTIFIER);
        if (this.match(tokenType.EQUAL)) {
            this.consume("Expected caret", tokenType.CARET);
            const type: Token = this.consume("Expected type", tokenType.INTEGER, tokenType.REAL, tokenType.CHAR, tokenType.STRING, tokenType.BOOLEAN, tokenType.IDENTIFIER);
            return new PtrDeclNode(ident, type);
        }
        const component: Array<VarDeclNode | ArrDeclNode> = new Array<VarDeclNode | ArrDeclNode>();
        while (!this.check(tokenType.ENDTYPE) && !this.isAtEnd()) {
            if (this.isNewLine()) this.advance();
            else {
                this.consume("Expected Declaration", tokenType.DECLARE);
                component.push(this.declaration());
            }
        }
        this.consume("Expected 'ENDTYPE'", tokenType.ENDTYPE);
        return new TypeDeclNode(ident, component);
    }

    private ifStatement(): IfNode {
        const condition: Expr = this.expression();
        this.consume("Expected 'THEN'", tokenType.THEN);
        const thenBranch: Array<Stmt> = new Array<Stmt>();
        while (!this.check(tokenType.ELSE) && !this.check(tokenType.ENDIF) && !this.isAtEnd()) {
            if (this.isNewLine()) this.advance();
            else thenBranch.push(this.statement());
        }
        const elseBranch: Array<Stmt> = new Array<Stmt>();
        if (this.match(tokenType.ELSE)) {
            while (!this.check(tokenType.ENDIF) && !this.isAtEnd()) {
                if (this.isNewLine()) this.advance();
                else elseBranch.push(this.statement());
            }
        }
        this.consume("Expected 'ENDIF'", tokenType.ENDIF);

        if (elseBranch.length > 0) {
            return new IfNode(condition, thenBranch, elseBranch);
        }
        else {
            return new IfNode(condition, thenBranch);
        }
    }

    private whileStatement(): WhileNode {
        const condition: Expr = this.expression();
        const body: Array<Stmt> = new Array<Stmt>();
        while (!this.check(tokenType.ENDWHILE) && !this.isAtEnd()) {
            if (this.isNewLine()) this.advance();
            else body.push(this.statement());
        }
        this.consume("Expected 'ENDWHILE'", tokenType.ENDWHILE);
        return new WhileNode(condition, body);
    }

    private repeatStatement(): RepeatNode {
        const body: Array<Stmt> = new Array<Stmt>();
        while (!this.check(tokenType.UNTIL) && !this.isAtEnd()) {
            if (this.isNewLine()) this.advance();
            else body.push(this.statement());
        }
        this.consume("Expected 'UNTIL'", tokenType.UNTIL);
        const condition: Expr = this.expression();
        return new RepeatNode(body, condition);
    }

    private forStatement(): ForNode {
        const ident: Token = this.consume("Expected variable name", tokenType.IDENTIFIER);
        this.consume("Expected assignment symbol", tokenType.LESS_MINUS);
        const start: Expr = this.expression();
        this.consume("Expected 'TO'", tokenType.TO);
        const end: Expr = this.expression();
        
        // step expression
        let step: Expr = new IntegerExprNode(1);
        if (this.match(tokenType.STEP)) {
            step = this.expression();
        }

        const body: Array<Stmt> = new Array<Stmt>();
        while (!this.check(tokenType.NEXT) && !this.isAtEnd()) {
            if (this.isNewLine()) this.advance();
            else body.push(this.statement());
        }
        this.consume("Expected 'NEXT'", tokenType.NEXT);
        const ident2: Token = this.consume("Expected variable name", tokenType.IDENTIFIER);

        if (ident.lexeme !== ident2.lexeme) {
            throw this.error(ident2, "Expected the same variable name.");
        }

        return new ForNode(ident, start, end, step, body);
    }

    private expressionStatement(): Stmt {
        const expr: Expr = this.expression();
        return new ExprStmtNode(expr);
    }

    private funcDefinition(): FuncDefNode {
        const ident: Token = this.consume("Expected function name", tokenType.IDENTIFIER);
        this.consume("Expected left parenthesis", tokenType.LEFT_PAREN);
        const params: Array<ParamNode> = new Array<ParamNode>();
        if (!this.check(tokenType.RIGHT_PAREN)) {
            do {
                if (params.length >= 255) {
                    // useless but keep it
                    this.error(this.peek(), "Cannot have more than 255 parameters.");
                }
                let ident: Token = this.consume("Expected parameter name", tokenType.IDENTIFIER);
                this.consume("Expected colon", tokenType.COLON);
                let type: Token = this.consume("Expected type", tokenType.INTEGER, tokenType.REAL, tokenType.CHAR, tokenType.STRING, tokenType.BOOLEAN, tokenType.IDENTIFIER);
                // function only supports BYVAL
                params.push(new ParamNode(ident, type, passType.BYVAL));
            } while (this.match(tokenType.COMMA));
        }
        this.consume("Expected right parenthesis", tokenType.RIGHT_PAREN);
        this.consume("Expected 'RETURNS'", tokenType.RETURNS);
        const type: Token = this.consume("Expected type", tokenType.INTEGER, tokenType.REAL, tokenType.CHAR, tokenType.STRING, tokenType.BOOLEAN, tokenType.IDENTIFIER);
        const body: Array<Stmt> = new Array<Stmt>();
        while (!this.check(tokenType.ENDFUNCTION) && !this.isAtEnd()) {
            if (this.isNewLine()) this.advance();
            else body.push(this.statement());
        }
        this.consume("Expected 'ENDFUNCTION'", tokenType.ENDFUNCTION);
        return new FuncDefNode(ident, params, type, body);
    }

    private procDefinition(): ProcDefNode {
        const ident: Token = this.consume("Expected procedure name", tokenType.IDENTIFIER);
        this.consume("Expected left parenthesis", tokenType.LEFT_PAREN);
        const params: Array<ParamNode> = new Array<ParamNode>();
        if (!this.check(tokenType.RIGHT_PAREN)) {
            do {
                if (params.length >= 255) {
                    // useless but keep it
                    this.error(this.peek(), "Cannot have more than 255 parameters.");
                }
                // add an underscore to the parameter name
                let _passType: passType = passType.BYVAL;
                if (this.check(tokenType.BYVAL)) {
                    _passType = passType.BYVAL;
                    this.advance();
                }
                else if (this.check(tokenType.BYREF)) {
                    _passType = passType.BYREF;
                    this.advance();
                }
                let ident: Token = this.consume("Expected parameter name", tokenType.IDENTIFIER);
                this.consume("Expected colon", tokenType.COLON);
                let type: Token = this.consume("Expected type", tokenType.INTEGER, tokenType.REAL, tokenType.CHAR, tokenType.STRING, tokenType.BOOLEAN, tokenType.IDENTIFIER);
                // default passType is BYVAL
                params.push(new ParamNode(ident, type, _passType));
            } while (this.match(tokenType.COMMA));
        }
        this.consume("Expected right parenthesis", tokenType.RIGHT_PAREN);
        const body: Array<Stmt> = new Array<Stmt>();
        while (!this.check(tokenType.ENDPROCEDURE) && !this.isAtEnd()) {
            if (this.isNewLine()) this.advance();
            else body.push(this.statement());
        }
        this.consume("Expected 'ENDPROCEDURE'", tokenType.ENDPROCEDURE);
        return new ProcDefNode(ident, params, body);
    }

    private match(...types: Array<tokenType>): boolean {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    private check(type: tokenType): boolean {
        if (this.isAtEnd()) return false;
        return this.peek().type === type;
    }

    private advance(): Token {
        if (!this.isAtEnd()) this.current++;
        return this.previous();
    }

    private isAtEnd(): boolean {
        return this.peek().type === tokenType.EOF;
    }

    private isNewLine(): boolean {
        return this.peek().type === tokenType.NEWLINE;
    }

    private peek(): Token {
        return this.tokens[this.current];
    }

    private previous(): Token {
        return this.tokens[this.current - 1];
    }

    private consume(message: string, ...types: Array<tokenType>): Token {
        for (const type of types) {
            if (this.check(type)) {
                return this.advance();
            }
        }
        throw this.error(this.peek(), message);
    }

    private error(token: Token, message: string): void {
        throw new SyntaxError(message, token.line, token.startColumn, token.endColumn);
    }

    private synchronize() {
        this.advance();

        while (!this.isAtEnd()) {
            switch (this.peek().type) {
                case tokenType.IF:
                case tokenType.WHILE:
                case tokenType.REPEAT:
                case tokenType.FOR:
                case tokenType.FUNCTION:
                case tokenType.PROCEDURE:
                case tokenType.OUTPUT:
                case tokenType.INPUT:
                case tokenType.RETURN:
                    return;
            }

            this.advance();
        }
    }
}
