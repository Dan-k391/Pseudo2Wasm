import binaryen from "binaryen";
import { Environment } from "../import";
import { RuntimeError } from "../error";
import { _Symbol } from "./symbol";
import { tokenType } from "../scanning/token";
import {
    nodeKind,

    ASTNode,
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
    IntegerExprNode,
    RealExprNode,
    CharExprNode,
    StringExprNode,
    BoolExprNode,
    OutputNode,
    InputNode
} from "../ast";
import { Generator } from "./generator";
import { LocalTable } from "./local";
import { convertToVarType, convertToWasmType } from "../util";
import { VarType } from "../type/variable";
import { minimalCompatableType } from "../type/type";

// TODO: maybe new a common file to contain these
type Module = binaryen.Module;
type ExpressionRef = binaryen.ExpressionRef;
type Type = binaryen.Type;

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
        const paramTypes = new Array<Type>();

        for (const wasmType of this.params.wasmTypes.values()) {
            paramTypes.push(wasmType);
        }

        const paramType = binaryen.createType(paramTypes);

        const funcBlock = this.generateBlock(this.body);
        const vars = new Array<Type>();

        for (const wasmType of this.locals.wasmTypes.values()) {
            vars.push(wasmType);
        }

        // FIXME: single returnType has problem here
        this.module.addFunction(this.ident, paramType, binaryen.none, vars, funcBlock);
    }

    private generateConstant(type: Type, value: number): ExpressionRef {
        if (type === binaryen.i32) {
            return this.module.i32.const(value);
        }
        else if (type === binaryen.f64) {
            return this.module.f64.const(value);
        }
        throw new RuntimeError("Unknown type '" + type + "'");
    }

    // returns bask the index
    private setLocal(name: string, type: VarType, wasmType: Type): number {
        const index = this.params.size() + this.locals.size();
        this.locals.set(name, type, wasmType, index);
        return index;
    }

    private getTypeForLocal(name: string): VarType {
        if (!this.locals.names.includes(name)) {
            return this.getTypeForParam(name);
        }
        return this.locals.getType(name);
    }

    private getTypeForParam(name: string): VarType {
        if (!this.params.names.includes(name)) {
            throw new RuntimeError("Symbol '" + name + "' is not declared");
        }
        return this.params.getType(name);
    }

    private getWasmTypeForLocal(name: string): Type {
        if (!this.locals.names.includes(name)) {
            return this.getWasmTypeForParam(name);
        }
        return this.locals.getWasmType(name);
    }

    private getWasmTypeForParam(name: string): Type {
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

    private resolveType(expression: Expr): VarType {
        switch (expression.kind) {
            // FIXME: some cases such as assignment are not considered
            // maybe not need to be fixed, keep this FIXME though
            case nodeKind.VarExprNode:
                return this.resolveVarExprNodeType(expression as VarExprNode);
            case nodeKind.CallFunctionExprNode:
                return this.resolveCallFunctionExprNodeType(expression as CallFunctionExprNode);
            case nodeKind.UnaryExprNode:
                // The type of a expression remains the same after a unary operation 
                // (as far as I can think)
                return this.resolveType((expression as UnaryExprNode).expr);
            case nodeKind.BinaryExprNode:
                return this.resolveBinaryExprNodeType(expression as BinaryExprNode);
            case nodeKind.IntegerExprNode:
                return VarType.INTEGER;
            case nodeKind.RealExprNode:
                return VarType.REAL;
            case nodeKind.CharExprNode:
                return VarType.CHAR;
            // case nodeKind.StringExprNode:
            //     return VarType.STRING;
            default:
                return VarType.NONE;
        }
    }

    private resolveVarExprNodeType(node: VarExprNode): VarType {
        const varName = node.ident.lexeme;

        if (this.params.names.includes(varName) || this.locals.names.includes(varName)) {
            return this.getTypeForLocal(varName);
        }

        return this.enclosing.resolveVarExprNodeType(node);
    }

    private resolveCallFunctionExprNodeType(node: CallFunctionExprNode): VarType {
        // FIXME: complicated expression calls are not implemented
        if (node.callee.kind === nodeKind.VarExprNode) {
            const funcName = (node.callee as VarExprNode).ident.lexeme;
            return this.enclosing.getFunction(funcName).returnType;
        }
        throw new RuntimeError("Not implemented yet");
    }

    private resolveBinaryExprNodeType(node: BinaryExprNode): VarType {
        const leftType = this.resolveType(node.left);
        const rightType = this.resolveType(node.right);
        switch (node.operator.type) {
            // arithmetic operations
            case tokenType.PLUS:
            case tokenType.MINUS:
            case tokenType.STAR:
            case tokenType.SLASH:
                switch (leftType) {
                    case VarType.INTEGER:
                        // TODO: optimize the type resolving system here
                        // The rules here may be incorret or not appropriate (fix it if needed)
                        // The rule: INTEGER ARITHOP CHAR is INTEGER
                        // CHAR ARITHOP INTEGER is CHAR
                        if (rightType == VarType.INTEGER || rightType == VarType.CHAR || rightType == VarType.BOOLEAN) {
                            return VarType.INTEGER;
                        }
                        else if (rightType == VarType.REAL) {
                            return VarType.REAL;
                        }
                        throw new RuntimeError("Cannot convert" + rightType + "to" + leftType);
                    case VarType.REAL:
                        if (rightType == VarType.INTEGER || rightType == VarType.REAL) {
                            return VarType.REAL;
                        }
                        throw new RuntimeError("Cannot convert" + rightType + "to" + leftType);
                    case VarType.CHAR:
                        if (rightType == VarType.INTEGER || rightType == VarType.CHAR || rightType == VarType.BOOLEAN) {
                            return VarType.INTEGER;
                        }
                        throw new RuntimeError("Cannot convert" + rightType + "to" + leftType);
                    case VarType.STRING:
                        // FIXME: handle concat
                        throw new RuntimeError("Cannot convert" + rightType + "to" + leftType);
                    case VarType.BOOLEAN:
                        if (rightType == VarType.INTEGER || rightType == VarType.CHAR || rightType == VarType.BOOLEAN) {
                            return VarType.INTEGER;
                        }
                        throw new RuntimeError("Cannot convert" + rightType + "to" + leftType);
                }
            // logical operators
            case tokenType.EQUAL:
            case tokenType.LESS_GREATER:
            case tokenType.LESS:
            case tokenType.GREATER:
            case tokenType.LESS_EQUAL:
            case tokenType.GREATER_EQUAL:
                // TODO: optimize the code
                switch (leftType) {
                    case VarType.INTEGER:
                        if (rightType == VarType.INTEGER || rightType == VarType.REAL || rightType == VarType.CHAR || rightType == VarType.BOOLEAN) {
                            return VarType.BOOLEAN;
                        }
                        throw new RuntimeError("Cannot convert" + rightType + "to" + leftType);
                    case VarType.REAL:
                        if (rightType == VarType.INTEGER || rightType == VarType.REAL) {
                            return VarType.BOOLEAN;
                        }
                        throw new RuntimeError("Cannot convert" + rightType + "to" + leftType);
                    case VarType.CHAR:
                        if (rightType == VarType.INTEGER || rightType == VarType.CHAR || rightType == VarType.BOOLEAN || VarType.STRING) {
                            return VarType.BOOLEAN;
                        }
                        throw new RuntimeError("Cannot convert" + rightType + "to" + leftType);
                    case VarType.STRING:
                        if (rightType == VarType.CHAR || rightType == VarType.STRING) {
                            return VarType.BOOLEAN;
                        }
                        throw new RuntimeError("Cannot convert" + rightType + "to" + leftType);
                    case VarType.BOOLEAN:
                        if (rightType == VarType.INTEGER || rightType == VarType.BOOLEAN) {
                            return VarType.BOOLEAN;
                        }
                        throw new RuntimeError("Cannot convert" + rightType + "to" + leftType);
                }
            // return anything here, it never comes to this step
            default:
                return VarType.NONE;
        }
    }

    // Expressions
    private generateExpression(expression: Expr): ExpressionRef {
        switch (expression.kind) {
            case nodeKind.VarAssignNode:
                return this.varAssignExpression(expression as VarAssignNode);
            case nodeKind.VarExprNode:
                return this.varExpression(expression as VarExprNode);
            case nodeKind.CallFunctionExprNode:
                return this.callFunctionExpression(expression as CallFunctionExprNode);
            case nodeKind.CallProcedureExprNode:
                return this.callProcedureExpression(expression as CallProcedureExprNode);
            case nodeKind.UnaryExprNode:
                return this.unaryExpression(expression as UnaryExprNode);
            case nodeKind.BinaryExprNode:
                return this.binaryExpression(expression as BinaryExprNode);
            case nodeKind.IntegerExprNode:
                return this.enclosing.integerExpression(expression as IntegerExprNode);
            // case nodeKind.CharExprNode:
            //     return this.charExpression(expression as CharExprNode);
            // case nodeKind.StringExprNode:
            //     return this.stringExpression(expression as StringExprNode);
            default:
                return -1;
        }
    }

    private varAssignExpression(node: VarAssignNode): ExpressionRef {
        const varName = node.ident.lexeme;
        if (this.params.names.includes(varName) || this.locals.names.includes(varName)) {
            const varIndex = this.getIndexForLocal(varName);
            const varType = this.getTypeForLocal(varName);
            const rhs = this.generateExpression(node.expr);
            const rightType = this.resolveType(node.expr);
            return this.module.local.set(varIndex, this.enclosing.convertType(rightType, varType, rhs));
        }
        else {
            return this.enclosing.varAssignExpression(node);
        }
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

    private callFunctionExpression(node: CallFunctionExprNode): ExpressionRef {
        if (node.callee.kind == nodeKind.VarExprNode) {
            const funcName = (node.callee as VarExprNode).ident.lexeme;
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
        return -1;
    }

    private callProcedureExpression(node: CallProcedureExprNode): ExpressionRef {
        if (node.callee.kind === nodeKind.VarExprNode) {
            const procName = (node.callee as VarExprNode).ident.lexeme;
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
        return -1;
    }

    private unaryExpression(node: UnaryExprNode): ExpressionRef {
        const type = this.resolveType(node.expr);
        
        // currently keep these 2 switch cases
        // TODO: optimize later
        if (type == VarType.REAL) {
            switch (node.operator.type) {
                case tokenType.PLUS:
                    return this.generateExpression(node.expr);
                case tokenType.MINUS:
                    return this.module.f64.neg(this.generateExpression(node.expr));
                default:
                    return -1;
            }
        }

        switch (node.operator.type) {
            case tokenType.PLUS:
                return this.generateExpression(node.expr);
            case tokenType.MINUS:
                return this.module.i32.sub(this.module.i32.const(0), this.generateExpression(node.expr));
            default:
                return -1;
        }
    }

    private binaryExpression(node: BinaryExprNode): ExpressionRef {
        const leftType = this.resolveType(node.left);
        const rightType = this.resolveType(node.right);

        const type = minimalCompatableType(leftType, rightType);

        let leftExpr = this.generateExpression(node.left);
        let rightExpr = this.generateExpression(node.right);
        // if the type is REAL, convert the INTEGER to REAL
        if (type == VarType.REAL) {
            if (leftType == VarType.INTEGER) {
                leftExpr = this.module.f64.convert_s.i32(leftExpr);
            }
            else if (rightType == VarType.INTEGER) {
                rightExpr = this.module.f64.convert_s.i32(rightExpr);
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
                    return -1;
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
                return -1;
        }
    }

    // Statements
    private generateBlock(statements: Array<Stmt>): ExpressionRef {
        return this.module.block(null, this.generateStatements(statements));
    }

    private generateStatements(statements: Array<Stmt>): Array<ExpressionRef> {
        const stmts = new Array<binaryen.ExpressionRef>();
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
                return this.generateExpression((statement as ExprStmtNode).expr);
            case nodeKind.ReturnNode:
                throw new RuntimeError("Procedures cannot contain return statements");
            case nodeKind.OutputNode:
                return this.outputStatement(statement as OutputNode);
            case nodeKind.VarDeclNode:
                return this.varDeclStatement(statement as VarDeclNode);
            case nodeKind.IfNode:
                return this.ifStatement(statement as IfNode);
            case nodeKind.WhileNode:
                return this.whileStatement(statement as WhileNode);
            case nodeKind.RepeatNode:
                return this.repeatStatement(statement as RepeatNode);
            case nodeKind.ForNode:
                return this.forStatement(statement as ForNode);
            default:
                return -1;
        }
    }

    private outputStatement(node: OutputNode): ExpressionRef {
        const type = this.resolveType(node.expr);

        if (type == VarType.INTEGER) {
            return this.module.call("logInteger", [this.generateExpression(node.expr)], binaryen.none);
        }
        else if (type == VarType.REAL) {
            return this.module.call("logReal", [this.generateExpression(node.expr)], binaryen.none);
        }
        else if (type == VarType.CHAR) {
            return this.module.call("logChar", [this.generateExpression(node.expr)], binaryen.none);
        }
        return -1;
    }

    private varDeclStatement(node: VarDeclNode): ExpressionRef {
        const varName = node.ident.lexeme;
        const varType = convertToVarType(node.type);
        const wasmType = convertToWasmType(node.type);
        const varIndex = this.setLocal(varName, varType, wasmType)
        return this.module.local.set(varIndex, this.generateConstant(wasmType, 0));
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

        if (varType != VarType.INTEGER) {
            throw new RuntimeError("For loops only iterate over for INTEGERs");
        }
        if (endType != VarType.INTEGER) {
            throw new RuntimeError("End value of for loops can only be INTEGERs");
        }
        if (stepType != VarType.INTEGER) {
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
