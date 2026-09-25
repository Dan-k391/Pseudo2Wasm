// TODO: this will be implemented after the first complete version is done
import { MAX_DIAGNOSTICS, RuntimeError } from "../error";
import { Token, tokenType } from "../lex/token";
import {
    nodeKind,
    BaseNode,

    Expr,
    Stmt,
    ProgramNode,
    FuncDefNode,
    ProcDefNode,
    ReturnNode,
    DeclNode,
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
import { ArrTypeNode, TypeNode } from "../syntax/typenode";
import { MEMORY_END } from "../memory-layout";

/** A use of an already-invalid declaration is not an independent error. */
class DependentDiagnostic extends Error {}

export class Checker {
    public ast: ProgramNode;
    public global: Scope;
    // current scope
    public curScope: Scope;
    private errors?: Array<RuntimeError>;
    private failedNames = new Map<Scope, Set<string>>();

    constructor(ast: ProgramNode) {
        this.ast = ast;
        this.global = new Scope(false);
        this.curScope = this.global;
    }

    public check(errors?: Array<RuntimeError>): ProgramNode {
        this.errors = errors;
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
        const randFunc = new FunctionType(
            new Map<string, Type>([
                ["range", new BasicType(basicKind.INTEGER)]
            ]),
            new BasicType(basicKind.INTEGER)
        );
        this.curScope.insertFunc("RAND", randFunc);
        // string operations
        const ucaseFunc = new FunctionType(
            new Map<string, Type>([
                ["ch", new BasicType(basicKind.CHAR)]
            ]),
            new BasicType(basicKind.CHAR)
        );
        this.curScope.insertFunc("UCASE", ucaseFunc);
        const lcaseFunc = new FunctionType(
            new Map<string, Type>([
                ["ch", new BasicType(basicKind.CHAR)]
            ]),
            new BasicType(basicKind.CHAR)
        );
        this.curScope.insertFunc("LCASE", lcaseFunc);
        const startTimeProc = new ProcedureType(
            new Map<string, Type>()
        );
        this.curScope.insertProc("STARTTIME", startTimeProc);
        const endTimeProc = new ProcedureType(
            new Map<string, Type>()
        );
        this.curScope.insertProc("ENDTIME", endTimeProc);
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

    // sequence matters, ARRAYs are compatable with POINTERs
    // but not the other way around
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
                // if the element types are same ARRAYs are compatable
                if (rightType.kind === typeKind.ARRAY) {
                    return Checker.compatable(leftType.elem, rightType.elem);
                }
                else if (rightType.kind === typeKind.POINTER) {
                    return Checker.compatable(leftType.elem, rightType.base);
                }
                return false;
            case typeKind.RECORD:
                if (rightType.kind !== typeKind.RECORD) {
                    return false;
                }
                if (leftType.fields.size !== rightType.fields.size) {
                    return false;
                }
                for (let i = 0,
                    leftFields = Array.from(leftType.fields.values()),
                    rightFields = Array.from(rightType.fields.values());
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
                throw new RuntimeError("Cannot convert " + rightBasicType + " to " + leftBasicType);
            }
            return basicKind.STRING;
        }
        else if (rightBasicType === basicKind.STRING) {
            throw new RuntimeError("Cannot convert " + rightBasicType + " to " + leftBasicType);
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
        if (this.curScope.elems.has(name.lexeme)) {
            throw new RuntimeError(`Duplicate variable '${name.lexeme}'`).at(name);
        }
        this.curScope.insert(name.lexeme, new Symbol(type, kind));
    }

    // return the look up type in the current scope
    private lookUp(name: Token): Type {
        try {
            return this.curScope.lookUp(name.lexeme).type;
        } catch (error) {
            if (this.isFailed(`variable:${name.lexeme}`)) throw new DependentDiagnostic();
            if (error instanceof RuntimeError) throw error.at(name);
            throw error;
        }
    }

    private getFuncType(name: Token): FunctionType {
        try {
            return this.curScope.lookUpFunc(name.lexeme);
        } catch (error) {
            if (this.isFailed(`function:${name.lexeme}`)) throw new DependentDiagnostic();
            if (error instanceof RuntimeError) throw error.at(name);
            throw error;
        }
    }

    private getProcType(name: Token): ProcedureType {
        try {
            return this.curScope.lookUpProc(name.lexeme);
        } catch (error) {
            if (this.isFailed(`procedure:${name.lexeme}`)) throw new DependentDiagnostic();
            if (error instanceof RuntimeError) throw error.at(name);
            throw error;
        }
    }

    private insertType(name: Token, type: Type): void {
        if (this.curScope.types.has(name.lexeme)) {
            throw new RuntimeError(`Duplicate TYPE '${name.lexeme}'`).at(name);
        }
        this.curScope.insertType(name.lexeme, type);
    }

    // TODO: add pointer types and enum
    private getType(name: Token): Type {
        try {
            return this.curScope.lookUpType(name.lexeme);
        } catch (error) {
            if (this.isFailed(`type:${name.lexeme}`)) throw new DependentDiagnostic();
            if (error instanceof RuntimeError) throw error.at(name);
            throw error;
        }
    }

    private resolveBasicType(typeToken: Token): Type {
        switch (typeToken.type) {
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
                return this.getType(typeToken);
            default:
                throw new Error("Internal compiler error: invalid type token");
        }
    }

    private resolveArrType(node: ArrTypeNode): ArrayType {
        if (node.dimensions.length === 0) {
            throw new RuntimeError("ARRAY needs at least one dimension").at(node.source!);
        }
        for (const dimension of node.dimensions) {
            if (!Number.isSafeInteger(dimension.lower) || !Number.isSafeInteger(dimension.upper) ||
                dimension.lower < 0 || dimension.upper > 2147483647) {
                throw new RuntimeError("ARRAY bounds must fit a nonnegative 32-bit INTEGER")
                    .at(dimension.source!);
            }
            if (dimension.lower > dimension.upper) {
                throw new RuntimeError(`ARRAY lower bound ${dimension.lower} exceeds upper bound ${dimension.upper}`)
                    .at(dimension.source!);
            }
        }
        const elemType = this.resolveType(node.type);
        const array = new ArrayType(elemType, node.dimensions);
        if (!Number.isSafeInteger(array.size()) || array.size() > MEMORY_END) {
            throw new RuntimeError("ARRAY size exceeds linear memory limit").at(node.source!);
        }
        return array;
    }

    private resolveType(typeNode: TypeNode): Type {
        switch (typeNode.kind) {
            case nodeKind.BasicTypeNode:
                return this.resolveBasicType(typeNode.type);
            case nodeKind.ArrTypeNode:
                return this.resolveArrType(typeNode);
            default:
                throw new Error("Internal compiler error: unknown type syntax");
        }
    }

    // only difference between resolveCallableType and resolveType is that
    // arrays are adjusted to pointers, similar as C fucntion declarators
    // only used as the parameter type of functions and procedures
    private resolveCallableType(node: TypeNode): Type {
        switch (node.kind) {
            case nodeKind.BasicTypeNode:
                return this.resolveBasicType(node.type);
            case nodeKind.ArrTypeNode: {
                const array = this.resolveArrType(node);
                return new PointerType(array.elem, array.dimensions);
            }
            default:
                throw new Error("Internal compiler error: unknown parameter type syntax");
        }
    }

    private declFunc(node: FuncDefNode): void {
        const funcName = node.ident.lexeme;
        const funcParams = new Map<string, Type>();

        if (this.curScope.functions.has(funcName) || this.curScope.procedures.has(funcName)) {
            throw new RuntimeError(`Duplicate callable '${funcName}'`).at(node.ident);
        }

        for (const param of node.params) {
            const paramName = param.ident.lexeme;
            if (funcParams.has(paramName)) {
                throw new RuntimeError(`Duplicate parameter '${paramName}'`).at(param.ident);
            }
            param.type = this.resolveCallableType(param.typeNode);
            funcParams.set(paramName, param.type);
        }

        node.type = this.resolveCallableType(node.typeNode);
        const func = new FunctionType(funcParams, node.type);
        this.curScope.insertFunc(funcName, func);
    }

    private declProc(node: ProcDefNode): void {
        const procName = node.ident.lexeme;
        const procParams = new Map<string, Type>();

        if (this.curScope.functions.has(procName) || this.curScope.procedures.has(procName)) {
            throw new RuntimeError(`Duplicate callable '${procName}'`).at(node.ident);
        }

        for (const param of node.params) {
            const paramName = param.ident.lexeme;
            if (procParams.has(paramName)) {
                throw new RuntimeError(`Duplicate parameter '${paramName}'`).at(param.ident);
            }
            param.type = this.resolveCallableType(param.typeNode);
            procParams.set(paramName, param.type);
        }

        const proc = new ProcedureType(procParams);
        this.curScope.insertProc(procName, proc);
    }

    // keep this function, maybe predeclarations are needed
    private declRecord(node: TypeDeclNode): void {
        const fields = new Map<string, Type>();
        for (const decl of node.body) {
            if (fields.has(decl.ident.lexeme)) {
                throw new RuntimeError(`Duplicate field '${decl.ident.lexeme}'`).at(decl.ident);
            }
            // do not assign the type to the declarations in the typedecl
            // not necessary
            fields.set(decl.ident.lexeme, this.resolveType(decl.typeNode));
        }
        node.type = new RecordType(fields);
        this.insertType(node.ident, node.type);
    }

    private declPtr(node: PtrDeclNode): void {
        const elemType = this.resolveType(node.typeNode);
        // default POINTER has no dimensions
        node.type = new PointerType(elemType, [{lower: 0, upper: 0}]);
        this.insertType(
            node.ident,
            node.type
        );
    }

    private visitFuncDef(node: FuncDefNode) {
        // Return type already determined in function declaration
        this.beginScope(true, node.type, node.params.length);
        try {
            for (const param of node.params) {
                this.insert(param.ident, param.type, symbolKind.LOCAL);
            }
            const previousErrors = this.errors?.length || 0;
            this.visitStmts(node.body);
            if ((this.errors?.length || 0) === previousErrors && !this.definitelyReturns(node.body)) {
                throw new RuntimeError(`Function '${node.ident.lexeme}' may finish without RETURN`).at(node.ident);
            }
            node.local = this.curScope;
        } finally {
            this.endScope();
        }
    }

    private visitProcDef(node: ProcDefNode) {
        this.beginScope(false);
        try {
            for (const param of node.params) {
                this.insert(param.ident, param.type, symbolKind.LOCAL);
            }
            this.visitStmts(node.body);
            node.local = this.curScope;
        } finally {
            this.endScope();
        }
    }

    // arithmetic conversion for basic type
    private arithConv(node: Expr, type: basicKind): Expr {
        node = new CastExprNode(node);
        node.type = new BasicType(type);
        return node;
    }

    private tokenFor(node: BaseNode): Token | undefined {
        const located = node as BaseNode & {
            ident?: Token; operator?: Token; expr?: Expr; condition?: Expr;
            callee?: Expr; left?: Expr; lVal?: Expr; start?: Expr;
        };
        return located.source || located.operator || located.ident ||
            (located.callee && this.tokenFor(located.callee)) ||
            (located.left && this.tokenFor(located.left)) ||
            (located.lVal && this.tokenFor(located.lVal)) ||
            (located.expr && this.tokenFor(located.expr)) ||
            (located.condition && this.tokenFor(located.condition)) ||
            (located.start && this.tokenFor(located.start));
    }

    private definitelyReturns(body: ReadonlyArray<Stmt>): boolean {
        for (const stmt of body) {
            if (stmt.kind === nodeKind.ReturnNode) return true;
            if (stmt.kind === nodeKind.IfNode && stmt.elseBody &&
                this.definitelyReturns(stmt.body) && this.definitelyReturns(stmt.elseBody)) {
                return true;
            }
        }
        return false;
    }

    private isAssignable(expr: Expr): boolean {
        return expr.kind === nodeKind.VarExprNode || expr.kind === nodeKind.IndexExprNode ||
            expr.kind === nodeKind.SelectExprNode || expr.kind === nodeKind.DerefExprNode;
    }

    private writesOutsideCurrentFrame(expr: Expr): boolean {
        if (expr.kind === nodeKind.DerefExprNode) return true;
        if (expr.kind === nodeKind.VarExprNode) {
            return this.curScope.lookUp(expr.ident.lexeme).kind === symbolKind.GLOBAL;
        }
        if (expr.kind === nodeKind.IndexExprNode || expr.kind === nodeKind.SelectExprNode) {
            return this.writesOutsideCurrentFrame(expr.expr);
        }
        return false;
    }

    private locate(error: unknown, node: BaseNode): never {
        if (error instanceof RuntimeError) {
            const token = this.tokenFor(node);
            if (token) error.at(token);
        }
        throw error;
    }

    private report(error: unknown, node: BaseNode): void {
        if (error instanceof DependentDiagnostic) return;
        if (!(error instanceof RuntimeError) || !this.errors) this.locate(error, node);
        const token = this.tokenFor(node);
        if (token) error.at(token);
        this.errors.push(error);
    }

    private isFailed(key: string): boolean {
        for (let scope: Scope | undefined = this.curScope; scope; scope = scope.parent) {
            if (this.failedNames.get(scope)?.has(key)) return true;
        }
        return false;
    }

    private markFailed(stmt: Stmt): void {
        let key: string | undefined;
        if (stmt.kind === nodeKind.DeclNode && !this.curScope.elems.has(stmt.ident.lexeme))
            key = `variable:${stmt.ident.lexeme}`;
        else if (stmt.kind === nodeKind.FuncDefNode && !this.curScope.functions.has(stmt.ident.lexeme))
            key = `function:${stmt.ident.lexeme}`;
        else if (stmt.kind === nodeKind.ProcDefNode && !this.curScope.procedures.has(stmt.ident.lexeme))
            key = `procedure:${stmt.ident.lexeme}`;
        else if ((stmt.kind === nodeKind.TypeDeclNode || stmt.kind === nodeKind.PtrDeclNode) &&
            !this.curScope.types.has(stmt.ident.lexeme)) key = `type:${stmt.ident.lexeme}`;
        if (key) {
            const names = this.failedNames.get(this.curScope) || new Set<string>();
            names.add(key);
            this.failedNames.set(this.curScope, names);
        }
    }

    private visitExpr(expr: Expr): Type {
        try {
            return this.visitExprCore(expr);
        } catch (error) {
            return this.locate(error, expr);
        }
    }

    private visitExprCore(expr: Expr): Type {
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
                throw new Error("Internal compiler error: unknown expression node");
        }
    }

    // TODO: check if can convert
    // assign has no type
    private assignExpr(node: AssignNode): Type {
        if (!this.isAssignable(node.left)) {
            throw new RuntimeError("Assignment target must be a variable, array element, field, or pointer dereference");
        }
        const leftType = this.visitExpr(node.left);
        const rightType = this.visitExpr(node.right);

        if (!Checker.compatable(rightType, leftType)) {
            throw new RuntimeError("Cannot convert " + rightType + " to " + leftType);
        }

        if (leftType.kind === typeKind.ARRAY || leftType.kind === typeKind.RECORD) {
            throw new RuntimeError("Whole ARRAY and RECORD assignment is not supported; assign elements or fields instead");
        }
        if (leftType.kind === typeKind.POINTER && !this.isGlobal() &&
            this.writesOutsideCurrentFrame(node.left)) {
            throw new RuntimeError("Cannot store a pointer outside the current function frame");
        }

        if (leftType.kind === typeKind.BASIC && rightType.kind === typeKind.BASIC) {
            node.right = this.arithConv(node.right, leftType.type);
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
        if (base.kind === typeKind.ARRAY) {
            if (node.indexes.length !== base.dimensions.length) {
                throw new RuntimeError("The index dimension numbers do not match for " + base.toString());
            }
            for (const index of node.indexes) {
                const indexType = this.visitExpr(index);
                if (indexType.kind !== typeKind.BASIC || indexType.type !== basicKind.INTEGER) {
                    throw new RuntimeError("ARRAY index must be INTEGER");
                }
            }
            node.type = base.elem;
            return node.type;
        }
        else if (base.kind === typeKind.POINTER) {
            if (node.indexes.length !== base.dimensions.length) {
                throw new RuntimeError("The index dimension numbers do not match for " + base.toString());
            }
            for (const index of node.indexes) {
                const indexType = this.visitExpr(index);
                if (indexType.kind !== typeKind.BASIC || indexType.type !== basicKind.INTEGER) {
                    throw new RuntimeError("POINTER index must be INTEGER");
                }
            }
            node.type = base.base;
            return node.type;
        }
        throw new RuntimeError("Only ARRAY or POINTER values can be indexed");
    }

    private selectExpr(node: SelectExprNode): Type {
        const base = this.visitExpr(node.expr);
        if (base.kind !== typeKind.RECORD) {
            throw new RuntimeError("Only RECORD values have fields");
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
                    node.args[i] = this.arithConv(node.args[i], paramType.type);
                }
            }
            node.type = func.returnType;
            return node.type;
        }
        throw new RuntimeError("Indirect function calls are not supported");
    }

    // PROCEDUREs do not have a return value
    private callProcExpr(node: CallProcExprNode): Type {
        if (node.callee.kind === nodeKind.VarExprNode) {
            const procName = node.callee.ident.lexeme;
            const proc = this.getProcType(node.callee.ident);
            if (proc.paramTypes.size !== node.args.length) {
                throw new RuntimeError("Procedure '" + procName + "' expects " + proc.paramTypes.size + " arguments, but " + node.args.length + " are provided");
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
        throw new RuntimeError("Indirect procedure calls are not supported");
    }

    private unaryExpr(node: UnaryExprNode): Type {   
        node.type = this.visitExpr(node.expr);
        return node.type;
    }

    private binaryExpr(node: BinaryExprNode): Type {
        const leftType = this.visitExpr(node.left);
        const rightType = this.visitExpr(node.right);

        // The right side of arithmetic operations need to be BASIC types
        // while the left side can be POINTER and BASIC types (for add and sub)
        if (rightType.kind !== typeKind.BASIC) {
            throw new RuntimeError("Binary operators require basic values");
        }
        
        // the following code looks complicated but just goes over all the possibilities
        // for basic types
        // I do this because it then differs every type instead of converting them all
        // into an INTEGER and see if promote to REAL
        // for example, doing this does not allow a CHAR to convert to a REAL
        switch (node.operator.type) {
            // arithmetic operations
            case tokenType.PLUS:
            case tokenType.MINUS:
                if (leftType.kind === typeKind.BASIC) {
                    if (leftType.type === basicKind.STRING ||
                        rightType.type === basicKind.STRING) {
                        throw new RuntimeError("Cannot perform arithmetic operations to STRINGs")
                    }
                    const type = Checker.commonBasicType(leftType.type, rightType.type);
                    node.type = new BasicType(type);
                    node.left = this.arithConv(node.left, type);
                    node.right = this.arithConv(node.right, type);
                }
                else if (leftType.kind === typeKind.POINTER) {
                    throw new RuntimeError("Pointer arithmetic is not supported safely");
                }
                break;
            case tokenType.STAR:
            case tokenType.SLASH: {
                if (leftType.kind !== typeKind.BASIC) {
                    throw new RuntimeError("Arithmetic operators require basic values");
                }
                if (leftType.type === basicKind.STRING ||
                    rightType.type === basicKind.STRING) {
                    throw new RuntimeError("Cannot perform arithmetic operations to STRINGs")
                }
                const type = Checker.commonBasicType(leftType.type, rightType.type);
                node.type = new BasicType(type);
                node.left = this.arithConv(node.left, type);
                node.right = this.arithConv(node.right, type);
                break;
            }
            case tokenType.MOD: {
                if (leftType.kind !== typeKind.BASIC) {
                    throw new RuntimeError("Arithmetic operators require basic values");
                }
                if (leftType.type !== basicKind.INTEGER ||
                    rightType.type !== basicKind.INTEGER) {
                    throw new RuntimeError("This operator requires INTEGER operands")
                }
                node.type = new BasicType(basicKind.INTEGER);
                break;
            }
            // logical operators
            case tokenType.EQUAL:
            case tokenType.LESS_GREATER:
            case tokenType.LESS:
            case tokenType.GREATER:
            case tokenType.LESS_EQUAL:
            case tokenType.GREATER_EQUAL: {
                if (leftType.kind !== typeKind.BASIC) {
                    throw new RuntimeError("Comparison requires basic values");
                }
                if (leftType.type === basicKind.STRING ||
                    rightType.type === basicKind.STRING) {
                    throw new RuntimeError("Cannot perform logical operations to STRINGs")
                }
                node.type = new BasicType(basicKind.BOOLEAN);
                const type = Checker.commonBasicType(leftType.type, rightType.type);
                node.left = this.arithConv(node.left, type);
                node.right = this.arithConv(node.right, type);
                break;
            }
            case tokenType.AND:
            case tokenType.OR: {
                if (leftType.kind !== typeKind.BASIC) {
                    throw new RuntimeError("Logical operators require basic values");
                }
                if (leftType.type !== basicKind.BOOLEAN ||
                    rightType.type !== basicKind.BOOLEAN) {
                    throw new RuntimeError("Logical operators require BOOLEAN operands")
                }
                node.type = new BasicType(basicKind.BOOLEAN);
                break;
            }
            case tokenType.AMPERSAND: {
                throw new RuntimeError("String concatenation is not supported yet");
            }
            default:
                unreachable();
        }
        return node.type;
    }

    private derefExpr(node: DerefExprNode): Type {
        node.type = this.visitExpr(node.lVal);
        if (node.type.kind !== typeKind.POINTER) {
            throw new RuntimeError("Only POINTER values can be dereferenced");
        }
        node.type = node.type.base;
        return node.type;
    }

    private addrExpr(node: AddrExprNode): Type {
        if (!this.isAssignable(node.lVal)) {
            throw new RuntimeError("Address-of target must be assignable");
        }
        // if (node.lVal.kind === nodeKind.DerefExprNode) {
        //     node = node.lVal.lVal;
        // }
        node.type = this.visitExpr(node.lVal);
        // default POINTER has no dimensions
        node.type = new PointerType(node.type, [{lower: 0, upper: 0}]);
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
        const failed = new Set<Stmt>();
        // Pre declare all FUNCTIONs and PROCEDUREs
        for (const stmt of stmts) {
            if (this.errors && this.errors.length >= MAX_DIAGNOSTICS) return;
            try {
                if (stmt.kind === nodeKind.FuncDefNode) this.declFunc(stmt);
                else if (stmt.kind === nodeKind.ProcDefNode) this.declProc(stmt);
                else if (stmt.kind === nodeKind.TypeDeclNode) this.declRecord(stmt);
                else if (stmt.kind === nodeKind.PtrDeclNode) this.declPtr(stmt);
            } catch (error) {
                failed.add(stmt);
                this.markFailed(stmt);
                this.report(error, stmt);
            }
        }
        // then run the other code
        for (const stmt of stmts) {
            if (this.errors && this.errors.length >= MAX_DIAGNOSTICS) return;
            if (failed.has(stmt)) continue;
            try {
                if (stmt.kind === nodeKind.FuncDefNode) this.visitFuncDef(stmt);
                else if (stmt.kind === nodeKind.ProcDefNode) this.visitProcDef(stmt);
                else this.visitStmt(stmt);
            } catch (error) {
                this.markFailed(stmt);
                this.report(error, stmt);
            }
        }
    }

    private visitStmt(stmt: Stmt): void {
        try {
            this.visitStmtCore(stmt);
        } catch (error) {
            this.locate(error, stmt);
        }
    }

    private visitStmtCore(stmt: Stmt): void {
        switch (stmt.kind) {
            case nodeKind.ExprStmtNode:
                this.visitExpr(stmt.expr);
                break;
            case nodeKind.ReturnNode:
                // can only return in functions
                if (!this.curScope.isFunc) {
                    throw new RuntimeError("RETURN is only valid inside a FUNCTION");
                }
                this.visitReturn(stmt);
                break;
            case nodeKind.OutputNode:
                this.visitOutputStmt(stmt);
                break;
            case nodeKind.InputNode:
                this.visitInputStmt(stmt);
                break;
            case nodeKind.DeclNode:
                this.visitDeclStmt(stmt);
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
            case nodeKind.CaseNode:
                throw new RuntimeError("CASE statements are not supported yet");
            default:
                throw new Error("Internal compiler error: unknown statement node");
        }
    }

    private visitReturn(node: ReturnNode): void {
        // leftType is the return type, right type is the expected return type
        const leftType = this.visitExpr(node.expr);
        const rightType = this.curScope.getReturnType();
        if (leftType.kind !== typeKind.BASIC || rightType.kind !== typeKind.BASIC) {
            throw new RuntimeError("Cannot convert " + leftType + " to " + rightType);
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
        if (!this.isAssignable(node.expr)) {
            const error = new RuntimeError("INPUT target must be assignable");
            const token = this.tokenFor(node.expr);
            throw token ? error.at(token) : error;
        }
        const type = this.visitExpr(node.expr);
        if (type.kind !== typeKind.BASIC) {
            throw new RuntimeError("INPUT target must have a basic type");
        }
    }

    private visitDeclStmt(node: DeclNode): void {
        // assign the type resolved to the node
        node.type = this.resolveType(node.typeNode);
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
        const startType = this.visitExpr(node.start);
        const endType = this.visitExpr(node.end);
        const stepType = this.visitExpr(node.step);
        
        if (varType.kind !== typeKind.BASIC || varType.type !== basicKind.INTEGER) {
            throw new RuntimeError("FOR loop variable must be INTEGER");
        }
        if (startType.kind !== typeKind.BASIC || startType.type !== basicKind.INTEGER) {
            throw new RuntimeError("Start value of for loops can only be INTEGERs");
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
