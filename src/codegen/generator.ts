import binaryen from "binaryen";
import { RuntimeError } from "../error";
import { tokenType } from "../lex/token";
import {
    nodeKind,

    Expr,
    Stmt,
    ProgramNode,
    ReturnNode,
    DeclNode,
    PtrDeclNode,
    TypeDeclNode,
    AssignNode,
    IfNode,
    WhileNode,
    RepeatNode,
    ForNode,
    CaseNode,
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
import { ParamNode, passType } from "../syntax/param";

import { 
    Type,
    typeKind
} from "../type/type";
import { basicKind } from "../type/basic";
import { String } from "./string";
import { 
    Length,
    UCase,
    LCase,
} from "./std/builtin";
import { symbolKind } from "../type/symbol";
import { Scope } from "../type/scope";
import { GLOBAL_DATA_START, HEAP_START, MEMORY_END, MEMORY_PAGES, STACK_START } from "../memory-layout";
import { FunctionContext } from "./function-context";
import { analyzeParameterReads, CallableNode, ParameterReads } from "./parameter-reads";

// TODO: maybe new a common file to contain these
type Module = binaryen.Module;
type FunctionRef = binaryen.FunctionRef;
type ExpressionRef = binaryen.ExpressionRef;
type WasmType = binaryen.Type;


export class Generator {
    private readonly stackStart: number = STACK_START;

    private ast: ProgramNode;
    private module: binaryen.Module;
    private global: Scope;
    private curScope: Scope;
    // Fixed global, stack, and input-string regions; see MEMORY_MODEL.md.
    // the global offset
    private globalOffset: number;
    // the local offset (relative to the stackbase)
    // set to 0 when entering a new scope
    private localOffset: number;
    private label: number;
    private context = new FunctionContext();
    private readonly parameterReads: ReadonlyMap<CallableNode, ParameterReads>;
    public strings: Array<String>;

    private get checkValueLocal(): number { return this.context.checkValueLocal; }
    private get checkPointerLocal(): number { return this.context.checkPointerLocal; }

    constructor(ast: ProgramNode) {
        this.ast = ast;
        this.parameterReads = analyzeParameterReads(ast);
        this.module = new binaryen.Module();

        // all variables in the body are global variables
        this.global = this.ast.global;
        this.curScope = this.global;

        this.globalOffset = GLOBAL_DATA_START;
        this.localOffset = 0;

        // all the strings are set together so record them
        this.strings = new Array<String>();
        
        this.label = 0;
    }

    public generate(): Module {
        // JSPI now uses WebAssembly.Suspending/promising at the host boundary;
        // recent Binaryen versions no longer provide a "jspi" transform pass.
        this.module.setFeatures(binaryen.Features.ReferenceTypes | binaryen.Features.BulkMemory |
            binaryen.Features.BulkMemoryOpt);
        // createType although it is useless
        this.module.addFunctionImport("logInteger", "env", "logInteger", binaryen.createType([binaryen.i32]), binaryen.none);
        this.module.addFunctionImport("logReal", "env", "logReal", binaryen.createType([binaryen.f64]), binaryen.none);
        this.module.addFunctionImport("logChar", "env", "logChar", binaryen.createType([binaryen.i32]), binaryen.none);
        this.module.addFunctionImport("logString", "env", "logString", binaryen.createType([binaryen.i32]), binaryen.none);
        this.module.addFunctionImport("logBoolean", "env", "logBoolean", binaryen.createType([binaryen.i32]), binaryen.none);
        this.module.addFunctionImport("inputInteger", "env", "inputInteger", binaryen.createType([]), binaryen.i32);
        this.module.addFunctionImport("inputReal", "env", "inputReal", binaryen.createType([]), binaryen.f64);
        this.module.addFunctionImport("inputChar", "env", "inputChar", binaryen.createType([]), binaryen.i32);
        this.module.addFunctionImport("inputString", "env", "inputString",
            binaryen.createType([binaryen.i32, binaryen.i32]), binaryen.i32);
        this.module.addFunctionImport("inputBoolean", "env", "inputBoolean", binaryen.createType([]), binaryen.i32);
        this.module.addFunctionImport("RAND", "env", "randomInteger", binaryen.createType([binaryen.i32]), binaryen.i32);
        this.module.addFunctionImport("STARTTIME", "env", "startTime", binaryen.createType([]), binaryen.none);
        this.module.addFunctionImport("ENDTIME", "env", "endTime", binaryen.createType([]), binaryen.none);
        this.module.addFunctionImport("failIndex", "env", "failIndex", binaryen.createType([
            binaryen.i32, binaryen.i32, binaryen.i32, binaryen.i32, binaryen.i32
        ]), binaryen.none);
        this.module.addFunctionImport("failPointer", "env", "failPointer", binaryen.createType([
            binaryen.i32, binaryen.i32, binaryen.i32, binaryen.i32
        ]), binaryen.none);
        this.module.addFunctionImport("failStack", "env", "failStack",
            binaryen.createType([binaryen.i32, binaryen.i32, binaryen.i32]), binaryen.none);

        // The stack grows upwards
        // stacktop starts at the stack region's lower boundary.
        this.module.addGlobal("__stackTop", binaryen.i32, true, this.generateConstant(binaryen.i32, this.stackStart));
        // stackbase starts at the stack region's lower boundary.
        this.module.addGlobal("__stackBase", binaryen.i32, true, this.generateConstant(binaryen.i32, this.stackStart));
        // CASE selectors are captured once before testing ordered branches.
        this.module.addGlobal("__caseI32", binaryen.i32, true, this.module.i32.const(0));
        this.module.addGlobal("__caseF64", binaryen.f64, true, this.module.f64.const(0));

        this.generateBuiltins();
        // this.module.setStart(this.generateBody(this.ast.body));
        this.generateBody(this.ast.body);

        const encoder = new TextEncoder();
        // the first and second number stand for memory page numbers
        this.module.setMemory(0, MEMORY_PAGES, null,
            this.strings.map(str => ({
                offset: str.ptr,
                data: encoder.encode(str.value + '\0'),
                passive: false
            })), false
        );

        this.module.addMemoryImport("0", "env", "buffer");
        // Keep only helpers/imports reachable from exported entry points. This
        // cheap reachability pass does not rewrite arithmetic or runtime checks.
        this.module.runPasses(["remove-unused-module-elements"]);
        return this.module;
    }

    public generateBuiltins(): void {
        new Length(this.module).generate();
        new UCase(this.module).generate();
        new LCase(this.module).generate();
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

    public incrementStackTop(value: number, line = 0, column = 0): ExpressionRef {
        return this.module.global.set(
            "__stackTop", 
            this.checkedStackTop(this.module.i32.add(
                this.module.global.get("__stackTop", binaryen.i32),
                this.generateConstant(binaryen.i32, value)
            ), line, column)
        );
    }

    private checkedStackTop(next: ExpressionRef, line: number, column: number): ExpressionRef {
        const current = () => this.module.local.get(this.checkValueLocal, binaryen.i32);
        return this.module.block(null, [
            this.module.local.set(this.checkValueLocal, next),
            this.module.if(this.module.i32.gt_u(current(), this.module.i32.const(HEAP_START)),
                this.module.call("failStack", [current(), this.module.i32.const(line),
                    this.module.i32.const(column)], binaryen.none)),
            current()
        ], binaryen.i32);
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
        if (!Number.isSafeInteger(this.globalOffset) || this.globalOffset > STACK_START) {
            throw new RuntimeError(`Global data exceeds ${STACK_START} bytes of reserved space`);
        }
        return old;
    }

    public getLocalOffset(type: Type): number {
        const old = this.localOffset;
        this.localOffset += type.size();
        if (!Number.isSafeInteger(this.localOffset) || this.localOffset > HEAP_START - STACK_START) {
            throw new RuntimeError(`Local data exceeds ${HEAP_START - STACK_START} bytes of stack space`);
        }
        return old;
    }

    public setPointer(name: string, ptr: ExpressionRef): void {
        this.curScope.setPointer(name, ptr);
    }

    public addVar(name: string, type: Type): void {
        const kind = this.curScope.lookUp(name).kind;
        // pointer of global variables: offset
        if (kind === symbolKind.GLOBAL) {
            const offset = this.getGlobalOffset(type);
            this.setPointer(
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

    private readVariable(name: string, type: Type): ExpressionRef {
        const symbol = this.curScope.lookUp(name);
        const parameterIndex = this.context.parameterReads.get(symbol);
        return parameterIndex === undefined
            ? this.load(type, symbol.pointer)
            : this.module.local.get(parameterIndex, type.wasmType());
    }

    public load(type: Type, ptr: ExpressionRef): ExpressionRef {
        // load ARRAYs by ptr
        if (type.kind === typeKind.ARRAY) {
            return ptr;
        }
        if (type.size() === 4) {
            return this.module.i32.load(0, 1, ptr, "0");
        }
        else if (type.size() === 8) {
            return this.module.f64.load(0, 1, ptr, "0");
        }
        throw new RuntimeError("Unknown type '" + type.toString() + "'");
    }

    public store(type: Type, ptr: ExpressionRef, value: ExpressionRef): ExpressionRef {
        // store ARRAYs by ptr
        if (type.kind === typeKind.ARRAY) {
            // FIXME: load ARRAYs?
            return this.module.i32.store(0, 1, ptr, value, "0");
        }
        if (type.size() === 4) {
            return this.module.i32.store(0, 1, ptr, value, "0");
        }
        else if (type.size() === 8) {
            return this.module.f64.store(0, 1, ptr, value, "0");
        }
        throw new RuntimeError("Unknown type '" + type.toString() + "'");
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

        const mainFunction = this.module.addFunction("__main", binaryen.none, binaryen.none,
            this.context.localTypes, block);
        this.module.addFunctionExport("__main", "main");
        return mainFunction;
    }

    protected callablePrologue(line = 0, column = 0, frameSize = 0): ExpressionRef {
        return this.module.block("__callablePrologue", [
            // Check the saved-base slot and complete frame before either write.
            // checkedStackTop leaves the reserved end in checkValueLocal.
            this.module.drop(this.checkedStackTop(this.module.i32.add(
                    this.module.global.get("__stackTop", binaryen.i32),
                    this.generateConstant(binaryen.i32, 4 + frameSize)
                ), line, column)),
            this.module.i32.store(0, 1, 
                this.module.global.get("__stackTop", binaryen.i32),
                this.module.global.get("__stackBase", binaryen.i32),
                "0"
            ),
            this.module.global.set(
                "__stackBase",
                this.module.i32.add(this.module.global.get("__stackTop", binaryen.i32),
                    this.module.i32.const(4))
            ),
            this.module.global.set(
                "__stackTop", this.module.local.get(this.checkValueLocal, binaryen.i32)
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
        // Multiple RETURN paths emit this sequence; no branch targets its block.
        return this.module.block(null, [
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
        let index = 0;
        for (const param of params) {
            const paramName = param.ident.lexeme;
            const paramType = param.type;
            if (param.passType === passType.BYREF) {
                this.setPointer(paramName, this.module.local.get(index, binaryen.i32));
                index++;
                continue;
            }
            this.addVar(paramName, paramType);
            // Keep the spill even when reads use the Wasm parameter: frame
            // layout, exhaustion, and reused-memory contents remain compatible.
            const ptr = this.getPointer(paramName);
            const wasmType = paramType.wasmType();
            statements.push(this.store(
                paramType,
                ptr,
                this.module.local.get(index, wasmType)
            ));
            index++;
        }
        return this.module.block("__paramInit", statements);
    }

    private generateCallableDefinition(node: CallableNode): void {
        const previousContext = this.context;
        const previousScope = this.curScope;
        const previousOffset = this.localOffset;
        const resultType = node.kind === nodeKind.FuncDefNode ? node.type.wasmType() : binaryen.none;
        this.enterScope(node.local);
        this.context = new FunctionContext(node.params.length, resultType, this.parameterReads.get(node));
        try {
            const parameterTypes = node.params.map(param =>
                param.passType === passType.BYREF ? binaryen.i32 : param.type.wasmType());
            const body = [
                this.callablePrologue(node.ident.line, node.ident.startColumn + 1, node.local.size()),
                this.initParams(node.params),
                ...this.generateStatements(node.body),
                this.callableEpilogue(),
            ];
            this.module.addFunction(node.ident.lexeme, binaryen.createType(parameterTypes),
                resultType, this.context.localTypes, this.module.block(null, body));
        } finally {
            this.context = previousContext;
            this.curScope = previousScope;
            this.localOffset = previousOffset;
        }
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
                return this.readVariable(expression.ident.lexeme, expression.type);
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
            case nodeKind.DerefExprNode:
                return this.load(expression.type, this.generateAddr(expression));
            case nodeKind.AddrExprNode:
                return this.generateAddr(expression.lVal);
            case nodeKind.IntegerExprNode:
                return this.integerExpression(expression);
            case nodeKind.RealExprNode:
                return this.realExpression(expression);
            case nodeKind.CharExprNode:
                return this.charExpression(expression);
            case nodeKind.StringExprNode:
                return this.stringExpression(expression);
            case nodeKind.BoolExprNode:
                return this.boolExpression(expression);
            default:
                throw new Error("Internal compiler error: unknown expression reached Wasm lowering");
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
            case nodeKind.DerefExprNode:
                return this.checkedPointer(
                    this.generateExpression(expression.lVal), expression.type.size(),
                    expression.source?.line || 0, (expression.source?.startColumn ?? -1) + 1
                );
            default:
                throw new RuntimeError(expression.toString() + " cannot be a left value");
        }
    }

    public castExpression(node: CastExprNode): ExpressionRef {
        const expr = this.generateExpression(node.expr);
        if (node.type.kind !== typeKind.BASIC || node.expr.type.kind !== typeKind.BASIC) {
            throw new RuntimeError("Type cast can only be performed for basic types");
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
        if (node.type.kind === typeKind.ARRAY || node.type.kind === typeKind.RECORD) {
            return this.module.memory.copy(
                this.generateAddr(node.left), this.generateAddr(node.right),
                this.module.i32.const(node.type.size()), "0", "0");
        }
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

    private checkedPointer(ptr: ExpressionRef, size: number, line: number, column: number): ExpressionRef {
        const current = () => this.module.local.get(this.checkPointerLocal, binaryen.i32);
        const invalidSize = size < 1 || size > MEMORY_END - GLOBAL_DATA_START;
        return this.module.block(null, [
            this.module.local.set(this.checkPointerLocal, ptr),
            this.module.if(invalidSize ? this.module.i32.const(1) : this.module.i32.or(
                this.module.i32.lt_u(current(), this.module.i32.const(GLOBAL_DATA_START)),
                this.module.i32.gt_u(current(), this.module.i32.const(MEMORY_END - size))
            ), this.module.call("failPointer", [current(), this.module.i32.const(size),
                this.module.i32.const(line), this.module.i32.const(column)], binaryen.none)),
            current()
        ], binaryen.i32);
    }

    private checkedIndex(index: ExpressionRef, lower: number, upper: number,
        line: number, column: number): ExpressionRef {
        const current = () => this.module.local.get(this.checkValueLocal, binaryen.i32);
        return this.module.block(null, [
            this.module.local.set(this.checkValueLocal, index),
            this.module.if(this.module.i32.or(
                this.module.i32.lt_s(current(), this.module.i32.const(lower)),
                this.module.i32.gt_s(current(), this.module.i32.const(upper))
            ), this.module.call("failIndex", [current(), this.module.i32.const(lower),
                this.module.i32.const(upper), this.module.i32.const(line),
                this.module.i32.const(column)], binaryen.none)),
            this.module.i32.sub(current(), this.module.i32.const(lower))
        ], binaryen.i32);
    }

    // obtain the pointer of the value but not setting or loading it
    public indexExpression(node: IndexExprNode): ExpressionRef {
        // check whether the expr exists and whether it is an ARRAY
        const rValType = node.expr.type;
        // same for both ARRAY and POINTER
        if (rValType.kind === typeKind.ARRAY || rValType.kind === typeKind.POINTER) {
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
                    section *= rValType.dimensions[j].upper - rValType.dimensions[j].lower + 1;
                }
                const dimension = rValType.dimensions[i];
                const indexExpr = node.indexes[i];
                // A literal proven inside its dimension has no runtime failure path.
                const checkedIndex = indexExpr.kind === nodeKind.IntegerExprNode &&
                    indexExpr.value >= dimension.lower && indexExpr.value <= dimension.upper
                    ? this.module.i32.const(indexExpr.value - dimension.lower)
                    : this.checkedIndex(this.generateExpression(indexExpr),
                        dimension.lower, dimension.upper, node.source?.line || 0,
                        (node.source?.startColumn ?? -1) + 1);
                index = this.module.i32.add(
                    index,
                    // and then multiple the index to the section
                    this.module.i32.mul(
                        checkedIndex,
                        this.generateConstant(binaryen.i32, section)
                    )
                )
            }
            const basePointer = this.load(rValType, base);
            const checkedBase = rValType.kind === typeKind.POINTER
                ? this.checkedPointer(basePointer, rValType.dimensions.reduce(
                    (length, dimension) => length * (dimension.upper - dimension.lower + 1),
                    elemType.size()), node.source?.line || 0, (node.source?.startColumn ?? -1) + 1)
                : basePointer;
            const ptr = this.module.i32.add(
                checkedBase,
                this.module.i32.mul(
                    index,
                    this.generateConstant(binaryen.i32, elemType.size())
                )
            );
            // checkedBase covers the entire declared pointer view; each index
            // is range-checked and the statically bounded offset lies inside it.
            // A second check on the final element address is therefore redundant.
            return ptr;
        }
        throw new Error("Internal compiler error: non-indexable value reached Wasm lowering");
    }

    public selectExpression(node: SelectExprNode): ExpressionRef {
        const rVal = node.expr.type;
        if (rVal.kind !== typeKind.RECORD) {
            throw new Error("Internal compiler error: non-record selection reached Wasm lowering");
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
        // closures and function pointers are not supported
        throw new Error("Internal compiler error: indirect function call reached Wasm lowering");
    }

    private callProcedureExpression(node: CallProcExprNode): ExpressionRef {
        if (node.callee.kind === nodeKind.VarExprNode) {
            const procName = node.callee.ident.lexeme;
            const procArgs = new Array<ExpressionRef>();

            for (let i = 0; i < node.args.length; i++) {
                const arg = node.args[i];
                const mode = Array.from(this.curScope.lookUpProc(procName).paramModes.values())[i];
                procArgs.push(mode === passType.BYREF ? this.generateAddr(arg) : this.generateExpression(arg));
            }
            return this.module.call(procName, procArgs, binaryen.none);
        }
        // FIXME: The complicated call possibilities are not supported (calling a complex expression)
        // closures and function pointers are not supported
        throw new Error("Internal compiler error: indirect procedure call reached Wasm lowering");
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
            case tokenType.NOT:
                return this.module.i32.eq(this.generateExpression(node.expr), this.module.i32.const(0));
        }
        throw new Error("Internal compiler error: unsupported unary operator reached Wasm lowering");

    }

    // judge the expression type then perform the conversion and operation
    private binaryExpression(node: BinaryExprNode): ExpressionRef {
        const type = node.type;
        if (type.kind !== typeKind.BASIC) {
            throw new RuntimeError("Binary operations can only be performed on basic types");
        }

        let leftExpr = this.generateExpression(node.left);
        let rightExpr = this.generateExpression(node.right);
        // Wasm `if` evaluates only the selected branch, so side effects on the
        // right of AND/OR are skipped when the left determines the result.
        if (node.operator.type === tokenType.AND) {
            return this.module.if(leftExpr, rightExpr, this.module.i32.const(0));
        }
        if (node.operator.type === tokenType.OR) {
            return this.module.if(leftExpr, this.module.i32.const(1), rightExpr);
        }
        const operandType = node.left.type;
        if (operandType.kind === typeKind.BASIC && operandType.type === basicKind.REAL) {
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
            case tokenType.DIV:
                return this.module.i32.div_s(leftExpr, rightExpr);
            case tokenType.MOD:
                return this.module.i32.rem_s(leftExpr, rightExpr);
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
        throw new Error("Internal compiler error: unsupported binary operator reached Wasm lowering");
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
        this.globalOffset += new TextEncoder().encode(node.value).length + 1;
        if (this.globalOffset > STACK_START) {
            throw new RuntimeError(`Global string data exceeds ${STACK_START} bytes of reserved space`)
                .at(node.source!);
        }
        // add this string to strings with type interface String Lol
        this.strings.push({ptr: this.generateConstant(binaryen.i32, stringIndex), value: node.value});
        return this.module.i32.const(stringIndex);
    }

    public boolExpression(node: BoolExprNode): ExpressionRef {
        return this.module.i32.const(node.value ? 1 : 0);
    }

    // Statements
    private generateBlock(statements: Array<Stmt>): ExpressionRef {
        return this.module.block(null, this.generateStatements(statements));
    }

    public generateStatements(statements: Array<Stmt>): Array<ExpressionRef> {
        const stmts = new Array<ExpressionRef>();
        for (const statement of statements) {
            if (statement.kind === nodeKind.FuncDefNode || statement.kind === nodeKind.ProcDefNode) {
                this.generateCallableDefinition(statement);
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
            case nodeKind.InputNode:
                return this.inputStatement(statement);
            case nodeKind.DeclNode:
                return this.declStatement(statement);
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
            case nodeKind.CaseNode:
                return this.caseStatement(statement);
            default:
                throw new Error("Internal compiler error: unknown statement reached Wasm lowering");
        }
    }

    private returnStatement(node: ReturnNode): ExpressionRef {
        const returnLocal = this.context.returnLocal;
        if (returnLocal === undefined) {
            throw new Error("Internal compiler error: RETURN outside a value-returning function");
        }
        const returnVal = this.generateExpression(node.expr);
        return this.module.block(null, [
            this.module.local.set(
                returnLocal,
                returnVal
            ),
            this.callableEpilogue(),
            this.module.return(
                this.module.local.get(
                    returnLocal,
                    node.expr.type.wasmType()
                )
            )
        ]);
    }

    private outputStatement(node: OutputNode): ExpressionRef {
        return this.module.block(null, node.exprs.map(expr => this.outputValue(expr)));
    }

    private outputValue(value: Expr): ExpressionRef {
        const type = value.type;
        if (type.kind !== typeKind.BASIC) {
            throw new RuntimeError("Output can only be performed on basic types");
        }

        const basicType: basicKind = type.type;
        const expr = this.generateExpression(value);

        switch (basicType) {
            case basicKind.INTEGER:
                return this.module.call("logInteger", [expr], binaryen.none);
            case basicKind.REAL:
                return this.module.call("logReal", [expr], binaryen.none);
            case basicKind.CHAR:
                return this.module.call("logChar", [expr], binaryen.none);
            case basicKind.STRING:
                return this.module.call("logString", [expr], binaryen.none);
            case basicKind.BOOLEAN:
                return this.module.call("logBoolean", [expr], binaryen.none);
        }

        throw new Error("Internal compiler error: unsupported OUTPUT type reached Wasm lowering");
    }

    private inputStatement(node: InputNode): ExpressionRef {
        const type = node.expr.type;
        if (type.kind !== typeKind.BASIC) {
            throw new RuntimeError("Input can only be performed on basic types");
        }

        const basicType: basicKind = type.type;
        const ptr = this.generateAddr(node.expr);

        switch (basicType) {
            case basicKind.INTEGER:
                return this.store(type, ptr, this.module.call("inputInteger", [], binaryen.i32));
            case basicKind.REAL:
                return this.store(type, ptr, this.module.call("inputReal", [], binaryen.f64));
            case basicKind.CHAR:
                return this.store(type, ptr, this.module.call("inputChar", [], binaryen.i32));
            case basicKind.STRING:
                return this.store(type, ptr, this.module.call("inputString", [
                    this.module.i32.const(node.source?.line || 0),
                    this.module.i32.const((node.source?.startColumn ?? -1) + 1)
                ], binaryen.i32));
            case basicKind.BOOLEAN:
                return this.store(type, ptr, this.module.call("inputBoolean", [], binaryen.i32));
        }
        
        throw new Error("Internal compiler error: unsupported INPUT type reached Wasm lowering");
    }

    // Local frame space is reserved once in the callable prologue, so a
    // declaration inside a loop cannot grow the stack on each iteration.
    private declStatement(node: DeclNode): ExpressionRef {
        const varName = node.ident.lexeme;
        // FIXME: only basic types supported
        const varType = node.type;
        try {
            this.addVar(varName, varType);
        } catch (error) {
            if (error instanceof RuntimeError) throw error.at(node.ident);
            throw error;
        }
        return this.module.block(null, []);
    }

    private typeDeclStatement(node: TypeDeclNode): ExpressionRef {
        // just a placeholder for ExpressionRef
        // TODO: maybe remove later
        return this.module.block(null, []);
    }

    private pointerDeclStatement(node: PtrDeclNode): ExpressionRef {
        // just a placeholder for ExpressionRef
        // TODO: maybe remove later
        return this.module.block(null, []);
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

        const init = this.module.i32.store(0, 1, ptr, initExpr, "0");

        const statements = this.generateStatements(node.body);
        const variable = this.module.i32.load(0, 1, ptr, "0");

        const descending = node.step.kind === nodeKind.UnaryExprNode &&
            node.step.operator.type === tokenType.MINUS;
        const condition = descending
            ? this.module.i32.ge_s(variable, this.generateExpression(node.end))
            : this.module.i32.le_s(variable, this.generateExpression(node.end));
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

    private caseValue(token: {type: tokenType; literal: any}): number {
        if (token.type === tokenType.CHAR_CONST) return token.literal.charCodeAt(0);
        if (token.type === tokenType.TRUE) return 1;
        if (token.type === tokenType.FALSE) return 0;
        return token.literal;
    }

    private caseStatement(node: CaseNode): ExpressionRef {
        const real = node.type.kind === typeKind.BASIC && node.type.type === basicKind.REAL;
        const wasmType = real ? binaryen.f64 : binaryen.i32;
        const temp = real ? "__caseF64" : "__caseI32";
        const selector = this.readVariable(node.ident.lexeme, node.type);
        const current = () => this.module.global.get(temp, wasmType);
        const literal = (value: number) => real ? this.module.f64.const(value) : this.module.i32.const(value);
        let branch: ExpressionRef = node.otherwiseBody
            ? this.generateBlock(node.otherwiseBody) : this.module.block(null, []);
        for (let i = node.values.length - 1; i >= 0; i--) {
            const {from, to} = node.values[i];
            const lower = literal(this.caseValue(from));
            const condition = from === to
                ? (real ? this.module.f64.eq(current(), lower) : this.module.i32.eq(current(), lower))
                : this.module.i32.and(
                    real ? this.module.f64.ge(current(), lower) : this.module.i32.ge_s(current(), lower),
                    real ? this.module.f64.le(current(), literal(this.caseValue(to))) :
                        this.module.i32.le_s(current(), literal(this.caseValue(to)))
                );
            branch = this.module.if(condition, this.generateBlock(node.bodies[i]), branch);
        }
        return this.module.block(null, [this.module.global.set(temp, selector), branch]);
    }
}
