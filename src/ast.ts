/**
 * I tried to use the visitor pattern but I found that it really was not necessary.
 */

import { Token, tokenType } from "./scanning/token";

import { passType } from "./passtype";
import { Return } from "./return";


export const enum nodeKind {
    ProgramNode,
    FuncDefNode,
    ProcDefNode,
    ReturnNode,
    VarDeclNode,
    ArrDeclNode,
    PointerDeclNode,
    TypeDefNode,
    AssignNode,
    VarAssignNode,
    ArrAssignNode,
    IfNode,
    WhileNode,
    RepeatNode,
    ForNode,
    ExprStmtNode,
    VarExprNode,
    IndexExprNode,
    SelectExprNode,
    CallFunctionExprNode,
    CallProcedureExprNode,
    UnaryExprNode,
    BinaryExprNode,
    PointerExprNode,
    LocationExprNode,
    IntegerExprNode,
    RealExprNode,
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
}

export abstract class Stmt extends ASTNode {
    public abstract toString(): string;
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

    public toString(): string {
        return "FuncDefNode";
    }
}

export class ProcDefNode extends Stmt {
    public ident: Token;
    public params: Array<Param>;
    public body: Array<Stmt>;

    constructor(ident: Token, params: Array<Param>, body: Array<Stmt>) {
        super(nodeKind.ProcDefNode);
        this.ident = ident;
        this.params = params;
        this.body = body;
    }

    public toString(): string {
        return "ProcDefNode";
    }
}

export class ReturnNode extends Stmt {
    public expr: Expr;

    constructor(expr: Expr) {
        super(nodeKind.ReturnNode);
        this.expr = expr;
    }

    public toString(): string {
        return "ReturnNode";
    }
}


export class VarExprNode extends Expr {
    public ident: Token;

    constructor(ident: Token) {
        super(nodeKind.VarExprNode);
        this.ident = ident;
    }

    public toString(): string {
        return "VarExprNode";
    }
}

export class IndexExprNode extends Expr {
    public expr: Expr;
    public index: Expr;

    constructor(expr: Expr, index: Expr) {
        super(nodeKind.IndexExprNode);
        this.expr = expr;
        this.index = index;
    }

    public toString(): string {
        return "IndexExprNode";
    }
}

export class SelectExprNode extends Expr {
    public expr: Expr;
    public ident: Token;

    constructor(expr: Expr, ident: Token) {
        super(nodeKind.SelectExprNode);
        this.expr = expr;
        this.ident = ident;
    }

    public toString(): string {
        return "SelectExprNode";
    }
}

// seperate the function and procedure calls
export class CallFunctionExprNode extends Expr {
    public callee: Expr;
    public args: Array<Expr>;

    constructor(ident: Expr, args: Array<Expr>) {
        super(nodeKind.CallFunctionExprNode);
        this.callee = ident;
        this.args = args;
    }

    public toString(): string {
        return "CallFunctionExprNode";
    }
}

export class CallProcedureExprNode extends Expr {
    public callee: Expr;
    public args: Array<Expr>;

    constructor(ident: Expr, args: Array<Expr>) {
        super(nodeKind.CallProcedureExprNode);
        this.callee = ident;
        this.args = args;
    }

    public toString(): string {
        return "CallProcedureExprNode";
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

    public toString(): string {
        return "UnaryExprNode";
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

    public toString(): string {
        return "BinaryExprNode";
    }
}

export class PointerExprNode extends Expr {
    // FIXME: ident should be LeftValue
    public leftValue: Expr;

    constructor(leftValue: Expr) {
        super(nodeKind.PointerExprNode);
        this.leftValue = leftValue;
    }

    public toString(): string {
        return "PointerExprNode";
    }
}

export class LocationExprNode extends Expr {
    // FIXME: ident should be LeftValue
    public leftValue: Expr;

    constructor(leftValue: Expr) {
        super(nodeKind.LocationExprNode);
        this.leftValue = leftValue;
    }

    public toString(): string {
        return "LocationExprNode";
    }
}

export class IntegerExprNode extends Expr {
    public value: number;

    constructor(value: number) {
        super(nodeKind.IntegerExprNode);
        this.value = value;
    }

    public toString(): string {
        return "IntegerExprNode";
    }
}

export class RealExprNode extends Expr {
    public value: number;

    constructor(value: number) {
        super(nodeKind.RealExprNode);
        this.value = value;
    }

    public toString(): string {
        return "RealExprNode";
    }
}

export class CharExprNode extends Expr {
    public value: string;

    constructor(value: string) {
        super(nodeKind.CharExprNode);
        this.value = value;
    }

    public toString(): string {
        return "CharExprNode";
    }
}

export class StringExprNode extends Expr {
    public value: string;

    constructor(value: string) {
        super(nodeKind.StringExprNode);
        this.value = value;
    }

    public toString(): string {
        return "StringExprNode";
    }
}

export class BoolExprNode extends Expr {
    public value: boolean;

    constructor(value: boolean) {
        super(nodeKind.BoolExprNode);
        this.value = value;
    }

    public toString(): string {
        return "BoolExprNode";
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

    public toString(): string {
        return "VarDeclNode";
    }
}

export class ArrDeclNode extends Stmt {
    public ident: Token;
    public type: Token;
    public lower: Token;
    public upper: Token;

    constructor(ident: Token, type: Token, lower: Token, upper: Token) {
        super(nodeKind.ArrDeclNode);
        this.ident = ident;
        this.type = type;
        this.lower = lower;
        this.upper = upper;
    }

    public toString(): string {
        return "ArrDeclNode";
    }
}

export class PointerDeclNode extends Stmt {
    public ident: Token;
    public type: Token;

    constructor(ident: Token, type: Token) {
        super(nodeKind.PointerDeclNode);
        this.ident = ident;
        this.type = type;
    }

    public toString(): string {
        return "PointerDeclNode";
    }
}

export class TypeDefNode extends Stmt {
    public ident: Token;
    public body: Array<Stmt>;

    constructor(ident: Token, body: Array<Stmt>) {
        super(nodeKind.TypeDefNode);
        this.ident = ident;
        this.body = body;
    }

    public toString(): string {
        return "TypeDefNode";
    }
}

export class AssignNode extends Expr {
    public left: Expr;
    public right: Expr;

    constructor(left: Expr, right: Expr) {
        super(nodeKind.AssignNode);
        this.left = left;
        this.right = right;
    }

    public toString(): string {
        return "AssignNode";
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

    public toString(): string {
        return "VarAssignNode";
    }
}

export class ArrAssignNode extends Expr {
    public ident: Token;
    public index: Expr;
    public expr: Expr;

    constructor(ident: Token, index: Expr, expr: Expr) {
        super(nodeKind.ArrAssignNode);
        this.ident = ident;
        this.index = index;
        this.expr = expr;
    }

    public toString(): string {
        return "ArrAssignNode";
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

    public toString(): string {
        return "IfNode";
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

    public toString(): string {
        return "WhileNode";
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

    public toString(): string {
        return "RepeatNode";
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

    public toString(): string {
        return "ForNode";
    }
}

// ExprStmt ::= AssignNode
export class ExprStmtNode extends Stmt {
    public expr: Expr;

    constructor(expr: Expr) {
        super(nodeKind.ExprStmtNode);
        this.expr = expr;
    }

    public toString(): string {
        return "ExprStmtNode";
    }
}

export class OutputNode extends Stmt {
    public expr: Expr;

    constructor(expr: Expr) {
        super(nodeKind.OutputNode);
        this.expr = expr;
    }

    public toString(): string {
        return "OutputNode";
    }
}

export class InputNode extends Stmt {
    public ident: string;

    constructor(ident: string) {
        super(nodeKind.InputNode);
        this.ident = ident;
    }

    public toString(): string {
        return "InputNode";
    }
}
