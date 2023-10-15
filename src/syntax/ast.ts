/**
 * I tried to use the visitor pattern but I found that it really was not necessary.
 */

import { Token, tokenType } from "../lex/token";
import { Type } from "../type/type";
import { ParamNode } from "./param";



export const enum nodeKind {
    ProgramNode,
    FuncDefNode,
    ProcDefNode,
    ReturnNode,
    VarDeclNode,
    ArrDeclNode,
    PtrDeclNode,
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
    InputNode
}

export abstract class BaseNode {
    public abstract readonly kind: nodeKind;
}

// every Expr has type property
export type Expr = AssignNode |
    VarExprNode |
    IndexExprNode |
    SelectExprNode |
    CallFuncExprNode |
    CallProcExprNode |
    UnaryExprNode |
    BinaryExprNode |
    DerefExprNode |
    AddrExprNode |
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
    PtrDeclNode |
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
    public params: Array<ParamNode>;
    // change type
    public type: Token;
    public body: Array<Stmt>;

    constructor(ident: Token, params: Array<ParamNode>, type: Token, body: Array<Stmt>) {
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
    public params: Array<ParamNode>;
    public body: Array<Stmt>;

    constructor(ident: Token, params: Array<ParamNode>, body: Array<Stmt>) {
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
    public type!: Type;
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
    public type!: Type;
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
    public type!: Type;
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
export class CallFuncExprNode extends BaseNode {
    public readonly kind = nodeKind.CallFuncExprNode;
    public type!: Type;
    public callee: Expr;
    public args: Array<Expr>;

    constructor(ident: Expr, args: Array<Expr>) {
        super();
        this.callee = ident;
        this.args = args;
    }

    public toString(): string {
        return "CallFuncExprNode";
    }
}

export class CallProcExprNode extends BaseNode {
    public readonly kind = nodeKind.CallProcExprNode;
    public callee: Expr;
    public args: Array<Expr>;

    constructor(ident: Expr, args: Array<Expr>) {
        super();
        this.callee = ident;
        this.args = args;
    }

    public toString(): string {
        return "CallProcExprNode";
    }
}

export class UnaryExprNode extends BaseNode {
    public readonly kind = nodeKind.UnaryExprNode;
    public type!: Type;
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
    public type!: Type;
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

export class DerefExprNode extends BaseNode {
    public readonly kind = nodeKind.DerefExprNode;
    public type!: Type;
    public leftValue: Expr;

    constructor(leftValue: Expr) {
        super();
        this.leftValue = leftValue;
    }

    public toString(): string {
        return "DerefExprNode";
    }
}

export class AddrExprNode extends BaseNode {
    public readonly kind = nodeKind.AddrExprNode;
    public type!: Type;
    public leftValue: Expr;

    constructor(leftValue: Expr) {
        super();
        this.leftValue = leftValue;
    }

    public toString(): string {
        return "AddrExprNode";
    }
}

export class IntegerExprNode extends BaseNode {
    public readonly kind = nodeKind.IntegerExprNode;
    public type!: Type;
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
    public type!: Type;
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
    public type!: Type;
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
    public type!: Type;
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
    public type!: Type;
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

export class PtrDeclNode extends BaseNode {
    public readonly kind = nodeKind.PtrDeclNode;
    public ident: Token;
    public type: Token;

    constructor(ident: Token, type: Token) {
        super();
        this.ident = ident;
        this.type = type;
    }

    public toString(): string {
        return "PtrDeclNode";
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
