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
    IfNode,
    WhileNode,
    RepeatNode,
    ForNode,
    ExprStmtNode,
    VarExprNode,
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
import { ParamNode } from "../syntax/param";


export class Resolver {
    private ast: ProgramNode;
    private scopes: Array<Map<string, boolean>>;

    constructor(ast: ProgramNode) {
        this.ast = ast;
        this.scopes = new Array();
    }
}