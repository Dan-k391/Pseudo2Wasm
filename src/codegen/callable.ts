import binaryen from "binaryen";
import { Environment } from "../import";
import { RuntimeError } from "../error";
import { _Symbol } from "./symbol";
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
import { Param } from "./param";

import { convertToBasicType, convertToWasmType, unreachable } from "../util";
import { Local } from "./local";
import { 
    Type,
    typeKind} from "../type/type";
import { basicKind } from "../type/basic";
import { RecordType } from "../type/record";
import { ArrayType } from "../type/array";
import { BasicType } from "../type/basic";
import { Generator } from "./generator";

// TODO: maybe new a common file to contain these
type Module = binaryen.Module;
type FunctionRef = binaryen.FunctionRef;
type ExpressionRef = binaryen.ExpressionRef;
type WasmType = binaryen.Type;

/**
 * The parameters are passed in by webassembly function parameters
 * At the function start organize every argument onto the stack
 * 
 * Kind of follows the same pattern as assembly calls which store
 * the arguments in registers and call the function
 * 
 * However, webassembly local variables are not used
 * stack operations are performed to access them
 */
export abstract class Callable {
    // use protected
    constructor(protected module: binaryen.Module,
        protected enclosing: Generator,
        protected ident: string, 
        // public params
        public params: Map<string, Param>,
        protected locals: Map<string, Local> = new Map<string, Local>(),
        protected offset: number = 0,
        protected label: number = 0,
        // returnIndex is the index of the current local index that can be used
        // just like registers lol
        // specifically used for recording the return 
        // initializes as paramNumber
        protected returnIndex: number = params.size) { }
    
    public abstract generate(): void;

    protected prologue(): ExpressionRef {
        return this.module.block("__callablePrologue", [
            this.module.i32.store(0, 1, 
                this.module.global.get("__stackTop", binaryen.i32),
                this.module.global.get("__stackBase", binaryen.i32),
                "0"
            ),
            this.enclosing.incrementStackTop(4),
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
    protected epilogue(): ExpressionRef {
        return this.module.block("__callableEpilogue", [
            this.module.global.set(
                "__stackTop",
                this.module.global.get("__stackBase", binaryen.i32)
            ),
            this.enclosing.decrementStackTop(4),
            this.module.global.set(
                "__stackBase",
                this.module.i32.load(0, 1, 
                    this.module.global.get("__stackTop", binaryen.i32), "0"
                )
            )
        ]);
    }
    
    // Currently use protected for all methods
    // TODO: switch to return ExpressionRef
    protected getOffset(type: Type): number {
        const old = this.offset;
        this.offset += type.size();
        return old;
    }

    protected setLocal(name: string, type: Type) {
        const offset = this.getOffset(type);
        this.locals.set(name, new Local(type, offset));
    }

    public getLocalType(name: string): Type {
        if (!this.locals.has(name)) {
            throw new RuntimeError("Unknown variable '" + name + "'");
        }
        // have to use non-null assertion here
        return this.locals.get(name)!.type;
    }

    public getLocalWasmType(name: string): WasmType {
        if (!this.locals.has(name)) {
            throw new RuntimeError("Unknown variable '" + name + "'");
        }
        // have to use non-null assertion here
        return this.locals.get(name)!.type.wasmType();
    }

    public getLocalOffset(name: string): number {
        if (!this.locals.has(name)) {
            throw new RuntimeError("Unknown variable '" + name + "'");
        }
        // have to use non-null assertion here
        return this.locals.get(name)!.offset;
    }

    protected calculateAbsolutePointer(offset: ExpressionRef): ExpressionRef {
        return this.module.i32.add(
            this.module.global.get("__stackBase", binaryen.i32),
            offset
        );
    }

    // load a local with basic type to the absolute offset
    protected loadLocal(type: Type, ptr: ExpressionRef): ExpressionRef {
        if (type.kind !== typeKind.BASIC) {
            throw new RuntimeError("not implemented"); 
        }
        switch (type.type) {
            case basicKind.INTEGER:
            case basicKind.CHAR:
            case basicKind.BOOLEAN:
            case basicKind.STRING:
                return this.module.i32.load(0, 1, 
                    this.calculateAbsolutePointer(ptr), "0");
            case basicKind.REAL:
                return this.module.f64.load(0, 1, 
                    this.calculateAbsolutePointer(ptr), "0");
        }
        unreachable();
    }

    // load a local with basic type to the absolute offset
    protected storeLocal(type: Type, ptr: ExpressionRef, value: ExpressionRef): ExpressionRef {
        if (type.kind !== typeKind.BASIC) {
            throw new RuntimeError("not implemented"); 
        }
        switch (type.type) {
            case basicKind.INTEGER:
            case basicKind.CHAR:
            case basicKind.BOOLEAN:
            case basicKind.STRING:
                return this.module.i32.store(0, 1, 
                    this.calculateAbsolutePointer(ptr), value, "0");
            case basicKind.REAL:
                return this.module.f64.store(0, 1, 
                    this.calculateAbsolutePointer(ptr), value, "0");
        }
        unreachable();
    }

    // useless for now
    // protected pushStackBase(): ExpressionRef {
    //     return this.module.block(null, [
    //         this.module.i32.store(0, 1, 
    //             this.module.global.get("__stackTop", binaryen.i32),
    //             this.module.global.get("__stackBase", binaryen.i32)
    //         ),
    //         this.enclosing.incrementStackTop(
    //             this.enclosing.generateConstant(binaryen.i32, 4)
    //         )
    //     ]);
    // }

    // pops the last stackBase to stackBase
    // protected popStackBase(): ExpressionRef {
    //     return this.module.block(null, [
    //         this.enclosing.decrementStackTop(
    //             this.enclosing.generateConstant(binaryen.i32, 4)
    //         ),
    //         this.module.i32.store(0, 1, 
    //             this.module.global.get("__stackBase", binaryen.i32),
    //             this.module.i32.load(0, 1, 
    //                 this.module.global.get("__stackTop", binaryen.i32)
    //             ),
    //         )
    //     ])
    // }

    protected initParams(): ExpressionRef {
        const statements = new Array<ExpressionRef>();
        let totalSize = 0;
        for (const [key, value] of this.params) {
            this.setLocal(key, value.type);
            if (value.type.kind !== typeKind.BASIC) {
                throw new RuntimeError("not implemented");
            }
            totalSize += value.type.size();
            const offset = this.getLocalOffset(key);
            const basicType = value.type;
            const wasmType = value.type.wasmType();
            statements.push(this.storeLocal(
                basicType,
                this.enclosing.generateConstant(binaryen.i32, offset),
                this.module.local.get(value.index, wasmType)
            ));
        }
        // grow the stack at the total param size
        statements.push(this.enclosing.incrementStackTop(totalSize));
        return this.module.block("__paramInit", statements);
    }

    protected generateExpression(expression: Expr): ExpressionRef {
        switch (expression.kind) {
            case nodeKind.CastExprNode:
                return this.castExpression(expression);
            case nodeKind.AssignNode:
                return this.assignExpression(expression);
            case nodeKind.VarExprNode:
                return this.loadVarExpression(expression);
            case nodeKind.IndexExprNode:
                return this.loadIndexExpression(expression);
            case nodeKind.SelectExprNode:
                return this.selectExpression(expression);
            case nodeKind.CallFuncExprNode:
                return this.callFunctionExpression(expression);
            case nodeKind.CallProcExprNode:
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

    protected castExpression(node: CastExprNode): ExpressionRef {
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

    protected assignExpression(node: AssignNode): ExpressionRef {
        const value = this.generateExpression(node.right);
        const ptr = this.generateAddr(node.left);
        return this.enclosing.store(node.left.type, ptr, value);
    }

    protected loadVarExpression(node: VarExprNode): ExpressionRef {
        const ptr = this.varExpression(node);
        return this.enclosing.load(node.type, ptr);
    }

    // return the absolute pointer
    protected varExpression(node: VarExprNode): ExpressionRef {
        const varName = node.ident.lexeme;
        if (this.locals.has(varName)) {
            const offset = this.getLocalOffset(varName);
            return this.calculateAbsolutePointer(this.enclosing.generateConstant(binaryen.i32, offset));
        }
        return this.enclosing.varExpression(node);
    }

    protected loadIndexExpression(node: IndexExprNode): ExpressionRef {
        const ptr = this.indexExpression(node);
        return this.enclosing.load(node.type, ptr);
    }

    // obtain the pointer of the value but not setting or loading it
    protected indexExpression(node: IndexExprNode): ExpressionRef {
        // check whether the expr exists and whether it is an ARRAY
        const rValType = node.expr.type;
        if (rValType.kind !== typeKind.ARRAY) {
            throw new RuntimeError("Cannot perfrom 'index' operation to non ARRAY types");
        }
        const elemType = node.type;
        // if it comes to here possibilities such as 1[1] are prevented
        // the base ptr(head) of the array
        const base = this.generateAddr(node.expr);
        // if the numbers of dimensions do not match
        if (node.indexes.length != rValType.dimensions.length) {
            throw new RuntimeError("The index dimension numbers do not match for " + rValType.toString());
        }
        // flaten index expressions
        let index = this.enclosing.generateConstant(binaryen.i32, 0);
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
                        this.enclosing.generateConstant(binaryen.i32, rValType.dimensions[i].lower.literal)
                    ),
                    this.enclosing.generateConstant(binaryen.i32, section)
                )
            )
        }
        return this.module.i32.add(
            base,
            this.module.i32.mul(
                index,
                this.enclosing.generateConstant(binaryen.i32, elemType.size())
            )
        );
    }

    // TODO: do it
    protected selectExpression(node: SelectExprNode): ExpressionRef {
        const rVal = node.type;
        if (rVal.kind !== typeKind.RECORD) {
            throw new RuntimeError("Cannot perfrom 'select' operation to non RECORD types");
        }
        // if it comes to here possibilities such as 1[1] are prevented
        const expr = this.generateExpression(node.expr);
        return this.module.i32.add(expr, this.enclosing.generateConstant(binaryen.i32, rVal.offset(node.ident.lexeme)));
    }

    protected callFunctionExpression(node: CallFuncExprNode): ExpressionRef {
        if (node.callee.kind === nodeKind.VarExprNode) {
            const funcName = node.callee.ident.lexeme;
            const funcArgs = new Array<ExpressionRef>();

            for (let i = 0; i < node.args.length; i++) {
                const arg = node.args[i];
                funcArgs.push(this.generateExpression(arg));
            }
            const returnType = this.enclosing.getFunction(funcName).wasmReturnType;
            return this.module.call(funcName, funcArgs, returnType);
        }
        // FIXME: The complicated call possibilities are not supported (calling a complex expression)
        throw new RuntimeError("Not implemented yet");
    }

    protected callProcedureExpression(node: CallProcExprNode): ExpressionRef {
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

    protected unaryExpression(node: UnaryExprNode): ExpressionRef {
        const type = node.type;
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
            }
        }
        // otherwise i32
        switch (node.operator.type) {
            case tokenType.PLUS:
                return this.generateExpression(node.expr);
            case tokenType.MINUS:
                return this.module.i32.sub(this.module.i32.const(0), this.generateExpression(node.expr));
        }
        throw new RuntimeError("Not implemented yet");
    }

    protected binaryExpression(node: BinaryExprNode): ExpressionRef {        
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

    protected generateBlock(statements: Array<Stmt>): ExpressionRef {
        return this.module.block(null, this.generateStatements(statements));
    }

    protected generateStatements(statements: Array<Stmt>): Array<ExpressionRef> {
        const stmts = new Array<binaryen.ExpressionRef>();
        for (const statement of statements) {
            stmts.push(this.generateStatement(statement));
        }
        return stmts;
    }

    protected generateStatement(statement: Stmt): ExpressionRef {
        switch (statement.kind) {
            case nodeKind.ExprStmtNode:
                return this.generateExpression(statement.expr);
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

    protected outputStatement(node: OutputNode): ExpressionRef {
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

    protected varDeclStatement(node: VarDeclNode): ExpressionRef {
        const varName = node.ident.lexeme;
        // FIXME: only basic types supported
        const varType = node.type;
        this.setLocal(varName, varType);
        return this.enclosing.incrementStackTop(varType.size());
    }

    protected arrDeclStatement(node: ArrDeclNode): ExpressionRef {
        const arrName = node.ident.lexeme;
        // FIXME: only basic types supported
        const elemType = node.type;
        // pointer to head
        const arrType = new ArrayType(elemType, node.dimensions);
        this.setLocal(arrName, arrType);
        // FIXME: set to init pointer
        return this.enclosing.incrementStackTop(arrType.size());
    }

    protected ifStatement(node: IfNode): ExpressionRef {
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

    protected whileStatement(node: WhileNode): ExpressionRef {
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

    protected repeatStatement(node: RepeatNode): ExpressionRef {
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

    protected forStatement(node: ForNode): ExpressionRef {
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
        const varOffset = this.calculateAbsolutePointer(
            this.enclosing.generateConstant(binaryen.i32, this.getLocalOffset(varName))
        );
        
        const initExpr = this.generateExpression(node.start);

        const init = this.module.i32.store(0, 1, varOffset, initExpr, "0");

        const statements = this.generateStatements(node.body);
        const variable = this.module.i32.load(0, 1, varOffset, "0");
    
        const condition = this.module.i32.ge_s(this.generateExpression(node.end), variable);
        const step = this.module.i32.store(0, 1,
            varOffset,
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
