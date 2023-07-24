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
    NumberExprNode,
    CharExprNode,
    StringExprNode,
    BoolExprNode,
    OutputNode,
    InputNode
} from "../ast";
import { Generator } from "./generator";

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
    public params: Map<string, _Symbol>;
    private body: Array<Stmt>;
    // TODO: change the data structure here
    private locals: Map<string, _Symbol>;
    private label: number;

    constructor(module: Module, enclosing: Generator, ident: string, params: Map<string, _Symbol>, body: Array<Stmt>) {
        this.module = module;
        this.enclosing = enclosing;
        this.ident = ident;
        this.params = params;
        this.body = body;
        this.locals = new Map<string, _Symbol>();
        this.label = 0;
    }

    public generate(): void {
        // FIXME: fix the type conversion, also only supports BYVAL currently
        const paramTypes = new Array<Type>();

        for (const param of this.params.values()) {
            paramTypes.push(param.type);
        }

        const paramType = binaryen.createType(paramTypes);

        const funcBlock = this.generateBlock(this.body);
        const vars = new Array<Type>();

        for (const local of this.locals.values()) {
            vars.push(local.type);
        }

        // FIXME: single returnType has problem here
        this.module.addFunction(this.ident, paramType, binaryen.none, vars, funcBlock);
    }

    private setTypeForLocal(name: string, type: Type): _Symbol {
        if (!this.locals.has(name) && !this.params.has(name)) {
            this.locals.set(name, new _Symbol(this.locals.size + this.params.size, type));
        }
        return this.getSymbolForLocal(name);
    }

    private getSymbolForLocal(name: string): _Symbol {
        if (!this.locals.has(name)) {
            return this.getSymbolForParam(name);
        }

        return this.locals.get(name) as _Symbol;
    }

    public getSymbolForParam(name: string): _Symbol {
        if (!this.params.has(name)) {
            // if not a param try to get from the global scope
            // return this.getSymbolForGlobal(name);
            throw new RuntimeError("Symbol '" + name + "' is not declared");
        }

        return this.params.get(name) as _Symbol;
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
            case nodeKind.NumberExprNode:
                return this.enclosing.numberExpression(expression as NumberExprNode);
            // case nodeKind.CharExprNode:
            //     return this.charExpression(expression as CharExprNode);
            // case nodeKind.StringExprNode:
            //     return this.stringExpression(expression as StringExprNode);
            default:
                return -1;
        }
    }

    private varAssignExpression(node: VarAssignNode): ExpressionRef {
        if (this.locals.has(node.ident.lexeme) || this.params.has(node.ident.lexeme)) {
            const varIndex = this.getSymbolForLocal(node.ident.lexeme).index;
            const varType = this.getSymbolForLocal(node.ident.lexeme).type;
            const rhs = this.generateExpression(node.expr);
            if (varType === binaryen.i32) {
                return this.module.local.set(varIndex, this.module.i32.trunc_s.f64(rhs));
            }
            return this.module.local.set(varIndex, rhs);
        }
        else {
            return this.enclosing.varAssignExpression(node);
        }
    }

    private varExpression(node: VarExprNode): ExpressionRef {
        if (this.locals.has(node.ident.lexeme) || this.params.has(node.ident.lexeme)) {
            const varIndex = this.getSymbolForLocal(node.ident.lexeme).index;
            const varType = this.getSymbolForLocal(node.ident.lexeme).type;
            const variable = this.module.local.get(varIndex, varType);
            if (varType === binaryen.i32) {
                return this.module.f64.convert_s.i32(variable);
            }
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
            if (func.params.size !== node.args.length) {
                throw new RuntimeError("Function '" + funcName + "' expects " + func.params.size + " arguments, but " + node.args.length + " are provided");
            }
            for (let i = 0, paramNames = Array.from(func.params.keys()); i < node.args.length; i++) {
                const arg = node.args[i];
                const expr = this.generateExpression(arg);
                const paramType = func.getSymbolForParam(paramNames[i]).type;
                if (paramType === binaryen.i32) {
                    funcArgs.push(this.module.i32.trunc_s.f64(expr));
                }
                else {
                    funcArgs.push(expr);
                }
            }
            const returnType = this.enclosing.getFunction(funcName).returnType;
            if (returnType === binaryen.i32) {
                return this.module.f64.convert_s.i32(this.module.call(funcName, funcArgs, binaryen.f64));
            }
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
            if (proc.params.size !== node.args.length) {
                throw new RuntimeError("Procedure '" + procName + "' expects " + proc.params.size + " arguments, but " + node.args.length + " are provided");
            }

            for (let i = 0, paramNames = Array.from(proc.params.keys()); i < node.args.length; i++) {
                const arg = node.args[i];
                const expr = this.generateExpression(arg);
                const paramType = proc.getSymbolForParam(paramNames[i]).type;
                if (paramType === binaryen.i32) {
                    procArgs.push(this.module.i32.trunc_s.f64(expr));
                }
                else {
                    procArgs.push(expr);
                }
            }
            return this.module.call(procName, procArgs, binaryen.none);
        }
        // FIXME: The complicated call possibilities are not supported (calling a complex expression)
        return -1;
    }

    private unaryExpression(node: UnaryExprNode): ExpressionRef {
        switch (node.operator.type) {
            case tokenType.PLUS:
                return this.generateExpression(node.expr);
            case tokenType.MINUS:
                return this.module.f64.neg(this.generateExpression(node.expr));
            default:
                return -1;
        }
    }

    private binaryExpression(node: BinaryExprNode): ExpressionRef {
        switch(node.operator.type) {
            case tokenType.PLUS:
                return this.module.f64.add(this.generateExpression(node.left), this.generateExpression(node.right));
            case tokenType.MINUS:
                return this.module.f64.sub(this.generateExpression(node.left), this.generateExpression(node.right));
            case tokenType.STAR:
                return this.module.f64.mul(this.generateExpression(node.left), this.generateExpression(node.right));
            case tokenType.SLASH:
                return this.module.f64.div(this.generateExpression(node.left), this.generateExpression(node.right));
            case tokenType.EQUAL:
                return this.module.f64.eq(this.generateExpression(node.left), this.generateExpression(node.right));
            case tokenType.LESS_GREATER:
                return this.module.f64.ne(this.generateExpression(node.left), this.generateExpression(node.right));
            case tokenType.LESS:
                return this.module.f64.lt(this.generateExpression(node.left), this.generateExpression(node.right));
            case tokenType.GREATER:
                return this.module.f64.gt(this.generateExpression(node.left), this.generateExpression(node.right));
            case tokenType.LESS_EQUAL:
                return this.module.f64.le(this.generateExpression(node.left), this.generateExpression(node.right));
            case tokenType.GREATER_EQUAL:
                return this.module.f64.ge(this.generateExpression(node.left), this.generateExpression(node.right));
            default:
                return -1
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
        return this.module.call("logNumber", [this.generateExpression(node.expr)], binaryen.none);
    }

    private varDeclStatement(node: VarDeclNode): ExpressionRef {
        // FIXME: single type problem
        const index = this.setTypeForLocal(node.ident.lexeme, binaryen.f64).index;
        return this.module.local.set(index, this.module.f64.const(0));
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
        const varIndex = this.getSymbolForLocal(varName).index;
        const varType = this.getSymbolForLocal(varName).type;

        const initExpr = this.generateExpression(node.start);

        let init: ExpressionRef;
        if (varType === binaryen.i32) {
            init = this.module.local.set(varIndex, this.module.i32.trunc_s.f64(initExpr));
        }
        else {
            init = this.module.local.set(varIndex, initExpr);
        }

        const statements = this.generateStatements(node.body);
        const variable = this.module.local.get(varIndex, varType);

        let condition: ExpressionRef;

        if (varType === binaryen.i32) {
            condition = this.module.f64.ge(this.generateExpression(node.end), this.module.f64.convert_s.i32(variable));
        }
        else {
            condition = this.module.f64.ge(this.generateExpression(node.end), variable);
        }

        let step: ExpressionRef;
        if (varType === binaryen.i32) {
            step = this.module.local.set(varIndex, this.module.i32.add(variable, this.module.i32.trunc_s.f64(this.generateExpression(node.step))));
        }
        else {
            step = this.module.local.set(varIndex, this.module.f64.add(variable, this.generateExpression(node.step)));
        }

        statements.push(step);
        statements.push(this.module.br((++this.label).toString()));
        return this.module.block(null, [init, this.module.loop(this.label.toString(), this.module.if(condition, this.module.block(null, statements)))]);
    }
}
