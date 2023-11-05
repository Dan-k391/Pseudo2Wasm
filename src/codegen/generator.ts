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

import { unreachable } from "../util";
import { Global } from "./global";
import { Local } from "./local";
import { 
    Type,
    typeKind
} from "../type/type";
import { basicKind } from "../type/basic";
import { PointerType } from "../type/pointer";
import { RecordType } from "../type/record";
import { ArrayType } from "../type/array";
import { BasicType } from "../type/basic";
import { commonBasicType } from "../type/type";
import { String } from "./string";
import { LengthFunction } from "./builtin";
import { Param } from "./param";
import { Symbol, symbolKind } from "../type/symbol";
import { Scope } from "../type/scope";

// TODO: maybe new a common file to contain these
type Module = binaryen.Module;
type FunctionRef = binaryen.FunctionRef;
type ExpressionRef = binaryen.ExpressionRef;
type WasmType = binaryen.Type;


export class Generator {
    private ast: ProgramNode;
    private module: binaryen.Module;
    private global: Scope;
    private curScope: Scope;
    // the global offset (where the stack starts from)
    private globalOffset: number;
    // the local offset (relative to the stackbase)
    // set to 0 when entering a new scope
    private localOffset: number;
    private size: number;
    private label: number;
    public strings: Array<String>;

    constructor(ast: ProgramNode) {
        this.ast = ast;
        this.module = new binaryen.Module();

        // all variables in the body are global variables
        this.global = this.ast.global;
        this.curScope = this.global;

        // memory
        this.size = 65536;
        this.globalOffset = 0;
        this.localOffset = 0; 

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
            })), false
        );

        this.module.addMemoryImport("0", "env", "buffer");
        return this.module;
    }

    public generateBuiltins(): void {
        new LengthFunction(this.module).generate();
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

    public enterScope(scope: Scope): void {
        this.curScope = scope;
        this.localOffset = 0;
    }

    public leaveScope(): void {
        // FIXME: check whether the scope is the global scope
        this.curScope = this.curScope.parent!;
        this.localOffset = 0;
    }

    public getGlobalOffset(type: Type): number {
        const old = this.globalOffset;
        this.globalOffset += type.size();
        return old;
    }

    public getLocalOffset(type: Type): number {
        const old = this.localOffset;
        this.localOffset += type.size();
        return old;
    }

    public setPointer(name: string, type: Type): void {
        const kind = this.curScope.lookUp(name).kind;
        // pointer of global variables: offset
        if (kind === symbolKind.GLOBAL) {
            const offset = this.getGlobalOffset(type);
            this.curScope.setPointer(
                name,
                this.generateConstant(binaryen.i32, offset)
            );
        }
        // pointer of local variables: stackbase + offset
        else {
            const offset = this.getLocalOffset(type);
            this.curScope.setPointer(
                name,
                this.module.i32.add(
                    this.module.global.get("__stackBase", binaryen.i32),
                    this.generateConstant(binaryen.i32, offset)
                )
            );
        }
    }

    public getPointer(name: string): ExpressionRef {
        return this.curScope.lookUp(name).pointer;
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

    protected callablePrologue(): ExpressionRef {
        return this.module.block("__callablePrologue", [
            this.module.i32.store(0, 1, 
                this.module.global.get("__stackTop", binaryen.i32),
                this.module.global.get("__stackBase", binaryen.i32),
                "0"
            ),
            this.incrementStackTop(4),
            this.module.global.set(
                "__stackBase",
                this.module.global.get("__stackTop", binaryen.i32)
            )
        ]);
    }

    // a very confusing concept here is that the stack starts from lower address to higher address
    // it grows uppwards
    // therefore, the pop a operation can be transformsed into 2 operations
    // sub rsp, 4
    // load b, rsp
    // At first subtract the stacktop and then load
    protected callableEpilogue(): ExpressionRef {
        return this.module.block("__callableEpilogue", [
            this.module.global.set(
                "__stackTop",
                this.module.global.get("__stackBase", binaryen.i32)
            ),
            this.decrementStackTop(4),
            this.module.global.set(
                "__stackBase",
                this.module.i32.load(0, 1, 
                    this.module.global.get("__stackTop", binaryen.i32), "0"
                )
            )
        ]);
    }

    // for callables
    private initParams(params: Array<ParamNode>): ExpressionRef {
        const statements = new Array<ExpressionRef>();
        let totalSize = 0;
        let index = 0;
        for (const param of params) {
            const paramName = param.ident.lexeme;
            const paramType = param.type;
            this.setPointer(paramName, paramType);
            if (paramType.kind !== typeKind.BASIC) {
                throw new RuntimeError("not implemented");
            }
            totalSize += paramType.size();
            const ptr = this.getPointer(paramName);
            const wasmType = paramType.wasmType();
            statements.push(this.store(
                paramType,
                ptr,
                this.module.local.get(index, wasmType)
            ));
            index++;
        }
        // grow the stack at the total param size
        statements.push(this.incrementStackTop(totalSize));
        return this.module.block("__paramInit", statements);
    }

    private generateFunctionDefinition(node: FuncDefNode): void {
        this.enterScope(node.local);

        const funcName = node.ident.lexeme;
        const paramWasmTypes = new Array<WasmType>();

        for (const value of node.params) {
            paramWasmTypes.push(value.type.wasmType());
        }

        const paramType = binaryen.createType(paramWasmTypes);

        const funcBody = [
            this.callablePrologue(),
            this.initParams(node.params),
            ...this.generateStatements(node.body),
            this.callableEpilogue(),
        ];

        // FIXME: single returnType has problem here
        // the only local variable: the return value variable
        this.module.addFunction(
            funcName,
            paramType,
            node.type.wasmType(),
            [node.type.wasmType()],
            this.module.block(null, funcBody)
        );
        this.leaveScope();
    }

    private generateProcedureDefinition(node: ProcDefNode): void {
        this.enterScope(node.local);
        const procName = node.ident.lexeme;
        const paramWasmTypes = new Array<WasmType>();

        for (const value of node.params) {
            paramWasmTypes.push(value.type.wasmType());
        }

        const paramType = binaryen.createType(paramWasmTypes);

        const procBody = [
            this.callablePrologue(),
            this.initParams(node.params),
            ...this.generateStatements(node.body),
            this.callableEpilogue(),
        ];

        // empty local variable array
        this.module.addFunction(
            procName,
            paramType,
            binaryen.none,
            [],
            this.module.block(null, procBody)
        );
        this.leaveScope();
    }

    // Expressions
    // specifically right values
    public generateExpression(expression: Expr): ExpressionRef {
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
        return this.getPointer(varName);
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
            const returnType = node.type.wasmType();
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
    // strings are stored in the global memory section
    public stringExpression(node: StringExprNode): ExpressionRef {
        const stringIndex = this.globalOffset;
        this.globalOffset += node.value.length + 1;
        // add this string to strings with type interface String Lol
        this.strings.push({offset: this.generateConstant(binaryen.i32, stringIndex), value: node.value});
        return this.module.i32.const(stringIndex);
    }

    // Statements
    private generateBlock(statements: Array<Stmt>): ExpressionRef {
        return this.module.block(null, this.generateStatements(statements));
    }

    public generateStatements(statements: Array<Stmt>): Array<ExpressionRef> {
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

    public generateStatement(statement: Stmt): ExpressionRef {
        switch (statement.kind) {
            case nodeKind.ExprStmtNode:
                return this.generateExpression(statement.expr);
            case nodeKind.ReturnNode:
                // return validation is done in checker
                return this.returnStatement(statement);
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

    private returnStatement(node: ReturnNode): ExpressionRef {
        const returnVal = this.generateExpression(node.expr);
        return this.module.block(null, [
            this.module.local.set(
                // definitely exists
                this.curScope.returnIndex!,
                returnVal
            ),
            this.module.global.set(
                "__stackTop",
                this.module.global.get("__stackBase", binaryen.i32)
            ),
            this.decrementStackTop(4),
            this.module.global.set(
                "__stackBase",
                this.module.i32.load(0, 1, 
                    this.module.global.get("__stackTop", binaryen.i32), "0"
                )
            ),
            this.module.return(
                this.module.local.get(
                    this.curScope.returnIndex!,
                    node.expr.type.wasmType()
                )
            )
        ]);
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
        this.setPointer(varName, varType);
        // increment stacktop and stackbase if the variable is global
        const kind = this.curScope.lookUp(varName).kind;
        if (kind === symbolKind.GLOBAL) {
            return this.module.block(null, [
                this.incrementStackBase(varType.size()),
                this.incrementStackTop(varType.size())
            ]);
        }
        else {
            return this.module.block(null, [
                this.incrementStackTop(varType.size())
            ]);
        }
    }

    private arrDeclStatement(node: ArrDeclNode): ExpressionRef {
        const arrName = node.ident.lexeme;
        const arrType = node.type;
        this.setPointer(arrName, arrType);
        // FIXME: set to init pointer
        const kind = this.curScope.lookUp(arrName).kind;
        if (kind === symbolKind.GLOBAL) {
            return this.module.block(null, [
                this.incrementStackBase(arrType.size()),
                this.incrementStackTop(arrType.size())
            ]);
        }
        else {
            return this.module.block(null, [
                this.incrementStackTop(arrType.size())
            ]);
        }
    }

    private typeDeclStatement(node: TypeDeclNode): ExpressionRef {
        // just a placeholder for ExpressionRef
        // TODO: maybe remove later
        return this.module.block(null, []);
    }

    private pointerDeclStatement(node: PtrDeclNode): ExpressionRef {
        const varName = node.ident.lexeme;
        // FIXME: only basic types supported
        const baseType = node.type;
        const ptrType = new PointerType(baseType);
        this.setPointer(varName, ptrType)
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
        const ptr = this.getPointer(varName);

        const initExpr = this.generateExpression(node.start);

        // basically, in the for loop, there is first an assignment followed by a comparison, and then a step
        // fuck it, just do not use the load function
        const init = this.module.i32.store(0, 1, ptr, initExpr, "0");

        const statements = this.generateStatements(node.body);
        const variable = this.module.i32.load(0, 1, ptr, "0");

        const condition = this.module.i32.ge_s(this.generateExpression(node.end), variable);
        const step = this.module.i32.store(0, 1, ptr,
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
