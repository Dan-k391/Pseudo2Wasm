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
    CastExprNode,
    DerefExprNode,
    AddrExprNode,
    CaseNode
} from "../syntax/ast";
import { unreachable } from "../util";
import { Scope } from "./scope";
import { NoneType, Type, typeKind } from "./type";
import { basicKind } from "./basic";
import { BasicType } from "./basic";
import { FunctionType } from "./function";
import { ArrayType } from "./array";
import { PointerType } from "./pointer";
import { ProcedureType } from "./procedure";
import { RecordType } from "./record";
import { Symbol, symbolKind } from "./symbol";


export class Checker {
    public ast: ProgramNode;
    public global: Scope;
    // current scope
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
        // assign global to ast
        this.ast.global = this.global;
    }

    private beginScope(isFunc: boolean, returnType?: Type, returnIndex?: number): void {
        let scope: Scope;
        if (returnType) {
            scope = new Scope(isFunc, this.global, returnType, returnIndex);
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

    private static compatableBasic(leftBasicType: basicKind, rightBasicType: basicKind): boolean {
        if (leftBasicType === basicKind.STRING &&
            rightBasicType !== basicKind.STRING) {
            return false;
        }
        if (leftBasicType !== basicKind.STRING &&
            rightBasicType === basicKind.STRING) {
            return false;
        }
        // compatable if both are not strings
        return true;
    }

    private static compatable(leftType: Type, rightType: Type): boolean {
        if (leftType === rightType) {
            return true;
        }
    
        switch (leftType.kind) {
            case typeKind.BASIC:
                if (rightType.kind !== typeKind.BASIC) {
                    return false;
                }
                return Checker.compatableBasic(leftType.type, rightType.type);
            case typeKind.ARRAY:
                if (rightType.kind !== typeKind.ARRAY) {
                    return false;
                }
                // if the element types are same ARRAYs are compatable
                return Checker.compatable(leftType.elem, rightType.elem);
            case typeKind.RECORD:
                if (rightType.kind !== typeKind.RECORD) {
                    return false;
                }
                if (leftType.fields.size !== rightType.fields.size) {
                    return false;
                }
                for (let i = 0,
                    leftFields = Array.from(leftType.fields.values()),
                    rightFields = Array.from(leftType.fields.values());
                    i < leftType.fields.size; i++) {
                    if (!Checker.compatable(leftFields[i], rightFields[i])) {
                        return false;
                    }
                }
                return true;
            case typeKind.POINTER:
                if (rightType.kind !== typeKind.POINTER) {
                    return false;
                }
                return Checker.compatable(leftType.base, rightType.base);
            default:
                unreachable();
        }
    }

    private static commonBasicType(leftBasicType: basicKind, rightBasicType: basicKind): basicKind {
        if (leftBasicType === basicKind.STRING) {
            if (rightBasicType !== basicKind.STRING) {
                throw new RuntimeError("Cannot convert " + leftBasicType + " to " + leftBasicType);
            }
            return basicKind.STRING;
        }
        else if (rightBasicType === basicKind.STRING) {
            throw new RuntimeError("Cannot convert " + leftBasicType + " to " + leftBasicType);
        }
        else if (leftBasicType === basicKind.REAL ||
            rightBasicType === basicKind.REAL) {
            return basicKind.REAL;
        }
        return basicKind.INTEGER;
    }

    private isGlobal(): boolean {
        return this.curScope === this.global;
    }

    private insert(name: Token, type: Type, kind: symbolKind): void {
        this.curScope.insert(name.lexeme, new Symbol(type, kind));
    }

    // return the look up type in the current scope
    private lookUp(name: Token): Type {
        return this.curScope.lookUp(name.lexeme).type;
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
                throw new RuntimeError("There is no type '" + name.lexeme + "'");
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

    private declPtr(node: PtrDeclNode): void {
        const elemType = this.resolveType(node.typeToken);
        node.type = new PointerType(elemType);
        this.insertType(
            node.ident,
            node.type
        );
    }

    private visitFuncDef(node: FuncDefNode) {
        // Return type already determined in function declaration
        this.beginScope(true, node.type, node.params.length);
        for (const param of node.params) {
            // type of param already determined in function declaration
            this.insert(param.ident, param.type, symbolKind.LOCAL);
        }
        this.visitStmts(node.body);
        // set the local scope of the function
        node.local = this.curScope;
        this.endScope();
    }

    private visitProcDef(node: ProcDefNode) {
        this.beginScope(false);
        for (const param of node.params) {
            // type of param already determined in procedure declaration
            this.insert(param.ident, param.type, symbolKind.LOCAL);
        }
        this.visitStmts(node.body);
        // set the local scope of the procedure
        node.local = this.curScope;
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
            case nodeKind.DerefExprNode:
                return this.derefExpr(expr);
            case nodeKind.AddrExprNode:
                return this.addrExpr(expr);
            case nodeKind.IntegerExprNode:
                return this.integerExpr(expr);
            case nodeKind.RealExprNode:
                return this.realExpr(expr);
            case nodeKind.CharExprNode:
                return this.charExpr(expr);
            case nodeKind.StringExprNode:
                return this.stringExpr(expr);
            case nodeKind.BoolExprNode:
                return this.boolExpr(expr);
            default:
                throw new RuntimeError("Not implemented yet");
        }
    }

    // TODO: check if can convert
    // assign has no type
    private assignExpr(node: AssignNode): Type {
        const leftType = this.visitExpr(node.left);
        const rightType = this.visitExpr(node.right);

        if (!Checker.compatable(leftType, rightType)) {
            throw new RuntimeError("Cannot convert " + leftType + " to " + rightType);
        }

        if (leftType.kind === typeKind.BASIC && rightType.kind === typeKind.BASIC) {
            const leftBasicType = leftType.type;
            const rightBasicType = rightType.type;
            node.right = this.arithConv(node.right, leftBasicType);
        }

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
                if (!Checker.compatable(argType, paramType)) {
                    throw new RuntimeError("Cannot convert " + argType + " to " + paramType);
                }
                if (argType.kind === typeKind.BASIC && paramType.kind === typeKind.BASIC) {
                    node.args[i] = this.arithConv(node.args[i], argType.type);
                }
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
                if (!Checker.compatable(argType, paramType)) {
                    throw new RuntimeError("Cannot convert " + argType + " to " + paramType);
                }
                if (argType.kind === typeKind.BASIC && paramType.kind === typeKind.BASIC) {
                    node.args[i] = this.arithConv(node.args[i], argType.type);
                }
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
                const type = Checker.commonBasicType(leftBasicType, rightBasicType);
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
                if (!Checker.compatableBasic(leftBasicType, rightBasicType)) {
                    throw new RuntimeError("Cannot convert " + leftBasicType + " to " + rightBasicType);
                }
                node.type = new BasicType(basicKind.BOOLEAN);
                const type = Checker.commonBasicType(leftBasicType, rightBasicType);
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

    private derefExpr(node: DerefExprNode): Type {
        node.type = this.visitExpr(node.lVal);
        if (node.type.kind !== typeKind.POINTER) {
            throw new RuntimeError("Cannot dereference none POINTER types");
        }
        node.type = node.type.base;
        return node.type;
    }

    private addrExpr(node: AddrExprNode): Type {
        // if (node.lVal.kind === nodeKind.DerefExprNode) {
        //     node = node.lVal.lVal;
        // }
        node.type = this.visitExpr(node.lVal);
        node.type = new PointerType(node.type);
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

    private boolExpr(node: BoolExprNode): Type {
        node.type = new BasicType(basicKind.BOOLEAN);
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
            // do type declarations really need to be pre declared?
            // i am not sure
            // they indeed need to, otherwise types in functions cannot be resolved
            else if (stmt.kind === nodeKind.TypeDeclNode) {
                this.declRecord(stmt);
            }
            else if (stmt.kind === nodeKind.PtrDeclNode) {
                this.declPtr(stmt);
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
            case nodeKind.InputNode:
                this.visitInputStmt(stmt);
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

        if (!Checker.compatableBasic(leftBasicType, rightBasicType)) {
            throw new RuntimeError("Cannot convert " + leftBasicType + " to " + rightBasicType);
        }

        node.expr = this.arithConv(node.expr, rightBasicType);
    }

    private visitOutputStmt(node: OutputNode): void {
        // debugger;
        this.visitExpr(node.expr);
    }

    private visitInputStmt(node: InputNode): void {
        this.visitExpr(node.expr);
    }

    private visitVarDeclStmt(node: VarDeclNode): void {
        // assign the type resolved to the node
        node.type = this.resolveType(node.typeToken);
        if (this.isGlobal()) {
            this.insert(node.ident, node.type, symbolKind.GLOBAL);
        }
        else {
            this.insert(node.ident, node.type, symbolKind.LOCAL);
        }
    }

    private visitArrDeclStmt(node: ArrDeclNode): void {
        const elemType = this.resolveType(node.typeToken);
        node.type = new ArrayType(elemType, node.dimensions);
        if (this.isGlobal()) {
            this.insert(node.ident, node.type, symbolKind.GLOBAL);
        }
        else {
            this.insert(node.ident, node.type, symbolKind.LOCAL);
        }
    }

    private visitTypeDeclStmt(node: TypeDeclNode): void {
        // do nothing, already predeclared
        return;
    }

    private visitPtrDeclStmt(node: PtrDeclNode): void {
        // do nothing, already predeclared
        return;
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
