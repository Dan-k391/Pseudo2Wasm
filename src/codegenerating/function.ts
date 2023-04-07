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

// TODO: maybe new a common file to contain these
type Module = binaryen.Module;
type ExpressionRef = binaryen.ExpressionRef;
type Type = binaryen.Type;

export class Function {
    private module: Module;
    private functions: Map<string, Function>;
    private ident: string;
    // Params are initialized to a Map in the generator
    private params: Map<string, _Symbol>;
    // The only public variable
    public returnType: Type;
    private body: Array<Stmt>;
    // TODO: change the data structure here
    private locals: Map<string, _Symbol>;
    private label: number;

    constructor(module: Module, functions: Map<string, Function>, ident: string, params: Map<string, _Symbol>, returnType: Type, body: Array<Stmt>) {
        this.module = module;
        this.functions = functions;
        this.ident = ident;
        this.params = params;
        this.returnType = returnType;
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
        this.module.addFunction(this.ident, paramType, binaryen.f64, vars, funcBlock);
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

    private getSymbolForParam(name: string): _Symbol {
        if (!this.params.has(name)) {
            throw new RuntimeError("Symbol '" + name + "' is not declared");
        }

        return this.params.get(name) as _Symbol;
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

    // Expressions
    private generateExpression(expression: Expr): ExpressionRef {
        switch (expression.kind) {
            case nodeKind.VarAssignNode:
                return this.varAssignExpression(expression as VarAssignNode);
            case nodeKind.VarExprNode:
                return this.varExpression(expression as VarExprNode);
            case nodeKind.CallFunctionExprNode:
                return this.callExpression(expression as CallFunctionExprNode);
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
        const varIndex = this.getSymbolForLocal(node.ident.lexeme).index;
        return this.module.local.set(varIndex, this.generateExpression(node.expr));
    }

    private varExpression(node: VarExprNode): ExpressionRef {
        const varIndex = this.getSymbolForLocal(node.ident.lexeme).index;
        const varType = this.getSymbolForLocal(node.ident.lexeme).type;
        return this.module.local.get(varIndex, varType);
    }

    private callExpression(node: CallFunctionExprNode): ExpressionRef {
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
                return this.module.f64.ge(this.generateExpression(node.left), this.generateExpression(node.right,));
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
    // private stringExpression(node: StringExprNode): ExpressionRef {
    //     const stringIndex = this.offset;
    //     this.offset += node.value.length + 1;
    //     console.log(new TextEncoder().encode(node.value + '\0'));
    //     this.module.setMemory(node.value.length + 1, node.value.length + 1, null, [{
    //         offset: stringIndex,
    //         data: new TextEncoder().encode(node.value + '\0'),
    //         passive: false,
    //     }], false);
    //     return this.module.i32.const(stringIndex);
    // }

    // Statements
    private generateBlock(statements: Array<Stmt>): ExpressionRef {
        return this.module.block(null, this.generateStatements(statements));
    }

    private generateStatements(statements: Array<Stmt>): Array<ExpressionRef> {
        const stmts = new Array<binaryen.ExpressionRef>();
        for (const statement of statements) {
            stmts.push(this.generateStatement(statement));
        }
        return stmts;
    }

    private generateStatement(statement: Stmt): ExpressionRef {
        switch (statement.kind) {
            case nodeKind.ExprStmtNode:
                return this.generateExpression((statement as ExprStmtNode).expr);
            case nodeKind.ReturnNode:
                return this.returnStatement(statement as ReturnNode);
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

    private returnStatement(node: ReturnNode): ExpressionRef {
        return this.module.return(this.generateExpression(node.expr));
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

        const init = this.module.local.set(this.getSymbolForLocal(varName).index, this.generateExpression(node.start));

        const statements = this.generateStatements(node.body);
        const condition = this.module.f64.ge(this.generateExpression(node.end), this.module.local.get(varIndex, varType));
        const step = this.module.local.set(varIndex, this.module.f64.add(this.module.local.get(varIndex, varType), this.generateExpression(node.step)));
        statements.push(step);
        statements.push(this.module.br((++this.label).toString()));
        return this.module.block(null, [init, this.module.loop(this.label.toString(), this.module.if(condition, this.module.block(null, statements)))]);
    }
}