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
    TypeDeclNode,
    AssignNode,
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
    typeKind} from "../type/type";
import { basicKind } from "../type/basic";
import { RecordType } from "../type/record";
import { ArrayType } from "../type/array";
import { BasicType } from "../type/basic";
import { Generator } from "./generator";
import { Callable } from "./callable";


// TODO: maybe new a common file to contain these
type Module = binaryen.Module;
type ExpressionRef = binaryen.ExpressionRef;
type WasmType = binaryen.Type;

export class Procedure extends Callable {
    private body: Array<Stmt>;

    constructor(module: Module,
        enclosing: Generator,
        ident: string,
        params: Map<string, Param>,
        body: Array<Stmt>) {
        super(module, enclosing, ident, params);
        this.body = body;
    }

    public generate(): void {
        // FIXME: fix the type conversion, also only supports BYVAL currently
        const paramWasmTypes = new Array<WasmType>();

        for (const value of this.params.values()) {
            paramWasmTypes.push(value.wasmType);
        }

        const paramType = binaryen.createType(paramWasmTypes);

        const procBody = [
            this.prologue(),
            this.initParams(),
            ...this.generateStatements(this.body),
            this.epilogue()
        ];

        // empty local variable array
        this.module.addFunction(this.ident, paramType, binaryen.none, [], this.module.block(null, procBody));
    }
}
