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
    InputNode,
    CastExprNode
} from "../syntax/ast";
import { unreachable } from "../util";
import { Scope } from "./scope";
import { NoneType, Type, commonBasicType, compatable, compatableBasic, typeKind } from "./type";
import { basicKind } from "./basic";
import { BasicType } from "./basic";
import { FunctionType } from "./function";
import { ArrayType } from "./array";
import { PointerType } from "./pointer";
import { ProcedureType } from "./procedure";
import { RecordType } from "./record";


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

    private beginScope(isFunc: boolean, returnType?: Type): void {
        let scope: Scope;
        if (returnType) {
            scope = new Scope(isFunc, this.global, returnType);
        }
        else {
            scope = new Scope(isFunc, this.global);
        }
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

    private getFuncType(name: Token): FunctionType {
        return this.curScope.lookUpFunc(name.lexeme);
    }

    private getProcType(name: Token): ProcedureType {
        return this.curScope.lookUpProc(name.lexeme);
    }

    private insertType(name: Token, type: Type): void {
        this.curScope.insertType(name.lexeme, type);
    }

    // TODO: add pointer types and enum
    private getType(name: Token): Type {
        return this.curScope.lookUpType(name.lexeme);
    }

    private resolveType(name: Token): Type {
        switch (name.type) {
            case tokenType.INTEGER:
                return new BasicType(basicKind.INTEGER);
            case tokenType.REAL:
                return new BasicType(basicKind.REAL);
            case tokenType.CHAR:
                return new BasicType(basicKind.CHAR);
            case tokenType.STRING:
                return new BasicType(basicKind.STRING);
            case tokenType.BOOLEAN:
                return new BasicType(basicKind.BOOLEAN);
            case tokenType.IDENTIFIER:
                return this.getType(name);
            default:
                unreachable();
        }
    }

    private declFunc(node: FuncDefNode): void {
        const funcName = node.ident.lexeme;
        const funcParams = new Map<string, Type>();

        for (const param of node.params) {
            const paramName = param.ident.lexeme;
            param.type = this.resolveType(param.typeToken);
            funcParams.set(paramName, param.type);
        }

        node.type = this.resolveType(node.typeToken);
        const func = new FunctionType(funcParams, node.type);
        this.curScope.insertFunc(funcName, func);
    }

    private declProc(node: ProcDefNode): void {
        const procName = node.ident.lexeme;
        const procParams = new Map<string, Type>();

        for (const param of node.params) {
            const paramName = param.ident.lexeme;
            param.type = this.resolveType(param.typeToken);
            procParams.set(paramName, param.type);
        }

        const proc = new ProcedureType(procParams);
        this.curScope.insertProc(procName, proc);
    }

    // keep this function, maybe predeclarations are needed
    private declRecord(node: TypeDeclNode): void {
        const fields = new Map<string, Type>();
        for (const decl of node.body) {
            // do not assign the type to the declarations in the typedecl
            // not necessary
            if (decl.kind === nodeKind.VarDeclNode) {
                fields.set(decl.ident.lexeme, this.resolveType(decl.typeToken));
            }
            else if (decl.kind === nodeKind.ArrDeclNode) {
                const elemType = this.resolveType(decl.typeToken);
                fields.set(
                    decl.ident.lexeme,
                    new ArrayType(elemType, decl.dimensions)
                );
            }
        }
        node.type = new RecordType(fields);
        this.insertType(node.ident, node.type);
    }

    private visitFuncDef(node: FuncDefNode) {
        // Return type already determined in function declaration
        this.beginScope(true, node.type);
        for (const param of node.params) {
            // type of param already determined in function declaration
            this.insert(param.ident, param.type);
        }
        this.visitStmts(node.body);
        this.endScope();
    }

    private visitProcDef(node: ProcDefNode) {
        this.beginScope(false);
        for (const param of node.params) {
            // type of param already determined in procedure declaration
            this.insert(param.ident, param.type);
        }
        this.visitStmts(node.body);
        this.endScope();
    }

    // arithmetic conversion for basic type
    private arithConv(node: Expr, type: basicKind): Expr {
        node = new CastExprNode(node);
        node.type = new BasicType(type);
        return node;
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
        
        const leftBasicType = leftType.type;
        const rightBasicType = rightType.type;

        if (!compatableBasic(leftBasicType, rightBasicType)) {
            throw new RuntimeError("Cannot convert " + leftBasicType + " to " + rightBasicType);
        }

        node.right = this.arithConv(node.right, leftBasicType);
        // let type for assignnode be the left type
        node.type = leftType;
        return node.type;
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
        if (node.indexes.length !== base.dimensions.length) {
            throw new RuntimeError("The index dimension numbers do not match for " + base.toString());
        }
        for (const index of node.indexes) {
            this.visitExpr(index);
        }
        node.type = base.elem;
        return node.type;
    }

    private selectExpr(node: SelectExprNode): Type {
        const base = this.visitExpr(node.expr);
        if (base.kind !== typeKind.RECORD) {
            throw new RuntimeError("Cannot perfrom 'select' operation to none RECORD types");
        }
        node.type = base.getField(node.ident.lexeme);
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
                const argType = this.visitExpr(arg);
                const paramType = func.getParamType(paramNames[i]);
                if (!compatable(argType, paramType)) {
                    throw new RuntimeError("Cannot convert " + argType + " to " + paramType);
                }
                if (argType.kind !== typeKind.BASIC || paramType.kind !== typeKind.BASIC) {
                    throw new RuntimeError("Cannot convert " + argType + " to " + paramType);
                }
                node.args[i] = this.arithConv(node.args[i], argType.type);   
            }
            node.type = func.returnType;
            return node.type;
        }
        throw new RuntimeError("Not implemented yet");
    }

    // PROCEDUREs do not have a return value
    private callProcExpr(node: CallProcExprNode): Type {
        if (node.callee.kind === nodeKind.VarExprNode) {
            const procName = node.callee.ident.lexeme;
            const proc = this.getProcType(node.callee.ident);
            if (proc.paramTypes.size !== node.args.length) {
                throw new RuntimeError("Function '" + procName + "' expects " + proc.paramTypes.size + " arguments, but " + node.args.length + " are provided");
            }
            for (let i = 0, paramNames = Array.from(proc.paramTypes.keys()); i < node.args.length; i++) {
                const arg = node.args[i]; 
                const argType = this.visitExpr(arg);
                const paramType = proc.getParamType(paramNames[i]);
                if (!compatable(argType, paramType)) {
                    throw new RuntimeError("Cannot convert " + argType + " to " + paramType);
                }
                if (argType.kind !== typeKind.BASIC || paramType.kind !== typeKind.BASIC) {
                    throw new RuntimeError("Cannot convert " + argType + " to " + paramType);
                }
                node.args[i] = this.arithConv(node.args[i], argType.type);   
            }
            node.type = new NoneType();
            return node.type;
        }
        throw new RuntimeError("Not implemented yet");
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
            case tokenType.SLASH: {
                if (leftBasicType === basicKind.STRING ||
                    rightBasicType === basicKind.STRING) {
                    throw new RuntimeError("Cannot perform arithmetic operations to STRINGs")
                }
                const type = commonBasicType(leftBasicType, rightBasicType);
                node.type = new BasicType(type);
                node.left = this.arithConv(node.left, type);
                node.right = this.arithConv(node.right, type);
                break;
            }
            // logical operators
            case tokenType.EQUAL:
            case tokenType.LESS_GREATER:
            case tokenType.LESS:
            case tokenType.GREATER:
            case tokenType.LESS_EQUAL:
            case tokenType.GREATER_EQUAL: {
                if (leftBasicType === basicKind.STRING ||
                    rightBasicType === basicKind.STRING) {
                    throw new RuntimeError("Cannot perform logical operations to STRINGs")
                }
                if (!compatableBasic(leftBasicType, rightBasicType)) {
                    throw new RuntimeError("Cannot convert " + leftBasicType + " to " + rightBasicType);
                }
                node.type = new BasicType(basicKind.BOOLEAN);
                const type = commonBasicType(leftBasicType, rightBasicType);
                node.left = this.arithConv(node.left, type);
                node.right = this.arithConv(node.right, type);
                break;
            }
            case tokenType.AMPERSAND: {
                if (leftBasicType !== basicKind.STRING ||
                    rightBasicType !== basicKind.STRING) {
                    throw new RuntimeError("Cannot perform logical operations to STRINGs")
                }
                node.type = new BasicType(basicKind.STRING);
            }
            default:
                unreachable();
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
        // Pre declare all FUNCTIONs and PROCEDUREs
        for (const stmt of stmts) {
            if (stmt.kind === nodeKind.FuncDefNode) {
                this.declFunc(stmt);
            }
            else if (stmt.kind === nodeKind.ProcDefNode) {
                this.declProc(stmt);
            }
            // FIXME: do type declarations really need to be pre declared?
            // i am not sure
            // else if (stmt.kind === nodeKind.TypeDeclNode) {
            //     this.declRecord(stmt);
            // }
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
            case nodeKind.TypeDeclNode:
                this.visitTypeDeclStmt(stmt);
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
        // leftType is the return type, right type is the expected return type
        const leftType = this.visitExpr(node.expr);
        const rightType = this.curScope.getReturnType();
        if (leftType.kind !== typeKind.BASIC || rightType.kind !== typeKind.BASIC) {
            throw new RuntimeError("Cannot convert " + rightType + " to " + leftType);
        }

        const leftBasicType = leftType.type;
        const rightBasicType = rightType.type;

        if (!compatableBasic(leftBasicType, rightBasicType)) {
            throw new RuntimeError("Cannot convert " + leftBasicType + " to " + rightBasicType);
        }

        node.expr = this.arithConv(node.expr, rightBasicType);
    }

    private visitOutputStmt(node: OutputNode): void {
        // debugger;
        this.visitExpr(node.expr);
    }

    private visitVarDeclStmt(node: VarDeclNode): void {
        // assign the type resolved to the node
        node.type = this.resolveType(node.typeToken);
        this.insert(node.ident, node.type);
    }

    private visitArrDeclStmt(node: ArrDeclNode): void {
        const elemType = this.resolveType(node.typeToken);
        node.type = new ArrayType(elemType, node.dimensions);
        this.insert(
            node.ident,
            node.type
        );
    }

    private visitTypeDeclStmt(node: TypeDeclNode): void {
        this.declRecord(node);
    }

    private visitPtrDeclStmt(node: PtrDeclNode): void {
        const elemType = this.resolveType(node.typeToken);
        node.type = new PointerType(elemType)
        this.insertType(
            node.ident,
            node.type
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
