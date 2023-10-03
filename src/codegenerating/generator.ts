// TODO: improve the fking code in generator (statements, expressions, etc.)

import binaryen from "binaryen";
import { Environment } from "../import";
import { RuntimeError } from "../error";
// TODO: Optimise the _Symbol class
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
    PointerDeclNode,
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

import { Function, DefinedFunction } from "./function";
import { Procedure } from "./procedure";
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
import { String } from "./string";
import { LengthFunction } from "./builtin";

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
    private globals: GlobalTable;
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
        this.globals = new GlobalTable();

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

        this.generateBuiltins();
        this.module.setStart(this.generateBody(this.ast.body));
        // this.generateBody(this.ast.body);

        // initialize the globals
        for (const name of this.globals.names) {
            const wasmType = this.globals.getWasmType(name);
            this.module.addGlobal(name, wasmType, true, this.generateConstant(wasmType, 0));
        }

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

    public getOffset(type: Type): ExpressionRef {
        console.log(this.offset);
        const old = this.offset;
        this.offset += type.size();
        return old;
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
    //     const vars = new Array<WasmType>();

    //     for (const symbol of this.symbols.values()) {
    //         vars.push(symbol.type);
    //     }

    //     this.module.addFunction("main", binaryen.none, binaryen.none, vars, block);
    //     this.module.addFunctionExport("main", "main");
    // }

    public convertBasicType(currentBasic: basicKind, targetBasic: basicKind, expression: ExpressionRef): ExpressionRef {
        // stupid way to convert
        switch (currentBasic) {
            case basicKind.INTEGER:
                // no need to convert for INTEGER, CHAR and BOOLEAN
                if (targetBasic == basicKind.INTEGER ||
                    targetBasic == basicKind.CHAR ||
                    targetBasic == basicKind.BOOLEAN) {
                    return expression;
                }
                else if (targetBasic == basicKind.REAL) {
                    return this.module.f64.convert_s.i32(expression);
                }
                throw new RuntimeError("Cannot convert " + currentBasic + " to " + targetBasic);
            case basicKind.REAL:
                if (targetBasic == basicKind.INTEGER) {
                    return this.module.i32.trunc_s.f64(expression);
                }
                else if (targetBasic == basicKind.REAL) {
                    return expression;
                }
                throw new RuntimeError("Cannot convert " + currentBasic + " to " + targetBasic);
            case basicKind.CHAR:
                if (targetBasic == basicKind.INTEGER ||
                    targetBasic == basicKind.CHAR ||
                    targetBasic == basicKind.BOOLEAN) {
                    return expression;
                }
                throw new RuntimeError("Cannot convert " + currentBasic + " to " + targetBasic);
            case basicKind.STRING:
                if (targetBasic == basicKind.STRING) {
                    return expression;
                }
                throw new RuntimeError("Cannot convert " + currentBasic + " to " + targetBasic);
            case basicKind.BOOLEAN:
                if (targetBasic == basicKind.INTEGER ||
                    targetBasic == basicKind.CHAR ||
                    targetBasic == basicKind.BOOLEAN) {
                    return expression;
                }
                throw new RuntimeError("Cannot convert " + currentBasic + " to " + targetBasic);
            default:
                return expression;
        }
    }

    // private convertArrayType(currentArray: ArrayType, target: Type, expression: ExpressionRef): ExpressionRef {
    //     // if the target is a not array type, throw an error
    //     if (target.kind !== typeKind.ARRAY) {
    //         throw new RuntimeError("Cannot convert" + currentArray + "to" + target);
    //     }
    // }

    // private convertRecordType(currentRecord: RecordType, target: Type, expression: ExpressionRef): ExpressionRef {
    //     if (target.kind !== typeKind.RECORD) {
    //         throw new RuntimeError("Cannot convert" + currentRecord + "to" + target);
    //     }
    //     // FIXME: Currently only identical records can convert
    //     const targetRecord: RecordType = (target as RecordType);
    //     if (targetRecord.fields.size !== currentRecord.fields.size) {
    //         throw new RuntimeError("Cannot convert" + currentRecord + "to" + targetRecord);
    //     }
    //     for (const [key, val] of currentRecord.fields) {
    //         if ()
    //     }
    // }

    public convertType(current: Type, target: Type, expression: ExpressionRef): ExpressionRef {
        if (target.kind !== current.kind) {
            throw new RuntimeError("Cannot convert" + current + "to" + target);
        }

        switch (current.kind) {
            case typeKind.BASIC:
                // FIXME: get rid of this 'target as BasicType'
                return this.convertBasicType(current.type, (target as BasicType).type, expression);
            // case typeKind.ARRAY:
            //     return this.convertArrayType(current as ArrayType, target, expression);
            // case typeKind.RECORD:
            //     return this.convertRecordType(current as RecordType, target, expression);
            default:
                return expression;
        }
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

    public resolveVarExprNodeType(node: VarExprNode): Type {
        return this.globals.getType(node.ident.lexeme);
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
            return this.getFunction(funcName).returnType;
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
        const funcParams = new LocalTable();

        let index = 0;
        for (const param of node.params) {
            const paramName = param.ident.lexeme;
            // FIXME: only basic types supported
            const paramType = convertToBasicType(param.type);
            const wasmType = convertToWasmType(param.type);
            // nethermind the method to set
            funcParams.set(paramName, paramType, wasmType, index);
            index++;
        }

        const func = new DefinedFunction(
            this.module,
            this,
            funcName,
            funcParams,
            convertToBasicType(node.type),
            convertToWasmType(node.type),
            node.body
        );

        this.setFunction(funcName, func);
        this.getFunction(funcName).generate();
    }

    private generateProcedureDefinition(node: ProcDefNode): void {
        const procName = node.ident.lexeme;
        const procParams = new LocalTable();

        let index = 0;
        for (const param of node.params) {
            const paramName = param.ident.lexeme;
            // FIXME: only basic types supported
            const paramType = convertToBasicType(param.type);
            const wasmType = convertToWasmType(param.type);
            procParams.set(paramName, paramType, wasmType, index);
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

    public assignExpression(node: AssignNode): ExpressionRef {
        // FIXME: resolve left value
        // Guess what? VarExpr has to be a special case
        // Because this is wasm!
        if (node.left.kind === nodeKind.VarExprNode) {
            const varName = node.left.ident.lexeme;
            const varType = this.globals.getType(varName);
            const rhs = this.generateExpression(node.right);
            const rightType = this.resolveType(node.right);
            return this.module.global.set(varName, this.convertType(rightType, varType, rhs));   
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
                return this.module.i32.store(0, 1, ptr, this.convertBasicType(rightBasicType, leftBasicType, rhs), "0");
            case basicKind.REAL:
                return this.module.f64.store(0, 1, ptr, this.convertBasicType(rightBasicType, leftBasicType, rhs), "0");
        }
        throw new RuntimeError("Not implemented yet");
    }

    public varExpression(node: VarExprNode): ExpressionRef {
        const varName = node.ident.lexeme;
        const wasmType = this.globals.getWasmType(varName);
        const variable = this.module.global.get(varName, wasmType);
        return variable;
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
        const rValType = this.resolveType(node.expr);
        if (rValType.kind !== typeKind.ARRAY) {
            throw new RuntimeError("Cannot perfrom 'index' operation to none ARRAY types");
        }
        const elemType = this.resolveType(node);
        // if it comes to here possibilities such as 1[1] are prevented
        // the base ptr(head) of the array
        const base = this.generateExpression(node.expr);
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
        // check whether the expr exists and whether it is an ARRAY
        const rVal = this.resolveType(node.expr);
        if (rVal.kind !== typeKind.RECORD) {
            throw new RuntimeError("Cannot perfrom 'select' operation to none RECORD types");
        }
        // if it comes to here possibilities such as 1[1] are prevented
        const expr = this.generateExpression(node.expr);
        return this.module.i32.add(expr, this.generateConstant(binaryen.i32, rVal.offset(node.ident.lexeme)));
    }

    private callFunctionExpression(node: CallFunctionExprNode): ExpressionRef {
        if (node.callee.kind === nodeKind.VarExprNode) {
            const funcName = node.callee.ident.lexeme;
            const funcArgs = new Array<ExpressionRef>();
            const func = this.getFunction(funcName);
            if (func.params.size() !== node.args.length) {
                throw new RuntimeError("Function '" + funcName + "' expects " + func.params.size + " arguments, but " + node.args.length + " are provided");
            }
            for (let i = 0, paramNames = func.params.names; i < node.args.length; i++) {
                const arg = node.args[i];
                const expr = this.generateExpression(arg);
                const argType = this.resolveType(arg);
                const paramType = func.params.getType(paramNames[i]);
                funcArgs.push(this.convertType(argType, paramType, expr));
            }
            const returnType = this.getFunction(funcName).wasmReturnType;
            return this.module.call(funcName, funcArgs, returnType);
        }
        // FIXME: The complicated call possibilities are not supported (calling a complex expression)
        throw new RuntimeError("Not implemented yet");
    }

    private callProcedureExpression(node: CallProcedureExprNode): ExpressionRef {
        if (node.callee.kind === nodeKind.VarExprNode) {
            const procName = node.callee.ident.lexeme;
            const procArgs = new Array<ExpressionRef>();
            const proc = this.getProcedure(procName);
            if (proc.params.size() !== node.args.length) {
                throw new RuntimeError("Procedure '" + procName + "' expects " + proc.params.size + " arguments, but " + node.args.length + " are provided");
            }

            for (let i = 0, paramNames = proc.params.names; i < node.args.length; i++) {
                const arg = node.args[i];
                const expr = this.generateExpression(arg);
                const argType = this.resolveType(arg);
                const paramType = proc.params.getType(paramNames[i]);
                procArgs.push(this.convertType(argType, paramType, expr));
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

    // judge the expression type then perform the conversion and operation
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
                leftExpr = this.convertBasicType(leftBasicType, basicType, leftExpr);
            }
            else if (rightBasicType == basicKind.INTEGER) {
                rightExpr = this.convertBasicType(rightBasicType, basicType, rightExpr);
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
            if (statement.kind == nodeKind.FuncDefNode) {
                this.generateFunctionDefinition(statement);
            }
            else if (statement.kind == nodeKind.ProcDefNode) {
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
            case nodeKind.PointerDeclNode:
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
        this.globals.set(varName, varType, wasmType);
        return this.module.global.set(varName, this.generateConstant(wasmType, 0));
    }

    private arrDeclStatement(node: ArrDeclNode): ExpressionRef {
        const arrName = node.ident.lexeme;
        // FIXME: only basic types supported
        const elemType = convertToBasicType(node.type);
        // pointer to head
        const wasmType = binaryen.i32;
        const arrType = new ArrayType(elemType, node.dimensions);
        this.globals.set(arrName, arrType, wasmType);
        // FIXME: set to init pointer
        return this.module.global.set(arrName, this.generateConstant(wasmType, this.getOffset(arrType)));
    }

    private pointerDeclStatement(node: PointerDeclNode): ExpressionRef {
        const varName = node.ident.lexeme;
        // FIXME: only basic types supported
        const varType = convertToBasicType(node.type);
        const wasmType = convertToWasmType(node.type);
        this.globals.set(varName, varType, wasmType);
        return this.module.global.set(varName, this.generateConstant(wasmType, 0));
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
        const varType = this.globals.getType(varName);
        const endType = this.resolveType(node.end);
        const stepType = this.resolveType(node.step);
        const wasmType = this.globals.getWasmType(varName);
        
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

        // basically, in the for loop, there is first an assignment followed by a comparison, and then a step
        const init = this.module.global.set(varName, initExpr);

        const statements = this.generateStatements(node.body);
        const variable = this.module.global.get(varName, wasmType);

        const condition = this.module.i32.ge_s(this.generateExpression(node.end), variable);
        const step = this.module.global.set(
            varName,
            this.module.i32.add(
                variable,
                this.generateExpression(node.step)
            )
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
