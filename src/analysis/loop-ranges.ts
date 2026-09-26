import { Expr, ForNode, nodeKind } from "../syntax/ast";
import { tokenType } from "../lex/token";
import { walkStatements } from "../syntax/walk";
import { typeKind } from "../type/type";

export interface IntegerRange { lower: number; upper: number }

function integer(node: Expr): number | undefined {
    if (node.kind === nodeKind.IntegerExprNode) return node.value;
    if (node.kind === nodeKind.UnaryExprNode && node.operator.type === tokenType.MINUS &&
        node.expr.kind === nodeKind.IntegerExprNode) return -node.expr.value;
    return undefined;
}

/** Sufficient proof, not speculative range inference. Unknown effects reject it. */
export function proveLoopRange(node: ForNode): IntegerRange | undefined {
    const start = integer(node.start), end = integer(node.end), step = integer(node.step);
    if (start === undefined || end === undefined || step === undefined || step === 0) return;
    if (![start, end, step].every(value => Number.isInteger(value) && value >= -2147483648 && value <= 2147483647)) return;
    if (step > 0 ? start > end : start < end) return;
    // The final increment must not wrap back into the loop's range.
    if (end + step < -2147483648 || end + step > 2147483647) return;
    let stable = true;
    walkStatements(node.body, {
        statement(stmt) {
            if (stmt.kind === nodeKind.ForNode && stmt.ident.lexeme === node.ident.lexeme) stable = false;
            if (stmt.kind === nodeKind.InputNode && stmt.expr.kind === nodeKind.VarExprNode &&
                stmt.expr.ident.lexeme === node.ident.lexeme) stable = false;
        },
        expression(expr) {
            if (expr.kind === nodeKind.CallFuncExprNode || expr.kind === nodeKind.CallProcExprNode ||
                expr.kind === nodeKind.DerefExprNode || expr.kind === nodeKind.AddrExprNode) stable = false;
            if (expr.kind === nodeKind.IndexExprNode && expr.expr.type.kind === typeKind.POINTER) stable = false;
            if (expr.kind === nodeKind.AssignNode && expr.left.kind === nodeKind.VarExprNode &&
                expr.left.ident.lexeme === node.ident.lexeme) stable = false;
        },
    });
    return stable ? { lower: Math.min(start, end), upper: Math.max(start, end) } : undefined;
}
