/**
 * I tried to use the visitor pattern but I found that it really was not necessary.
 */

import { Token, tokenType } from "./scanning/token";
import { Environment } from "./environment";

import { passType } from "./passtype";
import { VarType, Variable } from "./variable";
import { Callable } from "./callable";
import { Function } from "./function";
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
    VarAssignNode,
    ArrAssignNode,
    IfNode,
    WhileNode,
    RepeatNode,
    ForNode,
    ExprStmtNode,
    VarExprNode,
    ArrExprNode,
    CallFunctionExprNode,
    CallProcedureExprNode,
    UnaryExprNode,
    BinaryExprNode,
    PointerExprNode,
    LocationExprNode,
    NumberExprNode,
    CharExprNode,
    StringExprNode,
    BoolExprNode,
    OutputNode,
    InputNode
}

export abstract class ASTNode {
    constructor(public kind: nodeKind) { }

    public abstract evaluate(environment: Environment): unknown;
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

    public evaluate(environment: Environment): void {
        for (const stmt of this.body) {
            stmt.evaluate(environment);
        }
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

    public evaluate(environment: Environment): void {
        const func = new Function(this);
        environment.define(this.ident, func);
        return;
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

    public evaluate(environment: Environment): unknown {
        throw new Error("Method not implemented.");
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

    public evaluate(environment: Environment): unknown {
        throw new Return(this.expr.evaluate(environment));
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

    public evaluate(environment: Environment): unknown {
        let value = environment.get(this.ident);
        // if the value is a variable then return the value of the variable
        // FIXME: ? id this a good way to do this?
        if (value instanceof Variable) {
            return value.value;
        }
        return value;
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

    public toString(): string {
        return "ArrExprNode";
    }

    public evaluate(environment: Environment): unknown {
        return;
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

    public evaluate(environment: Environment): unknown {
        const callee = this.callee.evaluate(environment);
        const args = new Array<unknown>();
        for (const arg of this.args) {
            args.push(arg.evaluate(environment));
        }

        // TODO: check if the callee is a procedure
        if (!(callee instanceof Function)) {
            throw new Error("Can only call functions and procedures.");
        }

        const func: Callable = callee as Callable;

        if (args.length !== func.arity()) {
            throw new Error(`Expected ${func.arity()} arguments but got ${args.length}.`);
        }

        return func.call(environment, args);
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

    public evaluate(environment: Environment): unknown {
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

    public toString(): string {
        return "UnaryExprNode";
    }

    public evaluate(environment: Environment): unknown {
        let value: unknown = this.expr.evaluate(environment);

        if (typeof value === "number") {
            switch (this.operator.type) {
                case tokenType.PLUS:
                    return +value;
                case tokenType.MINUS:
                    return -value;
            }
        }

        if (typeof value === "boolean") {
            switch (this.operator.type) {
                case tokenType.NOT:
                    return !value;
            }
        }

        return null;
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

    public evaluate(environment: Environment): unknown {
        let left: unknown = this.left.evaluate(environment);
        let right: unknown = this.right.evaluate(environment);
        
        // strong type check
        if (typeof left === "number" && typeof right === "number") {
            switch (this.operator.type) {
                case tokenType.LESS_GREATER:
                    return left !== right;
                case tokenType.EQUAL:
                    return left === right;
                case tokenType.GREATER:
                    return left > right;
                case tokenType.GREATER_EQUAL:
                    return left >= right;
                case tokenType.LESS:
                    return left < right;
                case tokenType.LESS_EQUAL:
                    return left <= right;
                case tokenType.PLUS:
                    return left + right;
                case tokenType.MINUS:
                    return left - right;
                case tokenType.STAR:
                    return left * right;
                case tokenType.SLASH:
                    return left / right;
                case tokenType.AMPERSAND:
                    return left + right;
                case tokenType.CARET:
                    return left ^ right;
                case tokenType.MOD:
                    return left % right;
            }
        }

        if (typeof left === "string" && typeof right === "string") {
            switch (this.operator.type) {
                case tokenType.LESS_GREATER:
                    return left !== right;
                case tokenType.EQUAL:
                    return left === right;
                case tokenType.AMPERSAND:
                    return left + right;
            }
        }

        if (typeof left === "boolean" && typeof right === "boolean") {
            switch (this.operator.type) {
                case tokenType.LESS_GREATER:
                    return left !== right;
                case tokenType.EQUAL:
                    return left === right;
                case tokenType.AND:
                    return left && right;
                case tokenType.OR:
                    return left || right;
            }
        }

        return null;
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

    public evaluate(environment: Environment): unknown {
        return;
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

    public evaluate(environment: Environment): unknown {
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

    public toString(): string {
        return "NumberExprNode";
    }

    public evaluate(environment: Environment): number {
        return this.value;
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

    public evaluate(environment: Environment): string {
        return this.value;
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

    public evaluate(environment: Environment): string {
        return this.value;
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

    public evaluate(environment: Environment): boolean {
        return this.value;
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

    public evaluate(environment: Environment): void {
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

    public toString(): string {
        return "ArrDeclNode";
    }

    public evaluate(environment: Environment): unknown {
        return;
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

    public evaluate(environment: Environment): unknown {
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

    public toString(): string {
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

    public toString(): string {
        return "VarAssignNode";
    }

    public evaluate(environment: Environment): void {
        environment.assign(this.ident, this.expr.evaluate(environment));
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

    public toString(): string {
        return "ArrAssignNode";
    }

    public evaluate(environment: Environment): unknown {
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

    public toString(): string {
        return "IfNode";
    }

    public evaluate(environment: Environment): void {
        if (this.condition.evaluate(environment)) {
            for (let stmt of this.body) {
                stmt.evaluate(environment);
            }
        } else if (this.elseBody) {
            for (let stmt of this.elseBody) {
                stmt.evaluate(environment);
            }
        }
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

    public evaluate(environment: Environment): void {
        while(this.condition.evaluate(environment)) {
            for (let stmt of this.body) {
                stmt.evaluate(environment);
            }
        }
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

    public evaluate(environment: Environment): void {
        do {
            for (let stmt of this.body) {
                stmt.evaluate(environment);
            }
        } while (!this.condition.evaluate(environment));
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

    public evaluate(environment: Environment): void {
        const start = this.start.evaluate(environment);
        const end = this.end.evaluate(environment);
        const step = this.step.evaluate(environment);

        if (typeof start === "number" && typeof end === "number" && typeof step === "number" && step > 0) {
            for(let i = start; i <= end; i += step) {
                environment.assign(this.ident, i);
                for (let stmt of this.body) {
                    stmt.evaluate(environment);
                }
            }
        } else if (typeof start === "number" && typeof end === "number" && typeof step === "number" && step < 0) {
            for(let i = start; i >= end; i += step) {
                environment.assign(this.ident, i);
                for (let stmt of this.body) {
                    stmt.evaluate(environment);
                }
            }
        }
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

    public evaluate(environment: Environment): void {
        this.expr.evaluate(environment);
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

    public evaluate(environment: Environment): void {
        let value = this.expr.evaluate(environment);

        console.log(value);
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

    public evaluate(environment: Environment): unknown {
        return;
    }
}
