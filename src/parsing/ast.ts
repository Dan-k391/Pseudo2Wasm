import { Token, tokenType } from "../scanning/token";
import { Environment } from "../semantics/environment";

import { passType } from "../passtype";


export const enum nodeKind {
    ProgramNode,
    FuncDefNode,
    ProcDefNode,
    ReturnNode,
    VarDeclNode,
    ArrDeclNode,
    TypeDefNode,
    VarAssignNode,
    ArrAssignNode,
    IfNode,
    WhileNode,
    RepeatNode,
    ForNode,
    ExprStmtNode,
    VarExprNode,
    ArrExprNode,
    CallExprNode,
    UnaryExprNode,
    BinaryExprNode,
    NumberExprNode,
    CharExprNode,
    StringExprNode,
    BoolExprNode,
    OutputNode,
    InputNode
}

export abstract class ASTNode {
    constructor(public kind: nodeKind) { }
}

export abstract class Expr extends ASTNode {
    public abstract toString(): string;

    public abstract evaluate(environment: Environment): unknown;
}

export abstract class Stmt extends ASTNode {
    public abstract toString(): string;

    public abstract evaluate(environment: Environment): unknown;
}

// fix it
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

export class ProgramNode extends ASTNode {
    public body: Array<Stmt>;

    constructor(body: Array<Stmt>) {
        super(nodeKind.ProgramNode);
        this.body = body;
    }
}

export class FuncDefNode extends Stmt {
    public ident: Token;
    public params: Array<Param>;
    // change type
    public type: Token;
    public body: Array<Stmt>;

    constructor(ident: Token, params: Array<Param>, type: Token, body: Array<Stmt>) {
        super(nodeKind.FuncDefNode);
        this.ident = ident;
        this.params = params;
        this.type = type;
        this.body = body;
    }

    toString(): string {
        return "FuncDefNode";
    }

    evaluate(environment: Environment): unknown {
        throw new Error("Method not implemented.");
    }
}

export class ProcDefNode extends Stmt {
    public ident: string;
    public params: Array<Param>;
    public body: Array<Stmt>;

    constructor(ident: string, params: Array<Param>, body: Array<Stmt>) {
        super(nodeKind.ProcDefNode);
        this.ident = ident;
        this.params = params;
        this.body = body;
    }

    toString(): string {
        return "ProcDefNode";
    }

    evaluate(environment: Environment): unknown {
        throw new Error("Method not implemented.");
    }
}

export class ReturnNode extends Stmt {
    public expr: Expr;

    constructor(expr: Expr) {
        super(nodeKind.ReturnNode);
        this.expr = expr;
    }

    toString(): string {
        return "ReturnNode";
    }

    evaluate(environment: Environment): unknown {
        throw new Error("Method not implemented.");
    }
}

export class VarDeclNode extends Stmt {
    public ident: Token;
    public type: Token;

    constructor(ident: Token, type: Token) {
        super(nodeKind.VarDeclNode);
        this.ident = ident;
        this.type = type;
    }

    toString(): string {
        return "VarDeclNode";
    }

    evaluate(environment: Environment): void {
        environment.declare(this.ident, this.type);
    }
}

export class ArrDeclNode extends Stmt {
    public ident: string;
    public type: string;
    public lower: number;
    public upper: number;

    constructor(ident: string, type: string, lower: number, upper: number) {
        super(nodeKind.ArrAssignNode);
        this.ident = ident;
        this.type = type;
        this.lower = lower;
        this.upper = upper;
    }

    toString(): string {
        return "ArrDeclNode";
    }

    evaluate(environment: Environment): unknown {
        return;
    }
}

export class TypeDefNode extends Stmt {
    public ident: string;
    public body: VarDeclNode;

    constructor(ident: string, body: VarDeclNode) {
        super(nodeKind.TypeDefNode);
        this.ident = ident;
        this.body = body;
    }

    toString(): string {
        return "TypeDefNode";
    }

    evaluate(environment: Environment): unknown {
        return;
    }
}

// assignment is expr
export class VarAssignNode extends Expr {
    public ident: Token;
    public expr: Expr;

    constructor(ident: Token, expr: Expr) {
        super(nodeKind.VarAssignNode);
        this.ident = ident;
        this.expr = expr;
    }

    toString(): string {
        return "VarAssignNode";
    }

    evaluate(environment: Environment): unknown {
        return;
    }
}

export class ArrAssignNode extends Expr {
    public ident: string;
    public index: number;
    public expr: Expr;

    constructor(ident: string, index: number, expr: Expr) {
        super(nodeKind.ArrAssignNode);
        this.ident = ident;
        this.index = index;
        this.expr = expr;
    }

    toString(): string {
        return "ArrAssignNode";
    }

    evaluate(environment: Environment): unknown {
        return;
    }
}

export class IfNode extends Stmt {
    public condition: Expr;
    public body: Array<Stmt>;
    public elseBody?: Array<Stmt>;

    constructor(condition: Expr, body: Array<Stmt>, elseBody?: Array<Stmt>) {
        super(nodeKind.IfNode);
        this.condition = condition;
        this.body = body;
        if (elseBody) {
            this.elseBody = elseBody;
        }
    }

    toString(): string {
        return "IfNode";
    }

    evaluate(environment: Environment): unknown {
        return;
    }
}

export class WhileNode extends Stmt {
    public condition: Expr;
    public body: Array<Stmt>;

    constructor(condition: Expr, body: Array<Stmt>) {
        super(nodeKind.WhileNode);
        this.condition = condition;
        this.body = body;
    }

    toString(): string {
        return "WhileNode";
    }

    evaluate(environment: Environment): unknown {
        return;
    }
}

// post-condition loops
export class RepeatNode extends Stmt {
    public body: Array<Stmt>;
    public condition: Expr;

    constructor(body: Array<Stmt>, condition: Expr) {
        super(nodeKind.RepeatNode);
        this.body = body;
        this.condition = condition;
    }

    toString(): string {
        return "RepeatNode";
    }

    evaluate(environment: Environment): unknown {
        return;
    }
}

export class ForNode extends Stmt {
    // the identifier of the variable
    // default step has been done in the parser
    public ident: Token;
    public start: Expr;
    public end: Expr;
    public step: Expr;
    public body: Array<Stmt>;

    constructor(ident: Token, start: Expr, end: Expr, step: Expr, body: Array<Stmt>) {
        super(nodeKind.ForNode);
        this.ident = ident;
        this.start = start;
        this.end = end;
        this.step = step;
        this.body = body;
    }

    toString(): string {
        return "ForNode";
    }

    evaluate(environment: Environment): unknown {
        return;
    }
}

// ExprStmt ::= AssignNode
export class ExprStmtNode extends Stmt {
    public expr: Expr;

    constructor(expr: Expr) {
        super(nodeKind.ExprStmtNode);
        this.expr = expr;
    }

    toString(): string {
        return "ExprStmtNode";
    }

    evaluate(environment: Environment): unknown {
        return;
    }
}

export class VarExprNode extends Expr {
    public ident: Token;

    constructor(ident: Token) {
        super(nodeKind.VarExprNode);
        this.ident = ident;
    }

    toString(): string {
        return "VarExprNode";
    }

    evaluate(environment: Environment): unknown {
        return;
    }
}

export class ArrExprNode extends Expr {
    public ident: string;
    public index: number;

    constructor(ident: string, index: number) {
        super(nodeKind.ArrExprNode);
        this.ident = ident;
        this.index = index;
    }

    toString(): string {
        return "ArrExprNode";
    }

    evaluate(environment: Environment): unknown {
        return;
    }
}

export class CallExprNode extends Expr {
    public ident: Expr;
    public args: Array<Expr>;

    constructor(ident: Expr, args: Array<Expr>) {
        super(nodeKind.CallExprNode);
        this.ident = ident;
        this.args = args;
    }

    toString(): string {
        return "CallExprNode";
    }

    evaluate(environment: Environment): unknown {
        return;
    }
}

export class UnaryExprNode extends Expr {
    public operator: Token;
    public expr: Expr;

    constructor(operator: Token, expr: Expr) {
        super(nodeKind.UnaryExprNode);
        this.operator = operator;
        this.expr = expr;
    }

    toString(): string {
        return "UnaryExprNode";
    }

    evaluate(environment: Environment): unknown {
        return;
    }
}

export class BinaryExprNode extends Expr {
    public left: Expr;
    public operator: Token;
    public right: Expr;

    constructor(left: Expr, operator: Token, right: Expr) {
        super(nodeKind.BinaryExprNode);
        this.left = left;
        this.operator = operator;
        this.right = right;
    }

    toString(): string {
        return "BinaryExprNode";
    }

    evaluate(environment: Environment): unknown {
        return;
    }
}

// integers and reals are both numbers, currently
export class NumberExprNode extends Expr {
    public value: number;

    constructor(value: number) {
        super(nodeKind.NumberExprNode);
        this.value = value;
    }

    toString(): string {
        return "NumberExprNode";
    }

    evaluate(environment: Environment): unknown {
        return;
    }
}

export class CharExprNode extends Expr {
    public value: string;

    constructor(value: string) {
        super(nodeKind.CharExprNode);
        this.value = value;
    }

    toString(): string {
        return "CharExprNode";
    }

    evaluate(environment: Environment): unknown {
        return;
    }
}

export class StringExprNode extends Expr {
    public value: string;

    constructor(value: string) {
        super(nodeKind.StringExprNode);
        this.value = value;
    }

    toString(): string {
        return "StringExprNode";
    }

    evaluate(environment: Environment): unknown {
        return;
    }
}

export class BoolExprNode extends Expr {
    public value: boolean;

    constructor(value: boolean) {
        super(nodeKind.BoolExprNode);
        this.value = value;
    }

    toString(): string {
        return "BoolExprNode";
    }

    evaluate(environment: Environment): unknown {
        return;
    }
}

export class OutputNode extends Stmt {
    public expr: Expr;

    constructor(expr: Expr) {
        super(nodeKind.OutputNode);
        this.expr = expr;
    }

    toString(): string {
        return "OutputNode";
    }

    evaluate(environment: Environment): unknown {
        return;
    }
}

export class InputNode extends Stmt {
    public ident: string;

    constructor(ident: string) {
        super(nodeKind.InputNode);
        this.ident = ident;
    }

    toString(): string {
        return "InputNode";
    }

    evaluate(environment: Environment): unknown {
        return;
    }
}
