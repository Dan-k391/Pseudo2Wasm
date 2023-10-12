import binaryen from "binaryen";
import { Environment } from "../import";
import { RuntimeError } from "../error";
import { _Symbol } from "./symbol";
import { tokenType } from "../lex/token";
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
    TypeDefNode,
    AssignNode,
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
    IntegerExprNode,
    RealExprNode,
    CharExprNode,
    StringExprNode,
    BoolExprNode,
    OutputNode,
    InputNode
} from "../syntax/ast";
import { Param } from "./param";

import { convertToBasicType, convertToWasmType, unreachable } from "../util";
import { Local } from "./local";
import { 
    Type,
    typeKind,
    basicKind,
    BasicType,
    ArrayType,
    RecordType
} from "../type/type";
import { minimalCompatableBasicType } from "../type/type";
import { Generator } from "./generator";
import { Callable } from "./callable";

// TODO: maybe new a common file to contain these
type Module = binaryen.Module;
type FunctionRef = binaryen.FunctionRef;
type ExpressionRef = binaryen.ExpressionRef;
type WasmType = binaryen.Type;

export abstract class Function extends Callable {
    constructor(module: Module,
        enclosing: Generator,
        ident: string,
        params: Map<string, Param>,
        public returnType: Type,
        public wasmReturnType: WasmType,
        public isBuiltin: boolean) {
            super(module, enclosing, ident, params);
        }
    
    public abstract generate(): void;
}

// User Defined Function

export class DefinedFunction extends Function {
    private body: Array<Stmt>;

    constructor(module: Module,
        enclosing: Generator,
        ident: string,
        params: Map<string, Param>,
        returnType: Type,
        wasmReturnType: WasmType,
        body: Array<Stmt>) {
        super(module, enclosing, ident, params, returnType, wasmReturnType, false);
        this.body = body;
    }

    public generate(): void {
        // debugger;
        // FIXME: fix the type conversion, also only supports BYVAL currently
        const paramWasmTypes = new Array<WasmType>();

        for (const value of this.params.values()) {
            paramWasmTypes.push(value.wasmType);
        }

        const paramType = binaryen.createType(paramWasmTypes);

        const funcBody = [
            this.prologue(),
            ...this.initParams(),
            ...this.generateStatements(this.body),
            this.epilogue(),
        ];
        
        // FIXME: single returnType has problem here
        // empty local variable array
        this.module.addFunction(this.ident, paramType, this.wasmReturnType, [], this.module.block(null, funcBody));
    }

    protected override generateStatement(statement: Stmt): ExpressionRef {
        switch (statement.kind) {
            case nodeKind.ExprStmtNode:
                return this.generateExpression(statement.expr);
            case nodeKind.ReturnNode:
                return this.returnStatement(statement);
            case nodeKind.OutputNode:
                return this.outputStatement(statement);
            case nodeKind.VarDeclNode:
                return this.varDeclStatement(statement);
            case nodeKind.ArrDeclNode:
                return this.arrDeclStatement(statement);
            case nodeKind.IfNode:
                return this.ifStatement(statement);
            case nodeKind.WhileNode:
                return this.whileStatement(statement);
            case nodeKind.RepeatNode:
                return this.repeatStatement(statement);
            case nodeKind.ForNode:
                return this.forStatement(statement);
            default:
                throw new RuntimeError("Not implemented yet");
        }
    }

    private returnStatement(node: ReturnNode): ExpressionRef {
        return this.module.block(null, [
            this.module.global.set(
                "__stackTop",
                this.module.global.get("__stackBase", binaryen.i32)
            ),
            this.module.i32.store(0, 1, 
                this.module.global.get("__stackBase", binaryen.i32),
                this.module.i32.load(0, 1, 
                    this.module.global.get("__stackTop", binaryen.i32), "0"
                ), "0"
            ),
            this.enclosing.decrementStackTop(4),
            this.module.return(this.generateExpression(node.expr))
        ]);
    }
}
