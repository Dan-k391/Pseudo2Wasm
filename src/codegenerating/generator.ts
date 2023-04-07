// TODO: improve the fking code in generator (statements, expressions, etc.)

import binaryen from "binaryen";
import { Environment } from "../import";
import { RuntimeError } from "../error";
// TODO: Optimise the _Symbol class
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

import { Function } from "./function";

// TODO: maybe new a common file to contain these
type Module = binaryen.Module;
type FunctionRef = binaryen.FunctionRef;
type ExpressionRef = binaryen.ExpressionRef;
type Type = binaryen.Type;

export class Generator {
    private ast: ProgramNode;
    private module: binaryen.Module;
    private functions: Map<string, Function>;
    private globals: Map<string, Type>;
    private offset: number;
    private size: number;
    private label: number;

    constructor(ast: ProgramNode) {
        this.ast = ast;
        this.module = new binaryen.Module();

        this.functions = new Map<string, Function>();
        // all variables in the body are global variables
        this.globals = new Map<string, Type>();

        // memory
        this.size = 65536;
        this.offset = 0;

        this.label = 0;
    }

    public generate(): Module {
        // createType although it is useless
        this.module.addFunctionImport("logNumber", "env", "logNumber", binaryen.createType([binaryen.f64]), binaryen.none);
        this.module.addFunctionImport("logString", "env", "logString", binaryen.createType([binaryen.i32]), binaryen.none);
        this.module.addMemoryImport("buffer", "env", "buffer");

        this.module.setStart(this.generateBody(this.ast.body));

        // initialize the globals
        for (const name of this.globals.keys()) {
            // FIXME: single type problem
            this.module.addGlobal(name, this.getGlobalTypeForSymbol(name), true, this.module.f64.const(0));
        }

        return this.module;
    }

    private getGlobalTypeForSymbol(name: string): Type {
        if (!this.globals.has(name)) {
            throw("Symbol '" + name + "' is not declared");
        }
        return this.globals.get(name) as Type;
    }

    private setGlobalTypeForSymbol(name: string, type: Type): void {
        if (!this.globals.has(name)) {
            this.globals.set(name, type);
        }
    }

    private getFunction(name: string): Function {
        if (!this.functions.has(name)) {
            throw("Function '" + name + "' is not declared");
        }
        return this.functions.get(name) as Function;
    }

    private setFunction(name: string, func: Function): void {
        if (!this.functions.has(name)) {
            this.functions.set(name, func);
        }
    }

    // private generateMainFunction(statements: Array<Stmt>): void {
    //     // prevent overlapping of variables
    //     const block = this.generateBlock(statements);
    //     const vars = new Array<Type>();

    //     for (const symbol of this.symbols.values()) {
    //         vars.push(symbol.type);
    //     }

    //     this.module.addFunction("main", binaryen.none, binaryen.none, vars, block);
    //     this.module.addFunctionExport("main", "main");
    // }


    // returns the main functionref to be the start
    private generateBody(body: Array<Stmt>): FunctionRef {
        const stmts = this.generateStatements(body);
        const block = this.module.block(null, stmts);

        const mainFunciton = this.module.addFunction("main", binaryen.none, binaryen.none, new Array<Type>(), block);
        this.module.addFunctionExport("main", "main");
        return mainFunciton;
    }

    private generateFunctionDefinition(node: FuncDefNode): void {
        const funcName = node.ident.lexeme;
        const funcParams = new Map<string, _Symbol>();

        let index = 0;
        for (const param of node.params) {
            const paramName = param.ident.lexeme;
            // FIXME: single type problem
            const paramSymbol = new _Symbol(index, binaryen.f64);
            funcParams.set(paramName, paramSymbol);
            index++;
        }
        // FIXME: single type problem
        const func = new Function(this.module, this.functions, funcName, funcParams, binaryen.f64, node.body);

        this.setFunction(funcName, func);
        this.getFunction(funcName).generate();
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
            case nodeKind.UnaryExprNode:
                return this.unaryExpression(expression as UnaryExprNode);
            case nodeKind.BinaryExprNode:
                return this.binaryExpression(expression as BinaryExprNode);
            case nodeKind.NumberExprNode:
                return this.numberExpression(expression as NumberExprNode);
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
        return this.module.global.set(varName, this.generateExpression(node.expr));
    }

    private varExpression(node: VarExprNode): ExpressionRef {
        const varName = node.ident.lexeme;
        const varType = this.getGlobalTypeForSymbol(varName);
        return this.module.global.get(varName, varType);
    }

    private callFunctionExpression(node: CallFunctionExprNode): ExpressionRef {
        if (node.callee.kind == nodeKind.VarExprNode) {
            const funcName = (node.callee as VarExprNode).ident.lexeme;
            const funcArgs = new Array<ExpressionRef>();
            for (const arg of node.args) {
                const expr = this.generateExpression(arg);
                funcArgs.push(expr);
            }
            const returnType = this.getFunction(funcName).returnType;
            return this.module.call(funcName, funcArgs, returnType);
        }
        // FIXME: The complicated call possibilities are not supported
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

    private numberExpression(node: NumberExprNode): ExpressionRef {
        return this.module.f64.const(node.value);
    }

    private charExpression(node: CharExprNode): ExpressionRef {
        return this.module.i32.const(node.value.charCodeAt(0));
    }

    // use null-terminated strings
    private stringExpression(node: StringExprNode): ExpressionRef {
        const stringIndex = this.offset;
        this.offset += node.value.length + 1;
        console.log(new TextEncoder().encode(node.value + '\0'));
        this.module.setMemory(node.value.length + 1, node.value.length + 1, null, [{
            offset: stringIndex,
            data: new TextEncoder().encode(node.value + '\0'),
            passive: false,
        }], false);
        return this.module.i32.const(stringIndex);
    }

    // Statements
    private generateBlock(statements: Array<Stmt>): ExpressionRef {
        return this.module.block(null, this.generateStatements(statements));
    }

    private generateStatements(statements: Array<Stmt>): Array<ExpressionRef> {
        const stmts = new Array<binaryen.ExpressionRef>();
        for (const statement of statements) {
            if (statement.kind == nodeKind.FuncDefNode) {
                this.generateFunctionDefinition(statement as FuncDefNode);
            }
            else {
                stmts.push(this.generateStatement(statement));
            }
        }
        return stmts;
    }

    private generateStatement(statement: Stmt): ExpressionRef {
        switch (statement.kind) {
            case nodeKind.ExprStmtNode:
                return this.generateExpression((statement as ExprStmtNode).expr);
            case nodeKind.ReturnNode:
                throw("Really, what were you expecting it to return?");
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
        const varName = node.ident.lexeme;
        // FIXME: now all variables are double
        this.setGlobalTypeForSymbol(varName, binaryen.f64);
        return this.module.global.set(varName, this.module.f64.const(0));
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
        const varType = this.getGlobalTypeForSymbol(varName);

        const init = this.module.global.set(varName, this.generateExpression(node.start));

        const statements = this.generateStatements(node.body);
        const condition = this.module.f64.ge(this.generateExpression(node.end), this.module.global.get(varName, varType));
        const step = this.module.global.set(varName, this.module.f64.add(this.module.global.get(varName, varType), this.generateExpression(node.step)));
        statements.push(step);
        statements.push(this.module.br((++this.label).toString()));
        return this.module.block(null, [init, this.module.loop(this.label.toString(), this.module.if(condition, this.module.block(null, statements)))]);
    }
}
