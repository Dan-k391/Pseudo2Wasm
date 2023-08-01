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
    PointerDeclNode,
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
import { Procedure } from "./procedure";
import { convertToVarType, convertToWasmType } from "../util";
import { GlobalTable } from "./global";
import { LocalTable } from "./local";


// TODO: maybe new a common file to contain these
type Module = binaryen.Module;
type FunctionRef = binaryen.FunctionRef;
type ExpressionRef = binaryen.ExpressionRef;
type Type = binaryen.Type;

export class Generator {
    private ast: ProgramNode;
    private module: binaryen.Module;
    private functions: Map<string, Function>;
    private procedures: Map<string, Procedure>;
    private globals: GlobalTable;
    private offset: number;
    private size: number;
    private label: number;

    constructor(ast: ProgramNode) {
        this.ast = ast;
        this.module = new binaryen.Module();

        this.functions = new Map<string, Function>();
        this.procedures = new Map<string, Procedure>();
        // all variables in the body are global variables
        this.globals = new GlobalTable();

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
        for (const name of this.globals.names) {
            const wasmType = this.globals.getWasmType(name);
            this.module.addGlobal(name, wasmType, true, this.generateConstant(wasmType, 0));
        }

        return this.module;
    }

    // basically, all the constant value which are generated are numbers, either i32 or f64
    private generateConstant(type: Type, value: number): ExpressionRef {
        if (type === binaryen.i32) {
            return this.module.i32.const(value);
        }
        else if (type === binaryen.f64) {
            return this.module.f64.const(value);
        }
        throw new RuntimeError("Unknown type '" + type + "'");
    }

    public getFunction(name: string): Function {
        if (!this.functions.has(name)) {
            throw new RuntimeError("Function '" + name + "' is not declared");
        }
        return this.functions.get(name) as Function;
    }

    public setFunction(name: string, func: Function): void {
        if (!this.functions.has(name)) {
            this.functions.set(name, func);
        }
    }
    
    public getProcedure(name: string): Procedure {
        if (!this.procedures.has(name)) {
            throw new RuntimeError("Procedure '" + name + "' is not declared");
        }
        return this.procedures.get(name) as Procedure;
    }

    public setProcedure(name: string, proc: Procedure): void {
        if (!this.procedures.has(name)) {
            this.procedures.set(name, proc);
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
        const funcParams = new LocalTable();

        let index = 0;
        for (const param of node.params) {
            const paramName = param.ident.lexeme;
            const paramType = convertToVarType(param.type);
            const wasmType = convertToWasmType(param.type);
            // nethermind the method to set
            funcParams.set(paramName, paramType, wasmType, index);
            index++;
        }

        const func = new Function(this.module, this, funcName, funcParams, convertToWasmType(node.type), node.body);

        this.setFunction(funcName, func);
        this.getFunction(funcName).generate();
    }

    private generateProcedureDefinition(node: ProcDefNode): void {
        const procName = node.ident.lexeme;
        const procParams = new LocalTable();

        let index = 0;
        for (const param of node.params) {
            const paramName = param.ident.lexeme;
            const paramType = convertToVarType(param.type);
            const wasmType = convertToWasmType(param.type);
            procParams.set(paramName, paramType, wasmType, index);
            index++;
        }
        const proc = new Procedure(this.module, this, procName, procParams, node.body);

        this.setProcedure(procName, proc);
        this.getProcedure(procName).generate();
    }

    // Expressions
    protected generateExpression(expression: Expr): ExpressionRef {
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
                return this.numberExpression(expression as NumberExprNode);
            case nodeKind.CharExprNode:
                return this.charExpression(expression as CharExprNode);
            // case nodeKind.StringExprNode:
            //     return this.stringExpression(expression as StringExprNode);
            default:
                return -1;
        }
    }

    public varAssignExpression(node: VarAssignNode): ExpressionRef {
        const varName = node.ident.lexeme;
        const wasmType = this.globals.getWasmType(varName);
        const rhs = this.generateExpression(node.expr);
        if (wasmType === binaryen.i32) {
            return this.module.global.set(varName, this.module.i32.trunc_s.f64(rhs));
        }
        return this.module.global.set(varName, rhs);
    }

    public varExpression(node: VarExprNode): ExpressionRef {
        const varName = node.ident.lexeme;
        const wasmType = this.globals.getWasmType(varName);
        const variable = this.module.global.get(varName, wasmType);
        // if the type is i32, convert it to f64
        if (wasmType === binaryen.i32) {
            return this.module.f64.convert_s.i32(variable);
        }
        // otherwise the type is f64
        return variable;
    }

    private callFunctionExpression(node: CallFunctionExprNode): ExpressionRef {
        if (node.callee.kind === nodeKind.VarExprNode) {
            const funcName = (node.callee as VarExprNode).ident.lexeme;
            const funcArgs = new Array<ExpressionRef>();
            const func = this.getFunction(funcName);
            if (func.params.size() !== node.args.length) {
                throw new RuntimeError("Function '" + funcName + "' expects " + func.params.size + " arguments, but " + node.args.length + " are provided");
            }
            for (let i = 0, paramNames = func.params.names; i < node.args.length; i++) {
                const arg = node.args[i];
                const expr = this.generateExpression(arg);
                const wasmType = func.params.getWasmType(paramNames[i]);
                if (wasmType === binaryen.i32) {
                    funcArgs.push(this.module.i32.trunc_s.f64(expr));
                }
                else {
                    funcArgs.push(expr);
                }
            }
            const returnType = this.getFunction(funcName).returnType;
            if (returnType === binaryen.i32) {
                return this.module.f64.convert_s.i32(this.module.call(funcName, funcArgs, binaryen.f64));
            }
            return this.module.call(funcName, funcArgs, returnType);
        }
        // FIXME: The complicated call possibilities are not supported (calling a complex expression)
        return -1;
    }

    private callProcedureExpression(node: CallProcedureExprNode): ExpressionRef {
        if (node.callee.kind === nodeKind.VarExprNode) {
            const procName = (node.callee as VarExprNode).ident.lexeme;
            const procArgs = new Array<ExpressionRef>();
            const proc = this.getProcedure(procName);
            if (proc.params.size() !== node.args.length) {
                throw new RuntimeError("Procedure '" + procName + "' expects " + proc.params.size + " arguments, but " + node.args.length + " are provided");
            }

            for (let i = 0, paramNames = proc.params.names; i < node.args.length; i++) {
                const arg = node.args[i];
                const expr = this.generateExpression(arg);
                const wasmType = proc.params.getWasmType(paramNames[i]);
                if (wasmType === binaryen.i32) {
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

    // all the binary expressions are f64, the teo sides are converted to f64 and if needed, converted back to i32
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

    // all numbers are initialized as f64, they are converted to i32 if needed
    public numberExpression(node: NumberExprNode): ExpressionRef {
        return this.module.f64.const(node.value);
    }

    public charExpression(node: CharExprNode): ExpressionRef {
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
            else if (statement.kind == nodeKind.ProcDefNode) {
                this.generateProcedureDefinition(statement as ProcDefNode);
            }
            else {
                stmts.push(this.generateStatement(statement));
            }
        }
        return stmts;
    }

    protected generateStatement(statement: Stmt): ExpressionRef {
        switch (statement.kind) {
            case nodeKind.ExprStmtNode:
                return this.generateExpression((statement as ExprStmtNode).expr);
            case nodeKind.ReturnNode:
                throw new RuntimeError("Really? What were you expecting it to return?");
            case nodeKind.OutputNode:
                return this.outputStatement(statement as OutputNode);
            case nodeKind.VarDeclNode:
                return this.varDeclStatement(statement as VarDeclNode);
            case nodeKind.PointerDeclNode:
                return this.pointerDeclStatement(statement as PointerDeclNode);
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
        const varType = convertToVarType(node.type);
        const wasmType = convertToWasmType(node.type);
        this.globals.set(varName, varType, wasmType);
        return this.module.global.set(varName, this.generateConstant(wasmType, 0));
    }

    private pointerDeclStatement(node: PointerDeclNode): ExpressionRef {
        const varName = node.ident.lexeme;
        const varType = convertToVarType(node.type);
        const wasmType = convertToWasmType(node.type);
        this.globals.set(varName, varType, wasmType);
        return this.module.global.set(varName, this.generateConstant(wasmType, 0));
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
        const wasmType = this.globals.getWasmType(varName);

        const initExpr = this.generateExpression(node.start);

        // basically, in the for loop, there is first an assignment followed by a comparison, and then a step
        let init: ExpressionRef;
        if (wasmType === binaryen.i32) {
            init = this.module.global.set(varName, this.module.i32.trunc_s.f64(initExpr));
        }
        else {
            init = this.module.global.set(varName, initExpr);
        }

        const statements = this.generateStatements(node.body);
        const variable = this.module.global.get(varName, wasmType);

        let condition: ExpressionRef;

        if (wasmType === binaryen.i32) {
            condition = this.module.f64.ge(this.generateExpression(node.end), this.module.f64.convert_s.i32(variable));
        }
        else {
            condition = this.module.f64.ge(this.generateExpression(node.end), variable);
        }

        let step: ExpressionRef;
        if (wasmType === binaryen.i32) {
            // two ways here that can be used
            // 1. add the step to the variable as f64 and then convert it to an i32
            // 2. convert the expression into an i32 and then add it to the variable
            // although in the whole program generator everything is converted into f64 and then back to i32
            // both of them work so I use the second one because it's shorter
            step = this.module.global.set(varName, this.module.i32.add(variable, this.module.i32.trunc_s.f64(this.generateExpression(node.step))));
        }
        else {
            step = this.module.global.set(varName, this.module.f64.add(variable, this.generateExpression(node.step)));
        }

        statements.push(step);
        statements.push(this.module.br((++this.label).toString()));
        return this.module.block(null, [init, this.module.loop(this.label.toString(), this.module.if(condition, this.module.block(null, statements)))]);
    }
}
