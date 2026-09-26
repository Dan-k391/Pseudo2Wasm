import { Expr, Stmt, nodeKind } from "./ast";

/** Read-only traversal of executable syntax. Never follows types or scope links. */
export interface SyntaxVisitor {
    statement?(node: Stmt): void;
    expression?(node: Expr): void;
}

function assertNever(node: never): never {
    throw new Error(`Internal compiler error: missing syntax traversal for ${node}`);
}

export function walkExpression(node: Expr, visitor: SyntaxVisitor): void {
    visitor.expression?.(node);
    switch (node.kind) {
        case nodeKind.AssignNode:
        case nodeKind.BinaryExprNode:
            walkExpression(node.left, visitor);
            walkExpression(node.right, visitor);
            return;
        case nodeKind.CastExprNode:
        case nodeKind.UnaryExprNode:
        case nodeKind.SelectExprNode:
            walkExpression(node.expr, visitor);
            return;
        case nodeKind.IndexExprNode:
            walkExpression(node.expr, visitor);
            node.indexes.forEach(index => walkExpression(index, visitor));
            return;
        case nodeKind.CallFuncExprNode:
        case nodeKind.CallProcExprNode:
            // Callee names are not variable reads in the current language.
            node.args.forEach(arg => walkExpression(arg, visitor));
            return;
        case nodeKind.AddrExprNode:
        case nodeKind.DerefExprNode:
            walkExpression(node.lVal, visitor);
            return;
        case nodeKind.VarExprNode:
        case nodeKind.IntegerExprNode:
        case nodeKind.RealExprNode:
        case nodeKind.CharExprNode:
        case nodeKind.StringExprNode:
        case nodeKind.BoolExprNode:
            return;
        default:
            return assertNever(node);
    }
}

export function walkStatements(nodes: ReadonlyArray<Stmt>, visitor: SyntaxVisitor): void {
    for (const node of nodes) {
        visitor.statement?.(node);
        switch (node.kind) {
            case nodeKind.ProgramNode:
            case nodeKind.FuncDefNode:
            case nodeKind.ProcDefNode:
                walkStatements(node.body, visitor);
                break;
            case nodeKind.ReturnNode:
            case nodeKind.ExprStmtNode:
            case nodeKind.InputNode:
                walkExpression(node.expr, visitor);
                break;
            case nodeKind.OutputNode:
                node.exprs.forEach(expr => walkExpression(expr, visitor));
                break;
            case nodeKind.IfNode:
                walkExpression(node.condition, visitor);
                walkStatements(node.body, visitor);
                walkStatements(node.elseBody ?? [], visitor);
                break;
            case nodeKind.WhileNode:
            case nodeKind.RepeatNode:
                walkExpression(node.condition, visitor);
                walkStatements(node.body, visitor);
                break;
            case nodeKind.ForNode:
                walkExpression(node.start, visitor);
                walkExpression(node.end, visitor);
                walkExpression(node.step, visitor);
                walkStatements(node.body, visitor);
                break;
            case nodeKind.CaseNode:
                node.bodies.forEach(body => walkStatements(body, visitor));
                walkStatements(node.otherwiseBody ?? [], visitor);
                break;
            case nodeKind.DeclNode:
            case nodeKind.PtrDeclNode:
            case nodeKind.TypeDeclNode:
                break;
            default:
                assertNever(node);
        }
    }
}
