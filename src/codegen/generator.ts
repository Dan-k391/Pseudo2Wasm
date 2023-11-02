// TODO: improve the fking code in generator (statements, expressions, etc.)
// One very important thing here is to probably pass the scopes in checker
// to the generator. This way the code can be cleaned up

import binaryen from "binaryen";
import { Environment } from "../import";
import { RuntimeError } from "../error";
import { tokenType } from "../lex/token";
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
import { ParamNode } from "../syntax/param";

import { Function, DefinedFunction } from "./function";
import { Procedure } from "./procedure";
import { convertToBasicType, convertToWasmType, unreachable } from "../util";
import { Global } from "./global";
import { Local } from "./local";
import { 
    Type,
    typeKind} from "../type/type";
import { basicKind } from "../type/basic";
import { PointerType } from "../type/pointer";
import { RecordType } from "../type/record";
import { ArrayType } from "../type/array";
import { BasicType } from "../type/basic";
import { commonBasicType } from "../type/type";
import { String } from "./string";
import { LengthFunction } from "./builtin";
import { Param } from "./param";

// TODO: maybe new a common file to contain these
type Module = binaryen.Module;
type FunctionRef = binaryen.FunctionRef;
type ExpressionRef = binaryen.ExpressionRef;
type WasmType = binaryen.Type;


export class Generator {
    private ast: ProgramNode;
    private module: binaryen.Module;
    private functions: Map<string, Function>;
    private procedures: Map<string, Procedure>;
    private globals: Map<string, Global>;
    private types: Map<string, Type>;
    // the global offset(where the stack starts from)
    private offset: number;
    private size: number;
    private label: number;
    public strings: Array<String>;

    constructor(ast: ProgramNode) {
        this.ast = ast;
        this.module = new binaryen.Module();

        this.functions = new Map<string, Function>();
        this.procedures = new Map<string, Procedure>();
        // all variables in the body are global variables
        this.globals = new Map<string, Global>();
        this.types = new Map<string, Type>();

        // memory
        this.size = 65536;
        this.offset = 0;

        // all the strings are set together so record them
        this.strings = new Array<String>();
        
        this.label = 0;
    }

    public generate(): Module {
        // createType although it is useless
        this.module.addFunctionImport("logInteger", "env", "logInteger", binaryen.createType([binaryen.i32]), binaryen.none);
        this.module.addFunctionImport("logReal", "env", "logReal", binaryen.createType([binaryen.f64]), binaryen.none);
        this.module.addFunctionImport("logChar", "env", "logChar", binaryen.createType([binaryen.i32]), binaryen.none);
        this.module.addFunctionImport("logString", "env", "logString", binaryen.createType([binaryen.i32]), binaryen.none);

        // The stack grows upwards
        // stacktop
        this.module.addGlobal("__stackTop", binaryen.i32, true, this.generateConstant(binaryen.i32, 0));
        // stackbase
        this.module.addGlobal("__stackBase", binaryen.i32, true, this.generateConstant(binaryen.i32, 0));

        this.generateBuiltins();
        this.module.setStart(this.generateBody(this.ast.body));
        // this.generateBody(this.ast.body);

        const encoder = new TextEncoder();
        this.module.setMemory(0, 65536, null, 
            this.strings.map(str => ({
                offset: str.offset,
                data: encoder.encode(str.value + '\0'),
                passive: false
            })), 
        false);

        this.module.addMemoryImport("0", "env", "buffer");
        return this.module;
    }

    public generateBuiltins() {
        this.setFunction("LENGTH", new LengthFunction(this.module, this));
        this.getFunction("LENGTH").generate();
    }

    // basically, all the constant value which are generated are numbers, either i32 or f64
    public generateConstant(type: WasmType, value: number): ExpressionRef {
        if (type === binaryen.i32) {
            return this.module.i32.const(value);
        }
        else if (type === binaryen.f64) {
            return this.module.f64.const(value);
        }
        throw new RuntimeError("Unknown type '" + type + "'");
    }

    public incrementStackBase(value: number): ExpressionRef {
        return this.module.global.set(
            "__stackBase", 
            this.module.i32.add(
                this.module.global.get("__stackBase", binaryen.i32),
                this.generateConstant(binaryen.i32, value)
            )
        );
    }

    public incrementStackTop(value: number): ExpressionRef {
        return this.module.global.set(
            "__stackTop", 
            this.module.i32.add(
                this.module.global.get("__stackTop", binaryen.i32),
                this.generateConstant(binaryen.i32, value)
            )
        );
    }

    public decrementStackBase(value: number): ExpressionRef {
        return this.module.global.set(
            "__stackBase", 
            this.module.i32.sub(
                this.module.global.get("__stackBase", binaryen.i32),
                this.generateConstant(binaryen.i32, value)
            )
        );
    }

    public decrementStackTop(value: number): ExpressionRef {
        return this.module.global.set(
            "__stackTop", 
            this.module.i32.sub(
                this.module.global.get("__stackTop", binaryen.i32),
                this.generateConstant(binaryen.i32, value)
            )
        );
    }

    // public push(value: ExpressionRef, size: number): ExpressionRef {
    //     return this.module.block(null, [
    //         this.module.i32.store(0, 1, 
    //             this.module.global.get("__stackTop", binaryen.i32),
    //             value
    //         ),
    //         this.incrementStackTop(this.generateConstant(binaryen.i32, size))
    //     ]);
    // }

    // there is no place to return the popped value so don't use this for now
    // public pop(): ExpressionRef {
    //     return this.module.block(null, [
    //         this.module.i32.load(0, 1, 
    //             this.module.global.get("__stackTop", binaryen.i32),
    //         ),
    //         this.incrementStackTop(this.generateConstant(binaryen.i32, 4))
    //     ]);
    // }

    public getOffset(type: Type): number {
        const old = this.offset;
        this.offset += type.size();
        return old;
    }

    public setGlobal(name: string, type: Type): void {
        const offset = this.getOffset(type);
        this.globals.set(name, new Global(type, offset));
    }

    public getGlobalType(name: string): Type {
        if (!this.globals.has(name)) {
            throw new RuntimeError("Unknown variable '" + name + "'");
        }
        // have to use non-null assertion here
        return this.globals.get(name)!.type;
    }

    public getGlobalWasmType(name: string): WasmType {
        if (!this.globals.has(name)) {
            throw new RuntimeError("Unknown variable '" + name + "'");
        }
        // have to use non-null assertion here
        return this.globals.get(name)!.type.wasmType();
    }

    // TODO: maybe change to return ExpressionRef
    public getGlobalOffset(name: string): number {
        if (!this.globals.has(name)) {
            throw new RuntimeError("Unknown variable '" + name + "'");
        }
        // have to use non-null assertion here
        return this.globals.get(name)!.offset;
    }

    public getFunction(name: string): Function {
        if (!this.functions.has(name)) {
            throw new RuntimeError("FUNCTION '" + name + "' is not declared");
        }
        return this.functions.get(name)!;
    }

    public setFunction(name: string, func: Function): void {
        if (this.functions.has(name)) {
            throw new RuntimeError("FUNCTION '" + name + "' is already declared");
        }
        this.functions.set(name, func);
    }
    
    public getProcedure(name: string): Procedure {
        if (!this.procedures.has(name)) {
            throw new RuntimeError("PROCEDURE '" + name + "' is not declared");
        }
        return this.procedures.get(name)!;
    }

    public setProcedure(name: string, proc: Procedure): void {
        if (this.procedures.has(name)) {
            throw new RuntimeError("PROCEDURE '" + name + "' is already declared");
        }
        this.procedures.set(name, proc);
    }

    public setType(name: string, type: Type): void {
        if (this.types.has(name)) {
            throw new RuntimeError("TYPE '" + name + "' is already declared");
        }
        this.types.set(name, type);
    }

    public getType(name: string): Type {
        if (!this.types.has(name)) {
            throw new RuntimeError("TYPE '" + name + "' is not declared");
        }
        return this.types.get(name)!;
    }

    public load(type: Type, ptr: ExpressionRef): ExpressionRef {
        if (type.kind !== typeKind.BASIC) {
            throw new RuntimeError("not implemented"); 
        }
        switch (type.type) {
            case basicKind.INTEGER:
            case basicKind.CHAR:
            case basicKind.BOOLEAN:
            case basicKind.STRING:
                return this.module.i32.load(0, 1, ptr, "0");
            case basicKind.REAL:
                return this.module.f64.load(0, 1, ptr, "0");
        }
        unreachable();
    }

    public store(type: Type, ptr: ExpressionRef, value: ExpressionRef): ExpressionRef {
        if (type.kind !== typeKind.BASIC) {
            throw new RuntimeError("not implemented"); 
        }
        switch (type.type) {
            case basicKind.INTEGER:
            case basicKind.CHAR:
            case basicKind.BOOLEAN:
            case basicKind.STRING:
                return this.module.i32.store(0, 1, ptr, value, "0");
            case basicKind.REAL:
                return this.module.f64.store(0, 1, ptr, value, "0");
        }
        unreachable();
    }

    // private generateMainFunction(statements: Array<Stmt>): void {
    //     // prevent overlapping of variables
    //     const block = this.generateBlock(statements);
    //     const vars = new Array<WasmType>();

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

        const mainFunciton = this.module.addFunction("__main", binaryen.none, binaryen.none, new Array<WasmType>(), block);
        this.module.addFunctionExport("__main", "main");
        return mainFunciton;
    }

    private generateFunctionDefinition(node: FuncDefNode): void {
        const funcName = node.ident.lexeme;
        const funcParams = new Map<string, Param>();

        let index = 0;
        for (const param of node.params) {
            const paramName = param.ident.lexeme;
            // FIXME: only basic types supported
            const paramType = param.type;
            // nethermind the method to set
            funcParams.set(paramName, new Param(paramType, index));
            index++;
        }

        const func = new DefinedFunction(
            this.module,
            this,
            funcName,
            funcParams,
            node.type,
            node.type.wasmType(),
            node.body
        );

        this.setFunction(funcName, func);
        this.getFunction(funcName).generate();
    }

    private generateProcedureDefinition(node: ProcDefNode): void {
        const procName = node.ident.lexeme;
        const procParams = new Map<string, Param>();

        let index = 0;
        for (const param of node.params) {
            const paramName = param.ident.lexeme;
            // FIXME: only basic types supported
            const paramType = param.type;
            procParams.set(paramName, new Param(paramType, index));
            index++;
        }
        const proc = new Procedure(this.module, this, procName, procParams, node.body);

        this.setProcedure(procName, proc);
        this.getProcedure(procName).generate();
    }

    // Expressions
    // specifically right values
    private generateExpression(expression: Expr): ExpressionRef {
        switch (expression.kind) {
            case nodeKind.CastExprNode:
                return this.castExpression(expression);
            case nodeKind.AssignNode:
                return this.assignExpression(expression);
            case nodeKind.VarExprNode:
                return this.load(expression.type, this.varExpression(expression));
            case nodeKind.IndexExprNode:
                return this.load(expression.type, this.indexExpression(expression));
            case nodeKind.SelectExprNode:
                return this.load(expression.type, this.selectExpression(expression));
            case nodeKind.CallFuncExprNode:
                return this.callFunctionExpression(expression);
            case nodeKind.CallProcExprNode:
                return this.callProcedureExpression(expression);
            case nodeKind.UnaryExprNode:
                return this.unaryExpression(expression);
            case nodeKind.BinaryExprNode:
                return this.binaryExpression(expression);
            case nodeKind.IntegerExprNode:
                return this.integerExpression(expression);
            case nodeKind.RealExprNode:
                return this.realExpression(expression);
            case nodeKind.CharExprNode:
                return this.charExpression(expression);
            case nodeKind.StringExprNode:
                return this.stringExpression(expression);
            default:
                throw new RuntimeError("Not implemented yet");
        }
    }

    private generateAddr(expression: Expr): ExpressionRef {
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

    public castExpression(node: CastExprNode): ExpressionRef {
        const expr = this.generateExpression(node.expr);
        if (node.type.kind !== typeKind.BASIC || node.expr.type.kind !== typeKind.BASIC) {
            throw new RuntimeError("Type cast can onlybe perfromed for basic types");
        }
        const to = node.type.type;
        const from = node.expr.type.type;
        // type compatability is already checked in checker
        if (to === basicKind.REAL) {
            if (from === basicKind.REAL) {
                return expr;
            }
            return this.module.f64.convert_s.i32(expr);
        }
        if (from === basicKind.REAL) {
            return this.module.i32.trunc_s.f64(expr);
        }
        return expr;
    }

    public assignExpression(node: AssignNode): ExpressionRef {
        const value = this.generateExpression(node.right);
        const ptr = this.generateAddr(node.left);
        // the type of assign node is the type of it's left node
        return this.store(node.type, ptr, value);
    }

    // returns the pointer(offset) of the variable
    public varExpression(node: VarExprNode): ExpressionRef {
        const varName = node.ident.lexeme;
        const offset = this.getGlobalOffset(varName);
        return this.generateConstant(binaryen.i32, offset);
    }

    // obtain the pointer of the value but not setting or loading it
    public indexExpression(node: IndexExprNode): ExpressionRef {
        // check whether the expr exists and whether it is an ARRAY
        const rValType = node.expr.type;
        if (rValType.kind !== typeKind.ARRAY) {
            throw new RuntimeError("Cannot perfrom 'index' operation to none ARRAY types");
        }
        const elemType = node.type;
        // the base ptr(head) of the array
        const base = this.generateAddr(node.expr);
        // if the numbers of dimensions do not match
        if (node.indexes.length != rValType.dimensions.length) {
            throw new RuntimeError("The index dimension numbers do not match for " + rValType.toString());
        }
        // flaten index expressions
        let index = this.generateConstant(binaryen.i32, 0);
        for (let i = 0; i < rValType.dimensions.length; i++) {
            // the section index
            let section = 1;
            for (let j = i + 1; j < rValType.dimensions.length; j++) {
                // section is static, basically represents the size of one section
                // For example: i = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
                // i[2, 1]
                // for 2, section is 3
                // for 1, section is 1

                // add 1 because Pseudocode ARRAYs include upper and lower bound
                section *= rValType.dimensions[j].upper.literal - rValType.dimensions[j].lower.literal + 1;
            }
            index = this.module.i32.add(
                index,
                // and then multiple the index to the section
                this.module.i32.mul(
                    this.module.i32.sub(
                        this.generateExpression(node.indexes[i]),
                        this.generateConstant(binaryen.i32, rValType.dimensions[i].lower.literal)
                    ),
                    this.generateConstant(binaryen.i32, section)
                )
            )
        }
        return this.module.i32.add(
            base,
            this.module.i32.mul(
                index,
                this.generateConstant(binaryen.i32, elemType.size())
            )
        );
    }

    public selectExpression(node: SelectExprNode): ExpressionRef {
        const rVal = node.expr.type;
        if (rVal.kind !== typeKind.RECORD) {
            throw new RuntimeError("Cannot perfrom 'select' operation to non RECORD types");
        }
        const expr = this.generateAddr(node.expr);
        return this.module.i32.add(expr, this.generateConstant(binaryen.i32, rVal.offset(node.ident.lexeme)));
    }

    private callFunctionExpression(node: CallFuncExprNode): ExpressionRef {
        if (node.callee.kind === nodeKind.VarExprNode) {
            const funcName = node.callee.ident.lexeme;
            const funcArgs = new Array<ExpressionRef>();

            for (let i = 0; i < node.args.length; i++) {
                const arg = node.args[i];
                funcArgs.push(this.generateExpression(arg));
            }
            const returnType = this.getFunction(funcName).wasmReturnType;
            return this.module.call(funcName, funcArgs, returnType);
        }
        // FIXME: The complicated call possibilities are not supported (calling a complex expression)
        throw new RuntimeError("Not implemented yet");
    }

    private callProcedureExpression(node: CallProcExprNode): ExpressionRef {
        if (node.callee.kind === nodeKind.VarExprNode) {
            const procName = node.callee.ident.lexeme;
            const procArgs = new Array<ExpressionRef>();

            for (let i = 0; i < node.args.length; i++) {
                const arg = node.args[i];
                procArgs.push(this.generateExpression(arg));
            }
            return this.module.call(procName, procArgs, binaryen.none);
        }
        // FIXME: The complicated call possibilities are not supported (calling a complex expression)
        throw new RuntimeError("Not implemented yet");
    }

    private unaryExpression(node: UnaryExprNode): ExpressionRef {
        const type = node.type;
        if (type.kind !== typeKind.BASIC) {
            throw new RuntimeError("Unary operations can only be performed on basic types");
        }
        // currently keep these 2 switch cases
        // TODO: optimize later
        if (type.type === basicKind.REAL) {
            switch (node.operator.type) {
                case tokenType.PLUS:
                    return this.generateExpression(node.expr);
                case tokenType.MINUS:
                    return this.module.f64.neg(this.generateExpression(node.expr));
            }
        }
        switch (node.operator.type) {
            case tokenType.PLUS:
                return this.generateExpression(node.expr);
            case tokenType.MINUS:
                return this.module.i32.sub(this.module.i32.const(0), this.generateExpression(node.expr));
        }
        throw new RuntimeError("Not implemented yet");

    }

    // judge the expression type then perform the conversion and operation
    private binaryExpression(node: BinaryExprNode): ExpressionRef {
        const type = node.type;      
        if (type.kind !== typeKind.BASIC) {
            throw new RuntimeError("Binary operations can only be performed on basic types");
        }

        let leftExpr = this.generateExpression(node.left);
        let rightExpr = this.generateExpression(node.right);
        // if the type is REAL, convert the INTEGER to REAL
        if (type.type === basicKind.REAL) {
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
        }
        throw new RuntimeError("Not implemented yet");
        // TODO: STRING
    }

    public integerExpression(node: IntegerExprNode): ExpressionRef {
        return this.module.i32.const(node.value);
    }

    public realExpression(node: RealExprNode): ExpressionRef {
        return this.module.f64.const(node.value);
    }

    public charExpression(node: CharExprNode): ExpressionRef {
        return this.module.i32.const(node.value.charCodeAt(0));
    }

    // use null-terminated strings
    public stringExpression(node: StringExprNode): ExpressionRef {
        const stringIndex = this.offset;
        this.offset += node.value.length + 1;
        // add this string to strings with type interface String Lol
        this.strings.push({offset: this.generateConstant(binaryen.i32, stringIndex), value: node.value});
        return this.module.i32.const(stringIndex);
    }

    // Statements
    private generateBlock(statements: Array<Stmt>): ExpressionRef {
        return this.module.block(null, this.generateStatements(statements));
    }

    private generateStatements(statements: Array<Stmt>): Array<ExpressionRef> {
        const stmts = new Array<ExpressionRef>();
        for (const statement of statements) {
            if (statement.kind === nodeKind.FuncDefNode) {
                this.generateFunctionDefinition(statement);
            }
            else if (statement.kind === nodeKind.ProcDefNode) {
                this.generateProcedureDefinition(statement);
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
                return this.generateExpression(statement.expr);
            case nodeKind.ReturnNode:
                throw new RuntimeError("Really? What were you expecting it to return?");
            case nodeKind.OutputNode:
                return this.outputStatement(statement);
            case nodeKind.VarDeclNode:
                return this.varDeclStatement(statement);
            case nodeKind.ArrDeclNode:
                return this.arrDeclStatement(statement);
            case nodeKind.TypeDeclNode:
                return this.typeDeclStatement(statement);
            case nodeKind.PtrDeclNode:
                return this.pointerDeclStatement(statement);
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
        const type = node.expr.type;
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
        const varType = node.type;
        this.setGlobal(varName, varType);
        // increment stacktop and stackbase
        return this.module.block(null, [
            this.incrementStackBase(varType.size()),
            this.incrementStackTop(varType.size())
        ]);
    }

    private arrDeclStatement(node: ArrDeclNode): ExpressionRef {
        const arrName = node.ident.lexeme;
        const elemType = node.type;
        const arrType = new ArrayType(elemType, node.dimensions);
        this.setGlobal(arrName, arrType);
        // FIXME: set to init pointer
        return this.module.block(null, [
            this.incrementStackBase(arrType.size()),
            this.incrementStackTop(arrType.size())
        ]);
    }

    private typeDeclStatement(node: TypeDeclNode): ExpressionRef {
        this.setType(node.ident.lexeme, node.type);
        // just a placeholder for ExpressionRef
        // TODO: maybe remove later
        return this.module.block(null, []);
    }

    private pointerDeclStatement(node: PtrDeclNode): ExpressionRef {
        const varName = node.ident.lexeme;
        // FIXME: only basic types supported
        const baseType = node.type;
        const ptrType = new PointerType(baseType);
        this.setGlobal(varName, ptrType)
        return this.module.block(null, [
            this.incrementStackBase(ptrType.size()),
            this.incrementStackTop(ptrType.size())
        ]);
    }

    private ifStatement(node: IfNode): ExpressionRef {
        if (node.elseBody) {
            return this.module.if(
                this.generateExpression(node.condition),
                this.generateBlock(node.body),
                this.generateBlock(node.elseBody)
            ); 
        }
        else {
            return this.module.if(
                this.generateExpression(node.condition),
                this.generateBlock(node.body)
            );
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
        return this.module.loop(
            this.label.toString(),
            this.module.if(
                condition,
                this.module.block(null, statements)
            )
        );
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
        statements.push(
            this.module.if(
                this.module.i32.eqz(condition),
                this.module.br((++this.label).toString())
            )
        );
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
        const varOffset = this.getGlobalOffset(varName);

        const initExpr = this.generateExpression(node.start);

        // basically, in the for loop, there is first an assignment followed by a comparison, and then a step
        // fuck it, just do not use the load function
        const init = this.module.i32.store(0, 1, this.generateConstant(binaryen.i32, varOffset), initExpr, "0");

        const statements = this.generateStatements(node.body);
        const variable = this.module.i32.load(0, 1, this.generateConstant(binaryen.i32, varOffset), "0");

        const condition = this.module.i32.ge_s(this.generateExpression(node.end), variable);
        const step = this.module.i32.store(0, 1,
            this.generateConstant(binaryen.i32, varOffset),
            this.module.i32.add(
                variable,
                this.generateExpression(node.step)
            ), "0"
        );

        statements.push(step);
        statements.push(this.module.br((++this.label).toString()));
        return this.module.block(null, [
            init,
            this.module.loop(
                this.label.toString(),
                this.module.if(condition, this.module.block(null, statements))
            )
        ]);
    }
}
