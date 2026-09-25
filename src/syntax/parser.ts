/**
 * This parser is also highly overlapping with "https://craftinginterpreters.com/parsing-expressions.html"
 * (perhaps I would change it in the future)
 * 
 * I strongly recommend the book above (It really helped on my first hand-writen parser).
 * 
 */

import {
    nodeKind,
    BaseNode,

    Expr,
    Stmt,
    ProgramNode,
    FuncDefNode,
    ProcDefNode,
    ReturnNode,
    DeclNode,
    PtrDeclNode,
    TypeDeclNode,
    IfNode,
    WhileNode,
    RepeatNode,
    ForNode,
    CaseNode,
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
} from "./ast";
import { Dimension } from "./dimension";
import { passType, ParamNode } from "./param";
import { MAX_DIAGNOSTICS, SyntaxError } from "../error";
import { tokenType, Token } from "../lex/token";
import { Values } from "./value";
import { Type } from "../type/type";
import { ArrayType } from "../type/array";
import { BasicType, basicKind } from "../type/basic";
import { ArrTypeNode, BasicTypeNode, TypeNode } from "./typenode";


export class Parser {
    private tokens: Array<Token>;
    private current: number;
    private errors?: Array<SyntaxError>;
    
    constructor(tokens: Array<Token>) {
        this.tokens = tokens;
        this.current = 0;
    }

    private sourced<T extends BaseNode>(node: T, token: Token): T {
        node.source = token;
        return node;
    }

    public parse(errors?: Array<SyntaxError>): ProgramNode {
        this.errors = errors;
        const statements: Array<Stmt> = new Array<Stmt>();
        while (!this.isAtEnd()) {
            if (this.isNewLine()) { this.advance(); continue; }
            const start = this.peek().type;
            try {
                if (this.match(tokenType.FUNCTION)) statements.push(this.funcDefinition());
                else if (this.match(tokenType.PROCEDURE)) statements.push(this.procDefinition());
                else statements.push(this.statement());
            } catch (error) {
                if (!(error instanceof SyntaxError) || !errors) throw error;
                errors.push(error);
                if (errors.length >= MAX_DIAGNOSTICS) break;
                this.synchronize(this.terminator(start));
            }
        }
        return new ProgramNode(statements);
    }

    private recoverStatement(): Stmt | undefined {
        const start = this.peek().type;
        try {
            return this.statement();
        } catch (error) {
            if (!(error instanceof SyntaxError) || !this.errors) throw error;
            this.errors.push(error);
            if (this.errors.length >= MAX_DIAGNOSTICS) {
                this.current = this.tokens.length - 1;
                return undefined;
            }
            this.synchronize(this.terminator(start));
            return undefined;
        }
    }

    private terminator(start: tokenType): tokenType | undefined {
        switch (start) {
            case tokenType.FUNCTION: return tokenType.ENDFUNCTION;
            case tokenType.PROCEDURE: return tokenType.ENDPROCEDURE;
            case tokenType.TYPE: return tokenType.ENDTYPE;
            case tokenType.IF: return tokenType.ENDIF;
            case tokenType.WHILE: return tokenType.ENDWHILE;
            case tokenType.REPEAT: return tokenType.UNTIL;
            case tokenType.FOR: return tokenType.NEXT;
            case tokenType.CASE: return tokenType.ENDCASE;
            default: return undefined;
        }
    }

    private expression(): Expr {
        return this.assignment();
    }

    private assignment(): Expr {
        const expr: Expr = this.or();

        if (this.match(tokenType.LESS_MINUS)) {
            const equals: Token = this.previous();
            const value: Expr = this.assignment();

            return new AssignNode(expr, value);
        }
        return expr;
    }

    private or(): Expr {
        let expr: Expr = this.and();
        while (this.match(tokenType.OR)) {
            const operator: Token = this.previous();
            const right: Expr = this.and();
            expr = new BinaryExprNode(expr, operator, right);
        }
        return expr;
    }

    private and(): Expr {
        let expr: Expr = this.equality();
        while (this.match(tokenType.AND)) {
            const operator: Token = this.previous();
            const right: Expr = this.equality();
            expr = new BinaryExprNode(expr, operator, right);
        }
        return expr;
    }

    private equality(): Expr {
        let expr: Expr = this.comparison();
        while (this.match(tokenType.EQUAL, tokenType.LESS_GREATER)) {
            const operator: Token = this.previous();
            const right: Expr = this.comparison();
            expr = new BinaryExprNode(expr, operator, right);
        }
        return expr;
    }

    private comparison(): Expr {
        let expr: Expr = this.term();
        while (this.match(tokenType.GREATER, tokenType.GREATER_EQUAL, tokenType.LESS, tokenType.LESS_EQUAL)) {
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
        while (this.match(tokenType.SLASH, tokenType.STAR, tokenType.DIV, tokenType.MOD)) {
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
            const operator = this.previous();
            const leftValue: Expr = this.pointer();
            return this.sourced(new AddrExprNode(leftValue), operator);
        }

        // FIXME: A very hard problem here, this.call() should be this.pointer().
        let expr = this.call();

        while (this.match(tokenType.CARET)) expr = this.sourced(new DerefExprNode(expr), this.previous());
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
                const bracket = this.previous();
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
                expr = this.sourced(new IndexExprNode(expr, indexes), bracket);
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
        if (this.match(tokenType.FALSE)) return this.sourced(new BoolExprNode(false), this.previous());
        if (this.match(tokenType.TRUE)) return this.sourced(new BoolExprNode(true), this.previous());
        if (this.match(tokenType.INT_CONST)) return this.sourced(new IntegerExprNode(this.previous().literal), this.previous());
        if (this.match(tokenType.REAL_CONST)) return this.sourced(new RealExprNode(this.previous().literal), this.previous());
        if (this.match(tokenType.CHAR_CONST)) return this.sourced(new CharExprNode(this.previous().literal), this.previous());
        if (this.match(tokenType.STRING_CONST)) return this.sourced(new StringExprNode(this.previous().literal), this.previous());
        if (this.match(tokenType.IDENTIFIER)) return new VarExprNode(this.previous());
        if (this.match(tokenType.LEFT_PAREN)) {
            const expr: Expr = this.expression();
            this.consume("Expected ')' after expression.", tokenType.RIGHT_PAREN);
            return expr;
        }

        throw this.error(this.peek(), "Expected expression.");
    }

    private statement(): Stmt {
        if (this.match(tokenType.OUTPUT)) {
            const keyword = this.previous();
            return this.sourced(this.outputStatement(), keyword);
        }
        if (this.match(tokenType.INPUT)) {
            const keyword = this.previous();
            return this.sourced(this.inputStatement(), keyword);
        }
        if (this.match(tokenType.RETURN)) {
            const keyword = this.previous();
            return this.sourced(this.returnStatement(), keyword);
        }
        // FIXME: declaration only supports variable
        if (this.match(tokenType.DECLARE)) return this.declaration();
        // FIXME: type declaration only supports pointer
        if (this.match(tokenType.TYPE)) return this.typeDeclaration();

        if (this.match(tokenType.IF)) return this.ifStatement();
        if (this.match(tokenType.WHILE)) return this.whileStatement();
        if (this.match(tokenType.REPEAT)) return this.repeatStatement();
        if (this.match(tokenType.FOR)) return this.forStatement();
        if (this.match(tokenType.CASE)) {
            const keyword = this.previous();
            return this.sourced(this.caseStatement(), keyword);
        }

        return this.expressionStatement();
    } 

    private outputStatement(): Stmt {
        const exprs = [this.expression()];
        while (this.match(tokenType.COMMA)) exprs.push(this.expression());
        return new OutputNode(exprs);
    }

    private inputStatement(): Stmt {
        const expr = this.expression();
        return new InputNode(expr);
    }

    private returnStatement(): ReturnNode {
        const expr = this.expression();
        return new ReturnNode(expr);
    }

    private expectType(): TypeNode {
        if (this.match(tokenType.ARRAY)) {
            const arrayToken = this.previous();
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
                    const dimension: Dimension = {lower: lower.literal, upper: upper.literal, source: lower};
                    dimensions.push(dimension);
                }
                while (this.match(tokenType.COMMA));
            }
            this.consume("Expected ']'", tokenType.RIGHT_BRACKET);
            this.consume("Expected 'OF'", tokenType.OF);
            const type: TypeNode = this.expectType();
            return this.sourced(new ArrTypeNode(type, dimensions), arrayToken);
        }
        const type: Token = this.consume("Expected type", tokenType.INTEGER, tokenType.REAL, tokenType.CHAR, tokenType.STRING, tokenType.BOOLEAN, tokenType.IDENTIFIER);
        return new BasicTypeNode(type);
    }

    private declaration(): DeclNode {
        const ident: Token = this.consume("Expected variable name", tokenType.IDENTIFIER);
        this.consume("Expected colon", tokenType.COLON);
        const type: TypeNode = this.expectType();
        return new DeclNode(ident, type);
    }

    private typeDeclaration(): Stmt {
        const ident: Token = this.consume("Expected type name", tokenType.IDENTIFIER);
        if (this.match(tokenType.EQUAL)) {
            this.consume("Expected caret", tokenType.CARET);
            const type: TypeNode = this.expectType();
            return new PtrDeclNode(ident, type);
        }
        const component: Array<DeclNode> = new Array<DeclNode>();
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
            else { const stmt = this.recoverStatement(); if (stmt) thenBranch.push(stmt); }
        }
        const elseBranch: Array<Stmt> = new Array<Stmt>();
        if (this.match(tokenType.ELSE)) {
            while (!this.check(tokenType.ENDIF) && !this.isAtEnd()) {
                if (this.isNewLine()) this.advance();
                else { const stmt = this.recoverStatement(); if (stmt) elseBranch.push(stmt); }
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
            else { const stmt = this.recoverStatement(); if (stmt) body.push(stmt); }
        }
        this.consume("Expected 'ENDWHILE'", tokenType.ENDWHILE);
        return new WhileNode(condition, body);
    }

    private repeatStatement(): RepeatNode {
        const body: Array<Stmt> = new Array<Stmt>();
        while (!this.check(tokenType.UNTIL) && !this.isAtEnd()) {
            if (this.isNewLine()) this.advance();
            else { const stmt = this.recoverStatement(); if (stmt) body.push(stmt); }
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
        
        // step expression, default is 1
        let step: Expr = new IntegerExprNode(1);
        if (this.match(tokenType.STEP)) {
            step = this.expression();
        }

        const body: Array<Stmt> = new Array<Stmt>();
        while (!this.check(tokenType.NEXT) && !this.isAtEnd()) {
            if (this.isNewLine()) this.advance();
            else { const stmt = this.recoverStatement(); if (stmt) body.push(stmt); }
        }
        this.consume("Expected 'NEXT'", tokenType.NEXT);
        const ident2: Token = this.consume("Expected variable name", tokenType.IDENTIFIER);

        if (ident.lexeme !== ident2.lexeme) {
            throw this.error(ident2, "Expected the same variable name.");
        }

        return new ForNode(ident, start, end, step, body);
    }

    private caseLiteral(): Token {
        const sign = this.match(tokenType.MINUS, tokenType.PLUS) ? this.previous() : undefined;
        const literal = this.consume("Expected CASE literal", tokenType.INT_CONST,
            tokenType.REAL_CONST, tokenType.CHAR_CONST, tokenType.STRING_CONST,
            tokenType.TRUE, tokenType.FALSE);
        if (!sign) return literal;
        if (literal.type !== tokenType.INT_CONST && literal.type !== tokenType.REAL_CONST) {
            throw this.error(sign, "A sign is only valid on a numeric CASE literal");
        }
        return new Token(literal.type, sign.lexeme + literal.lexeme,
            sign.type === tokenType.MINUS ? -literal.literal : literal.literal,
            sign.line, sign.startColumn, literal.endColumn);
    }

    private isCaseLabel(): boolean {
        let index = this.current;
        if (this.tokens[index]?.type === tokenType.OTHERWISE) return true;
        if (this.tokens[index]?.type === tokenType.MINUS ||
            this.tokens[index]?.type === tokenType.PLUS) index++;
        const literal = this.tokens[index]?.type;
        if (literal !== tokenType.INT_CONST && literal !== tokenType.REAL_CONST &&
            literal !== tokenType.CHAR_CONST && literal !== tokenType.STRING_CONST &&
            literal !== tokenType.TRUE && literal !== tokenType.FALSE) return false;
        index++;
        if (this.tokens[index]?.type === tokenType.TO) {
            index++;
            if (this.tokens[index]?.type === tokenType.MINUS ||
                this.tokens[index]?.type === tokenType.PLUS) index++;
            index++;
        }
        return this.tokens[index]?.type === tokenType.COLON;
    }

    // CASE branches end at the next label or ENDCASE; semicolons remain optional
    // for compatibility with older source files.
    private caseStatement(): CaseNode {
        this.consume("Expected 'OF'", tokenType.OF);
        const ident: Token = this.consume("Expected variable name", tokenType.IDENTIFIER);
        const bodies: Array<Array<Stmt>> = new Array<Array<Stmt>>();
        const values: Array<Values> = new Array<Values>();
        let otherwiseBody: Array<Stmt> | undefined;
        while (!this.check(tokenType.ENDCASE) && !this.isAtEnd()) {
            if (this.isNewLine() || this.match(tokenType.SEMICOLON)) {
                if (this.isNewLine()) this.advance();
                continue;
            }
            if (otherwiseBody) throw this.error(this.peek(), "OTHERWISE must be the last CASE branch");
            const otherwise = this.match(tokenType.OTHERWISE);
            const from = otherwise ? undefined : this.caseLiteral();
            const to = !otherwise && this.match(tokenType.TO) ? this.caseLiteral() : from;
            this.consume("Expected ':' after CASE label", tokenType.COLON);
            const body: Array<Stmt> = [];
            while (!this.check(tokenType.ENDCASE) && !this.isAtEnd()) {
                if (this.isNewLine() || this.match(tokenType.SEMICOLON)) {
                    if (this.isNewLine()) this.advance();
                    continue;
                }
                if (this.isCaseLabel()) break;
                const stmt = this.recoverStatement();
                if (stmt) body.push(stmt);
            }
            if (otherwise) otherwiseBody = body;
            else {
                values.push({from: from!, to: to!});
                bodies.push(body);
            }
        }
        this.consume("Expected 'ENDCASE'", tokenType.ENDCASE);
        return new CaseNode(ident, values, bodies, otherwiseBody);
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
                let type: TypeNode = this.expectType();
                // function only supports BYVAL
                params.push(new ParamNode(ident, type, passType.BYVAL));
            } while (this.match(tokenType.COMMA));
        }
        this.consume("Expected right parenthesis", tokenType.RIGHT_PAREN);
        this.consume("Expected 'RETURNS'", tokenType.RETURNS);
        const type: TypeNode = this.expectType();
        const body: Array<Stmt> = new Array<Stmt>();
        while (!this.check(tokenType.ENDFUNCTION) && !this.isAtEnd()) {
            if (this.isNewLine()) this.advance();
            else { const stmt = this.recoverStatement(); if (stmt) body.push(stmt); }
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
                let type: TypeNode = this.expectType();
                // default passType is BYVAL
                params.push(new ParamNode(ident, type, _passType));
            } while (this.match(tokenType.COMMA));
        }
        this.consume("Expected right parenthesis", tokenType.RIGHT_PAREN);
        const body: Array<Stmt> = new Array<Stmt>();
        while (!this.check(tokenType.ENDPROCEDURE) && !this.isAtEnd()) {
            if (this.isNewLine()) this.advance();
            else { const stmt = this.recoverStatement(); if (stmt) body.push(stmt); }
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
        const atLineEnd = token.type === tokenType.NEWLINE || token.type === tokenType.EOF;
        throw new SyntaxError(message, token.line, token.startColumn,
            atLineEnd ? token.startColumn + 1 : token.endColumn,
            atLineEnd ? token.line : token.endLine);
    }

    private synchronize(end?: tokenType): void {
        let depth = 0;
        while (!this.isAtEnd()) {
            if (end !== undefined && this.terminator(this.peek().type) === end) depth++;
            if (this.peek().type === end) {
                this.advance();
                if (depth === 0) {
                    if (end === tokenType.NEXT && this.peek().type === tokenType.IDENTIFIER) this.advance();
                    if (end === tokenType.UNTIL) {
                        while (!this.isAtEnd() && this.peek().type !== tokenType.NEWLINE) this.advance();
                    }
                    return;
                }
                depth--;
                continue;
            }
            if (end === undefined && this.peek().type === tokenType.NEWLINE) {
                this.advance(); return;
            }
            this.advance();
        }
    }
}
