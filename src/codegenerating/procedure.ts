import binaryen from "binaryen";
import { Environment } from "../import";
import { RuntimeError } from "../error";
import { _Symbol } from "./symbol";
import { tokenType } from "../scanning/token";
import {
    nodeKind,

    Expr,
    Stmt,
    Param,
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
} from "../ast";

import { convertToBasicType, convertToWasmType, unreachable } from "../util";
import { GlobalTable } from "./global";
import { LocalTable } from "./local";
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


// TODO: maybe new a common file to contain these
type Module = binaryen.Module;
type ExpressionRef = binaryen.ExpressionRef;
type WasmType = binaryen.Type;

export class Procedure {
    private module: Module;
    // I have no better idea for the name of the outergenerator instead of 'enclosing'
    private enclosing: Generator;
    private ident: string;
    // Params are initialized to a Map in the generator
    public params: LocalTable;
    private body: Array<Stmt>;
    // TODO: change the data structure here
    private locals: LocalTable;
    private label: number;

    constructor(module: Module, enclosing: Generator, ident: string, params: LocalTable, body: Array<Stmt>) {
        this.module = module;
        this.enclosing = enclosing;
        this.ident = ident;
        this.params = params;
        this.body = body;
        this.locals = new LocalTable();
        this.label = 0;
    }

    public generate(): void {
        // FIXME: fix the type conversion, also only supports BYVAL currently
        const paramTypes = new Array<WasmType>();

        for (const wasmType of this.params.wasmTypes.values()) {
            paramTypes.push(wasmType);
        }

        const paramType = binaryen.createType(paramTypes);

        const funcBlock = this.generateBlock(this.body);
        const vars = new Array<WasmType>();

        for (const wasmType of this.locals.wasmTypes.values()) {
            vars.push(wasmType);
        }

        this.module.addFunction(this.ident, paramType, binaryen.none, vars, funcBlock);
    }

    // returns bask the index
    private setLocal(name: string, type: Type, wasmType: WasmType): number {
        const index = this.params.size() + this.locals.size();
        this.locals.set(name, type, wasmType, index);
        return index;
    }

    private getTypeForLocal(name: string): Type {
        if (!this.locals.names.includes(name)) {
            return this.getTypeForParam(name);
        }
        return this.locals.getType(name);
    }

    private getTypeForParam(name: string): Type {
        if (!this.params.names.includes(name)) {
            throw new RuntimeError("Symbol '" + name + "' is not declared");
        }
        return this.params.getType(name);
    }

    private getWasmTypeForLocal(name: string): WasmType {
        if (!this.locals.names.includes(name)) {
            return this.getWasmTypeForParam(name);
        }
        return this.locals.getWasmType(name);
    }

    private getWasmTypeForParam(name: string): WasmType {
        if (!this.params.names.includes(name)) {
            throw new RuntimeError("Symbol '" + name + "' is not declared");
        }
        return this.params.getWasmType(name);
    }

    private getIndexForLocal(name: string): number {
        if (!this.locals.names.includes(name)) {
            return this.getIndexForParam(name);
        }
        return this.locals.getIndex(name);
    }

    private getIndexForParam(name: string): number {
        if (!this.params.names.includes(name)) {
            throw new Error("Symbol '" + name + "' is not declared");
        }
        return this.params.getIndex(name);
    }

    private resolveType(expression: Expr): Type {
        switch (expression.kind) {
            // FIXME: some cases such as assignment are not considered
            // maybe not need to be fixed, keep this FIXME though
            case nodeKind.VarExprNode:
                return this.resolveVarExprNodeType(expression);
            case nodeKind.IndexExprNode:
                return this.resolveIndexExprNodeType(expression);
            case nodeKind.SelectExprNode:
                return this.resolveSelectExprNodeType(expression);
            case nodeKind.CallFunctionExprNode:
                return this.resolveCallFunctionExprNodeType(expression);
            case nodeKind.UnaryExprNode:
                // The type of a expression remains the same after a unary operation 
                // (as far as I can think)
                return this.resolveType(expression.expr);
            case nodeKind.BinaryExprNode:
                return this.resolveBasicBinaryExprNodeType(expression);
            case nodeKind.IntegerExprNode:
                return new BasicType(basicKind.INTEGER);
            case nodeKind.RealExprNode:
                return new BasicType(basicKind.REAL);
            case nodeKind.CharExprNode:
                return new BasicType(basicKind.CHAR);
            case nodeKind.StringExprNode:
                return new BasicType(basicKind.STRING);
            default:
                unreachable();
        }
    }

    private resolveVarExprNodeType(node: VarExprNode): Type {
        const varName = node.ident.lexeme;

        if (this.params.names.includes(varName) ||
            this.locals.names.includes(varName)) {
            return this.getTypeForLocal(varName);
        }

        return this.enclosing.resolveVarExprNodeType(node);
    }

    public resolveIndexExprNodeType(node: IndexExprNode): Type {
        const rVal = this.resolveType(node.expr);
        if (rVal.kind !== typeKind.ARRAY) {
            throw new RuntimeError("Cannot perfrom 'index' operation to none ARRAY types");
        }
        return rVal.elem;
    }

    public resolveSelectExprNodeType(node: SelectExprNode): Type {
        const rVal = this.resolveType(node.expr);
        if (rVal.kind !== typeKind.RECORD) {
            throw new RuntimeError("Cannot perfrom 'select' operation to none RECORD types");
        }
        return rVal.fields.get(node.ident.lexeme) as Type;
    }

    private resolveCallFunctionExprNodeType(node: CallFunctionExprNode): Type {
        // FIXME: complicated expression calls are not implemented
        if (node.callee.kind === nodeKind.VarExprNode) {
            const funcName = node.callee.ident.lexeme;
            return this.enclosing.getFunction(funcName).returnType;
        }
        throw new RuntimeError("Not implemented yet");
    }

    private resolveBasicBinaryExprNodeType(node: BinaryExprNode): Type {
        const leftType = this.resolveType(node.left);
        const rightType = this.resolveType(node.right);

        // Binary operations only happen between basic types, at least now
        // TODO: Whether ot not to support Array comparison is a question
        if (leftType.kind !== typeKind.BASIC || rightType.kind !== typeKind.BASIC) {
            throw new RuntimeError("Cannot convert" + rightType + "to" + leftType);
        }

        const leftBasicType = leftType.type;
        const rightBasicType = rightType.type;

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
                            return new BasicType(basicKind.INTEGER);
                        }
                        else if (rightBasicType == basicKind.REAL) {
                            return new BasicType(basicKind.REAL);
                        }
                        throw new RuntimeError("Cannot convert" + rightBasicType + "to" + leftBasicType);
                    case basicKind.REAL:
                        if (rightBasicType == basicKind.INTEGER ||
                            rightBasicType == basicKind.REAL) {
                            return new BasicType(basicKind.REAL);
                        }
                        throw new RuntimeError("Cannot convert" + rightBasicType + "to" + leftBasicType);
                    case basicKind.CHAR:
                        if (rightBasicType == basicKind.INTEGER ||
                            rightBasicType == basicKind.CHAR ||
                            rightBasicType == basicKind.BOOLEAN) {
                            return new BasicType(basicKind.INTEGER);
                        }
                        throw new RuntimeError("Cannot convert" + rightBasicType + "to" + leftBasicType);
                    case basicKind.STRING:
                        // FIXME: handle concat
                        throw new RuntimeError("Cannot convert" + rightBasicType + "to" + leftBasicType);
                    case basicKind.BOOLEAN:
                        if (rightBasicType == basicKind.INTEGER ||
                            rightBasicType == basicKind.CHAR ||
                            rightBasicType == basicKind.BOOLEAN) {
                            return new BasicType(basicKind.INTEGER);
                        }
                        throw new RuntimeError("Cannot convert" + rightBasicType + "to" + leftBasicType);
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
                            return new BasicType(basicKind.BOOLEAN);
                        }
                        throw new RuntimeError("Cannot convert" + rightBasicType + "to" + leftBasicType);
                    case basicKind.REAL:
                        if (rightBasicType == basicKind.INTEGER ||
                            rightBasicType == basicKind.REAL) {
                            return new BasicType(basicKind.BOOLEAN);
                        }
                        throw new RuntimeError("Cannot convert" + rightBasicType + "to" + leftBasicType);
                    case basicKind.CHAR:
                        if (rightBasicType == basicKind.INTEGER ||
                            rightBasicType == basicKind.CHAR ||
                            rightBasicType == basicKind.BOOLEAN ||
                            basicKind.STRING) {
                            return new BasicType(basicKind.BOOLEAN);
                        }
                        throw new RuntimeError("Cannot convert" + rightBasicType + "to" + leftBasicType);
                    case basicKind.STRING:
                        if (rightBasicType == basicKind.CHAR ||
                            rightBasicType == basicKind.STRING) {
                            return new BasicType(basicKind.BOOLEAN);
                        }
                        throw new RuntimeError("Cannot convert" + rightBasicType + "to" + leftBasicType);
                    case basicKind.BOOLEAN:
                        if (rightBasicType == basicKind.INTEGER ||
                            rightBasicType == basicKind.BOOLEAN) {
                            return new BasicType(basicKind.BOOLEAN);
                        }
                        throw new RuntimeError("Cannot convert" + rightBasicType + "to" + leftBasicType);
                }
                default:
                    unreachable();
        }
    }

    // Expressions
    private generateExpression(expression: Expr): ExpressionRef {
        switch (expression.kind) {
            case nodeKind.AssignNode:
                return this.assignExpression(expression);
            case nodeKind.VarExprNode:
                return this.varExpression(expression);
            case nodeKind.IndexExprNode:
                return this.loadIndexExpression(expression);
            case nodeKind.SelectExprNode:
                return this.selectExpression(expression);
            case nodeKind.CallFunctionExprNode:
                return this.callFunctionExpression(expression);
            case nodeKind.CallProcedureExprNode:
                return this.callProcedureExpression(expression);
            case nodeKind.UnaryExprNode:
                return this.unaryExpression(expression);
            case nodeKind.BinaryExprNode:
                return this.binaryExpression(expression);
            case nodeKind.IntegerExprNode:
                return this.enclosing.integerExpression(expression);
            case nodeKind.RealExprNode:
                return this.enclosing.realExpression(expression);
            case nodeKind.CharExprNode:
                return this.enclosing.charExpression(expression);
            case nodeKind.StringExprNode:
                return this.enclosing.stringExpression(expression);
            default:
                throw new RuntimeError("Not implemented yet");
        }
    }

    private generateLeftValue(expression: Expr): ExpressionRef {
        switch (expression.kind) {
            case nodeKind.VarExprNode:
                return this.varExpression(expression);
            case nodeKind.IndexExprNode:
                return this.indexExpression(expression);
            case nodeKind.SelectExprNode:
                return this.selectExpression(expression);
            default:
                throw new RuntimeError(expression.toString() + "cannot be a left value");
        }
    }

    private assignExpression(node: AssignNode): ExpressionRef {
        // Guess what? VarExpr has to be a sqecial case
        // Because this is wasm!
        if (node.left.kind === nodeKind.VarExprNode) {
            const varName = node.left.ident.lexeme;
            if (this.params.names.includes(varName) || this,this.locals.names.includes(varName)) {
                const varIndex = this.getIndexForLocal(varName);
                const varType = this.getTypeForLocal(varName);
                const rhs = this.generateExpression(node.right);
                const rightType = this.resolveType(node.right);
                return this.module.local.set(varIndex, this.enclosing.convertType(rightType, varType, rhs));
            }
            return this.enclosing.assignExpression(node);
        }

        const leftType = this.resolveType(node.left);
        const rightType = this.resolveType(node.right);
        // FIXME: fix soon
        if (leftType.kind !== typeKind.BASIC || rightType.kind !== typeKind.BASIC) {
            throw new RuntimeError("not implemented");
        }
        const leftBasicType = leftType.type;
        const rightBasicType = rightType.type;
        const rhs = this.generateExpression(node.right);
        const ptr = this.generateLeftValue(node.left);
        switch (leftBasicType) {
            case basicKind.INTEGER:
            case basicKind.CHAR:
            case basicKind.BOOLEAN:
            case basicKind.STRING:
                return this.module.i32.store(0, 1, ptr, this.enclosing.convertBasicType(rightBasicType, leftBasicType, rhs), "0");
            case basicKind.REAL:
                return this.module.f64.store(0, 1, ptr, this.enclosing.convertBasicType(rightBasicType, leftBasicType, rhs), "0");
        }
        throw new RuntimeError("Not implemented yet");
    }

    private varExpression(node: VarExprNode): ExpressionRef {
        const varName = node.ident.lexeme;
        // first param then local
        if (this.params.names.includes(varName) || this.locals.names.includes(varName)) {
            const paramIndex = this.getIndexForLocal(varName);
            const wasmType = this.getWasmTypeForLocal(varName);
            const variable = this.module.local.get(paramIndex, wasmType);
            return variable;
        }
        else {
            return this.enclosing.varExpression(node);
        }
    }

    private loadIndexExpression(node: IndexExprNode): ExpressionRef {
        const elemType = this.resolveType(node);
        // FIXME: fix soon
        if (elemType.kind !== typeKind.BASIC) {
            throw new RuntimeError("not implemented");
        }
        const basicType = elemType.type;
        const ptr = this.indexExpression(node);
        if (basicType === basicKind.INTEGER ||
            basicType === basicKind.CHAR||
            basicType === basicKind.BOOLEAN||
            basicType === basicKind.STRING) {
            return this.module.i32.load(0, 1, ptr, "0");
        }
        else if (basicType === basicKind.REAL) {
            return this.module.f64.load(0, 1, ptr, "0");
        }
        throw new RuntimeError("Not implemented yet");
    }

    // obtain the pointer of the value but not setting or loading it
    public indexExpression(node: IndexExprNode): ExpressionRef {
        // check whether the expr exists and whether it is an ARRAY
        const rVal = this.resolveType(node.expr);
        if (rVal.kind !== typeKind.ARRAY) {
            throw new RuntimeError("Cannot perfrom 'index' operation to none ARRAY types");
        }
        const elemType = this.resolveType(node);
        // if it comes to here possibilities such as 1[1] are prevented
        const expr = this.generateExpression(node.expr);
        const index = this.generateExpression(node.indexes[0]);
        return this.module.i32.add(expr, this.module.i32.mul(index, this.enclosing.generateConstant(binaryen.i32, elemType.size())));
    }

    public selectExpression(node: SelectExprNode): ExpressionRef {
        // check whether the expr exists and whether it is an ARRAY
        const rVal = this.resolveType(node.expr);
        if (rVal.kind !== typeKind.RECORD) {
            throw new RuntimeError("Cannot perfrom 'select' operation to none RECORD types");
        }
        // if it comes to here possibilities such as 1[1] are prevented
        const expr = this.generateExpression(node.expr);
        return this.module.i32.add(expr, this.enclosing.generateConstant(binaryen.i32, rVal.offset(node.ident.lexeme)));
    }

    private callFunctionExpression(node: CallFunctionExprNode): ExpressionRef {
        if (node.callee.kind == nodeKind.VarExprNode) {
            const funcName = node.callee.ident.lexeme;
            const funcArgs = new Array<ExpressionRef>();
            const func = this.enclosing.getFunction(funcName);
            if (func.params.size() !== node.args.length) {
                throw new RuntimeError("Function '" + funcName + "' expects " + func.params.size + " arguments, but " + node.args.length + " are provided");
            }
            for (let i = 0, paramNames = func.params.names; i < node.args.length; i++) {
                const arg = node.args[i];
                const expr = this.generateExpression(arg);
                const argType = this.resolveType(arg);
                const paramType = func.params.getType(paramNames[i]);
                funcArgs.push(this.enclosing.convertType(argType, paramType, expr));
            }
            const returnType = this.enclosing.getFunction(funcName).wasmReturnType;
            return this.module.call(funcName, funcArgs, returnType);
        }
        // FIXME: The complicated call possibilities are not supported
        throw new RuntimeError("Not implemented yet");
    }

    private callProcedureExpression(node: CallProcedureExprNode): ExpressionRef {
        if (node.callee.kind === nodeKind.VarExprNode) {
            const procName = node.callee.ident.lexeme;
            const procArgs = new Array<ExpressionRef>();
            const proc = this.enclosing.getProcedure(procName);
            if (proc.params.size() !== node.args.length) {
                throw new RuntimeError("Procedure '" + procName + "' expects " + proc.params.size + " arguments, but " + node.args.length + " are provided");
            }

            for (let i = 0, paramNames = proc.params.names; i < node.args.length; i++) {
                const arg = node.args[i];
                const expr = this.generateExpression(arg);
                const argType = this.resolveType(arg);
                const paramType = proc.params.getType(paramNames[i]);
                procArgs.push(this.enclosing.convertType(argType, paramType, expr));
            }
            return this.module.call(procName, procArgs, binaryen.none);
        }
        // FIXME: The complicated call possibilities are not supported (calling a complex expression)
        throw new RuntimeError("Not implemented yet");
    }

    private unaryExpression(node: UnaryExprNode): ExpressionRef {
        const type = this.resolveType(node.expr);
        
        if (type.kind !== typeKind.BASIC) {
            throw new RuntimeError("Unary operations can only be performed on basic types");
        }

        const basicType = type.type;

        // currently keep these 2 switch cases
        // TODO: optimize later
        if (basicType === basicKind.REAL) {
            switch (node.operator.type) {
                case tokenType.PLUS:
                    return this.generateExpression(node.expr);
                case tokenType.MINUS:
                    return this.module.f64.neg(this.generateExpression(node.expr));
                default:
                    throw new RuntimeError("Not implemented yet");
            }
        }
        // otherwise i32
        switch (node.operator.type) {
            case tokenType.PLUS:
                return this.generateExpression(node.expr);
            case tokenType.MINUS:
                return this.module.i32.sub(this.module.i32.const(0), this.generateExpression(node.expr));
            default:
                throw new RuntimeError("Not implemented yet");
        }
    }

    private binaryExpression(node: BinaryExprNode): ExpressionRef {
        const leftType = this.resolveType(node.left);
        const rightType = this.resolveType(node.right);

        if (leftType.kind !== typeKind.BASIC || rightType.kind !== typeKind.BASIC) {
            throw new RuntimeError("Binary operations can only be performed on basic types");
        }

        const leftBasicType: basicKind = leftType.type;
        const rightBasicType: basicKind = rightType.type;

        const basicType = minimalCompatableBasicType(leftBasicType, rightBasicType);

        let leftExpr = this.generateExpression(node.left);
        let rightExpr = this.generateExpression(node.right);
        // if the type is REAL, convert the INTEGER to REAL
        if (basicType == basicKind.REAL) {
            if (leftBasicType == basicKind.INTEGER) {
                leftExpr = this.enclosing.convertBasicType(leftBasicType, basicType, leftExpr);
            }
            else if (rightBasicType == basicKind.INTEGER) {
                rightExpr = this.enclosing.convertBasicType(rightBasicType, basicType, rightExpr);
            }

            switch(node.operator.type) {
                case tokenType.PLUS:
                    return this.module.f64.add(leftExpr, rightExpr);
                case tokenType.MINUS:
                    return this.module.f64.sub(leftExpr, rightExpr);
                case tokenType.STAR:
                    return this.module.f64.mul(leftExpr, rightExpr);
                case tokenType.SLASH:
                    return this.module.f64.div(leftExpr, rightExpr);
                case tokenType.EQUAL:
                    return this.module.f64.eq(leftExpr, rightExpr);
                case tokenType.LESS_GREATER:
                    return this.module.f64.ne(leftExpr, rightExpr);
                case tokenType.LESS:
                    return this.module.f64.lt(leftExpr, rightExpr);
                case tokenType.GREATER:
                    return this.module.f64.gt(leftExpr, rightExpr);
                case tokenType.LESS_EQUAL:
                    return this.module.f64.le(leftExpr, rightExpr);
                case tokenType.GREATER_EQUAL:
                    return this.module.f64.ge(leftExpr, rightExpr);
                default:
                    throw new RuntimeError("Not implemented yet");
            }
        }

        switch(node.operator.type) {
            case tokenType.PLUS:
                return this.module.i32.add(leftExpr, rightExpr);
            case tokenType.MINUS:
                return this.module.i32.sub(leftExpr, rightExpr);
            case tokenType.STAR:
                return this.module.i32.mul(leftExpr, rightExpr);
            case tokenType.SLASH:
                return this.module.i32.div_s(leftExpr, rightExpr);
            case tokenType.EQUAL:
                return this.module.i32.eq(leftExpr, rightExpr);
            case tokenType.LESS_GREATER:
                return this.module.i32.ne(leftExpr, rightExpr);
            case tokenType.LESS:
                return this.module.i32.lt_s(leftExpr, rightExpr);
            case tokenType.GREATER:
                return this.module.i32.gt_s(leftExpr, rightExpr);
            case tokenType.LESS_EQUAL:
                return this.module.i32.le_s(leftExpr, rightExpr);
            case tokenType.GREATER_EQUAL:
                return this.module.i32.ge_s(leftExpr, rightExpr);
            default:
                throw new RuntimeError("Not implemented yet");
        }
    }

    // Statements
    private generateBlock(statements: Array<Stmt>): ExpressionRef {
        return this.module.block(null, this.generateStatements(statements));
    }

    private generateStatements(statements: Array<Stmt>): Array<ExpressionRef> {
        const stmts = new Array<ExpressionRef>();
        for (const statement of statements) {
            stmts.push(this.generateStatement(statement));
        }
        // create an empty return statement at the end of the block, its a good habit
        stmts.push(this.module.return());
        return stmts;
    }

    private generateStatement(statement: Stmt): ExpressionRef {
        switch (statement.kind) {
            case nodeKind.ExprStmtNode:
                return this.generateExpression(statement.expr);
            case nodeKind.ReturnNode:
                throw new RuntimeError("Procedures cannot contain return statements");
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

    private outputStatement(node: OutputNode): ExpressionRef {
        const type = this.resolveType(node.expr);
        if (type.kind !== typeKind.BASIC) {
            throw new RuntimeError("Output can only be performed on basic types");
        }

        const basicType: basicKind = type.type;
        const expr = this.generateExpression(node.expr);

        if (basicType === basicKind.INTEGER) {
            return this.module.call("logInteger", [expr], binaryen.none);
        }
        else if (basicType === basicKind.REAL) {
            return this.module.call("logReal", [expr], binaryen.none);
        }
        else if (basicType === basicKind.CHAR) {
            return this.module.call("logChar", [expr], binaryen.none);
        }
        else if (basicType === basicKind.STRING) {
            return this.module.call("logString", [expr], binaryen.none);
        }
        throw new RuntimeError("Not implemented yet");
        // return this.module.call("logNumber", [this.generateExpression(node.expr)], binaryen.none);
    }

    private varDeclStatement(node: VarDeclNode): ExpressionRef {
        const varName = node.ident.lexeme;
        // FIXME: only basic types supported
        const varType = convertToBasicType(node.type);
        const wasmType = convertToWasmType(node.type);
        const varIndex = this.setLocal(varName, varType, wasmType);
        console.log(varName, varType, varIndex, wasmType);
        return this.module.local.set(varIndex, this.enclosing.generateConstant(wasmType, 0));
    }

    private arrDeclStatement(node: ArrDeclNode): ExpressionRef {
        const arrName = node.ident.lexeme;
        // FIXME: only basic types supported
        const elemType = convertToBasicType(node.type);
        // FIXME: temp test
        const lower = node.dimensions[0].lower.literal;
        const upper = node.dimensions[0].upper.literal;
        // pointer to head
        const wasmType = binaryen.i32;
        const varIndex = this.setLocal(arrName, new ArrayType(elemType, lower, upper), wasmType);
        // FIXME: set to init pointer
        return this.module.local.set(varIndex, this.enclosing.generateConstant(wasmType, 0));
    }

    private ifStatement(node: IfNode): ExpressionRef {
        if (node.elseBody) {
            return this.module.if(this.generateExpression(node.condition), this.generateBlock(node.body), this.generateBlock(node.elseBody)); 
        }
        else {
            return this.module.if(this.generateExpression(node.condition), this.generateBlock(node.body));
        }
    }

    private whileStatement(node: WhileNode): ExpressionRef {
        // (loop $label
        //  (if (condition)
        //   (then
        //    (body)
        //    (br $label)
        //   )
        //  )
        // )

        const statements = this.generateStatements(node.body);
        const condition = this.generateExpression(node.condition);
        statements.push(this.module.br((++this.label).toString()));
        return this.module.loop(this.label.toString(), this.module.if(condition, this.module.block(null, statements)));
    }

    private repeatStatement(node: RepeatNode): ExpressionRef {
        // (loop $label
        //  (body)
        //  (if (i32.eqz (condition))
        //   (then
        //    (br $label)
        //   )
        //  )
        // )
        
        const statements = this.generateStatements(node.body);
        const condition = this.generateExpression(node.condition);
        statements.push(this.module.if(this.module.i32.eqz(condition), this.module.br((++this.label).toString())));
        return this.module.loop(this.label.toString(), this.module.block(null, statements));
    }

    private forStatement(node: ForNode): ExpressionRef {
        // (init)
        // (loop $label
        //  (if condition)
        //   (then
        //    (body)
        //    (step)
        //    (br $label)
        //   )
        //  )
        // )
        const varName = node.ident.lexeme;
        const varIndex = this.getIndexForLocal(varName);
        const varType = this.getTypeForLocal(varName);
        const endType = this.resolveType(node.end);
        const stepType = this.resolveType(node.step);
        const wasmType = this.getWasmTypeForLocal(varName);
        
        if (varType.kind !== typeKind.BASIC || varType.type !== basicKind.INTEGER) {
            throw new RuntimeError("For loops only iterate over for INTEGERs");
        }
        if (endType.kind !== typeKind.BASIC || endType.type !== basicKind.INTEGER) {
            throw new RuntimeError("End value of for loops can only be INTEGERs");
        }
        if (stepType.kind !== typeKind.BASIC || stepType.type !== basicKind.INTEGER) {
            throw new RuntimeError("Step value of for loops can only be INTEGERs");
        }

        const initExpr = this.generateExpression(node.start);

        const init = this.module.local.set(varIndex, initExpr);

        const statements = this.generateStatements(node.body);
        const variable = this.module.local.get(varIndex, wasmType);
    
        const condition = this.module.i32.ge_s(this.generateExpression(node.end), variable);
        const step = this.module.local.set(varIndex, this.module.i32.add(variable, this.generateExpression(node.step)));

        statements.push(step);
        statements.push(this.module.br((++this.label).toString()));
        return this.module.block(null, [init, this.module.loop(this.label.toString(), this.module.if(condition, this.module.block(null, statements)))]);
    }
}
