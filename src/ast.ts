/**
 * I tried to use the visitor pattern but I found that it really was not necessary.
 */

import { Token, tokenType } from "./scanning/token";

import { passType } from "./passtype";


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

export abstract class BaseNode {
    public abstract readonly kind: nodeKind;
}

export type Expr = AssignNode |
    VarExprNode |
    IndexExprNode |
    SelectExprNode |
    CallFunctionExprNode |
    CallProcedureExprNode |
    UnaryExprNode |
    BinaryExprNode |
    PointerExprNode |
    LocationExprNode |
    IntegerExprNode |
    RealExprNode |
    CharExprNode |
    StringExprNode |
    BoolExprNode;

export type Stmt = ProgramNode |
    FuncDefNode |
    ProcDefNode |
    ReturnNode |
    VarDeclNode |
    ArrDeclNode |
    PointerDeclNode |
    TypeDefNode |
    VarAssignNode |
    ArrAssignNode |
    IfNode |
    WhileNode |
    RepeatNode |
    ForNode |
    ExprStmtNode |
    OutputNode |
    InputNode;

// export abstract class Expr extends BaseNode {
//     public abstract toString(): string;
// }

// export abstract class Stmt extends BaseNode {
//     public abstract toString(): string;
// }

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

export class ProgramNode extends BaseNode {
    public readonly kind = nodeKind.ProgramNode;
    public body: Array<Stmt>;

    constructor(body: Array<Stmt>) {
        super();
        this.body = body;
    }
}

export class FuncDefNode extends BaseNode {
    public readonly kind = nodeKind.FuncDefNode;
    public ident: Token;
    public params: Array<Param>;
    // change type
    public type: Token;
    public body: Array<Stmt>;

    constructor(ident: Token, params: Array<Param>, type: Token, body: Array<Stmt>) {
        super();
        this.ident = ident;
        this.params = params;
        this.type = type;
        this.body = body;
    }

    public toString(): string {
        return "FuncDefNode";
    }
}

export class ProcDefNode extends BaseNode {
    public readonly kind = nodeKind.ProcDefNode;
    public ident: Token;
    public params: Array<Param>;
    public body: Array<Stmt>;

    constructor(ident: Token, params: Array<Param>, body: Array<Stmt>) {
        super();
        this.ident = ident;
        this.params = params;
        this.body = body;
    }

    public toString(): string {
        return "ProcDefNode";
    }
}

export class ReturnNode extends BaseNode {
    public readonly kind = nodeKind.ReturnNode;
    public expr: Expr;

    constructor(expr: Expr) {
        super();
        this.expr = expr;
    }

    public toString(): string {
        return "ReturnNode";
    }
}


export class VarExprNode extends BaseNode {
    public readonly kind = nodeKind.VarExprNode;
    public ident: Token;

    constructor(ident: Token) {
        super();
        this.ident = ident;
    }

    public toString(): string {
        return "VarExprNode";
    }
}

export class IndexExprNode extends BaseNode {
    public readonly kind = nodeKind.IndexExprNode;
    public expr: Expr;
    public indexes: Array<Expr>;

    constructor(expr: Expr, indexes: Array<Expr>) {
        super();
        this.expr = expr;
        this.indexes = indexes;
    }

    public toString(): string {
        return "IndexExprNode";
    }
}

export class SelectExprNode extends BaseNode {
    public readonly kind = nodeKind.SelectExprNode;
    public expr: Expr;
    public ident: Token;

    constructor(expr: Expr, ident: Token) {
        super();
        this.expr = expr;
        this.ident = ident;
    }

    public toString(): string {
        return "SelectExprNode";
    }
}

// seperate the function and procedure calls
export class CallFunctionExprNode extends BaseNode {
    public readonly kind = nodeKind.CallFunctionExprNode;
    public callee: Expr;
    public args: Array<Expr>;

    constructor(ident: Expr, args: Array<Expr>) {
        super();
        this.callee = ident;
        this.args = args;
    }

    public toString(): string {
        return "CallFunctionExprNode";
    }
}

export class CallProcedureExprNode extends BaseNode {
    public readonly kind = nodeKind.CallProcedureExprNode;
    public callee: Expr;
    public args: Array<Expr>;

    constructor(ident: Expr, args: Array<Expr>) {
        super();
        this.callee = ident;
        this.args = args;
    }

    public toString(): string {
        return "CallProcedureExprNode";
    }
}

export class UnaryExprNode extends BaseNode {
    public readonly kind = nodeKind.UnaryExprNode;
    public operator: Token;
    public expr: Expr;

    constructor(operator: Token, expr: Expr) {
        super();
        this.operator = operator;
        this.expr = expr;
    }

    public toString(): string {
        return "UnaryExprNode";
    }
}

export class BinaryExprNode extends BaseNode {
    public readonly kind = nodeKind.BinaryExprNode;
    public left: Expr;
    public operator: Token;
    public right: Expr;

    constructor(left: Expr, operator: Token, right: Expr) {
        super();
        this.left = left;
        this.operator = operator;
        this.right = right;
    }

    public toString(): string {
        return "BinaryExprNode";
    }
}

export class PointerExprNode extends BaseNode {
    public readonly kind = nodeKind.PointerDeclNode;
    public leftValue: Expr;

    constructor(leftValue: Expr) {
        super();
        this.leftValue = leftValue;
    }

    public toString(): string {
        return "PointerExprNode";
    }
}

export class LocationExprNode extends BaseNode {
    public readonly kind = nodeKind.LocationExprNode;
    public leftValue: Expr;

    constructor(leftValue: Expr) {
        super();
        this.leftValue = leftValue;
    }

    public toString(): string {
        return "LocationExprNode";
    }
}

export class IntegerExprNode extends BaseNode {
    public readonly kind = nodeKind.IntegerExprNode;
    public value: number;

    constructor(value: number) {
        super();
        this.value = value;
    }

    public toString(): string {
        return "IntegerExprNode";
    }
}

export class RealExprNode extends BaseNode {
    public readonly kind = nodeKind.RealExprNode;
    public value: number;

    constructor(value: number) {
        super();
        this.value = value;
    }

    public toString(): string {
        return "RealExprNode";
    }
}

export class CharExprNode extends BaseNode {
    public readonly kind = nodeKind.CharExprNode;
    public value: string;

    constructor(value: string) {
        super();
        this.value = value;
    }

    public toString(): string {
        return "CharExprNode";
    }
}

export class StringExprNode extends BaseNode {
    public readonly kind = nodeKind.StringExprNode;
    public value: string;

    constructor(value: string) {
        super();
        this.value = value;
    }

    public toString(): string {
        return "StringExprNode";
    }
}

export class BoolExprNode extends BaseNode {
    public readonly kind = nodeKind.BoolExprNode;
    public value: boolean;

    constructor(value: boolean) {
        super();
        this.value = value;
    }

    public toString(): string {
        return "BoolExprNode";
    }
}

export class VarDeclNode extends BaseNode {
    public readonly kind = nodeKind.VarDeclNode;
    public ident: Token;
    public type: Token;

    constructor(ident: Token, type: Token) {
        super();
        this.ident = ident;
        this.type = type;
    }

    public toString(): string {
        return "VarDeclNode";
    }
}

export interface Dimension {
    lower: Token;
    upper: Token;
}

export class ArrDeclNode extends BaseNode {
    public readonly kind = nodeKind.ArrDeclNode;
    public ident: Token;
    public type: Token;
    public dimensions: Array<Dimension>;

    constructor(ident: Token, type: Token, dimensions: Array<Dimension>) {
        super();
        this.ident = ident;
        this.type = type;
        this.dimensions = dimensions;
    }

    public toString(): string {
        return "ArrDeclNode";
    }
}

export class PointerDeclNode extends BaseNode {
    public readonly kind = nodeKind.PointerDeclNode;
    public ident: Token;
    public type: Token;

    constructor(ident: Token, type: Token) {
        super();
        this.ident = ident;
        this.type = type;
    }

    public toString(): string {
        return "PointerDeclNode";
    }
}

export class TypeDefNode extends BaseNode {
    public readonly kind = nodeKind.TypeDefNode;
    public ident: Token;
    public body: Array<Stmt>;

    constructor(ident: Token, body: Array<Stmt>) {
        super();
        this.ident = ident;
        this.body = body;
    }

    public toString(): string {
        return "TypeDefNode";
    }
}

export class AssignNode extends BaseNode {
    public readonly kind = nodeKind.AssignNode;
    public left: Expr;
    public right: Expr;

    constructor(left: Expr, right: Expr) {
        super();
        this.left = left;
        this.right = right;
    }

    public toString(): string {
        return "AssignNode";
    }
}

// assignment is expr
export class VarAssignNode extends BaseNode {
    public readonly kind = nodeKind.VarAssignNode;
    public ident: Token;
    public expr: Expr;

    constructor(ident: Token, expr: Expr) {
        super();
        this.ident = ident;
        this.expr = expr;
    }

    public toString(): string {
        return "VarAssignNode";
    }
}

export class ArrAssignNode extends BaseNode {
    public readonly kind = nodeKind.ArrAssignNode;
    public ident: Token;
    public index: Expr;
    public expr: Expr;

    constructor(ident: Token, index: Expr, expr: Expr) {
        super();
        this.ident = ident;
        this.index = index;
        this.expr = expr;
    }

    public toString(): string {
        return "ArrAssignNode";
    }
}

export class IfNode extends BaseNode {
    public readonly kind = nodeKind.IfNode;
    public condition: Expr;
    public body: Array<Stmt>;
    public elseBody?: Array<Stmt>;

    constructor(condition: Expr, body: Array<Stmt>, elseBody?: Array<Stmt>) {
        super();
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

export class WhileNode extends BaseNode {
    public readonly kind = nodeKind.WhileNode;
    public condition: Expr;
    public body: Array<Stmt>;

    constructor(condition: Expr, body: Array<Stmt>) {
        super();
        this.condition = condition;
        this.body = body;
    }

    public toString(): string {
        return "WhileNode";
    }
}

// post-condition loops
export class RepeatNode extends BaseNode {
    public readonly kind = nodeKind.RepeatNode;
    public body: Array<Stmt>;
    public condition: Expr;

    constructor(body: Array<Stmt>, condition: Expr) {
        super();
        this.body = body;
        this.condition = condition;
    }

    public toString(): string {
        return "RepeatNode";
    }
}

export class ForNode extends BaseNode {
    public readonly kind = nodeKind.ForNode;
    // the identifier of the variable
    // default step has been done in the parser
    public ident: Token;
    public start: Expr;
    public end: Expr;
    public step: Expr;
    public body: Array<Stmt>;

    constructor(ident: Token, start: Expr, end: Expr, step: Expr, body: Array<Stmt>) {
        super();
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
export class ExprStmtNode extends BaseNode {
    public readonly kind = nodeKind.ExprStmtNode;
    public expr: Expr;

    constructor(expr: Expr) {
        super();
        this.expr = expr;
    }

    public toString(): string {
        return "ExprStmtNode";
    }
}

export class OutputNode extends BaseNode {
    public readonly kind = nodeKind.OutputNode;
    public expr: Expr;

    constructor(expr: Expr) {
        super();
        this.expr = expr;
    }

    public toString(): string {
        return "OutputNode";
    }
}

export class InputNode extends BaseNode {
    public readonly kind = nodeKind.InputNode;
    public ident: string;

    constructor(ident: string) {
        super();
        this.ident = ident;
    }

    public toString(): string {
        return "InputNode";
    }
}
