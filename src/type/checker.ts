// TODO: this will be implemented after the first complete version is done
import { RuntimeError } from "../error";
import { Token, tokenType } from "../lex/token";
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
import { convertToBasicType, unreachable } from "../util";
import { Scope } from "./scopes";
import { Type, typeKind } from "./type";
import { basicKind } from "./basic";
import { BasicType } from "./basic";
import { FunctionType } from "./function";
import { ArrayType } from "./array";
import { PointerType } from "./pointer";


export class Checker {
    public ast: ProgramNode;
    public global: Scope;
    public curScope: Scope;

    constructor(ast: ProgramNode) {
        this.ast = ast;
        this.global = new Scope(false);
        this.curScope = this.global;
    }

    public check(): ProgramNode {
        this.visit();
        return this.ast;
    }

    // initialize builtin functions
    private init(): void {
        const lengthFunc = new FunctionType(
            new Map<string, Type>([
                ["str", new BasicType(basicKind.STRING)]
            ]),
            new BasicType(basicKind.INTEGER)
        );
        this.curScope.insertFunc("LENGTH", lengthFunc);
    }

    // assign type to each Expr Node
    private visit(): void {
        this.init();
        this.visitStmts(this.ast.body);
    }

    private beginScope(isFunc: boolean): void {
        const scope = new Scope(isFunc, this.global);
        this.global.children.push(scope);
        this.curScope = scope;
    }

    private endScope(): void {
        this.curScope = this.curScope.parent!;
    }

    private insert(name: Token, type: Type): void {
        this.curScope.insert(name.lexeme, type);
    }

    private lookUp(name: Token): Type {
        return this.curScope.lookUp(name.lexeme);
    }

    private declFunc(node: FuncDefNode): void {
        const funcName = node.ident.lexeme;
        const funcParams = new Map<string, Type>();

        for (const param of node.params) {
            const paramName = param.ident.lexeme;
            // FIXME: only basic types supported
            const paramType = convertToBasicType(param.type);
            // nethermind the method to set
            funcParams.set(paramName, paramType);
        }

        const func = new FunctionType(funcParams, convertToBasicType(node.type));

        this.curScope.insertFunc(funcName, func);
    }

    private getFuncType(name: Token): FunctionType {
        return this.curScope.getFuncType(name.lexeme);
    }

    private visitFuncDef(node: FuncDefNode) {
        this.beginScope(true);
        for (const param of node.params) {
            this.insert(param.ident, convertToBasicType(param.type));
        }
        this.visitStmts(node.body);
        this.endScope();
    }

    private visitProcDef(node: ProcDefNode) {
        this.beginScope(false);
        for (const param of node.params) {
            this.insert(param.ident, convertToBasicType(param.type));
        }
        this.visitStmts(node.body);
        this.endScope();
    }

    private visitExpr(expr: Expr): Type {
        switch (expr.kind) {
            case nodeKind.AssignNode:
                return this.assignExpr(expr);
            case nodeKind.VarExprNode:
                return this.varExpr(expr);
            case nodeKind.IndexExprNode:
                return this.indexExpr(expr);
            case nodeKind.SelectExprNode:
                return this.selectExpr(expr);
            case nodeKind.CallFuncExprNode:
                return this.callFuncExpr(expr);
            case nodeKind.CallProcExprNode:
                return this.callProcExpr(expr);
            case nodeKind.UnaryExprNode:
                return this.unaryExpr(expr);
            case nodeKind.BinaryExprNode:
                return this.binaryExpr(expr);
            case nodeKind.IntegerExprNode:
                return this.integerExpr(expr);
            case nodeKind.RealExprNode:
                return this.realExpr(expr);
            case nodeKind.CharExprNode:
                return this.charExpr(expr);
            case nodeKind.StringExprNode:
                return this.stringExpr(expr);
            default:
                throw new RuntimeError("Not implemented yet");
        }
    }

    // TODO: check if can convert
    // assign has no type
    private assignExpr(node: AssignNode): Type {
        const leftType = this.visitExpr(node.left);
        const rightType = this.visitExpr(node.right);
        // FIXME: fix soon
        if (leftType.kind !== typeKind.BASIC || rightType.kind !== typeKind.BASIC) {
            throw new RuntimeError("not implemented");
        }
        return new BasicType(basicKind.NONE);
    }

    private varExpr(node: VarExprNode): Type {
        node.type = this.lookUp(node.ident);
        return node.type;
    }

    private indexExpr(node: IndexExprNode): Type {   
        const base = this.visitExpr(node.expr);
        if (base.kind !== typeKind.ARRAY) {
            throw new RuntimeError("Cannot perfrom 'index' operation to none ARRAY types");
        }
        node.type = base.elem;
        return node.type;
    }

    private selectExpr(node: SelectExprNode): Type {
        const base = this.visitExpr(node.expr);
        if (base.kind !== typeKind.RECORD) {
            throw new RuntimeError("Cannot perfrom 'select' operation to none RECORD types");
        }
        node.type = base.fields.get(node.ident.lexeme)!;
        return node.type;
    }

    private callFuncExpr(node: CallFuncExprNode): Type {
        if (node.callee.kind === nodeKind.VarExprNode) {
            const funcName = node.callee.ident.lexeme;
            const func = this.getFuncType(node.callee.ident);
            if (func.paramTypes.size !== node.args.length) {
                throw new RuntimeError("Function '" + funcName + "' expects " + func.paramTypes.size + " arguments, but " + node.args.length + " are provided");
            }
            for (let i = 0, paramNames = Array.from(func.paramTypes.keys()); i < node.args.length; i++) {
                const arg = node.args[i]; 
                const expr = this.visitExpr(arg);
                const paramType = func.paramTypes.get(paramNames[i]);
                // TODO: check if can convert
            }
            node.type = func.returnType;
            return node.type;
        }
        throw new RuntimeError("Not implemented yet");
    }

    // PROCEDUREs do not have a return value
    private callProcExpr(node: CallProcExprNode): Type {
        return new BasicType(basicKind.NONE);
    }

    private unaryExpr(node: UnaryExprNode): Type {   
        node.type = this.visitExpr(node.expr);
        return node.type;
    }

    private binaryExpr(node: BinaryExprNode): Type {
        const leftType = this.visitExpr(node.left);
        const rightType = this.visitExpr(node.right);

        // Binary operations only happen between basic types, at least now
        // TODO: Whether ot not to support Array comparison is a question
        if (leftType.kind !== typeKind.BASIC || rightType.kind !== typeKind.BASIC) {
            throw new RuntimeError("Cannot convert " + rightType + " to " + leftType);
        }

        const leftBasicType = leftType.type;
        const rightBasicType = rightType.type;
        
        // the following code looks complicated but just goes over all the possibilities
        // for basic types
        // I do this because it then differs every type instead of converting them all
        // into an INTEGER and see if promote to REAL
        // for example, doing this does not allow a CHAR to convert to a REAL
        switch (node.operator.type) {
            // arithmetic operations
            case tokenType.PLUS:
            case tokenType.MINUS:
            case tokenType.STAR:
            case tokenType.SLASH:
                switch (leftBasicType) {
                    case basicKind.INTEGER:
                        if (rightBasicType == basicKind.INTEGER ||
                            rightBasicType == basicKind.CHAR ||
                            rightBasicType == basicKind.BOOLEAN) {
                            node.type = new BasicType(basicKind.INTEGER);
                        }
                        else if (rightBasicType == basicKind.REAL) {
                            node.type = new BasicType(basicKind.REAL);
                        }
                        else {
                            throw new RuntimeError("Cannot convert " + rightBasicType + " to " + leftBasicType);
                        }
                        break;
                    case basicKind.REAL:
                        if (rightBasicType == basicKind.INTEGER ||
                            rightBasicType == basicKind.REAL) {
                            node.type = new BasicType(basicKind.REAL);
                        }
                        else {
                            throw new RuntimeError("Cannot convert " + rightBasicType + " to " + leftBasicType);
                        }
                        break;
                    case basicKind.CHAR:
                        if (rightBasicType == basicKind.INTEGER ||
                            rightBasicType == basicKind.CHAR ||
                            rightBasicType == basicKind.BOOLEAN) {
                            node.type = new BasicType(basicKind.INTEGER);
                        }
                        else {
                            throw new RuntimeError("Cannot convert " + rightBasicType + " to " + leftBasicType);
                        }
                        break;
                    case basicKind.STRING:
                        // FIXME: handle concat
                        throw new RuntimeError("Cannot convert " + rightBasicType + " to " + leftBasicType);
                        break;
                    case basicKind.BOOLEAN:
                        if (rightBasicType == basicKind.INTEGER ||
                            rightBasicType == basicKind.CHAR ||
                            rightBasicType == basicKind.BOOLEAN) {
                            node.type = new BasicType(basicKind.INTEGER);
                        }
                        else {
                            throw new RuntimeError("Cannot convert " + rightBasicType + " to " + leftBasicType);
                        }
                        break;
                }
            // logical operators
            case tokenType.EQUAL:
            case tokenType.LESS_GREATER:
            case tokenType.LESS:
            case tokenType.GREATER:
            case tokenType.LESS_EQUAL:
            case tokenType.GREATER_EQUAL:
                switch (leftBasicType) {
                    case basicKind.INTEGER:
                        if (rightBasicType == basicKind.INTEGER ||
                            rightBasicType == basicKind.REAL ||
                            rightBasicType == basicKind.CHAR ||
                            rightBasicType == basicKind.BOOLEAN) {
                            node.type = new BasicType(basicKind.BOOLEAN);
                        }
                        else {
                            throw new RuntimeError("Cannot convert " + rightBasicType + " to " + leftBasicType);
                        }
                        break;
                    case basicKind.REAL:
                        if (rightBasicType == basicKind.INTEGER ||
                            rightBasicType == basicKind.REAL) {
                            node.type = new BasicType(basicKind.BOOLEAN);
                        }
                        else {
                            throw new RuntimeError("Cannot convert " + rightBasicType + " to " + leftBasicType);
                        }
                        break;
                    case basicKind.CHAR:
                        if (rightBasicType == basicKind.INTEGER ||
                            rightBasicType == basicKind.CHAR ||
                            rightBasicType == basicKind.BOOLEAN ||
                            basicKind.STRING) {
                            node.type = new BasicType(basicKind.BOOLEAN);
                        }
                        else {
                            throw new RuntimeError("Cannot convert " + rightBasicType + " to " + leftBasicType);
                        }
                        break;
                    case basicKind.STRING:
                        if (rightBasicType == basicKind.CHAR ||
                            rightBasicType == basicKind.STRING) {
                            node.type = new BasicType(basicKind.BOOLEAN);
                        }
                        else {
                            throw new RuntimeError("Cannot convert " + rightBasicType + " to " + leftBasicType);
                        }
                        break;
                    case basicKind.BOOLEAN:
                        if (rightBasicType == basicKind.INTEGER ||
                            rightBasicType == basicKind.BOOLEAN) {
                            node.type = new BasicType(basicKind.BOOLEAN);
                        }
                        else {
                            throw new RuntimeError("Cannot convert " + rightBasicType + " to " + leftBasicType);
                        }
                        break;
                }
            // FIXME: this is so wierd, enabling this gives an error
            // default:
            //     unreachable();
        }
        return node.type;
    }

    private integerExpr(node: IntegerExprNode): Type {
        node.type = new BasicType(basicKind.INTEGER)
        return node.type;
    }

    private realExpr(node: RealExprNode): Type {
        node.type = new BasicType(basicKind.REAL);
        return node.type;
    }

    private charExpr(node: CharExprNode): Type {
        node.type = new BasicType(basicKind.CHAR);
        return node.type;
    }

    private stringExpr(node: StringExprNode): Type {
        node.type = new BasicType(basicKind.STRING);
        return node.type;
    }

    private visitStmts(stmts: Array<Stmt>): void {
        // first declare all functions
        for (const stmt of stmts) {
            if (stmt.kind === nodeKind.FuncDefNode) {
                this.declFunc(stmt);
            }
        }
        // then run the other code
        for (const stmt of stmts) {
            if (stmt.kind === nodeKind.FuncDefNode) {
                this.visitFuncDef(stmt);
            }
            else if (stmt.kind === nodeKind.ProcDefNode) {
                this.visitProcDef(stmt);
            }
            else {
                this.visitStmt(stmt);
            }
        }
    }

    private visitStmt(stmt: Stmt): void {
        switch (stmt.kind) {
            case nodeKind.ExprStmtNode:
                this.visitExpr(stmt.expr);
                break;
            case nodeKind.ReturnNode:
                // can only return in functions
                if (!this.curScope.isFunc) {
                    throw new RuntimeError("Really? What were you expecting it to return?");
                }
                this.visitReturn(stmt);
                break;
            case nodeKind.OutputNode:
                this.visitOutputStmt(stmt);
                break;
            case nodeKind.VarDeclNode:
                this.visitVarDeclStmt(stmt);
                break;
            case nodeKind.ArrDeclNode:
                this.visitArrDeclStmt(stmt);
                break;
            case nodeKind.PtrDeclNode:
                this.visitPtrDeclStmt(stmt);
                break;
            case nodeKind.IfNode:
                this.visitIfStmt(stmt);
                break;
            case nodeKind.WhileNode:
                this.visitWhileStmt(stmt);
                break;
            case nodeKind.RepeatNode:
                this.visitRepeatStmt(stmt);
                break;
            case nodeKind.ForNode:
                this.visitForStmt(stmt);
                break;
            default:
                throw new RuntimeError("Not implemented yet");
        }
    }

    private visitReturn(node: ReturnNode): void {
        this.visitExpr(node.expr);
    }

    private visitOutputStmt(node: OutputNode): void {
        this.visitExpr(node.expr);
    }

    private visitVarDeclStmt(node: VarDeclNode): void {
        this.insert(node.ident, convertToBasicType(node.type));
    }

    private visitArrDeclStmt(node: ArrDeclNode): void {
        const elemType = convertToBasicType(node.type);
        this.insert(
            node.ident,
            new ArrayType(elemType, node.dimensions)
        );
    }

    private visitPtrDeclStmt(node: PtrDeclNode): void {
        const elemType = convertToBasicType(node.type);
        this.insert(
            node.ident,
            new PointerType(elemType)
        );
    }

    private visitIfStmt(node: IfNode): void {
        this.visitExpr(node.condition);
        this.visitStmts(node.body);
        if (node.elseBody) {
            this.visitStmts(node.elseBody);
        }
    }

    private visitWhileStmt(node: WhileNode): void {
        this.visitExpr(node.condition);
        this.visitStmts(node.body);
    }

    private visitRepeatStmt(node: RepeatNode): void {
        this.visitExpr(node.condition);
        this.visitStmts(node.body);
    }

    private visitForStmt(node: ForNode): void {
        const varType = this.lookUp(node.ident);
        const endType = this.visitExpr(node.end);
        const stepType = this.visitExpr(node.step);
        
        if (varType.kind !== typeKind.BASIC || varType.type !== basicKind.INTEGER) {
            throw new RuntimeError("For loops only iterate over for INTEGERs");
        }
        if (endType.kind !== typeKind.BASIC || endType.type !== basicKind.INTEGER) {
            throw new RuntimeError("End value of for loops can only be INTEGERs");
        }
        if (stepType.kind !== typeKind.BASIC || stepType.type !== basicKind.INTEGER) {
            throw new RuntimeError("Step value of for loops can only be INTEGERs");
        }
        this.visitStmts(node.body);
    }
}
